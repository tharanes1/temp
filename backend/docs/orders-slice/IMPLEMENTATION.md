# Orders Slice — Implementation Document

> **Slice:** Order state machine, atomic 45-second accept claim, realtime offer flow
> **Endpoints:** `GET /api/v1/orders/active|history` · `POST /api/v1/orders/:id/{accept,reject,delivery-proof}` · `PATCH /api/v1/orders/:id/status` · `POST /api/v1/admin/orders/offer`
> **Date:** 2026-05-01

---

## 1. Feature Overview

This slice closes the largest "fake business logic" gap in the original review (§6.3 of `BACKEND_ALIGNMENT_REVIEW.md`): `OrdersScreen.seedMissions`, `HISTORY_MOCK`, the entire hardcoded `orderData` blob in `DeliveryRequestScreen`, and the `+0.003/+0.008` offset coords in `ActiveNavigationScreen`. After this slice, every screen that displays an order is server-driven and the 45-second offer→accept race is enforced atomically across all 8 instances.

It implements:
- **Order state machine** (PENDING → ASSIGNED → ACCEPTED → PICKED_UP → EN_ROUTE → ARRIVED → DELIVERED, plus FAILED/CANCELLED terminals) with strict transition validation in both Zod and the service layer.
- **Atomic 45-second claim** — `SET cravix:order:assigned:{orderId} {riderId} NX EX 3600` (spec §5.4 verbatim). The first instance to win the SET-NX takes the order; everyone else gets `409 ORDER_TAKEN`.
- **Pending-pool entry** with 45-second TTL — `cravix:order:pending:{orderId}` carries the offer payload so an accept after the timer naturally returns `409 ORDER_EXPIRED`.
- **Realtime offer fan-out** via Redis pub/sub on the existing socket-gateway adapter (slice 4 pattern).
- **Locked-A6 currency** — money is `Decimal(8,2)` rupees in DB (`baseEarnings`, `bonus`) and `number` rupees on the wire (no paise integers anywhere).
- **Admin offer endpoint** (`POST /api/v1/admin/orders/offer`, behind `X-Admin-Token`) — minimal stand-in for the future dispatcher service so the realtime flow can be tested end-to-end with curl.

## 2. API Specification

### 2.1 `GET /api/v1/orders/active`

| | |
|---|---|
| Auth | Bearer access token |

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": "01930b2e-...",
    "status": "picked_up",
    "hubName": "Local Fulfillment Center #042",
    "hubAddress": "Swish Dark Store, MG Road",
    "hubCoords": { "latitude": 12.9716, "longitude": 77.5946 },
    "deliveryAddress": "Skyline Residency, Block C",
    "destCoords": { "latitude": 12.985, "longitude": 77.61 },
    "specialInstructions": "Leave at front door and ring bell.",
    "distance": 3.8,
    "estimatedTime": "22m",
    "baseEarnings": 25.00,
    "longDistanceBonus": 15.50,
    "totalEarnings": 40.50,
    "items": [
      { "name": "Fresh Milk (1L)", "qty": 2, "icon": "cup-water" }
    ],
    "merchantRating": 4.8,
    "assignedAt": "2026-05-01T10:30:00.000Z",
    "acceptedAt": "2026-05-01T10:30:24.000Z",
    "pickedUpAt": "2026-05-01T10:45:00.000Z",
    "deliveredAt": null,
    "proofImageUrl": null
  }
}
```

When the rider has no active order, `data` is `null` (not 404 — the FE distinguishes "no order yet" from a transport error).

### 2.2 `GET /api/v1/orders/history`

Query: `?page=1&limit=20&status=delivered|failed|cancelled|all` (default `all`, max `limit=50`).

Returns the standard paginated envelope (spec §11):
```json
{
  "success": true,
  "data": [{ "id": "...", "status": "delivered", "hubName": "...", "totalEarnings": 40.50, ... }],
  "pagination": { "page": 1, "limit": 20, "total": 142, "totalPages": 8, "hasNext": true, "hasPrev": false }
}
```

### 2.3 `POST /api/v1/orders/:orderId/accept`

The atomic-claim endpoint. Service flow (spec §5.4):

1. `redis.get('cravix:order:pending:{orderId}')` — missing ⇒ `409 ORDER_EXPIRED`.
2. `redis.set('cravix:order:assigned:{orderId}', riderId, 'EX', 3600, 'NX')` — fails ⇒ `409 ORDER_TAKEN`.
3. `redis.del('cravix:order:pending:{orderId}')` — remove from pool atomically with the claim.
4. `prisma.order.update` — set `status=ACCEPTED`, `riderId`, `acceptedAt=now`.
5. `redis.publish('cravix:events:order:status', { orderId, riderId, status:'accepted' })` — admin dashboards subscribe to this.

On success returns the full `ActiveOrderDto` (so the FE doesn't need a follow-up GET).

### 2.4 `POST /api/v1/orders/:orderId/reject`

```json
{ "reason": "too_far", "note": "Beyond 8km radius" }
```

Reasons: `too_far | vehicle_issue | personal | other` (spec §5.4).

Behavior:
- Increments `cravix:order:rejects:{orderId}` (24 h TTL) so the dispatcher can decide when to give up on the order.
- Records the per-rider rejection at `cravix:order:rejects:{orderId}:{riderId}` so the dispatcher won't re-offer the same order to the same rider.
- Publishes `cravix:events:order:rejected` for the dispatch dashboard.
- The order **stays `PENDING`** — rejection isn't a state transition, it's a routing hint.

### 2.5 `PATCH /api/v1/orders/:orderId/status`

```json
{ "status": "picked_up", "timestamp": "2026-05-01T10:45:00.000Z" }
```

Rider-driven transitions only: `picked_up | en_route | arrived | delivered | failed`. Riders can't self-`accept` (the dedicated endpoint owns that), can't self-`assign`, and can't `cancel` (admin-only).

Strict state-machine in `canTransition()`:

| From | Allowed → |
|---|---|
| pending | assigned, cancelled |
| assigned | accepted, cancelled |
| accepted | picked_up, failed, cancelled |
| picked_up | en_route, failed |
| en_route | arrived, failed |
| arrived | delivered, failed |
| delivered, failed, cancelled | (terminal) |

Special rules:
- `delivered` requires `proofImageUrl` (or a previously-uploaded one on the order row) — otherwise `400 VALIDATION_ERROR` with `details:[{field:'proofImageUrl', message:'required'}]`.
- `failed` requires `failureReason` (Zod refine).
- All inbound `proofImageUrl` values run through `isCravixS3Url` for bucket allow-list validation.

Emits `cravix:events:order:status` after every successful transition.

### 2.6 `POST /api/v1/orders/:orderId/delivery-proof`

```json
{ "proofImageUrl": "https://cravix-cdn.s3.ap-south-1.amazonaws.com/orders/.../proof.jpg" }
```

Same allow-list validation. Doesn't transition the order on its own — pair it with a subsequent `PATCH /status` `delivered` call (or send `delivered` with `proofImageUrl` inline in one request).

### 2.7 `POST /api/v1/admin/orders/offer` (test driver)

Auth: `X-Admin-Token: <ADMIN_API_TOKEN env>` (timing-safe compare).

```json
{
  "riderId": "01930b2e-...",
  "hubName": "Local Fulfillment Center #042",
  "hubAddress": "Swish Dark Store, MG Road",
  "hubCoords": { "latitude": 12.9716, "longitude": 77.5946 },
  "deliveryAddress": "Skyline Residency, Block C",
  "destCoords": { "latitude": 12.985, "longitude": 77.61 },
  "distanceKm": 3.8,
  "estimatedTimeMin": 22,
  "baseEarnings": 25.0,
  "bonus": 15.5,
  "items": [{ "name": "Fresh Milk (1L)", "qty": 2, "icon": "cup-water" }],
  "specialInstructions": "Leave at front door.",
  "merchantRating": 4.8
}
```

Service:
1. Generate UUID v7 order id.
2. `prisma.order.create` with `status=PENDING`.
3. Build the `OrderRequestPayload` with `expiresIn: 45`.
4. `redis.set('cravix:order:pending:{id}', payload, 'EX', 45)`.
5. `prisma.order.update { status: ASSIGNED, riderId, assignedAt }` — pre-assigns to the requested rider.
6. `redis.publish('cravix:events:order:offer', { riderId, payload })` — socket-gateway re-emits as `order:new-request` to that rider's room.

This is **not** the real dispatcher — that needs a Redis-GeoSet candidate query, scoring, and re-offer logic. But it's enough to drive the FE flow end-to-end.

## 3. Realtime Fan-out

Channels published by the API gateway (consumed by the socket-gateway subscriber added in this slice):

| Channel | Payload | Re-emitted as |
|---|---|---|
| `cravix:events:order:offer` | `{ riderId, payload: OrderRequestPayload }` | `order:new-request` to `rider:{id}` |
| `cravix:events:order:status` | `{ orderId, riderId, status, at }` | `order:status-updated` to `rider:{id}` and `admin:orders` |
| `cravix:events:order:cancelled` | `{ orderId, riderId?, reason }` | `order:cancelled` to `rider:{id}` and `admin:orders` |
| `cravix:events:order:rejected` | `{ orderId, riderId, reason, at }` | `notification:push` to `admin:orders` (for dispatcher) |

The socket-gateway file `subscribers/orderEvents.ts` (new) follows the same pattern as `riderStatus.ts` from slice 4 — single `redisSub.on('message', …)` switch statement, JSON parse, room-targeted emit.

## 4. Frontend Integration

| Change | File | Notes |
|---|---|---|
| Typed orders service | `src/services/api/features/orders.ts` (rewritten) | All 6 endpoints + DTOs that mirror backend wire format. |
| `useActiveOrder` hook | `src/features/orders/hooks/useActiveOrder.ts` (new) | Loads `/orders/active`, re-pulls on `order:status-updated` and `order:cancelled` socket events, exposes `setStatus(next, opts)` + `submitProof(url)`. |
| `useOrderHistory` hook | `src/features/orders/hooks/useOrderHistory.ts` (new) | Paginated `/orders/history`. |
| `useDeliveryRequest` hook | `src/features/orders/hooks/useDeliveryRequest.ts` (new) | Subscribes to `order:new-request`, manages the 45-second countdown, exposes `accept()` and `reject(reason, note)`. |
| OrdersScreen rewired | `src/features/orders/screens/OrdersScreen.tsx` | Drops `seedMissions` (always-on fake) and `HISTORY_MOCK`; renders the active order tile from `useActiveOrder` and history rows from `useOrderHistory` (with empty-state copy). |
| DeliveryRequestScreen rewired | `src/features/orders/screens/DeliveryRequestScreen.tsx` | Drops the hardcoded `orderData` blob; the on-screen offer is the `liveOffer` from the hook. Accept calls `POST /orders/:id/accept`; on `409 ORDER_TAKEN` / `ORDER_EXPIRED` the FE routes to `/warning`. |
| ActiveNavigationScreen rewired | `src/features/orders/screens/ActiveNavigationScreen.tsx` | Map markers + polyline now use `activeOrder.hubCoords` and `destCoords` from `/orders/active` (replacing the offset-from-rider fakes). The "Arrived" button calls `setStatus()` walking through PICKED_UP → EN_ROUTE → ARRIVED. The DELIVERED transition is gated by the proof-photo capture screen, which is the next polish item. |

## 5. Code Walkthrough

### 5.1 Atomic 45-second claim (`service.ts`)

The implementation matches spec §5.4 line-for-line:

```ts
const pendingRaw = await redis.get(RedisKeys.orderPending(orderId));
if (!pendingRaw) throw new ConflictError('Order offer expired or already taken', 'ORDER_EXPIRED');

const won = await redis.set(
  RedisKeys.orderAssigned(orderId),
  riderId,
  'EX',
  3600,
  'NX',
);
if (won !== 'OK') throw new ConflictError('Order already taken by another rider', 'ORDER_TAKEN');

await redis.del(RedisKeys.orderPending(orderId));
await orderRepository.accept(orderId, riderId);
```

The two-step (pending check + NX-claim) is intentional — the pending-pool absence catches the "offer expired" case (which is a different error code than "another rider beat me to it") so the FE can show the right message.

### 5.2 State-machine validation (`schemas.ts`)

Two layers:
1. **Zod enum** on the inbound `status` field — only rider-driven transitions are listed in `RiderDrivenStatusEnum` (`picked_up | en_route | arrived | delivered | failed`). `pending`, `assigned`, `accepted`, and `cancelled` cannot be requested by the rider.
2. **`canTransition(from, to)` predicate** in the service — given the order's current DB status, only the legal next states are allowed. The transition map is exported from `schemas.ts` as the single source of truth.

### 5.3 Currency = decimals, never paise (locked A6)

`baseEarnings` and `bonus` are stored as `Prisma.Decimal(8,2)` and `Decimal(8,2)`. The projector reads them as `Number(o.baseEarnings)` (Prisma's Decimal-to-number coerces correctly inside the 0–999_999.99 range we care about) and ships them as `number` rupees in the JSON response. A small `(base + bonus).toFixed(2) → Number` round at the boundary keeps the response from showing `40.499999...` artifacts.

### 5.4 Rejection vs cancellation

The spec is silent on whether a rejection changes the order's status. The implementation deliberately keeps `status=PENDING` and only counts/records the rejection in Redis — that way the dispatcher can re-offer the order to the next-best rider without an extra `pending → pending` transition. Cancellation is a separate, terminal admin verb (not implemented in this slice; will land with the dispatcher service or admin dashboard).

### 5.5 Frontend hook composition

`useActiveOrder` and `useDeliveryRequest` are deliberately separate:
- `useDeliveryRequest` is for the **pre-acceptance** offer screen — it owns the 45-second countdown and the accept/reject buttons.
- `useActiveOrder` is for the **post-acceptance** journey — it re-fetches whenever a status event arrives and exposes the state-machine-driven `setStatus` helper.

A single hook would have leaked offer-only state into the journey screens and vice versa.

### 5.6 Socket subscriber pattern

`subscribers/orderEvents.ts` is a copy-paste of the proven `riderStatus.ts` shape from slice 4 — single `redisSub.subscribe` per channel at boot, single `redisSub.on('message', …)` switch on channel name. JSON parse is in a try/catch so a single bad message can't crash the gateway.

## 6. Security Measures

| Measure | Implementation |
|---|---|
| All rider routes auth-guarded | `orderRouter.use(authMiddleware)`. |
| Riders can only act on their own orders | `transition` and `setProof` queries include `where: { id, riderId }` — Prisma raises `RecordNotFound` (404) if the order isn't owned by the rider. The accept endpoint additionally enforces ownership via the atomic NX claim. |
| Strict body schemas | All `.strict()` — rider can't slip in `kycStatus`, `riderId`, `status='accepted'`, etc. |
| State-machine guard at TWO layers | Zod enum + `canTransition` predicate. Even if a future change loosens the Zod side, the service-level guard remains. |
| Proof URL allow-list | `isCravixS3Url` reused from KYC slice — pinned hosts only. |
| Admin endpoint requires `ADMIN_API_TOKEN` with timing-safe compare | `crypto.timingSafeEqual` — no length-leak side channel. Token absent = 403. |
| Single-flight refresh + JWT rotation | Inherited from auth slice — no rider can use a stale access token to claim an order. |
| Rejections capped per order via TTL | 24-hour TTL on `cravix:order:rejects:{orderId}` keeps the counter from leaking memory in Redis. |
| Pending-pool TTL is 45s, claim lock TTL is 1h | A rider whose claim succeeds but who then drops offline still owns the order for an hour, after which the lock auto-releases (admin can reassign without DB intervention). |

## 7. How to Run

```bash
cd backend

# Install
pnpm install

# Bring up infra + apply schema
pnpm docker:up
pnpm prisma:migrate

# Run the gateways + workers (3 separate terminals if not using docker compose)
pnpm dev               # api-gateway
pnpm dev:socket        # socket-gateway
pnpm dev:workers       # workers
```

End-to-end smoke (with the access token from the auth flow + the rider id from `/auth/verify` `data.user.id`):

```bash
ACCESS=...
RIDER_ID=...
ADMIN=$(grep ADMIN_API_TOKEN .env | cut -d= -f2)

# 1. Offer an order to the rider (admin endpoint)
ORDER_ID=$(curl -s -X POST http://localhost:3000/api/v1/admin/orders/offer \
  -H "X-Admin-Token: $ADMIN" -H 'Content-Type: application/json' \
  -d "{
    \"riderId\":\"$RIDER_ID\",
    \"hubName\":\"Hub 042\",\"hubAddress\":\"MG Road\",
    \"hubCoords\":{\"latitude\":12.9716,\"longitude\":77.5946},
    \"deliveryAddress\":\"Skyline Block C\",
    \"destCoords\":{\"latitude\":12.985,\"longitude\":77.61},
    \"distanceKm\":3.8,\"estimatedTimeMin\":22,
    \"baseEarnings\":25.00,\"bonus\":15.50,
    \"items\":[{\"name\":\"Fresh Milk\",\"qty\":2,\"icon\":\"cup-water\"}]
  }" | jq -r '.data.orderId')

# Watch the rider's connected socket — should receive `order:new-request` immediately.

# 2. Accept (within 45s)
curl -s -X POST "http://localhost:3000/api/v1/orders/$ORDER_ID/accept" \
  -H "Authorization: Bearer $ACCESS" | jq

# 3. Walk the state machine
for s in picked_up en_route arrived; do
  curl -s -X PATCH "http://localhost:3000/api/v1/orders/$ORDER_ID/status" \
    -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
    -d "{\"status\":\"$s\"}" | jq -r '.data.status'
done

# 4. Deliver with proof (the URL must be a cravix-* host; mock-mode FE upload returns one)
curl -s -X PATCH "http://localhost:3000/api/v1/orders/$ORDER_ID/status" \
  -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
  -d '{"status":"delivered","proofImageUrl":"https://cravix-cdn.s3.ap-south-1.amazonaws.com/orders/test/x.jpg"}' | jq

# 5. History
curl -s "http://localhost:3000/api/v1/orders/history?status=delivered&limit=5" \
  -H "Authorization: Bearer $ACCESS" | jq
```

## 8. Files Created / Modified

**Backend (created):**
```
backend/services/api-gateway/src/modules/orders/
├── schemas.ts
├── types.ts
├── repository.ts
├── service.ts
├── controller.ts
└── routes.ts
backend/services/api-gateway/src/middleware/admin-auth.ts
backend/services/socket-gateway/src/subscribers/orderEvents.ts
backend/docs/orders-slice/
├── IMPLEMENTATION.md
└── SELF_REVIEW.md
```

**Backend (modified):**
- `services/api-gateway/src/app.ts` — mounts `/api/v1/orders` and `/api/v1/admin`.
- `services/socket-gateway/src/server.ts` — calls `startOrderEventsSubscriber(io)`.
- `packages/shared-config/src/index.ts` + `.env.example` — `ADMIN_API_TOKEN`.

**Frontend (modified):**
- `src/services/api/features/orders.ts` — rewritten as full typed service.
- `src/features/orders/hooks/{useActiveOrder,useOrderHistory,useDeliveryRequest}.ts` — three new hooks.
- `src/features/orders/screens/OrdersScreen.tsx` — `seedMissions` + `HISTORY_MOCK` removed.
- `src/features/orders/screens/DeliveryRequestScreen.tsx` — hardcoded `orderData` removed; live offer + API accept/reject.
- `src/features/orders/screens/ActiveNavigationScreen.tsx` — real hub/dest coords; status transitions on Arrived.

## 9. Open Items Carried Forward

1. **Delivery-proof capture screen** — capture photo → `uploadKycDocument`-style presign → `POST /orders/:id/delivery-proof` → `PATCH /status delivered`. Single new screen; tracked.
2. **Real dispatcher service** — Redis-GeoSet candidate query, scoring (distance + rating + acceptance rate), re-offer on rejection. The admin offer endpoint is the test driver until then.
3. **Cancellation flow** — `POST /api/v1/admin/orders/:id/cancel` (admin) and `POST /api/v1/customer/orders/:id/cancel` (customer-app, when that ships). Both fan out via `cravix:events:order:cancelled`.
4. **Order events reconciler** — the socket-gateway already buffers `cravix:order:event:arrived/delivered:{orderId}` keys (slice 4); a worker that consumes those against the canonical `PATCH /status` is a small addition.
5. **Long-distance bonus calculator** — currently the admin endpoint accepts an explicit `bonus` value. Production will compute it from `distanceKm > 3 ? 15.50 : 0` style logic in the dispatcher.
6. **Audit log** — `OrderStatusHistory` table to track every transition with timestamp + actor. Hardening pass.
