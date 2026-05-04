# Auth Slice — Implementation Document

> **Slice:** Authentication & token management
> **Endpoints:** `POST /api/v1/auth/login` · `POST /api/v1/auth/verify` · `POST /api/v1/auth/refresh` · `POST /api/v1/auth/logout`
> **Status:** Implemented end-to-end (backend + frontend integration). Awaiting integration tests against a live Postgres + Redis (deferred to Sprint 0 docker-compose smoke test).
> **Date:** 2026-05-01

---

## 1. Feature Overview

The Auth slice is the keystone for every other slice — every protected endpoint and every Socket.IO handshake reads the access token minted here. The slice covers:

1. **OTP issuance.** Rider submits a phone number; backend generates a 4-digit OTP, hashes it with bcrypt, stores in Redis with 5-minute TTL, enqueues an SMS dispatch job (logged to console in dev), and never reveals whether the phone is registered.
2. **OTP verification.** Rider submits phone + OTP; backend compares against the bcrypt-hashed Redis value with attempt counter, upserts the rider on first login, mints an access token (3 min) + refresh token (2 days), persists the refresh token's bcrypt hash in Redis (single-device policy), and returns the spec-shaped DTO.
3. **Refresh.** Rider submits the refresh token; backend verifies signature, compares jti against Redis, detects token reuse, rotates both tokens (one-time-use refresh), returns a fresh pair.
4. **Logout.** Authenticated rider triggers refresh-token revocation; backend deletes the Redis hash and emits an audit event.

The implementation honors the locked decisions from `BACKEND_ALIGNMENT_REVIEW.md §0`: 4-digit OTPs, 3-minute access tokens, 2-day refresh tokens, refresh rotation with reuse detection, no Passport (custom JWT middleware), no express-validator (Zod only), and currency in rupees-as-decimal (not relevant to this slice but reflected throughout the shared types).

## 2. API Specification

### 2.1 `POST /api/v1/auth/login`

Initiate OTP login flow.

| | |
|---|---|
| Auth | None |
| Rate limit | 5 / 10 min / phone (Redis) — global 100/min/IP also applies |
| Validation | `LoginSchema = z.object({ phone: PhoneSchema })` |

**Request**
```json
{ "phone": "+919876543210" }
```

**Response 201**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": { "expiresIn": 300 }
}
```

**Errors**
| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Phone format invalid |
| 409 | `CONFLICT` | An unexpired OTP is already in flight (TTL > 60 s) |
| 429 | `RATE_LIMITED` | 5 OTP requests in 10 min for this phone |

**Service flow**
1. Reject if a fresh OTP already exists in Redis with > 60 s remaining (anti-SMS-bomb).
2. `crypto.randomInt(1000, 9999)` — 4-digit OTP (locked A1).
3. `bcrypt.hash(otp, 10)` → `redis.set('cravix:otp:{phone}', hash, 'EX', 300)`.
4. `redis.del('cravix:otp:attempts:{phone}')` — fresh attempt window.
5. Enqueue SMS dispatch (BullMQ — landing in Notifications slice). In non-prod, the OTP is printed to the warn-level log so developers can test.
6. Insert `AuthEvent { type: 'OTP_SENT' }`.

### 2.2 `POST /api/v1/auth/verify`

Verify OTP and mint access + refresh tokens.

| | |
|---|---|
| Auth | None |
| Rate limit | Shares the OTP limiter (failed verifies count toward the 5/10min cap) |
| Validation | `VerifyOtpSchema = z.object({ phone, otp: /^\d{4}$/, consentVersion?: z.string() })` |

**Request**
```json
{ "phone": "+919876543210", "otp": "4839", "consentVersion": "v1" }
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",        // ACCESS — 3 min
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...", // REFRESH — 2 days
    "expiresIn": 180,
    "refreshExpiresIn": 172800,
    "user": {
      "id": "01930b2e-7af1-7000-8a00-...",
      "phone": "+919876543210",
      "name": null,
      "profileImage": null,
      "isKycComplete": false,
      "consentAccepted": true
    }
  }
}
```

**Errors**
| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | OTP not 4 digits, phone malformed |
| 401 | `OTP_EXPIRED` | Redis key missing (expired or never sent) |
| 401 | `OTP_INVALID` | Hash mismatch — increments attempt counter |
| 429 | `OTP_LOCKED` | ≥ 5 failed attempts in 15 min |

**Service flow**
1. Read `cravix:otp:attempts:{phone}` — if ≥ 5, throw `OTP_LOCKED`.
2. `redis.get('cravix:otp:{phone}')` — if missing, throw `OTP_EXPIRED`.
3. `bcrypt.compare(otp, stored)` — on miss: `redis.incr('cravix:otp:attempts:{phone}')`, set 15-min TTL on first miss, throw `OTP_INVALID` (or `OTP_LOCKED` once threshold hit).
4. On match: `redis.del` both OTP keys (single-use enforced).
5. `Rider.upsert({where:{phone}})` — first-login creates an empty rider row.
6. If `consentVersion` provided and rider hasn't consented yet, persist `consentVersion` + `consentGivenAt` (DPDPA).
7. Mint `accessToken` (3 min, claims `{sub, phone, role:'rider', type:'access', jti}`) + `refreshToken` (2 days, claims `{sub, phone, type:'refresh', jti}`).
8. **Single-device policy:** `redis.set('cravix:refresh:{riderId}', '{jti}:{bcrypt(jti+token)}', 'EX', 172800)` — overwrites any prior session.
9. Insert `AuthEvent { type: 'OTP_VERIFIED' }`.

### 2.3 `POST /api/v1/auth/refresh`

Rotate access + refresh tokens.

| | |
|---|---|
| Auth | None (the refresh token IS the auth) |
| Rate limit | 30 / hour / IP |
| Validation | `RefreshSchema = z.object({ refreshToken: z.string().min(20).max(2048) })` |

**Request**
```json
{ "refreshToken": "eyJhbGciOiJIUzI1NiIs..." }
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "token": "eyJ...",            // new ACCESS — 3 min
    "refreshToken": "eyJ...",     // new REFRESH — 2 days (rotated)
    "expiresIn": 180,
    "refreshExpiresIn": 172800
  }
}
```

**Errors**
| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Token missing or wrong shape |
| 401 | `UNAUTHORIZED` | Signature invalid, token expired, wrong `type` claim, refresh hash absent in Redis |
| 401 | `TOKEN_REUSE_DETECTED` | jti mismatch — old refresh presented after rotation. **All sessions for this rider are revoked.** |

**Service flow**
1. `jwt.verify(refreshToken, JWT_REFRESH_SECRET, { issuer, audience })`. Reject if `type !== 'refresh'`.
2. `redis.get('cravix:refresh:{riderId}')` → `'{storedJti}:{bcrypt(...)}'`.
3. If missing → `UNAUTHORIZED('Refresh token revoked or expired')`.
4. If stored jti ≠ token jti → **token-reuse detection**: `redis.del('cravix:refresh:{riderId}')` (revokes the active session), insert `AuthEvent { type: 'TOKEN_REUSE' }`, throw `TOKEN_REUSE_DETECTED`.
5. `bcrypt.compare(jti+token, storedHash)` — on miss, treat as reuse (same flow).
6. Mint new pair, `redis.set` overwrite (TTL re-applied).
7. Insert `AuthEvent { type: 'REFRESH', metadata: { newJti } }`.

### 2.4 `POST /api/v1/auth/logout`

Revoke refresh token.

| | |
|---|---|
| Auth | Bearer access token required |

**Response 200**
```json
{ "success": true }
```

Service: `redis.del('cravix:refresh:{riderId}')`; `AuthEvent { type:'LOGOUT' }`. Idempotent — succeeds even if already logged out.

## 3. Frontend Integration

| Change | File | Notes |
|---|---|---|
| Token store moved from AsyncStorage → expo-secure-store | `src/services/storage/secureTokenStore.ts` (new) | Tokens go to iOS Keychain / Android Keystore. `AFTER_FIRST_UNLOCK` accessibility so background hydration still works. |
| `useAuthStore` rebuilt | `src/features/auth/state/authStore.ts` | Holds `token`, `refreshToken`, `accessTokenExpiresAt`, `user`, `isAuthenticated`, `isHydrating`. New `setAuth(payload)` accepts the full DTO from `/auth/verify`; `setTokens(...)` for refresh-only updates; `logout()` wipes SecureStore + state. `initialize()` on cold-start checks refresh-expiry and re-hydrates. |
| Single source of truth for the JWT | various | `@user_token` AsyncStorage key removed from writes (`OtpScreen`) and reads (`authStore`, `useProfileData`, `SettingsScreen`). |
| Axios refresh-on-401 with single-flight | `src/services/api/client.ts` | On 401 (except for `/auth/login|verify|refresh`), one `/auth/refresh` is attempted. Concurrent 401s share `inflightRefresh`. On success the original request retries with the new token; on failure the rider is logged out. |
| Auth service typed | `src/services/api/features/auth.ts` | `LoginResponse`, `VerifyResponse`, `VerifyResponseData` exported. `login`, `verify`, `refresh`, `logout` methods. Endpoint paths now include `/api/v1` prefix. |
| OtpScreen rewired | `src/features/auth/screens/OtpScreen.tsx` | Calls `setAuth({ token, refreshToken, expiresIn, refreshExpiresIn, user })`. Branches on `user.isKycComplete` to route `/(tabs)/home` vs `/kyc`. Drops `@user_token` write. Strips OTP from error logs. |
| Logout handlers consolidated | `useProfileData.ts`, `SettingsScreen.tsx` | Both now call `authService.logout()` (best-effort) then `useAuthStore.getState().logout()` (always). |
| Env-driven base URLs | `src/core/config/env.ts` + `app.json:extra` | `ENV.API_URL` and `ENV.SOCKET_URL` come from `Constants.expoConfig.extra`. Hardcoded LAN IPs still serve as dev defaults but are overridable per EAS profile. |
| Expo plugins added | `app.json` | `expo-secure-store`, `expo-camera`, `expo-image-picker`, `expo-location` (with background location enabled), `expo-notifications`. iOS `infoPlist` strings + Android `permissions[]` populated. iOS `bundleIdentifier` and Android `package` set to `com.cravix.rider`. |

## 4. Code Walkthrough

### 4.1 JWT minting (`shared/utils/jwt.ts`)
- `mintAccess({riderId, phone})` signs with `JWT_ACCESS_SECRET`, expiry `Config.JWT_ACCESS_EXPIRY` (`3m`), and includes a fresh UUIDv7 `jti` so the refresh-rotation can detect old vs new.
- `mintRefresh({riderId, phone})` signs with the *separate* `JWT_REFRESH_SECRET` so a stolen access secret can't forge refresh tokens.
- `verifyAccessToken` walks the current then the optional `JWT_ACCESS_SECRET_PREVIOUS` so secrets can be rotated without forcing every rider to re-login.
- `parseExpiryToSeconds` converts `"3m"` → `180`, `"2d"` → `172800` so the response can include `expiresIn` for the frontend.

### 4.2 Single-device, one-time-use refresh (`modules/auth/service.ts`)

The refresh hash stored in Redis is `'{jti}:{bcrypt(jti + ":" + refreshToken)}'`. On every refresh:

1. The presented token's `jti` is compared against the stored `jti`. Mismatch ⇒ token reuse detected (an attacker — or an out-of-order client — is presenting an already-rotated token).
2. On reuse, **all sessions for the rider are revoked** (the Redis key is deleted), forcing a fresh OTP login. This is a deliberate trade-off: a rare false-positive (e.g. a backgrounded app racing the foreground refresh) over a stolen-token replay.
3. On a clean rotation, the new pair overwrites the Redis key (TTL refreshed to 2 days), so the previous refresh becomes immediately unusable.

### 4.3 Custom JWT middleware (`middleware/auth.ts`)
- Reads `Authorization: Bearer <token>`.
- Calls `verifyAccessToken` — rejects refresh tokens (`type !== 'access'`).
- Sets `req.user = { id, phone, role: 'rider' }` and `res.locals.riderId` so the request logger can include it.
- All errors are funnelled into `UnauthorizedError` so the global handler emits a consistent envelope.

### 4.4 Rate limiting (`middleware/rate-limiter.ts`)
- Uses `rate-limit-redis` so counters are shared across all 8 instances (spec §14).
- Three named limiters exported: `globalLimiter` (100/min/IP), `otpLimiter` (5/10min/phone — `keyGenerator` reads `req.body.phone`), `refreshLimiter` (30/hour/IP), `withdrawLimiter` (3/day/IP — for the wallet slice).

### 4.5 Error envelope (`middleware/error-handler.ts`)
- Zod errors → 400 with `details: [{field, message}]` per spec §11.
- `AppError` subclasses → spec §12 codes, status taken from the error.
- Unknown errors → 500 `INTERNAL_ERROR` with no body details (only logged).

## 5. Security Measures

| Measure | Implementation |
|---|---|
| OTPs hashed before storage | `bcrypt.hash(otp, 10)` (round count configurable via `OTP_BCRYPT_ROUNDS`) |
| OTP single-use | Both `cravix:otp:{phone}` and `cravix:otp:attempts:{phone}` are deleted on first match |
| OTP brute-force lock | 5 failed attempts in 15 min → `OTP_LOCKED` 429 |
| OTP rate-limited per phone | `keyGenerator` in `otpLimiter` uses request-body phone — works for both login and verify |
| Refresh-token rotation | One-time-use; presenting an old refresh after rotation revokes all sessions for the rider |
| Single-device login | Refresh key is keyed by `riderId` only (no deviceId), so a new login overwrites the prior session |
| Distinct JWT secrets | `JWT_ACCESS_SECRET` ≠ `JWT_REFRESH_SECRET` — secret rotation per type independent |
| Token type pinning | `type` claim enforced on both verify paths — access rejected at refresh, refresh rejected at API gateway |
| Issuer/audience pinned | `JWT_ISSUER` + `JWT_AUDIENCE` checked on every verify |
| PII redaction in logs | Winston format strips `otp`, `token`, `accessToken`, `refreshToken`, etc. before serializing |
| OTP never logged in prod | Dev-only `logger.warn` print; in prod the OTP only ever leaves the process via the SMS queue |
| No Passport/express-validator | Custom JWT middleware + Zod-only schemas (spec §15) |
| Helmet + HPP + CSP | `default-src 'none'; frame-ancestors 'none'` since we serve only JSON |
| HSTS 1y on TLS | Set in helmet config; Nginx terminates TLS |
| Secure transport for tokens | `expo-secure-store` (Keychain/Keystore) on the device, never AsyncStorage |
| Auth-event audit trail | `AuthEvent` table records OTP_SENT, OTP_VERIFIED, OTP_FAILED, REFRESH, LOGOUT, TOKEN_REUSE with IP + UA — supports forensics if a session is questioned |

## 6. How to Run

```bash
cd backend

# 1. Bring up infra (Postgres, PgBouncer, Redis, Nginx)
pnpm docker:up

# 2. Generate Prisma client + apply migrations
pnpm prisma:generate
pnpm prisma:migrate

# 3. Run the API gateway in watch mode
pnpm dev
# → http://localhost:3000/health/ready
```

Smoke test the OTP flow:
```bash
# Issue an OTP — the dev log prints the 4-digit code
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+919876543210"}'

# Verify with the printed code
curl -X POST http://localhost:3000/api/v1/auth/verify \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+919876543210","otp":"1234","consentVersion":"v1"}'

# Refresh
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<paste-from-verify>"}'

# Logout (Bearer access token from verify or refresh response)
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H 'Authorization: Bearer <access>'
```

## 7. Files Created / Modified

**Backend (created):**

```
backend/package.json                                  ── pnpm workspace root
backend/pnpm-workspace.yaml
backend/tsconfig.base.json
backend/.env.example
backend/.gitignore
backend/.eslintrc.cjs
backend/.prettierrc
backend/README.md
backend/docker-compose.yml
backend/infra/nginx/nginx.conf
backend/infra/docker/api-gateway.Dockerfile
backend/prisma/schema.prisma
backend/prisma/seed.ts
backend/packages/shared-config/{package.json,tsconfig.json,src/index.ts}
backend/packages/shared-errors/{package.json,tsconfig.json,src/index.ts}
backend/packages/shared-logger/{package.json,tsconfig.json,src/index.ts}
backend/packages/shared-redis/{package.json,tsconfig.json,src/index.ts}
backend/packages/shared-types/{package.json,tsconfig.json,src/index.ts}
backend/services/api-gateway/package.json
backend/services/api-gateway/tsconfig.json
backend/services/api-gateway/src/index.ts
backend/services/api-gateway/src/app.ts
backend/services/api-gateway/src/config/database.ts
backend/services/api-gateway/src/middleware/{request-id,cors,security,request-logger,error-handler,request-validator,rate-limiter,auth}.ts
backend/services/api-gateway/src/shared/utils/{async-handler,jwt,uuid}.ts
backend/services/api-gateway/src/shared/types/express.d.ts
backend/services/api-gateway/src/health/{controller,routes}.ts
backend/services/api-gateway/src/modules/auth/{schemas,types,repository,service,controller,routes,events}.ts
backend/docs/auth-slice/IMPLEMENTATION.md
backend/docs/auth-slice/SELF_REVIEW.md
```

**Frontend (modified):**

```
src/core/config/env.ts                                  ── env now sourced from Constants.expoConfig.extra
src/features/auth/state/authStore.ts                    ── access + refresh + secure-store + hydrate state
src/services/storage/secureTokenStore.ts (new)          ── Keychain/Keystore wrapper
src/services/api/client.ts                              ── env baseURL + refresh-on-401 single-flight
src/services/api/features/auth.ts                       ── typed Login/Verify/Refresh/Logout, /api/v1 prefix
src/features/auth/screens/OtpScreen.tsx                 ── new payload shape, isKycComplete branch, no @user_token
src/features/profile/hooks/useProfileData.ts            ── server logout + authStore.logout()
src/features/profile/screens/SettingsScreen.tsx        ── server logout + authStore.logout()
package.json                                            ── + expo-secure-store
app.json                                                ── plugins (camera, image-picker, location, notifications, secure-store), iOS infoPlist, Android permissions, extra block
```

## 8. Open Items Carried Forward

These are tracked as work for upcoming slices, not gaps in the auth slice itself:

- **SMS dispatch:** OTP currently logged in dev. The `notifications` BullMQ queue + MSG91 worker arrive in the Notifications slice.
- **Socket.IO auth handshake:** the access token will be presented as `socket.handshake.auth.token`. The socket-gateway service is built in the Socket slice (#4 in the sequencing plan).
- **DPDPA consent screen:** the `consentVersion: 'v1'` is passed through from the OTP screen but the UI still needs a consent-capture screen with the legal text. Tracked for the KYC slice (the screen sits between OTP and KYC anyway).
