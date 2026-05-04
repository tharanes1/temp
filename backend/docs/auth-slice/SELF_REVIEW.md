# Auth Slice — Self-Review Report

> **Slice:** Authentication & token management
> **Reviewer:** Same author (Self-review per spec §3 Step 4 / "After Each Feature")
> **Date:** 2026-05-01
> **Verdict:** Ship — with the four follow-ups listed in §6 scheduled for the next slices. No blockers found.

This report deliberately adopts an adversarial stance: each section answers "how could this break?" before it answers "and how is that handled?".

---

## 1. Bug Detection

### 1.1 Defects fixed during review

| # | Issue surfaced | Fix |
|---|---|---|
| 1 | `setAuth` previously wrote to AsyncStorage *and* a separate `@user_token` key — two sources of truth. Logout from `useProfileData` only cleared one of them, so the rider could re-hydrate as authenticated on next launch. | Single source: SecureStore. `setAuth` writes the bundle; `logout` clears the bundle. Both legacy AsyncStorage paths removed. |
| 2 | The frontend axios client called `useAuthStore.getState().logout()` on 401, but `logout` was synchronous in the old store. With the new async logout, fire-and-forget would drop errors silently. | Logout is now `async` and the interceptor `await`s the refresh attempt before deciding whether to logout. |
| 3 | Failed-OTP attempt counter (`cravix:otp:attempts:{phone}`) was set without a TTL on the first miss in earlier drafts — would stick forever. | `redis.expire(key, OTP_LOCK_TTL_SECONDS)` is applied only on the first miss (when `incr` returns 1). |
| 4 | OTP value was being printed via `console.error('Login error:', error)` if any axios layer threw — the error object can include the request body. | OtpScreen logs only `"OTP verification failed"` in dev; the underlying error message is shown to the user via `alert(...)` but never serialized to logs. |
| 5 | The refresh interceptor could fan out N parallel `/auth/refresh` calls when N requests hit 401 simultaneously after a token expiry. | Single-flight: `inflightRefresh` is a module-scoped `Promise<string|null>` that all queued retries await on. |
| 6 | `verifyAccessToken` walked only the current secret. A secret rotation would have force-logged-out every active rider. | `JWT_ACCESS_SECRET_PREVIOUS` env, when set, is also tried — supports rolling rotation. |
| 7 | `compareRefreshHash` initially compared raw bcrypt hash without binding to `jti`. An attacker who stole the bcrypt hash could substitute their own jti. | The Redis value stores `{jti}:{bcrypt(jti + ':' + token)}`. The compare binds both. |
| 8 | `Constants.expoConfig?.extra` returns `undefined` on web — would have crashed early. | Defensive: `Constants.manifest2.extra` fallback, then defaults. |

### 1.2 Defects intentionally accepted (with risk notes)

- **Anti-SMS-bomb threshold of 60 s.** If a user genuinely doesn't receive the SMS, they must wait until the OTP has < 60 s left to request a fresh one. The express rate-limit (5/10min/phone) is the harder cap. Trade-off: a fraction of legitimate retry attempts will see `409 CONFLICT` for up to 4 minutes. Acceptable for v1.
- **Token reuse → revoke ALL sessions.** A backgrounded app racing the foreground refresh can present a just-rotated refresh and trip the reuse-detection. Trade-off: rare UX hit (forced re-login) vs. mitigated replay attack. Acceptable; will revisit if customer support flags it.
- **Single-device policy.** A second login on Device B silently invalidates Device A. Rider does not see a "you've been logged in elsewhere" notice yet. Acceptable for v1; UX improvement deferred.
- **PII in `RIDER_PROFILE` mock data file.** `src/core/config/user.ts` still contains `https://i.pravatar.cc/150?u=rider_42`, name, rating, etc. Used as defaults in `UserContext`. Not a defect of this slice; tracked for the Rider Profile slice (#3 in the sequencing plan).

## 2. Performance Analysis

### 2.1 Hot path latency (ballpark, single-instance, no network)

| Operation | Cost | Notes |
|---|---|---|
| `crypto.randomInt(1000, 9999)` | < 0.01 ms | Negligible. |
| `bcrypt.hash(otp, 10)` | ~80 ms | This is the dominant cost in `/auth/login`. Could go to round 8 (≈20 ms) without meaningful security loss for a 4-digit secret with a 5-min TTL — kept at 10 to match spec defaults. |
| `bcrypt.compare(otp, stored)` | ~80 ms | Constant-time. Same trade-off applies in `/auth/verify`. |
| Redis `set/get/del/incr` | ~0.3 ms each (LAN) | Auth flow uses 3-4 round trips. |
| `prisma.rider.upsert` | ~3-8 ms | Indexed on `phone` (unique). |
| `jwt.sign HS256` × 2 | ~1 ms total | |

**End-to-end:** `/auth/login` ≈ 100-110 ms; `/auth/verify` ≈ 100-130 ms; `/auth/refresh` ≈ 95-110 ms. All comfortably inside the 200 ms budget for Indian-tier networks.

### 2.2 At 80K riders

- **OTP throughput.** Each rider OTP cycle (login + verify) costs ~5 Redis ops. Even at 100 logins/sec across the fleet, Redis sees 500 ops/sec — three orders of magnitude under cluster capacity.
- **Refresh fan-out.** Access expiry is 3 minutes; in steady-state, every active rider triggers ~20 refreshes per hour. At 80K, that's ~440/sec — well within Redis + Postgres `AuthEvent` insert capacity.
- **AuthEvent insert volume.** `AuthEvent` could grow ~100M rows/year at 80K-rider scale. Spec §13 calls for partitioning large tables by date — flagged for hardening.

### 2.3 Memory

- No request-scoped state lives in Node memory. Module-scoped `inflightRefresh` (frontend) is a single nullable Promise — bounded.
- `winston` JSON serialization redacts before stringify; no PII in the log buffers.

### 2.4 Cold-start

- `loadConfig()` parses + freezes the env once at boot. First request pays no validation cost.
- Prisma client lazy-connects — first DB query takes ~30 ms; subsequent are cheap.

## 3. Security Audit

### 3.1 STRIDE walk

| Threat | Vector | Mitigation |
|---|---|---|
| **S**poofing | Attacker tries to log in as another rider's phone | OTP delivered to that phone's SIM via MSG91 — out-of-band. No password to guess. |
| **S** | Forged JWT | HS256 with 32+ char secrets, distinct per token type, issuer + audience pinned. |
| **T**ampering | Attacker modifies the OTP in transit | bcrypt-compared against Redis hash; modification ⇒ mismatch ⇒ `OTP_INVALID`. |
| **T** | Refresh-token modification | JWT signature check + Redis bcrypt compare — both must pass. |
| **R**epudiation | Rider denies an action | `AuthEvent` row per OTP_SENT/VERIFIED/FAILED/REFRESH/LOGOUT/TOKEN_REUSE with IP + UA. |
| **I**nfo disclosure | Server reveals whether phone is registered | Login response is identical for unknown vs known phones (`{success:true, data:{expiresIn:300}}`). |
| **I** | OTP leaked via logs | Winston redactor strips `otp` field; OtpScreen does not log error bodies; pre-prod log of OTP is gated on `NODE_ENV !== 'production'`. |
| **I** | JWT leaked via URL params | Spec §9.4 forbids URL-embedded auth; we only use `Authorization: Bearer`. |
| **D**oS | Attacker triggers OTPs for many phones | Per-phone limit (5/10min) + global per-IP limit (100/min). MSG91 is the costly leg — bounded. |
| **D** | Attacker hits `/auth/verify` with random OTPs | Lockout at 5 attempts / 15 min per phone. 4-digit OTP × 15-min lock = ≤ 5 guesses per ¼ hour ≈ 1/2000 odds. |
| **E**levation | Refresh token used as access | `type` claim differentiates; `verifyAccessToken` rejects `type=refresh`. |
| **E** | Stolen refresh token replayed | Rotation + reuse-detection — first reuse revokes all sessions for the rider. |

### 3.2 Cryptography choices

- **bcrypt 10 rounds** for OTPs. A 4-digit secret with a 5-min TTL doesn't need argon2id; bcrypt is cheaper and the TTL bounds the attack surface.
- **HS256** for JWTs. Symmetric; secrets shared across all 8 instances per spec. RS256 would let us hand out the public key for client-side verification but isn't needed here (no third-party JWT consumers).
- **UUIDv7** for rider PKs and JWT `jti`. Time-ordered, B-tree friendly (spec §13 #4).

### 3.3 What's NOT covered yet

- **Per-rider rate limit on `/auth/verify` after a successful login** — currently the OTP-attempts counter caps brute force, but not "100 successful logins in a minute" (which would be weird but not catastrophic). Low priority.
- **Geo-anomaly detection** ("new login from a country you've never been in") — out of scope; would belong in a fraud-engine slice.
- **Device fingerprinting** — single-device policy uses just riderId; we accept the silent-revoke trade-off above.
- **Token revocation list at access-token granularity** — access tokens are unrevocable for their 3-min life. The 3-min TTL is the mitigation; if we needed faster revocation we'd add a Redis denylist keyed by `jti`.

## 4. Edge-Case Handling

| Scenario | Behavior |
|---|---|
| Rider closes app mid-OTP, opens later | OTP key still alive (TTL 5 min) — entering the code in time succeeds. After TTL, `OTP_EXPIRED`. |
| Two devices race the OTP | Second `verify` fails — OTP key was deleted on first success → `OTP_EXPIRED`. |
| App backgrounded just before access expiry | On wake, axios's first request hits 401 → refresh succeeds → request retried. Single-flight ensures only one refresh even if multiple endpoints fire concurrently. |
| Refresh token expired (≥ 2 days idle) | `jwt.verify` throws → `UnauthorizedError` → axios logout. SecureStore is cleared. |
| Rider rotates SIM (new phone same number) | `Rider.upsert({where:{phone}})` finds the existing row — same id, same KYC status, name, etc. New refresh token issued; prior device's refresh becomes orphaned (TTL expires in ≤ 2 days). |
| Rider revoked from server side (admin tool) | Tool would `redis.del('cravix:refresh:{riderId}')`. Next refresh ⇒ `UNAUTHORIZED`. The 3-min access window is the residual exposure; acceptable. |
| OTP request while still inside SMS-bomb window | `409 CONFLICT` until TTL drops below 60 s. Frontend shows the message. |
| Server clock skew with the device | JWT verify allows the default 0 s clock skew (`clockTolerance: 0`). Recommend bumping to 60 s in a future patch — not blocking for v1. |
| Phone number exotic format (international) | Zod regex pins `^\+91[6-9]\d{9}$` — rejects with VALIDATION_ERROR. Will revisit when we onboard non-India markets. |
| 4-digit OTP starts with 0 | `crypto.randomInt(1000, 9999)` excludes leading-zero codes — OTP is always 4 digits visually. (Concern noted: this slightly reduces entropy from 10000 to 9000 codes; for a 5-min, 5-attempt-locked secret, the impact is ~0.05% on guess probability — accepted.) |
| Body larger than 10 kb | Express body parser rejects with 413; never reaches the controller. |
| Network blip mid-refresh | axios timeout 10 s → `performRefresh` returns `null` → logout. Acceptable. |
| Rider triggers logout while offline | `authService.logout` catches the network error and returns `{success:true}`; local SecureStore is wiped regardless. Server-side refresh hash will TTL-expire in ≤ 2 days. |
| `consentVersion` is provided but the rider already consented | The service skips the update — `consentGivenAt` is preserved, never overwritten. |
| `AuthEvent.metadata` carries a nested `password` or `otp` field by mistake | Logger redactor strips it before serialization. The DB column is JSON though — if some future caller stuffs sensitive data into metadata, it WILL persist. Mitigation: a code-review checklist; longer-term, a Prisma middleware that scrubs known PII keys before insert. |

## 5. Test Coverage Status

**Note:** integration tests will be added in a follow-up dedicated to test infrastructure (jest + supertest + testcontainers postgres/redis). For this slice the verification matrix below describes the manual smoke tests run against a local docker-compose:

| Path | Scenario | Result |
|---|---|---|
| `POST /auth/login` | valid phone | 201 + `{expiresIn:300}` |
| | malformed phone | 400 `VALIDATION_ERROR` |
| | 6th request in 10 min | 429 `RATE_LIMITED` |
| | second request inside 60 s window | 409 `CONFLICT` |
| `POST /auth/verify` | correct OTP | 200 + tokens |
| | wrong OTP × 4 | 401 `OTP_INVALID` × 4 |
| | wrong OTP × 5 | 429 `OTP_LOCKED` |
| | expired OTP | 401 `OTP_EXPIRED` |
| | invalid 4-digit shape (`'12a4'`) | 400 `VALIDATION_ERROR` |
| | first-login phone | upserts rider, returns `consentAccepted:true` if `consentVersion` provided |
| `POST /auth/refresh` | clean rotation | 200, new pair |
| | replay old refresh after rotation | 401 `TOKEN_REUSE_DETECTED`, all sessions revoked |
| | refresh from another rider's session | 401 `UNAUTHORIZED` (signature OK, but Redis hash mismatch) |
| | expired refresh (> 2 days) | 401 `UNAUTHORIZED` |
| `POST /auth/logout` | valid access | 200, refresh hash deleted |
| | no auth header | 401 `UNAUTHORIZED` |
| | already-logged-out | 200 (idempotent) |

Everything passes the manual matrix. Automation lands as part of the next slice (Rider Profile) so the test harness pays its setup cost once.

## 6. Open Items / Follow-Ups

These are tracked for explicit pickup in the indicated slices — none block shipping the Auth slice on its own:

1. **MSG91 wiring** (Notifications slice). Until then OTP prints to dev logs; will not work in QA/UAT without provider creds.
2. **Socket.IO auth handshake** (Socket slice). The access token format and lifetime are agreed; the socket service's `io.use(...)` middleware will consume them.
3. **Consent-capture screen** (KYC slice). Backend is ready to record `v1` — frontend needs to show the consent UI between OTP success and KYC start.
4. **AuthEvent partitioning** (hardening). Monthly partitions (`pg_partman` or hand-rolled) before crossing 10 M rows.
5. **Integration test harness** — jest + supertest + testcontainers. Will be set up alongside the next slice so subsequent slices inherit it.
6. **Centralized log redactor coverage** — current redactor handles known keys at top level + nested objects. Add a fuzz test: random JSON containing PII keys at various depths must always render `[REDACTED]`.

## 7. Self-Review Conclusion

The Auth slice meets the contract in `BACKEND_REQUIREMENTS.md` §5.1 + §6 + §14, with the locked deviations from `BACKEND_ALIGNMENT_REVIEW.md §0` correctly applied (4-digit OTP, 3-min access, 2-day refresh, single-device, one-time-use rotation, reuse-detection). Frontend integration replaces every dead-code path identified in the review (§6.2 of the review). No blockers. Recommend proceeding to **Slice 3 — Rider Profile** in the next iteration.
