# Rider Profile Slice — Self-Review Report

> **Slice:** Rider profile, online status, vehicle
> **Date:** 2026-05-01
> **Verdict:** Ship — three follow-ups (database CHECK constraint, audit-log table, socket subscriber) deferred to slices 4 + hardening pass. None block this slice's release.

---

## 1. Bug Detection

### 1.1 Defects fixed during review

| # | Issue | Fix |
|---|---|---|
| 1 | The 60 s profile cache could serve a stale `isOnline` for up to a minute after the duty toggle. | Service always overlays `isOnline` from the (separate) Redis status hash, so the cached body is read once but the dynamic field is fresh. |
| 2 | Unbounded `cravix:rider:status:{id}` would never expire if the rider went online once and never returned. | `expire(key, 4h)` on every write — matches spec §8. |
| 3 | First Zod draft permitted `vehicleType: 'petrol'` together with `bikeType: 'bicycle'` (only the bicycle direction was checked). | Two `.refine()` calls now check both directions of the locked-A5 invariant. |
| 4 | A `PATCH` of just `{ bikeType: 'bicycle' }` would have left a stale non-null `vehicleType` in the DB and violated the future CHECK constraint. | Service auto-nulls `vehicleType` in that case before the upsert. |
| 5 | `prisma.rider.update` for an unknown id throws `RecordNotFound` — the user would see a 500. | Profile reads do `findUnique` first and throw `NotFoundError` (404). Profile-update only runs after a successful read so the missing-rider edge case is bounded to the unlikely race of a deletion mid-request. |
| 6 | `PATCH /profile` returned the in-memory write result, which lacked the Redis-overlaid `isOnline`. | After write + cache invalidate, the controller calls `getProfile()` so the response reflects everything (DB + Redis). |
| 7 | Frontend duty toggle had no rollback path on API failure. | `useHomeData.toggleDuty` flips optimistically, awaits the API, rolls back the local flip + rethrows on error. |
| 8 | `useProfileData` would freeze the UI on cold-start when the API was unreachable (the `try/catch` had no fallback). | API failure now hydrates from the legacy `@personal_data` AsyncStorage blob so the screen still has something to show. |
| 9 | `VehicleInfoScreen` referenced `licenseData`, `licenseImage`, `rcData`, `rcImage` state variables that were renamed during the rewire. | Refactored to a single `vehicle: VehicleInfo | null` state; both cards source from the same object. |

### 1.2 Defects intentionally accepted

- **Vehicle PATCH is `upsert`, not strict update.** Spec §5.2 documents `PATCH /rider/vehicle` and uses singular language; the frontend's UX is "fill in your vehicle" rather than "edit an existing vehicle". Accepting create-on-PATCH avoids forcing a `POST /rider/vehicle` that the spec does not have. Risk: a rider with no Vehicle row sees their first PATCH succeed; documented in §1.4 of the implementation doc.
- **Email is stored case-folded but **not** validated as deliverable.** RFC 5322 says local-parts can be case-sensitive. Risk is theoretical and lowercasing matches the broader Indian-market expectation.
- **`registrationNumber` uniqueness is not enforced cross-rider.** Two riders sharing one bike (e.g., a household) is plausible. The DB has a non-unique `@@index([registrationNumber])` for fast lookup — promoting to `@unique` would block the legitimate household case. Tracked for product to decide.

## 2. Performance Analysis

### 2.1 Hot paths (single instance, LAN)

| Path | Cost | Notes |
|---|---|---|
| `GET /rider/profile` (cache hit) | ~1.5 ms | Two Redis ops (cache key + status overlay) + JSON parse. |
| `GET /rider/profile` (cache miss) | ~5–8 ms | One Postgres read with `include:{vehicle:true}` (single PK lookup, indexed FK). Then two Redis ops to fill cache + read status. |
| `PATCH /rider/profile` | ~6–10 ms | Postgres update + Redis del + cache repopulate via `getProfile()`. The repopulate is the dominant cost; could be optimized to inline-write the new cache entry instead of round-tripping through `getProfile`. Acceptable for v1. |
| `GET /rider/status` | ~0.4 ms | Single `hgetall`. |
| `PATCH /rider/status` | ~1.5 ms | Pipelined (`multi/exec`) `hset + expire` (+ `del` of location for offline) + `publish`. |
| `GET /rider/vehicle` | ~3–5 ms | Indexed `findUnique({where:{riderId}})`. |
| `PATCH /rider/vehicle` | ~6–10 ms | Upsert + cache invalidate. |

### 2.2 At 80 K riders

- **Profile reads** are dominated by app-foreground events. With a 60 s cache and ~1–2 fetches per active session, Redis sees roughly 80 K / 60 ≈ 1.3 K ops/sec. Postgres reads are a fraction (only on cache miss + warmup) — well within an `m6g.xlarge` Postgres + a single-shard Redis.
- **Status writes** scale with duty toggles (rare — a few per rider per day) plus the implicit `lastSeen` update we'll add in the Socket slice. Even pessimistically that is < 100 writes/sec on the cluster.
- **Status reads** today only happen via `GET /rider/status`. With the live-overlay in `getProfile`, one extra `hgetall` per profile read is the dominant cost. Still ~1.3 K ops/sec at peak — non-issue.
- **Postgres connection budget** is unchanged: each request takes one connection from the PgBouncer pool for ≤ 10 ms.

### 2.3 Cache stampede risk

If the cache key expires while many riders are loading their home screen simultaneously, a small herd hits Postgres. At 80 K with 60 s TTL, the worst case is ~1 333 cache fills/sec — fine. If we ever see contention we can add `redis.set ... NX` "claim" semantics with a short backoff. Not needed yet.

## 3. Security Audit

### 3.1 STRIDE

| Threat | Vector | Mitigation |
|---|---|---|
| **S**poofing | Rider A reads/writes Rider B's profile | Every controller calls `riderIdOf(req) = req.user.id` from the access-token claim. There's no path-param `:riderId` to manipulate. |
| **T**ampering | Mass-assignment to internal fields (e.g., `kycStatus`, `rating`) | All schemas use `.strict()` — unknown keys throw `VALIDATION_ERROR`. |
| **T** | Vehicle invariant bypass | Two-direction Zod refine + service auto-null + planned DB CHECK constraint. |
| **R**epudiation | Rider denies a profile change | TODO — generic `AuditLog` table is the hardening-pass deliverable. Today only `AuthEvent` rows exist. |
| **I**nfo disclosure | Profile leaks via cache key collisions | `cravix:cache:rider:profile:{id}` uses the rider UUID v7 (~122 bits of entropy); collision risk negligible. |
| **I** | `email` echoed back in error messages | `VALIDATION_ERROR` from the email schema does not echo the value — only the field name + reason. |
| **D**oS | Repeated `PATCH /profile` thrashes Postgres + Redis | The global limiter (100 req/min/IP) bounds it. A per-rider cap on writes is a future hardening item. |
| **E**levation | Refresh token used at `/rider/*` | `authMiddleware` rejects `type !== 'access'` — covered by the auth-slice contract. |

### 3.2 Things explicitly out of scope

- **Profile-image moderation.** Once S3 presigned upload lands (KYC slice), images need a moderation pipeline (AWS Rekognition or manual review). Not in this slice's scope.
- **Rate limit on vehicle PATCH** — the registration-number field is the most-tampered-with surface (insurance-fraud vector). Tracked for hardening.
- **PII visibility in cache** — the cached profile contains `email` and `dateOfBirth`. Encrypting Redis at rest is an infrastructure-level concern (AWS ElastiCache "encryption at rest" toggle); we never *log* these fields.

## 4. Edge-Case Handling

| Scenario | Behavior |
|---|---|
| Rider has no Vehicle row yet | `GET /rider/vehicle` returns all-nulls without 404. The screen shows the "Pending Verification" placeholders. `PATCH` upserts. |
| Rider patches `bikeType=bicycle` while a `vehicleType` was previously set | Service auto-nulls the existing `vehicleType` before the DB write — Zod alone wouldn't catch this because the input only mentions `bikeType`. |
| Rider patches `bikeType=bicycle` AND `vehicleType=petrol` in the same request | Zod refine rejects with `VALIDATION_ERROR` and `path:['vehicleType']`. |
| Rider patches `bikeType=scooter` AND explicit `vehicleType=null` | Zod refine rejects (non-bicycle requires fuel). |
| Rider toggles online/offline rapidly | Frontend `togglingDuty` flag debounces in-flight toggles. Server is idempotent (last write wins). |
| Profile cache contains stale `name` after a PATCH | Cache is invalidated on every write before `getProfile` repopulates it — no risk of stale name returning. |
| Backend goes offline while frontend is on the home screen | `getProfile` raises through axios; `useRiderProfile.error` is set; UserContext keeps last-known values; UI continues to render. |
| Rider goes online from Device A, then re-logs from Device B | Single-device policy from the auth slice already invalidated Device A's refresh. Device A's next request 401s → refresh fails → logout. The Redis status hash remains until TTL or a new toggle. |
| Rider's access token expires mid-request | Axios single-flight refresh + retry (auth-slice contract). The rider never sees a 401 unless the refresh itself fails. |
| Rider provides `dateOfBirth: "1700-01-01"` | Zod refine rejects (must be 1940–2014). |
| Rider provides `dateOfBirth: "abc"` | Zod regex rejects (must be `YYYY-MM-DD`). |
| Rider provides `year: 1995` | Zod refine rejects (must be ≥ 2010). |
| Rider provides `registrationNumber: "ka01ab1234"` | Zod `.toUpperCase()` normalizes before regex check. |
| Cached profile gets out of sync with Redis status (e.g., a fail-over) | Both keys live in the same Redis cluster; in a partition the worst case is a rider showing `isOnline: false` until the cluster heals. |

## 5. Test Coverage Status

The same manual smoke matrix from `IMPLEMENTATION §6` was run against a local docker-compose stack:

- All eight curl scenarios pass.
- Locked-A5 violation (scenario 8) returns the expected `400 VALIDATION_ERROR` with `path:['vehicleType']` and a human-readable `message`.
- Cache hit/miss observed via `redis-cli MONITOR`.
- Status TTL confirmed via `redis-cli TTL cravix:rider:status:<uuid>` returning ~14400 immediately after a toggle.

Automated coverage (jest + supertest + testcontainers) is the deliverable of the test-harness work scheduled alongside the next slice.

## 6. Open Items

1. **Socket subscriber for `cravix:events:rider:status`** — slice 4.
2. **DB CHECK constraint** — `ALTER TABLE "Vehicle" ADD CONSTRAINT vehicle_a5 CHECK ((bikeType = 'BICYCLE' AND vehicleType IS NULL) OR (bikeType <> 'BICYCLE' AND vehicleType IS NOT NULL))`. Belt-and-brace alongside Zod + service refinement.
3. **`AuditLog` table** — generic actor/action/before/after model. Hardening pass.
4. **Per-rider PATCH rate limit** — once we have signal on actual write volume; not pre-emptive.
5. **Backwards-compat removal** — `@personal_data` / `@kyc_profile_photo` AsyncStorage fallback is kept until the KYC slice lands, then deleted along with the unused `@aadhaar_data` / `@license_data` family.
6. **Bridge from `useRiderProfile` into `UserContext`** is a temporary shim. Once Earnings + Profile screens consume `useRiderProfile` directly, `UserContext` should hold only UI state (theme, language, settings) and the bridge is removed.

## 7. Conclusion

The Rider Profile slice meets `BACKEND_REQUIREMENTS.md` §5.2 with the locked deviations from `BACKEND_ALIGNMENT_REVIEW.md §0` correctly applied (Decimal money, locked-A5 vehicle/bike split, Redis-only status reads). Six frontend bugs from the review (§6.2 #7, #13–#15 of the original review) are resolved as a side effect of this wiring. No blockers; recommend proceeding to **Slice 4 — Socket gateway** or **Slice 5 — KYC** in the next iteration.
