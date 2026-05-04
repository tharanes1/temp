# Notifications + Push Slice — Implementation Document

> **Slice:** Inbox notifications, system alerts, FCM/APNs push registration
> **Endpoints:** `GET /api/v1/notifications` · `PATCH /api/v1/notifications/:id/read` · `PATCH /api/v1/notifications/read-all` · `GET /api/v1/notifications/alerts` · `POST /api/v1/notifications/fcm-token` · `POST /api/v1/admin/alerts`
> **Date:** 2026-05-01

---

## 1. Feature Overview

Closes review §6.2 #12 (`expo-notifications` declared in `package.json` but never imported anywhere — no FCM token registration code existed) and §3.6 (`NotificationsScreen` and `AlertsScreen` were 8-row + 6-row hardcoded fixtures).

After this slice:
- The notifications inbox (`NotificationsScreen`) is server-driven via `GET /api/v1/notifications`, with mark-as-read + mark-all + push-driven refresh.
- System alerts (`AlertsScreen`) come from `GET /api/v1/notifications/alerts` (60 s cached, polled, plus realtime via `emergency:alert` socket event).
- The rider app registers for FCM/APNs on every login + cold-start via `expo-notifications.getDevicePushTokenAsync()` and `POST /api/v1/notifications/fcm-token`.
- The notifications worker has a real dispatch shape for FCM (lazy-loads `firebase-admin` when `FCM_SERVICE_ACCOUNT_JSON` is set; logs structured stub lines otherwise) and inserts a Notification row + publishes for socket fan-out on `kind: 'in-app'` jobs.
- Admin can broadcast a system alert via the token-gated `POST /api/v1/admin/alerts` endpoint.

A new `SystemAlert` Prisma model carries the broadcast inventory (severity, title, body, optional city scope, expiry).

## 2. API Specification

### 2.1 `GET /api/v1/notifications`

| | |
|---|---|
| Auth | Bearer access token |
| Query | `?page=1&limit=20&unreadOnly=false` |

**Response 200** (paginated envelope):
```json
{
  "success": true,
  "data": [
    {
      "id": "ntf_...",
      "type": "order_assigned",
      "title": "New Delivery Request",
      "body": "₹45.00 — 3.8km — MG Road to Koramangala",
      "isRead": false,
      "createdAt": "2026-05-01T10:30:00.000Z",
      "metadata": { "orderId": "01930b..." }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 142, "totalPages": 8, "hasNext": true, "hasPrev": false }
}
```

### 2.2 `PATCH /api/v1/notifications/:id/read`
Marks a single notification as read.  Idempotent (no-op when already read).
Returns `{ success: true, data: { count: 0|1 } }`.

### 2.3 `PATCH /api/v1/notifications/read-all`
Bulk mark-all-as-read for the rider.  Returns `{ count }`.

### 2.4 `GET /api/v1/notifications/alerts`

| | |
|---|---|
| Auth | Bearer access token |
| Query | `?city=bengaluru` (optional; null = global only) |
| Cache | Redis 60s (`cravix:cache:alerts:{city|global}`) |

**Response 200**:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "severity": "warning",
      "title": "Heavy Rain Alert",
      "body": "Extra ₹10 surge active in Indiranagar and HSR Layout",
      "expiresAt": "2026-05-01T20:00:00.000Z",
      "city": null
    }
  ]
}
```

The repository query selects `WHERE isActive=true AND expiresAt > now() AND (city IS NULL OR city = $city)` so a city query naturally subsumes global alerts.

### 2.5 `POST /api/v1/notifications/fcm-token`

```json
{ "fcmToken": "dGhpcyBpcyBhIHRlc3Q...", "platform": "android", "appVersion": "1.0.0" }
```

Service:
1. Upsert `FcmToken` by token uniqueness (re-binds to current rider if a token gets re-used after device hand-off).
2. Mirror to Redis at `cravix:rider:fcm:{riderId}` with 30-day TTL — workers read this for fast dispatch.
3. Return `{ registered: true, tokenId }`.

### 2.6 `POST /api/v1/admin/alerts` (token-gated)

Reuses the `adminAuth` middleware from the orders slice. Body:
```json
{
  "severity": "warning",
  "title": "Heavy Rain Alert",
  "body": "Extra ₹10 surge active in Indiranagar and HSR Layout",
  "city": "bengaluru",
  "expiresAt": "2026-05-01T20:00:00.000Z"
}
```

Service:
1. Inserts the `SystemAlert` row.
2. `redis.del` invalidates the cached alerts list for the targeted scope (city + global).
3. Publishes `cravix:events:alert:broadcast` — the socket-gateway subscriber (added in this slice) re-emits as `emergency:alert` to the admin room and broadcasts to connected riders.

## 3. Worker + Socket Pub/Sub

### 3.1 `notifications` BullMQ worker

Three job kinds (defined in `@cravix/shared-queue`):

| `kind` | Implementation |
|---|---|
| `sms-otp` | MSG91 (stub today) — used by the auth slice for OTP delivery. |
| `fcm-push` | Reads `cravix:rider:fcm:{riderId}` from Redis; dispatches to FCM via lazy-loaded `firebase-admin`. Without creds, logs a structured `[fcm:stub]` line so wiring is testable. |
| `in-app` | INSERT Notification row + publish to `cravix:events:notification:push` for cross-instance socket fan-out. |

### 3.2 Socket-gateway subscribers (new `subscribers/notifications.ts`)

| Channel | Re-emits as |
|---|---|
| `cravix:events:notification:push` | `notification:push` to `rider:{id}` room |
| `cravix:events:alert:broadcast` | `emergency:alert` to admin room + global broadcast |

The global broadcast is heavy at 80 K connected sockets (the dispatcher slice will replace it with per-rider FCM enqueues), but it's correct for v1 — alerts are infrequent (a few per city per day).

## 4. Frontend Integration

| Change | File | Notes |
|---|---|---|
| Typed service | `src/services/api/features/notifications.ts` (new) | All 5 endpoints; envelope-aware. |
| Inbox hook | `src/features/notifications/hooks/useNotifications.ts` (new) | Optimistic mark-read + rollback; re-pulls on `notification:push` socket event so the inbox stays in sync without us reconstructing rows from the event payload. |
| Alerts hook | `src/features/notifications/hooks/useAlerts.ts` (new) | 60s polling + realtime refresh on `emergency:alert`. |
| Push registration | `src/services/notifications/push.ts` (new) | Configures Android channel, requests iOS permissions, gets the native token via `Notifications.getDevicePushTokenAsync()`, POSTs to `/notifications/fcm-token`. Idempotent across calls. |
| Auth lifecycle hook-in | `src/features/auth/state/authStore.ts` | `setAuth` and `initialize` now call `registerForPushNotifications()` (fire-and-forget). |
| NotificationsScreen rewired | `src/features/notifications/screens/NotificationsScreen.tsx` | 8-row `NOTIFICATIONS_DATA` removed; renders `useNotifications().items`. Mark-as-read on tap + bulk "MARK READ" in the header. |
| AlertsScreen rewired | `src/features/notifications/screens/AlertsScreen.tsx` | 6-row `INITIAL_NOTIFICATIONS` removed; renders `useAlerts().alerts` projected to the existing `AppNotification` shape. |
| Package additions | `package.json` | `expo-device` (used by the push module to skip the simulator). |

## 5. Code Walkthrough

### 5.1 Cache key shape (`service.ts`)

```ts
const key = prefixKey(`cache:alerts:${city ?? 'global'}`);
```

Per-city cache prevents a Bengaluru alert from being served to Mumbai riders. The repository query joins both, but the cache is segmented so invalidation on alert creation only invalidates the right keys.

### 5.2 Optimistic mark-read (`useNotifications`)

```ts
setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
try { await notificationsService.markRead(id); }
catch { void refresh(); /* fallback: full reload */ }
```

Single failure path: on server error we don't show a toast; we just refetch so the UI converges with reality.

### 5.3 Push registration idempotency (`push.ts`)

`registerForPushNotifications` checks platform (skips web), requires `Device.isDevice` (skips simulators), requests permissions only when not granted, and short-circuits a second time within the same session (`_registered` flag). Token comparison happens server-side via `prisma.fcmToken.upsert`'s `where: { token }` uniqueness, so re-POSTing the same token is cheap.

### 5.4 FCM lazy-load (`workers/notifications.ts`)

```ts
let _firebase: { send: ... } | null = null;
async function getFirebaseSender() {
  if (_firebase) return _firebase;
  if (!Config.FCM_SERVICE_ACCOUNT_JSON) return null;
  // ... lazy import + cache ...
}
```

Two benefits: workers without FCM creds boot cleanly (no spurious "missing module" crashes), and the production binary doesn't load Firebase Admin until the first push job arrives.

## 6. Security Measures

| Measure | Implementation |
|---|---|
| All rider routes auth-guarded | `notificationsRouter.use(authMiddleware)`. |
| Admin alert endpoint token-gated | `adminAuth` middleware (timing-safe compare, reused from orders slice). |
| FCM token uniqueness re-binds to current rider | Prevents a stale device from continuing to receive a previous owner's pushes when the device is sold/transferred. |
| Notification ownership pinning | `markRead` / `markAllRead` queries pin `riderId`; another rider's id can't be supplied via path. |
| Cache invalidation on alert creation | Both city-scoped and global cache keys are cleared so freshly-issued alerts surface within the next 60 s for everyone. |
| Push payload PII-clean | The worker job carries only what's needed (title/body/data); the metadata field is redacted by the Winston PII filter before logging. |
| Strict Zod schemas | `.strict()` everywhere; FCM tokens length-bounded. |
| HTTPS only on the wire | Inherited from the gateway. |

## 7. How to Run

```bash
cd backend
pnpm docker:up
pnpm prisma:migrate     # adds SystemAlert model
pnpm dev                # api-gateway
pnpm dev:socket         # socket-gateway
pnpm dev:workers        # workers (notifications worker now real-shaped)
```

Smoke test:
```bash
ACCESS=...
ADMIN=$(grep ADMIN_API_TOKEN .env | cut -d= -f2)

# 1. List inbox (empty for a fresh rider)
curl -s "http://localhost:3000/api/v1/notifications" -H "Authorization: Bearer $ACCESS" | jq

# 2. Register a fake FCM token
curl -s -X POST http://localhost:3000/api/v1/notifications/fcm-token \
  -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
  -d '{"fcmToken":"AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG-HHHH-IIII-JJJJ-KKKK-LLLL","platform":"android"}' | jq

# 3. Issue a system alert as admin
curl -s -X POST http://localhost:3000/api/v1/admin/alerts \
  -H "X-Admin-Token: $ADMIN" -H 'Content-Type: application/json' \
  -d '{"severity":"warning","title":"Heavy Rain","body":"Surge ₹15 in Koramangala","city":"bengaluru"}' | jq

# 4. Read the alerts list — should include the freshly-created alert
curl -s "http://localhost:3000/api/v1/notifications/alerts?city=bengaluru" -H "Authorization: Bearer $ACCESS" | jq
```

## 8. Files Created / Modified

**Backend (created):**
```
backend/services/api-gateway/src/modules/notifications/
├── schemas.ts, types.ts, repository.ts, service.ts, controller.ts, routes.ts
backend/services/socket-gateway/src/subscribers/notifications.ts
backend/docs/notifications-slice/
├── IMPLEMENTATION.md, SELF_REVIEW.md
```

**Backend (modified):**
- `prisma/schema.prisma` — adds `SystemAlert` model.
- `services/api-gateway/src/app.ts` — mounts `/api/v1/notifications` + `/api/v1/admin/alerts`.
- `services/socket-gateway/src/server.ts` — boots `startNotificationsSubscriber`.
- `services/workers/src/workers/notifications.ts` — real dispatch shape for `fcm-push`, `in-app`.

**Frontend (created):**
- `src/services/api/features/notifications.ts`
- `src/features/notifications/hooks/{useNotifications,useAlerts}.ts`
- `src/services/notifications/push.ts`

**Frontend (modified):**
- `src/features/auth/state/authStore.ts` — invokes `registerForPushNotifications` on login + cold-start.
- `src/features/notifications/screens/NotificationsScreen.tsx` — `NOTIFICATIONS_DATA` mock removed; server-driven.
- `src/features/notifications/screens/AlertsScreen.tsx` — `INITIAL_NOTIFICATIONS` mock removed; server-driven.
- `package.json` — adds `expo-device`.

## 9. Open Items Carried Forward

1. **Real Firebase Admin integration** — uncomment the `firebase-admin` import in `workers/notifications.ts` and add the package to the workers' `package.json` once the FCM service-account JSON is available.
2. **Per-city alert fan-out via FCM** — current alert broadcast hits `io.emit(...)` globally; replace with `queues.notifications.add('fcm-broadcast', ...)` once the dispatcher service can resolve city → riderIds efficiently.
3. **Admin auth promotion** — `adminAuth` is a token check today; the dashboard slice replaces it with proper OAuth + role-based authz.
4. **Alert dismiss / opt-out** — an "I've read this" interaction for system alerts (separate from the inbox mark-read) so the UI can hide acknowledged ones per-rider.
5. **iOS provisional permission flag** — currently we only consider full-grant as success; iOS provisional could surface notifications without an explicit prompt.
