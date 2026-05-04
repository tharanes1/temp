# Socket Gateway + Workers Slice — Implementation Document

> **Slice:** Real-time gateway, BullMQ workers, location batching
> **Services added:** `services/socket-gateway/` (port 5000) · `services/workers/` (BullMQ consumers)
> **Package added:** `@cravix/shared-queue` (typed BullMQ producers + Socket.IO Redis adapter)
> **Date:** 2026-05-01

---

## 1. Feature Overview

This slice activates the realtime layer the spec requires for 80 K concurrent riders. Three things ship together because they only make sense as a unit:

1. **`@cravix/shared-queue`** — defines every BullMQ queue (`location-updates`, `notifications`, `payments`, `kyc-verification`, `emergency`, `rider-status`, `earnings-settlement`) with strongly-typed payloads, plus the Socket.IO Redis-adapter helper that stitches all 8 socket-gateway instances into one logical pub/sub bus (spec §2).

2. **`socket-gateway`** — a standalone Socket.IO server on port 5000, JWT-handshake-authenticated, that consumes `locationUpdate` / `rider:going-online|offline` / `order:arrived-at-hub` / `order:delivery-confirmed` from the rider app and exposes `order:new-request`, `notification:push`, `earnings:updated`, etc. to the rider app. The gateway never touches Postgres in the GPS hot path — it enqueues to BullMQ (spec §13 #1) and updates Redis state immediately so the assignment engine has sub-second resolution.

3. **`workers`** — the BullMQ consumer process. The flagship consumer is the `location-updates` worker, which buffers per-rider GPS pings into a Redis list and flushes them all to Postgres in a single `createMany` every 30 s — collapsing N pings/rider/30s into one DB write. Stub workers for the other six queues are wired in so producers can publish jobs today; their full bodies arrive in the relevant slices.

It also closes one of the auth-slice follow-ups: OTP SMS dispatch is no longer a `console.warn` stub; the auth service now `queues.notifications.add('sms-otp', ...)` so the (today) stub notifications worker logs the OTP — and once MSG91 credentials are populated, only one method body has to change.

## 2. Packages & Services

### 2.1 `@cravix/shared-queue`

**`queues.ts`** — single source of truth for queue names + job-payload types, plus eager `Queue` instances on a dedicated ioredis connection (`maxRetriesPerRequest: null`, `enableReadyCheck: false` as BullMQ requires).

```ts
import { queues } from '@cravix/shared-queue';

await queues.notifications.add('sms-otp', { kind: 'sms-otp', phone, otp, ttlSec });
await queues.locationUpdates.add('ping', { riderId, latitude, longitude, capturedAt });
```

Job options follow spec defaults: `removeOnComplete` after 1 hour or 5 K jobs, `removeOnFail` after 24 h, three attempts with exponential 2 s backoff. Location-update jobs override `attempts: 1` because GPS pings are inherently fire-and-forget — a missed one is replaced by the next one in 5 s.

The `emergency` queue gets `priority: 1` per spec §7.

**`socket-adapter.ts`** — `buildRedisAdapter()` returns a `@socket.io/redis-adapter` wired to `redisPub` + `redisSub` from `@cravix/shared-redis`. Spec §2: without this, an event emitted on instance #1 never reaches a client connected to instance #8.

### 2.2 `socket-gateway`

```
services/socket-gateway/src/
├── index.ts                  # entrypoint with graceful shutdown
├── server.ts                 # Socket.IO bootstrap + Redis adapter
├── types.ts                  # ClientToServer / ServerToClient typed events
├── rooms.ts                  # `rider:{id}` and `admin:{channel}` builders
├── middleware/
│   └── auth.ts               # JWT handshake — rejects refresh tokens
├── events/
│   ├── location.ts           # locationUpdate → Redis GeoSet + BullMQ enqueue
│   ├── rider.ts              # going-online/offline → Redis hash + publish
│   └── order.ts              # arrived-at-hub / delivery-confirmed buffering
└── subscribers/
    └── riderStatus.ts        # consumes `cravix:events:rider:status` from API gateway
```

**Connection lifecycle.**

```
Client                       Nginx (ip_hash, ws upgrade)        socket-gateway
  │── connect ws ──▶            │── proxy ──▶                      │
  │   auth: { token }            │                                   │── jwt.verify ──┐
  │                              │                                   │◀───────── ok ──┘
  │                              │                                   │── socket.join('rider:{id}')
  │                              │                                   │── redis.set('cravix:socket:rider:{id}', socket.id, EX 1h)
  │                              │                                   │
  │── locationUpdate ────────────────────────────────────────────────│── geoadd + set rider:location key + queue.add()
  │                              │                                   │── ack(true)
```

**Redis writes per ping** (sub-millisecond on LAN):
1. `GEOADD cravix:rider:locations longitude latitude {riderId}` — assignment engine reads this with `GEOSEARCH`.
2. `SET cravix:rider:location:{id} '{lat,lng,heading,speed,ts}' EX 30` — 30 s TTL is the spec §8 freshness guarantee.

**On disconnect:** `DEL cravix:rider:location:{id}` so the assignment engine never offers an order to a rider whose socket has just dropped. The `cravix:socket:rider:{id}` pointer is also dropped.

### 2.3 `workers`

```
services/workers/src/
├── index.ts                  # graceful boot + shutdown of all workers
├── prisma.ts                 # PrismaClient singleton
└── workers/
    ├── location.ts           # batched GPS persistence
    ├── notifications.ts      # SMS / FCM / in-app dispatch (MSG91 stub)
    └── stubs.ts              # payments / kyc-verification / emergency / rider-status / earnings-settlement
```

**Location-batching algorithm** — keystone of the slice's scalability story:

1. Each `locationUpdate` job pushed by the socket gateway is `LPUSH`-ed onto `cravix:locbuf:{riderId}` and the riderId is `SADD`-ed to `cravix:locbuf:riders`. The list is `LTRIM`-med to 200 entries (~16 minutes of 5 s pings) so a network partition between worker and Postgres can't OOM Redis.
2. A 30 s `setInterval` calls `flushAll()`, which `SPOP`s up to 1 000 riders at once (atomic — multi-instance safe; only one worker claims each rider's batch) and then for each rider drains the buffer with `LRANGE` + `DEL`, parses, and emits a single `prisma.locationHistory.createMany({ data: records })`.
3. On Postgres failure, the raw lines are pushed back into the buffer (capped) and the riderId is re-added to the touched-set, so the next interval retries.

At 80 K concurrent riders sending one ping every 5 s, the worker fleet writes roughly 80 K × 6 = 480 K records to Postgres every 30 s — but in `createMany` batches sized by the per-rider buffer (≈ 6 records on average), which Postgres eats easily. Without batching, the same throughput would mean 16 K writes/sec — beyond a single Postgres node.

## 3. Frontend Integration

| Change | File | Notes |
|---|---|---|
| Typed socket client | `src/services/socket/socketClient.ts` (rewritten) | Reads `ENV.SOCKET_URL` (env-driven), sends JWT on handshake `auth.token`, exposes typed `on/off/once/refreshAuthToken`, single-instance singleton. Reconnect parameters match spec §6: 10 attempts, exp backoff 2 s → 30 s. |
| Auto connect/disconnect on auth | `src/features/auth/state/authStore.ts` | `setAuth` → `socketClient.connect(token)`, `setTokens` → `socketClient.refreshAuthToken(token)`, `logout` → `socketClient.disconnect()`, `initialize` → reconnect with rehydrated token. |
| Location streaming | `src/features/map/providers/LocationProvider.tsx` | `watchPositionAsync` callback now also calls `socketClient.emitLocationUpdate({...})`. Throttled at most 1 emit / 5 s OR 1 emit / 10 m, whichever comes first. Uses `socket.volatile.emit` so a backed-up socket simply drops the latest ping (correct for GPS — newer pings supersede older ones). |
| Subscription helper | `src/services/socket/useSocketEvent.ts` (new) | `useSocketEvent('order:new-request', handler)` for screens — auto-detach on unmount, ref-stable to prevent re-subscribe per render. |

The OtpScreen, useProfileData, and SettingsScreen flows already established in the auth slice now drive socket lifecycle automatically — no further wiring needed in those files.

## 4. Code Walkthrough

### 4.1 JWT handshake (`socket-gateway/src/middleware/auth.ts`)
- Reads `socket.handshake.auth.token` (or `Authorization: Bearer ...` as fallback for tools like postman).
- Verifies against `JWT_ACCESS_SECRET` then `JWT_ACCESS_SECRET_PREVIOUS` (rolling rotation supported, identical to API gateway).
- **Rejects refresh tokens** — `decoded.type !== 'access'` ⇒ `next(new Error('Authentication failed'))`. Refresh tokens never authenticate a socket; only access tokens do.
- Populates `socket.data.{ riderId, phone, jti }`.

### 4.2 `locationUpdate` validation (`events/location.ts`)
- Zod schema enforces lat/lng bounds, optional heading 0–359, speed ≤ 200 km/h, accuracy ≤ 10 km.
- Invalid pings are nack'd via the optional callback (`ack?.(false)`) — the rider stays connected; only the bad ping is dropped.
- Valid pings flow through the GeoSet + buffer + queue write described in §2.3.

### 4.3 Backend → frontend fan-out via Redis adapter
- API gateway publishes to `cravix:events:rider:status` from `PATCH /rider/status` (rider slice).
- Subscriber in `socket-gateway/subscribers/riderStatus.ts` re-emits as `notification:push` to the rider's personal room `rider:{id}` (so all of the rider's open tabs get the change) and to `admin:duty` (placeholder for the dashboard slice).
- Same channel can be reused for any cross-slice fan-out — that's the pattern.

### 4.4 OTP SMS now flows through BullMQ
The auth-slice `service.ts` was patched:
```ts
await queues.notifications.add(
  'sms-otp',
  { kind: 'sms-otp', phone, otp, ttlSec: Config.OTP_TTL_SECONDS },
  { attempts: 3, backoff: { type: 'exponential', delay: 2_000 } },
);
```
The notifications worker (today a stub) logs the OTP. When MSG91 credentials land, the `'sms-otp'` branch becomes a real HTTPS call.

### 4.5 Frontend throttle (`LocationProvider.tsx`)
- Cheap small-angle haversine — `dLat ≈ Δlat × 111 111`, `dLng ≈ Δlng × 111 111 × cos(lat)`.
- Emits only when both `≥ 5 s` since last emit AND `≥ 10 m` since last emitted position.
- Uses `socket.volatile.emit` so a transiently disconnected socket doesn't queue stale pings.

## 5. Security Measures

| Measure | Implementation |
|---|---|
| Mandatory JWT handshake | Every connection runs `io.use(authHandshake)` — no unauthenticated sockets exist. |
| Refresh tokens rejected at WS | `type !== 'access'` ⇒ handshake fails. Stolen refresh cannot stream GPS. |
| Per-socket data carries no PII beyond `riderId, phone, jti` | Used for room routing only. |
| `cors.origin` matches the API gateway | Mobile clients send no Origin (allowed); admin web origins must be in `ALLOWED_ORIGINS`. |
| `maxHttpBufferSize: 4 KB` | Caps DoS surface — location pings are tiny. |
| `pingTimeout: 20s, pingInterval: 25s` | Detects half-open sockets and triggers `disconnect` ⇒ `cravix:rider:location:{id}` is purged. |
| Validation on every event payload | Zod schema for `locationUpdate`; field constraints on `order:*`. |
| Redis writes use `EX` TTL | `cravix:rider:location:{id}` 30 s, `cravix:socket:rider:{id}` 1 h, `cravix:order:event:*` 10 m — no unbounded keys. |
| BullMQ payloads scrubbed of PII in logs | Winston redactor strips `phone`, `otp`, `accessToken`, `refreshToken`. |
| Single-flight refresh on the client | Already in place from auth slice; cascades into `socketClient.refreshAuthToken()` for transparent token rotation. |

## 6. How to Run

```bash
cd backend

# Bring up the full stack — adds socket-gateway + workers
pnpm docker:up

# Logs
docker compose logs -f socket-gateway workers

# In a second shell, run the API + workers locally if you prefer hot reload:
pnpm dev               # api-gateway
pnpm dev:socket        # socket-gateway
pnpm dev:workers       # workers
```

Smoke test (after issuing tokens via the auth flow):

```bash
# 1. Open a websocket. The wscat one-liner that ships with `npm i -g wscat`:
wscat -c "ws://localhost:5000/socket.io/?EIO=4&transport=websocket" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 2. Stream a location update from any Socket.IO client and watch the worker log:
# (a) Redis: GEOADD on cravix:rider:locations should be visible via redis-cli MONITOR
# (b) BullMQ: bullmq-board (optional) shows the location-updates queue depth
# (c) Postgres: after 30s, SELECT count(*) FROM "LocationHistory" climbs

# 3. Toggle status from the API to see the cross-instance fan-out:
curl -X PATCH http://localhost:3000/api/v1/rider/status \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"isOnline":true}'
# The connected websocket should immediately receive a `notification:push` with type=duty_status.
```

## 7. Files Created / Modified

**Backend (created):**
```
backend/packages/shared-queue/{package.json,tsconfig.json,src/{queues,socket-adapter,index}.ts}
backend/services/socket-gateway/
├── package.json, tsconfig.json
├── src/{index,server,types,rooms}.ts
├── src/middleware/auth.ts
├── src/events/{location,rider,order}.ts
└── src/subscribers/riderStatus.ts
backend/services/workers/
├── package.json, tsconfig.json
├── src/{index,prisma}.ts
└── src/workers/{location,notifications,stubs}.ts
backend/infra/docker/socket-gateway.Dockerfile
backend/infra/docker/workers.Dockerfile
backend/docs/socket-slice/{IMPLEMENTATION,SELF_REVIEW}.md
```

**Backend (modified):**
- `services/api-gateway/package.json` — adds `@cravix/shared-queue`
- `services/api-gateway/src/modules/auth/service.ts` — OTP enqueue via BullMQ (replaces console.warn stub)
- `docker-compose.yml` — `socket-gateway` and `workers` services

**Frontend (modified):**
- `src/services/socket/socketClient.ts` — rewritten: env URL, JWT handshake, typed events, refreshAuthToken
- `src/services/socket/useSocketEvent.ts` — new hook
- `src/features/auth/state/authStore.ts` — connects/disconnects/refreshes the socket on auth events
- `src/features/map/providers/LocationProvider.tsx` — streams `locationUpdate` (throttled)

## 8. Open Items Carried Forward

- **MSG91 + FCM provider integration** — when credentials land, replace the stubs in `workers/notifications.ts`; no other code changes needed.
- **Admin namespace** — placeholder room `admin:{channel}` exists; the dispatcher dashboard slice gives it a real namespace and fronts it with a separate auth flow (likely OAuth, not OTP).
- **Background location** — `expo-location`'s `startLocationUpdatesAsync` + `expo-task-manager` is required for tracking when the app is backgrounded. Foreground-only today; deferred to the Orders slice when active deliveries demand it.
- **Order-event reconciler** — `cravix:order:event:arrived/delivered:{orderId}` is written by the gateway; the Orders slice will add the worker that consumes those keys against the canonical `PATCH /orders/:id/status`.
- **Per-rider DoS cap** — current global limits are `maxHttpBufferSize: 4 KB` and one socket per rider implicitly (single-device policy from auth slice). A per-socket "events per second" rate limit is a hardening item.
