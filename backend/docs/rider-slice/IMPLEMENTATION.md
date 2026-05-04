# Rider Profile Slice — Implementation Document

> **Slice:** Rider profile, online status, vehicle
> **Endpoints:** `GET/PATCH /api/v1/rider/profile` · `GET/PATCH /api/v1/rider/status` · `GET/PATCH /api/v1/rider/vehicle`
> **Status:** Backend implemented; frontend wiring complete; manual smoke matrix passing.
> **Date:** 2026-05-01

---

## 1. Feature Overview

This slice gives the frontend a real source of truth for the rider's identity and duty state. Before, every dynamic field on the home, profile, and vehicle screens was either a UserContext default, an AsyncStorage blob, or a hardcoded fixture; afterward, those screens read from `/api/v1/rider/profile` (cached 60s in Redis), the duty toggle writes to `/api/v1/rider/status` (Redis hash, never Postgres in the hot path — spec §13 #2), and the vehicle screen finally renders something other than placeholder text.

It honors the locked decisions from the alignment review:

- **A5** — vehicle has both `vehicleType ∈ {petrol, ev}` and `bikeType ∈ {bike, bicycle, scooter, ev}`. Bicycles must have `vehicleType=null`. The Zod schema enforces both directions of the refinement; the service layer also nulls `vehicleType` when a `PATCH` only flips `bikeType` to `bicycle` (so a partial update never violates the DB CHECK).
- **A6** — the `rating` field returned in the profile is a `number` (decimal rupees-style), backed by `Decimal(3,2)` in Postgres.

## 2. API Specification

### 2.1 `GET /api/v1/rider/profile`

| | |
|---|---|
| Auth | Bearer access token |
| Cache | Redis 60 s (`cravix:cache:rider:profile:{id}`) |

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": "01930b2e-7af1-7000-8a00-...",
    "phone": "+919876543210",
    "name": "Arjun Kumar",
    "email": "arjun@example.com",
    "profileImage": "https://cdn.cravix.in/riders/arjun.jpg",
    "gender": "male",
    "dateOfBirth": "2000-05-15",
    "isOnline": false,
    "rating": 4.8,
    "totalDeliveries": 1482,
    "vehicleType": "petrol",
    "bikeType": "bike",
    "kycStatus": "verified",
    "joiningDate": "2024-01-15T00:00:00.000Z"
  }
}
```

**Service flow**
1. `redis.get('cravix:cache:rider:profile:{id}')` — on hit, parse the cached projection.
2. On miss, `prisma.rider.findUnique({ where:{id}, include:{vehicle:true} })`. 404 if missing.
3. Project to wire format (Decimal → number for `rating`; enum lowercase; `joiningDate` from `createdAt`).
4. `redis.set` cache with 60 s TTL.
5. **Always** overlay live `isOnline` from `cravix:rider:status:{id}` so the 60 s cache never serves a stale duty state.

### 2.2 `PATCH /api/v1/rider/profile`

| | |
|---|---|
| Auth | Bearer access token |
| Validation | `UpdateProfileSchema` (strict; at least one field) |

**Request body** (all fields optional)
```json
{
  "name": "Arjun Kumar",
  "email": "arjun@example.com",
  "profileImage": "https://cdn.cravix.in/...",
  "gender": "male",
  "dateOfBirth": "2000-05-15"
}
```

**Behavior:** writes the patch to Postgres, deletes the Redis cache key, returns the freshly-loaded profile.

### 2.3 `GET /api/v1/rider/status`

| | |
|---|---|
| Auth | Bearer access token |
| Source | Redis `cravix:rider:status:{id}` (never Postgres — spec §13 #2) |

**Response 200**
```json
{
  "success": true,
  "data": {
    "isOnline": true,
    "since": "2026-05-01T10:30:00.000Z",
    "lastSeen": "2026-05-01T10:35:12.000Z"
  }
}
```

If the rider has never gone online, the response is `{ isOnline: false, since: null, lastSeen: null }`.

### 2.4 `PATCH /api/v1/rider/status`

**Request body**
```json
{ "isOnline": true }
```

**Service flow (going online)**
1. `redis.multi()` → `hset('cravix:rider:status:{id}', { isOnline:'1', since:<now>, lastSeen:<now> })` + `expire(key, 4h)`.
2. Publish to channel `cravix:events:rider:status` `{riderId, isOnline:true, at:<now>}` (the socket-gateway in slice 4 will subscribe and emit `rider:going-online` to the admin namespace).
3. Returns the freshly-read status.

**Service flow (going offline)**
1. `hset(... isOnline:'0', lastSeen:<now>)` + `expire(key, 4h)`.
2. `del('cravix:rider:location:{id}')` so the assignment engine cannot offer this rider new orders.
3. Publishes the corresponding event.
4. Returns the freshly-read status.

### 2.5 `GET /api/v1/rider/vehicle`

| | |
|---|---|
| Auth | Bearer access token |

**Response 200**
```json
{
  "success": true,
  "data": {
    "vehicleType": "petrol",
    "bikeType": "bike",
    "make": "Honda",
    "model": "Activa 6G",
    "year": 2022,
    "registrationNumber": "KA01AB1234",
    "rcImage": "https://cdn.cravix.in/...",
    "bikePhoto": "https://cdn.cravix.in/...",
    "insuranceNumber": "POL-12345",
    "insurancePolicy": "https://cdn.cravix.in/...",
    "insuranceExpiry": "2027-03-31"
  }
}
```

Returns all-nulls when the rider has not yet entered vehicle details — the screen shows the "Pending Verification" placeholders without 404'ing.

### 2.6 `PATCH /api/v1/rider/vehicle`

**Validation** (`UpdateVehicleSchema`):
- All fields optional, but the request must contain at least one.
- `vehicleType` accepts `petrol | ev | null`.
- `bikeType` accepts `bike | bicycle | scooter | ev`.
- **Refinements (locked A5):**
  - If `bikeType === 'bicycle'`, `vehicleType` must be `null` (or omitted).
  - If `bikeType` is anything else AND `vehicleType` is explicitly `null`, reject.
- `registrationNumber` is uppercased and pinned to `^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$` (Indian RTO format).

The service auto-nulls `vehicleType` when a `PATCH` only flips `bikeType` to `bicycle`, so partial updates never violate the DB CHECK constraint that pairs the two columns.

Cache invalidation: `del('cravix:cache:rider:profile:{id}')` (vehicle changes affect the profile mirror).

## 3. Frontend Integration

| Change | File | Notes |
|---|---|---|
| Typed rider service | `src/services/api/features/rider.ts` | `getProfile`, `updateProfile`, `getStatus`, `setStatus`, `getVehicle`, `updateVehicle`. DTOs include both `vehicleType` and `bikeType` per locked A5. |
| `useRiderProfile` hook | `src/features/profile/hooks/useRiderProfile.ts` (new) | Loads on mount, exposes `loading`, `error`, `refresh`, `updateProfile`. Bridges into `UserContext` so unmigrated screens stay in sync. |
| Duty toggle wired to API | `src/features/home/hooks/useHomeData.ts` | Optimistic flip → `riderService.setStatus(value)` → start/stop foreground tracking. Rolls back on API failure. New `togglingDuty` flag prevents double-taps. |
| Profile reads server first | `src/features/profile/hooks/useProfileData.ts` | `riderService.getProfile()` populates name + photo + phone. AsyncStorage `@personal_data`/`@kyc_profile_photo` reads kept as offline/pre-auth fallback only. Photo edit is uploaded to the server when the URI is `https://`; local `file://` URIs are still saved locally until the KYC slice ships the S3 presigned-PUT pipeline. |
| Vehicle screen reads API | `src/features/profile/screens/VehicleInfoScreen.tsx` | Replaces the always-empty `@license_data`/`@vehicle_data`/`@kyc_*_image` reads with `riderService.getVehicle()`. Fallbacks to a small inline error message when the API errors out. |

## 4. Code Walkthrough

### 4.1 Cache + live-status overlay (`service.ts`)

Reading the profile costs two Redis ops (cache key + status hash) plus one Postgres call on cache miss, and one Redis op on cache hit. The 60 s cache hides routine profile reads from Postgres entirely; the live `isOnline` overlay is mandatory because the duty toggle writes to a different Redis key, so the cached projection alone would lag behind a duty change by up to 60 s.

```ts
const baseProjection = JSON.parse(cached);
const status = await readStatus(riderId);
return { ...baseProjection, isOnline: status.isOnline };
```

### 4.2 Status writes are pipelined and TTL-bounded (`service.ts`)

```ts
await redis
  .multi()
  .hset(key, { isOnline: '1', since: String(now), lastSeen: String(now) })
  .expire(key, 4 * 60 * 60)
  .exec();
```

The 4-hour TTL is the safety net spec §8 documents: a rider whose app goes silent (force-quit, low battery, lost network) eventually drops out of the assignment pool without us having to detect the disappearance.

### 4.3 Locked-A5 refinement (`schemas.ts`)

The Zod schema enforces both directions:

```ts
.refine((v) => !(v.bikeType === 'bicycle' && v.vehicleType !== undefined && v.vehicleType !== null),
        { message: 'Bicycles must have vehicleType=null', path: ['vehicleType'] })
.refine((v) => !(v.bikeType !== undefined && v.bikeType !== 'bicycle' && v.vehicleType === null),
        { message: 'Non-bicycle vehicles require vehicleType (petrol|ev)', path: ['vehicleType'] });
```

The service auto-nulls `vehicleType` when only `bikeType=bicycle` is patched in, so a rider who switches from a scooter to a bicycle in a single round trip works correctly.

### 4.4 Optimistic duty toggle (`useHomeData.ts`)

The toggle flips local state first (snappy UI), calls the API, then starts/stops location tracking. On API failure it rolls back and rethrows so the caller can show a toast. The `togglingDuty` flag prevents double-taps from racing a not-yet-acknowledged write.

## 5. Security Measures

| Measure | Implementation |
|---|---|
| All routes auth-guarded | `riderRouter.use(authMiddleware)` — every endpoint sees `req.user.id` |
| Strict schemas | `.strict()` on every body schema rejects unknown keys (prevents mass-assignment of internal columns like `kycStatus`) |
| `email` lowercased + trimmed | Eliminates a class of duplicate-account bugs |
| `registrationNumber` uppercased + format-pinned | Single canonical RTO format avoids spoofable duplicates |
| Vehicle refinement at two layers | Zod (input) + service-level auto-null (semantic) + DB CHECK (last line of defense — to be added in a follow-up migration) |
| No Postgres reads for status | `getStatus` is Redis-only — saves load and matches spec §13 #2 |
| Audit-ready writes | `PATCH /profile` invalidates cache atomically before re-loading; cache key TTL prevents stale reads |
| PII redaction in logs | `winston` redactor strips `phone`, `email` if they appear in metadata; structured request log already excludes the body |

## 6. How to Run

```bash
cd backend

# Bring up infra and apply schema
pnpm docker:up
pnpm prisma:migrate

# Start the API gateway
pnpm dev
```

Smoke matrix:

```bash
# Issue OTP, verify, capture access token (from previous slice)
ACCESS=$(... your access token from /auth/verify ...)

# 1. Profile (cache miss → DB → cache fill, 60s)
curl -s http://localhost:3000/api/v1/rider/profile -H "Authorization: Bearer $ACCESS" | jq

# 2. Status (Redis-only)
curl -s http://localhost:3000/api/v1/rider/status -H "Authorization: Bearer $ACCESS" | jq

# 3. Go online
curl -s -X PATCH http://localhost:3000/api/v1/rider/status \
  -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
  -d '{"isOnline":true}' | jq

# 4. Profile again — cache hit + live overlay shows isOnline:true
curl -s http://localhost:3000/api/v1/rider/profile -H "Authorization: Bearer $ACCESS" | jq

# 5. Patch profile
curl -s -X PATCH http://localhost:3000/api/v1/rider/profile \
  -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
  -d '{"name":"Arjun Kumar","email":"arjun@example.com"}' | jq

# 6. Vehicle: empty when nothing's set
curl -s http://localhost:3000/api/v1/rider/vehicle -H "Authorization: Bearer $ACCESS" | jq

# 7. Patch vehicle (locked A5)
curl -s -X PATCH http://localhost:3000/api/v1/rider/vehicle \
  -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
  -d '{"bikeType":"scooter","vehicleType":"petrol","make":"Honda","model":"Activa 6G","year":2022,"registrationNumber":"KA01AB1234"}' | jq

# 8. Bicycle with vehicleType — must be rejected (VALIDATION_ERROR)
curl -s -X PATCH http://localhost:3000/api/v1/rider/vehicle \
  -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
  -d '{"bikeType":"bicycle","vehicleType":"petrol"}' | jq
```

## 7. Files Created / Modified

**Backend (created):**
```
backend/services/api-gateway/src/modules/rider/
├── schemas.ts
├── types.ts
├── repository.ts
├── service.ts
├── controller.ts
└── routes.ts
backend/docs/rider-slice/
├── IMPLEMENTATION.md
└── SELF_REVIEW.md
```

**Backend (modified):**
- `services/api-gateway/src/app.ts` — mounts `/api/v1/rider`.

**Frontend (modified):**
- `src/services/api/features/rider.ts` — full typed service (was just endpoint constants).
- `src/features/profile/hooks/useRiderProfile.ts` (new) — fetch/update hook.
- `src/features/home/hooks/useHomeData.ts` — duty toggle hits the API.
- `src/features/profile/hooks/useProfileData.ts` — server-first profile load.
- `src/features/profile/screens/VehicleInfoScreen.tsx` — vehicle reads from API.

## 8. Open Items Carried Forward

- **Socket gateway `cravix:events:rider:status` subscriber** — the publish is in place; consumption ships in slice 4.
- **DB CHECK constraint** for the locked-A5 invariant — a follow-up Prisma migration to belt-and-brace the Zod refinement.
- **`@personal_data` AsyncStorage fallback** — kept for offline cold-start. Removed once the KYC slice ships, because by then `/kyc/status` + `/rider/profile` together cover every screen that reads from it.
- **Profile-image S3 upload** — `useProfileData.handleEditPhoto` skips the server PATCH for `file://` URIs; the presigned-PUT pipeline is the KYC slice's deliverable, so this becomes a one-line change at that point.
- **Audit log** — profile/vehicle PATCHes don't yet emit `AuthEvent`-style audit rows. Recommend a generic `AuditLog` model in the hardening pass.
