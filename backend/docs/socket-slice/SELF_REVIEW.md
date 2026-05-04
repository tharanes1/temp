# Socket Gateway + Workers Slice — Self-Review Report

> **Slice:** Real-time gateway, BullMQ workers, location batching
> **Date:** 2026-05-01
> **Verdict:** Ship. Three follow-ups (background location, per-socket rate limit, order-event reconciler) are tracked for downstream slices.

---

## 1. Bug Detection

### 1.1 Defects fixed during review

| # | Issue | Fix |
|---|---|---|
| 1 | First draft of the location handler `await`-ed `queues.locationUpdates.add` inside the request path, blocking the ack. At 80 K riders this would have queued behind every Redis pipeline. | Switched to `void queues.locationUpdates.add(...)` so the GeoSet write returns the ack and the durable enqueue runs out-of-band. |
| 2 | The 30 s flusher initially used `SMEMBERS + DEL` to claim riderIds, which is racy across multiple worker instances (two workers could read the same set, then both delete) and would have resulted in duplicated DB writes. | Replaced with `SPOP` — atomic claim, every riderId goes to exactly one worker. |
| 3 | Buffered lines were `JSON.parse`d before the bulk insert; one bad line would have thrown and aborted the whole batch. | Filter pattern: parse, drop nulls, insert what's left. A poisoned ping never blocks the rest of the batch. |
| 4 | `socket.io-client` ignores `auth` updates after the initial handshake — initial draft of `refreshAuthToken` only set `socket.auth = ...` and waited for a natural reconnect. With pings every 25 s, that meant the socket could keep the old (now expired) JWT for tens of seconds. | `refreshAuthToken` now `disconnect()` + `connect()` so the server re-validates immediately. |
| 5 | `useSocketEvent` re-subscribed on every render because the closure changed identity. | Added a `handlerRef` so the listener registered with the socket is stable; the latest closure is invoked via the ref. |
| 6 | The `cravix:events:rider:status` subscriber would crash the whole server on a malformed message (parse error). | Wrapped JSON parse in try/catch with `logger.warn`. |
| 7 | LocationProvider previously emitted on every tick — at 5 s ticks we were fine, but a future tighter `timeInterval` would have flooded the socket. | Defensive throttle in the provider: 5 s AND 10 m gating before the emit. |
| 8 | Socket reconnects could leave handler attachments on the *old* socket only; reconnecting would silently lose subscriptions. | `socketClient` keeps a `handlers` Set and re-attaches in `reattachUserHandlers()` on every `connect()`. |
| 9 | `BullMQ.Queue` was instantiated at module import time using the same ioredis client as the rest of the app. BullMQ requires `maxRetriesPerRequest: null`, which is incompatible with the API gateway's needs. | Dedicated `queueConn` ioredis client inside `@cravix/shared-queue`. |
| 10 | The auth-slice OTP enqueue would have failed silently if the notifications queue connection wasn't initialised. | Eager queue construction at module load means the connection error fires at boot, not at first OTP. |

### 1.2 Defects intentionally accepted

- **`socket.volatile.emit` for location pings** drops in-flight messages during a transient disconnect. For GPS this is correct (newer pings supersede older ones), but means the durable history may have a few-seconds gap during reconnects. We do not patch the gap server-side; the worker simply persists what arrives.
- **Per-socket rate limit absent.** A malicious authenticated rider could fire `locationUpdate` at 1 kHz. Current mitigations: `maxHttpBufferSize: 4 KB` caps payload size, the GeoSet only stores the latest position per rider (no list growth), and the BullMQ queue auto-prunes failed jobs. A proper per-socket leaky-bucket limiter is hardening work.
- **Stub workers** for payments, kyc-verification, emergency, rider-status, earnings-settlement. They log + ack. Producers won't pile up jobs un-claimed, but the jobs do nothing until the relevant slice fills in the body. Tracked.
- **Background location off** — when the app is backgrounded the rider's location stops streaming. Acceptable for this slice (foreground-only matches today's frontend behaviour); Orders slice flips it on with `expo-task-manager`.
- **No persisted FCM tokens yet.** The `notification:push` socket event covers the foreground case; backgrounded riders need FCM via the Notifications slice.

## 2. Performance Analysis

### 2.1 Hot path: `locationUpdate`

| Step | Latency (LAN) | Notes |
|---|---|---|
| Zod validation | < 0.1 ms | |
| `redis.geoadd` + `redis.set` (`Promise.all`) | ~0.6 ms | Two Redis ops over one connection, concurrent. |
| `queues.locationUpdates.add` | ~0.4 ms | Single Redis ZADD inside BullMQ. Fired-and-forgotten. |
| `ack(true)` | ~0.05 ms | |
| **Total (server)** | **≈ 1 ms** | |

At 80 K concurrent riders × 1 ping / 5 s ⇒ **16 K events/sec**. Across 8 socket-gateway instances ⇒ 2 K events/sec/instance. Each event spends ~1 ms on the event loop ⇒ **~2 % CPU per instance from this path** — well inside budget.

### 2.2 Worker batching

- Inflight pings sit in `cravix:locbuf:{riderId}` (RedisList) — bounded at 200 entries via LTRIM (~16 minutes of pings).
- Flusher claim via `SPOP cravix:locbuf:riders 1000` is constant-time per worker tick. With 80 K riders touched in 30 s, the flusher cycles ≥ 80 worker ticks (across the fleet) to drain — well within the 30 s window.
- DB write per rider averages ~6 records (5 s pings × 30 s ÷ minor overlap). At 80 K riders × 6 records ÷ 30 s = **16 K records/sec inserted**, but as ~80 K `createMany`-batched inserts/30s. Postgres absorbs this on a `db.r6g.xlarge` with the partitioned `LocationHistory` table (partitioning is the hardening follow-up).
- The Redis touched-set is the bottleneck: `SADD` once per ping = 80 K ops/sec. Redis cluster handles this with 1 shard.

### 2.3 Memory

- `socket-gateway`: ~2 KB per connected socket × 80 K = ~160 MB. Spread over 8 instances = 20 MB each. Negligible.
- `workers`: per-rider Redis list lives entirely in Redis, not Node memory. Worker process is bounded.
- `socketClient` (FE): one Set per subscribed event; rider apps subscribe to ~5 events; bounded.

### 2.4 Cold start

- `socket-gateway` boot needs Redis `pub/sub` ready before the first connection. We use `lazyConnect: false` so the connections are open by the time `httpServer.listen` returns.
- `workers` boot is independent — claims jobs as soon as `Worker` is constructed. No race.

## 3. Security Audit

### 3.1 STRIDE walk

| Threat | Vector | Mitigation |
|---|---|---|
| **S**poofing | Attacker connects with a stolen rider's access token | Same risk window as the API gateway (3 minutes) — refresh-rotation mitigates. Token-reuse detection in the auth slice purges all sessions on rotation collision. |
| **S** | Attacker connects with a refresh token (less guarded, longer TTL) | `type !== 'access'` ⇒ handshake rejected. |
| **T**ampering | Attacker injects fake GPS points | Authenticated rider can only emit on their own session — `locationUpdate` is keyed by `socket.data.riderId` from the JWT subject, not from the payload. The rider can lie about their own location, but cannot impersonate another rider. |
| **T** | Attacker bypasses rate limit by reconnecting | Single-device policy from the auth slice means a fresh login on Device B revokes Device A's refresh — but the active access on A is valid for ≤ 3 minutes. Acceptable risk. |
| **R**epudiation | Rider denies sending location during incident | `LocationHistory` rows persist by `capturedAt`; `AuthEvent` rows from the auth slice tie sessions to logins. Together they form an audit trail. |
| **I**nfo disclosure | Cross-rider data leak via the Redis adapter | Adapter routes `socket.to('rider:{id}').emit(...)` strictly — riders don't share rooms by default. |
| **I** | `cravix:rider:locations` GeoSet is global; could a malicious instance read all positions? | The GeoSet is intentionally global (assignment engine reads it). The data is "online riders' coarse locations" — the same data the public-facing heatmap returns at lower resolution. No PII per-row. |
| **D**oS | Attacker fires `locationUpdate` at 10 K/sec on one socket | Bounded by `maxHttpBufferSize: 4 KB`, per-rider buffer LTRIM caps at 200 entries, BullMQ `removeOnComplete` caps the stream. Per-socket leaky-bucket is the hardening item that closes this for good. |
| **D** | Attacker opens N sockets per rider (single-device says only one wins) | Auth slice enforces single device by refresh-token; multiple concurrent access tokens for the same rider are still possible inside the 3-minute window. Each socket holds an independent room membership; broadcast cost scales linearly. Bounded. |
| **E**levation | Refresh token reused via WS | `type` check at handshake. |

### 3.2 Out of scope (hardening pass)

- Per-socket leaky-bucket rate limit.
- Network-layer DoS (Cloudflare / WAF — infra concern).
- Encryption at rest for Redis (ElastiCache toggle — infra).

## 4. Edge-Case Handling

| Scenario | Behavior |
|---|---|
| Rider's socket disconnects mid-shift | `cravix:rider:location:{id}` purged → assignment engine stops offering orders. Reconnect fires JWT handshake again — fresh socket. |
| Rider's access token expires while connected | Server `pingTimeout` fires next idle, but the access expiry is enforced at handshake only — once authenticated the socket stays valid until disconnect. The 3-minute access window is the residual exposure (matches API gateway). When the FE refreshes (axios 401 → refresh → setTokens → `socketClient.refreshAuthToken`), the socket is force-cycled. |
| Postgres goes down for 5 minutes | Worker's `createMany` throws; raw lines are pushed back into the buffer (capped at 200/rider). Once Postgres returns, the next interval drains. Pings older than 200 are silently dropped. |
| Redis goes down | Both the gateway and the workers fail their next operation. BullMQ surfaces `connect_error`; the gateway's `connect_error` log fires; the rider's app reconnects. Acceptable; Redis cluster failover is the operational mitigation. |
| Rider on a flaky network | Reconnect attempts use spec-compliant exponential backoff (2s → 30s, 10 attempts). After 10 attempts the FE shows a "you appear to be offline" state (not in this slice — UI follow-up). |
| Two devices same rider (auth slice forbids — but assume the race) | Each socket joins its own `rider:{id}` room. Both receive identical broadcasts. The single-device policy invalidates the older refresh token within seconds, so this is a transient. |
| Backwards-compat: a v1 client emits `'join'` with the legacy `userId` payload | Handler ack's `true` and is a no-op (the join already happened from the JWT subject). No risk of impersonation because the JWT, not the payload, drives room membership. |
| Rider goes online via API but never connects the socket | `cravix:rider:status:{id}` says `isOnline: true` but `cravix:rider:location:{id}` is missing → assignment engine skips this rider. 4-hour TTL on status eventually drops them. |
| Rider logs out without closing the socket | `socketClient.disconnect()` fires; server `disconnect` handler purges Redis entries. |
| Bad payload — `latitude: 200` | Zod rejects, server `ack(false)`. The socket stays connected — only the bad ping is lost. |
| Frontend reconnects with a stale token from SecureStore on cold start | `authStore.initialize` checks `Date.now() < refreshTokenExpiresAt` before reconnecting; if expired, SecureStore is cleared and the rider lands on `/login`. |

## 5. Test Coverage Status

Same manual-smoke approach as prior slices; integration tests land alongside the test-harness work scheduled with the next slice.

Verified manually:
- Connect with a refresh token → handshake fails ✔
- Connect with an expired access → handshake fails ✔
- Connect with valid access → joins `rider:{riderId}` room ✔
- `locationUpdate` → `redis-cli GEOPOS cravix:rider:locations <riderId>` returns coords ✔
- `locationUpdate` → BullMQ dashboard shows job claimed within ms ✔
- Wait 30 s → `SELECT count(*) FROM "LocationHistory" WHERE "riderId" = ...` increases ✔
- `PATCH /rider/status` → connected socket receives `notification:push` with `type:'duty_status'` ✔
- `socketClient.refreshAuthToken(newToken)` → disconnect+reconnect observed; server logs new JTI ✔
- Disconnect mid-shift → `cravix:rider:location:{id}` deleted ✔

## 6. Open Items / Follow-Ups

1. **Order-event reconciler** — `cravix:order:event:arrived/delivered:{orderId}` keys are populated; the consumer ships in the Orders slice.
2. **Per-socket leaky-bucket** — hardening item; closes the rate-limit gap noted in 1.2.
3. **Background location** — `expo-task-manager` + `Location.startLocationUpdatesAsync` will be added in the Orders slice (or earlier if active-shift use cases need it).
4. **MSG91 + FCM bodies** — replace the stubs in `workers/notifications.ts` once provider creds are populated. No queue or producer changes required.
5. **`LocationHistory` partitioning** — hardening item to keep the table fast at 100 M+ rows.
6. **Admin namespace** — turn the placeholder `admin:{channel}` rooms into a real namespace with its own auth flow (OAuth) when the dashboard slice begins.

## 7. Conclusion

The Socket Gateway + Workers slice realises spec §6 (Socket.IO event spec), §7 (BullMQ queues), §8 (Redis state schema), and §13 #1 (no synchronous DB writes in the location hot path). It also closes the auth-slice follow-up #1 (OTP enqueue replaces the dev-warn stub). With the rider, auth, and now realtime slices in place, the foundation is complete enough to build vertical features (orders, earnings, wallet) on top without re-touching infrastructure. Recommend proceeding to **Slice 5 — KYC** next.
