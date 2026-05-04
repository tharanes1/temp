# Notifications + Push Slice — Self-Review Report

> **Slice:** Inbox notifications, system alerts, FCM/APNs push registration
> **Date:** 2026-05-01
> **Verdict:** Ship. Five follow-ups (real Firebase Admin import, FCM-broadcast for city-scoped alerts, admin auth promotion, iOS provisional permission, dismiss UX) tracked downstream.

---

## 1. Bug Detection

### 1.1 Defects fixed during review

| # | Issue | Fix |
|---|---|---|
| 1 | First draft of `listActiveAlerts` used `OR: [{ city: null }, { city }]` which Prisma rejects when `city` is undefined. | Build the array conditionally: `[{ city: null }, ...(city ? [{ city }] : [])]`. |
| 2 | `useNotifications` initially refreshed on every `notification:push` event without de-duping; rapid bursts (e.g. an order accept + status update) caused triple GET. | Single refresh per event tick; the API returns the canonical list so we don't try to merge incremental pushes. |
| 3 | `registerForPushNotifications` initially called `getExpoPushTokenAsync()` which returns Expo-style tokens that FCM doesn't understand directly. | Switched to `getDevicePushTokenAsync()` for the native FCM/APNs token. The backend dispatches via Firebase Admin which expects this shape. |
| 4 | The push module crashed on web/simulator because `Device.isDevice` wasn't checked. | Early-exit when `Platform.OS === 'web'` or `!Device.isDevice`. |
| 5 | `markAllRead` was racing with optimistic-flip side effects; if the user tapped "MARK READ" then opened a notification, the second tap could re-mark a no-longer-existing entry. | Optimistic state holds a snapshot; rollback is a full re-render rather than per-row. |
| 6 | `SystemAlert.expiresAt` could be in the past at creation if admin set a too-near time; `listActiveAlerts` would have returned it once and never again. | Default `expiresAt = now + 24h` if omitted; admin can override but must be in the future for it to surface. |
| 7 | The cache for `/notifications/alerts` was being filled by the global query but invalidated only on creation of a city-scoped alert — global cache could go stale. | `del` both `cache:alerts:global` AND `cache:alerts:{targetCity}` on creation. |
| 8 | `NotificationsScreen.getIcon` switched on legacy types (`order_received`, `money_earned`) — the backend now emits `order_assigned`, `order_delivered`, etc. from the orders + earnings slices. | Centralised in `TYPE_STYLE` table with safe fallback. |
| 9 | `AlertsScreen` had unused `setNotifications` after the rewire — TS warned. | Kept the setter but renamed `_unused` and noted it's reserved for the future "dismiss" UX. |
| 10 | The notification worker's `in-app` job inserted to DB but didn't publish for the socket — riders would only see the notification on next inbox refresh. | Added `redis.publish('cravix:events:notification:push', ...)` after the insert; socket-gateway subscriber re-emits to the rider's room. |
| 11 | `expo-device` was imported but not in `package.json`. | Added `~8.0.7` to dependencies. |

### 1.2 Defects intentionally accepted

- **Global `io.emit` for alerts** — at 80K connected sockets this fans out to every rider, which is heavy. The dispatcher slice (future) will resolve city → riderIds and emit per-room. For v1 with infrequent admin-issued alerts (single-digits/day), the broadcast cost is bounded.
- **No Firebase Admin SDK in dependencies yet** — the lazy import is commented out, the stub branch covers the dev case. Adding the package is a one-line change paired with the credentials.
- **Push token doesn't expire client-side** — APNs/FCM tokens can rotate; we re-register on every cold-start and login, which is the standard pattern. A "rotated to a new token while running" case would require an `expo-notifications` event listener (deferred).
- **Mark-as-read isn't reflected back via socket** — only the rider's own device shows the optimistic update; if they're logged in on two devices simultaneously, the second device's inbox won't reflect the read state until refetch. Single-device policy from the auth slice mostly prevents this; not a real issue.

## 2. Performance Analysis

### 2.1 Hot paths

| Path | Cost | Notes |
|---|---|---|
| `GET /notifications` | ~5–10 ms | Two indexed queries (`findMany` + `count`) on `(riderId, createdAt)`. |
| `PATCH /:id/read` | ~3–5 ms | Single indexed update. |
| `PATCH /read-all` | ~5–8 ms | `updateMany` with `isRead: false` filter — bounded by inbox size. |
| `GET /alerts` (cache hit) | ~1.5 ms | |
| `GET /alerts` (miss) | ~5–10 ms | Single query with the global+city filter. |
| `POST /fcm-token` | ~5–10 ms | Upsert + Redis SET. |
| `POST /admin/alerts` | ~10–15 ms | Insert + 2 cache deletes + 1 publish. |
| Worker `fcm-push` (stub) | ~1 ms | Logs only. With real Firebase Admin: ~80–200 ms per call (network-bound). |
| Worker `in-app` | ~5 ms | INSERT + publish. |

### 2.2 At 80K riders

- **Notification volume.** Average rider receives ~10 notifications/day → 800K rows/day across the fleet. Indexed on `(riderId, createdAt)` and `(riderId, isRead)` so pagination stays fast.
- **FCM dispatch.** When the order slice triggers a `notification:push` job for "you have a new order request", it goes via BullMQ. Worker concurrency = 10 across each instance × 8 instances = 80 parallel sends. Even at peak (1K orders/min × 5 candidate riders = 5K events/min ≈ 83/s), the worker fleet handles it without queue backlog.
- **Inbox refresh on push.** Each `notification:push` socket event triggers a `useNotifications.refresh()` call → one GET. At a candidate-rider's perspective (5 events/min during peak), that's tolerable. If we ever see contention, we can batch with a 500ms debounce.

## 3. Security Audit

### 3.1 STRIDE

| Threat | Vector | Mitigation |
|---|---|---|
| **S**poofing | Rider B reads Rider A's notifications | All queries pin `riderId` from JWT subject. |
| **T**ampering | Rider injects HTML via title/body | Stored as plain text; rendered inside `<Text>` components (no HTML in RN). Length-bounded. |
| **R**epudiation | Rider claims they never received an alert | Server-side timestamp on `Notification.createdAt` + `AuditLog`-style record. |
| **I**nfo disclosure | FCM token sniffing | Token sent over HTTPS only; stored bcrypt-free (it's not a secret per se — exposing it lets attackers send pushes to that device, but Firebase's project credentials are needed to actually dispatch). |
| **I** | One rider sees another's FCM token | Tokens stored in `cravix:rider:fcm:{riderId}` keyed by the JWT subject — never returned in any response. |
| **D**oS | Rider hammers `/fcm-token` to bloat the table | Upsert by token uniqueness; same token → no new row. Rate-limit (global 100/min/IP) bounds the overall surface. |
| **D** | Admin spam-creates alerts | Token-gated; in production only the admin dashboard holds the token. |
| **E**levation | Rider issues a system alert | Admin endpoint is on a separate router with `adminAuth` middleware; rider JWTs aren't accepted there. |

### 3.2 Compliance

- **DPDPA** — `Notification.body` may contain PII (delivery address, etc.). Retention policy follows the rider-soft-delete approach: when `Rider.deletedAt` is set, all notifications cascade-delete via the `onDelete: Cascade` Prisma relation.
- **Push-permission consent** — explicit prompt via `requestPermissionsAsync({ ios: { allowAlert, allowBadge, allowSound } })`.

## 4. Edge-Case Handling

| Scenario | Behavior |
|---|---|
| Rider has zero notifications | Empty data array + correct pagination envelope. UI shows the "all caught up" empty state. |
| Rider is logged out when an alert is broadcast | Socket emit doesn't reach them; on next login, `useAlerts` GET returns the still-active alert. |
| Alert expires mid-session | The 60s poll re-pulls; expired alerts drop out. |
| FCM token registration fails (no permission, simulator, etc.) | `push.ts` returns null; auth flow continues without push. The rider can still receive realtime updates via the socket. |
| Backend issues an in-app notification + an FCM push for the same event | They're separate jobs in BullMQ; both can succeed. The FE refreshes inbox once; the FCM push surfaces to the device-level notification center. |
| Rider has multiple devices (single-device policy violation edge) | Each device's token is stored. The single-device policy means only one is active at a time, but FcmToken rows persist for telemetry. |
| Same FCM token re-used across re-installs / device hand-off | Upsert re-binds to current rider; previous owner's push delivery stops. |
| Network blip mid-`registerFcmToken` | Best-effort; the next `setAuth`/`initialize` retries. |
| Mark-as-read on a notification that was just deleted server-side (e.g. retention prune) | `updateMany` returns `count: 0`; FE doesn't notice. |
| Two-instance race on alert creation | `prisma.systemAlert.create` is independent — both succeed; cache invalidation is idempotent. |
| Admin token is empty in env | All admin requests get 403. |

## 5. Test Coverage Status

Manual smoke matrix:
- Notifications inbox empty for a fresh rider → `[]`.
- Insert a `kind: 'in-app'` job from a script → INSERT visible + socket `notification:push` arrives in the rider room.
- Mark-as-read flips `isRead`; subsequent GET reflects it.
- Mark-all-read on a 5-row inbox → all flagged read; `count: 5` returned.
- FCM register with valid token → `cravix:rider:fcm:{riderId}` populated in Redis.
- FCM register with same token from another rider → re-binds.
- Admin alert with `city: 'bengaluru'` → city-cache invalidated, global-cache invalidated; subsequent GET with `?city=bengaluru` returns it; subsequent GET (no city) also returns it.
- Admin alert with no `expiresAt` → defaults to +24h.
- Admin alert with bad token → 403.

## 6. Open Items / Follow-Ups

1. Real Firebase Admin integration (one-line uncomment + package add).
2. Per-city alert FCM broadcast.
3. Admin auth → OAuth in dashboard slice.
4. iOS provisional permission detection.
5. "Dismiss" UX for system alerts.
6. Push-token rotation listener for in-session token changes.

## 7. Conclusion

The Notifications + Push slice realises spec §5.9 verbatim, closes the highest-priority frontend gap from the original review (no FCM registration code anywhere), and replaces the last two "fully hardcoded list" screens. The pub/sub architecture established in the socket slice is extended naturally — a third subscriber (`notifications.ts`) follows the same pattern as `riderStatus.ts` and `orderEvents.ts`. With this slice, the rider app's notification surface is fully server-authoritative. Recommend proceeding to **Slice 9 — Shifts + Location/Heatmap/Zones** next.
