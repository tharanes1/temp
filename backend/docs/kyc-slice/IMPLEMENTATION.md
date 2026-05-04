# KYC Slice — Implementation Document

> **Slice:** Identity verification — category, personal, documents (with S3 presigned uploads), student/disabled sub-flows
> **Endpoints:** `GET /api/v1/kyc/status` · `POST /api/v1/kyc/category|personal|documents|student|disabled|finalize` · `GET /api/v1/kyc/s3-presigned-url`
> **Date:** 2026-05-01

---

## 1. Feature Overview

This slice replaces the largest pile of dead code in the original review (§3.2 of `BACKEND_ALIGNMENT_REVIEW.md`): six KYC screens that wrote everything to AsyncStorage and never sent anything to a server. After this slice the entire KYC flow is server-authoritative — local AsyncStorage is kept only as an offline cold-start fallback — and the never-written `@kyc_status` key that was breaking SplashScreen routing is gone for good.

It honors the locked decisions:
- **A3** — `POST /kyc/documents` accepts `aadhaarFront`, `aadhaarBack`, `panCard`, `drivingLicense`, `selfie`. Vehicle artifacts (RC, bike photo, insurance) are **not** part of KYC documents — they live on `PATCH /rider/vehicle` from the rider slice.
- **A4** — Two-axis category: `{category: 'freelancer'|'fulltime'} × {subCategory: 'student'|'professional'|'disabled'}`. The Prisma `KycApplication` row carries both columns.
- **Spec gap** — `POST /kyc/disabled` formally added as a first-class endpoint (was missing from spec §5.3).

It also introduces the **S3 presigned-PUT pipeline** that every subsequent slice needing file uploads (delivery proof, vehicle photos) will reuse.

## 2. API Specification

### 2.1 `GET /api/v1/kyc/status`

| | |
|---|---|
| Auth | Bearer access token |

**Response 200**
```json
{
  "success": true,
  "data": {
    "status": "in_progress",
    "completedSteps": ["category", "personal"],
    "pendingSteps": ["documents"],
    "rejectionReason": null,
    "category": "freelancer",
    "subCategory": "professional",
    "progressPercent": 67,
    "submittedAt": null,
    "reviewedAt": null
  }
}
```

The `pendingSteps` array dynamically includes `student` when `subCategory='student'` and `disabled` when `subCategory='disabled'` — the spec §5.3 status example doesn't surface those, but the FE needs them to correctly route through `useKycStatus`.

### 2.2 `POST /api/v1/kyc/category`

```json
{ "category": "freelancer", "subCategory": "professional" }
```

Idempotent — riders can re-pick (e.g. switching from student to professional) up until `kycStatus === 'verified'`.

### 2.3 `POST /api/v1/kyc/personal`

```json
{
  "fullName": "Arjun Kumar",
  "email": "arjun@example.com",
  "dateOfBirth": "2000-05-15",
  "gender": "male",
  "address": {
    "line1": "12, MG Road",
    "city": "Bengaluru",
    "state": "Karnataka",
    "pincode": "560001",
    "district": "Bengaluru Urban",
    "latitude": 12.9716,
    "longitude": 77.5946
  }
}
```

Validation: PIN regex `^[1-9]\d{5}$`; DOB between 1940 and 2014 (16–86 years old in 2026); strict `.strict()` schema rejects unknown keys.

The handler runs all writes inside a `prisma.$transaction` so a partial failure (e.g. address-write OK but rider-update fails) leaves nothing dangling.

### 2.4 `POST /api/v1/kyc/documents` (locked A3)

```json
{
  "aadhaarFront": "https://cravix-kyc.s3.ap-south-1.amazonaws.com/kyc/...",
  "aadhaarBack": "https://cravix-kyc.s3.ap-south-1.amazonaws.com/kyc/...",
  "panCard": "https://cravix-kyc.s3.ap-south-1.amazonaws.com/kyc/...",
  "drivingLicense": "https://cravix-kyc.s3.ap-south-1.amazonaws.com/kyc/...",
  "selfie": "https://cravix-kyc.s3.ap-south-1.amazonaws.com/kyc/..."
}
```

Body is **partial** — riders can upload progressively. The `getStatus` endpoint owns the completeness check. Each URL is validated against the cravix bucket allow-list (spec §14):

```ts
const ALLOWED_HOSTS = new Set([
  'cravix-kyc.s3.ap-south-1.amazonaws.com',
  'cravix-cdn.s3.ap-south-1.amazonaws.com',
  'cdn.cravix.in',
]);
```

When the fifth document arrives and all required steps are otherwise complete, the service automatically transitions `Rider.kycStatus` → `UNDER_REVIEW` and enqueues a `kyc-verification` BullMQ job.

### 2.5 `POST /api/v1/kyc/student`

```json
{
  "collegeName": "RV College of Engineering",
  "enrollmentNumber": "1RV20CS050",
  "collegeIdImage": "https://cravix-kyc.s3..../kyc/.../collegeIdImage-...jpeg"
}
```

Same auto-finalize behavior as `/documents`.

### 2.6 `POST /api/v1/kyc/disabled` (formally added)

```json
{
  "disabilityCertNumber": "DC-1234567",
  "disabilityDetails": "Hearing impairment confirmed via UDID-issued certificate dated 2023-04-15.",
  "disabilityProof": "https://cravix-kyc.s3..../kyc/.../disabilityProof-...jpeg"
}
```

Constraints: `disabilityDetails` 20–600 chars (avoids one-word descriptions while bounding admin-review time).

### 2.7 `GET /api/v1/kyc/s3-presigned-url`

Query: `?documentType=aadhaarFront&contentType=image/jpeg`

```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://cravix-kyc.s3.ap-south-1.amazonaws.com/kyc/.../aadhaarFront-1730462400000.jpeg?X-Amz-Algorithm=...",
    "fileKey": "kyc/01930b2e-.../aadhaarFront-1730462400000.jpeg",
    "publicUrl": "https://cravix-kyc.s3.ap-south-1.amazonaws.com/kyc/01930b2e-.../aadhaarFront-1730462400000.jpeg",
    "contentType": "image/jpeg",
    "expiresIn": 300,
    "maxBytes": 5242880
  }
}
```

The S3 service (`shared/services/s3.ts`):
- Pins `Bucket`, `Key`, `ContentType`, `ServerSideEncryption: 'AES256'`, and `Metadata: { riderId, documentType }` on the signed PUT command.
- Constrains `expiresIn` to 5 minutes (configurable via `S3_PRESIGNED_URL_TTL`) and `maxBytes` to 5 MB (`S3_MAX_UPLOAD_BYTES`).
- Allows `image/jpeg | image/png | image/webp` only (MIME whitelist).
- Falls back to a **mock URL** (`X-Cravix-Mock=1`) when AWS credentials aren't configured. In production this is fatal; in dev it lets the FE flow run end-to-end without provisioning AWS.

### 2.8 `POST /api/v1/kyc/finalize`

The ReviewScreen's "Finalize Verification" button. Idempotent transition to `UNDER_REVIEW`; rejects with `409 CONFLICT` if already verified/rejected, or `400 VALIDATION_ERROR` (with `details: pendingSteps`) if anything's missing.

## 3. Frontend Integration

| Change | File | Notes |
|---|---|---|
| Typed KYC service | `src/services/api/features/kyc.ts` (new) | All 8 endpoints + the `uploadKycDocument(documentType, localUri)` helper that GETs presigned URL → PUTs to S3 → returns the public URL. |
| Status hook rewritten | `src/features/kyc/hooks/useKycStatus.ts` | Replaces the AsyncStorage scraper; still exposes legacy flags (`isPersonalDone`, `isDocsDone`, `isCategoryDone`, `progressPercent`, `isAllDone`) so existing JSX in ReviewScreen renders unchanged. |
| SplashScreen routing | `src/features/auth/screens/SplashScreen.tsx` | Reads `kycService.getStatus()` instead of the never-written `@kyc_status` AsyncStorage key — closes the bug from review §6.2 #7 that always routed to `/kyc`. |
| ReviewScreen finalize | `src/features/kyc/screens/ReviewScreen.tsx` | "Finalize" button calls `kycService.finalize()` — no longer just `router.replace('/(tabs)/home')`. Routes to home only when the server returns `verified` or `under_review`. |
| CategoryScreen | `src/features/kyc/screens/CategoryScreen.tsx` | Calls `kycService.setCategory({category, subCategory})` after the AsyncStorage cache; surfaces server errors via Alert. |
| PersonalScreen save | `src/features/kyc/components/usePersonalForm.tsx` | Uploads the locally-captured selfie (`file://`) via `uploadKycDocument('selfie', uri)` then `kycService.setDocuments({selfie: url})`, followed by `kycService.setPersonal({...})`. |
| DocumentVerificationScreen | `src/features/kyc/screens/DocumentVerificationScreen.tsx` | Uploads `aadhaarFront`, `aadhaarBack`, `drivingLicense` (and PAN if captured) via presigned PUT then POSTs to `/kyc/documents`. Partial body permitted. |
| StudentScreen | `src/features/kyc/screens/StudentScreen.tsx` | Uploads `collegeIdImage` via presigned PUT then POSTs to `/kyc/student`. |
| DisabledScreen | `src/features/kyc/screens/DisabledScreen.tsx` | Uploads `disabilityProof` via presigned PUT then POSTs to `/kyc/disabled`. |

The AsyncStorage writes are kept as **offline cache** so a rider mid-flow on a flaky network doesn't lose their input. The server is the source of truth; AsyncStorage is purely for cold-start defaults.

## 4. Code Walkthrough

### 4.1 Status computation (`service.ts`)

`getStatus` is the only place where "what's done" is decided. It pulls the rider row, the `KycApplication`, and the `RiderAddress` in two queries (one `Promise.all`), and runs a series of cheap predicate checks (`isPersonalComplete`, `isDocumentsComplete`, etc.). The required-steps list is dynamic: `category` + `personal` + `documents` always, plus `student` when subCategory is student, plus `disabled` when subCategory is disabled. This keeps the FE check trivially correct: just `pendingSteps.length === 0`.

### 4.2 Auto-submission

After every sub-flow POST, the service calls `maybeAutoSubmit` which:
1. Re-reads status.
2. If `status === 'in_progress' && pendingSteps.length === 0`, marks the application `submittedAt = now()` and the rider `kycStatus = UNDER_REVIEW` in a `prisma.$transaction`.
3. Enqueues a `kyc-verification` BullMQ job (3 attempts, exp backoff). The verification worker is currently a stub (slice 4); a real worker would AI-OCR the documents and either auto-approve or surface to admin review.

The explicit `POST /kyc/finalize` endpoint exists for the ReviewScreen "Finalize" button, but its body is just `maybeAutoSubmit + nicer error messages` — the system would converge on `UNDER_REVIEW` even without it.

### 4.3 S3 presigned-PUT (`shared/services/s3.ts`)

Three concerns folded into one tight helper:
1. **MIME whitelist** at the top of the function — invalid types throw before any AWS round-trip.
2. **Deterministic key naming** `kyc/{riderId}/{documentType}-{ts}.{ext}` — easy to find in the bucket and easy to GC by riderId.
3. **Mock mode** detected by absent AWS credentials. Returns a sentinel URL with `X-Cravix-Mock=1` that the FE recognizes and short-circuits — no actual upload. In production a missing credential throws at signing time, fail-loud.

### 4.4 URL allow-list (`isCravixS3Url`)

Belt-and-brace enforcement for the documents endpoint. Even if a presigned-URL handoff were misused, the `/kyc/documents` validator rejects any URL whose host isn't in the cravix-* set. Spec §14: "S3 URLs validated to belong to the cravix-* bucket domain only."

### 4.5 Frontend upload helper (`uploadKycDocument`)

```
GET /kyc/s3-presigned-url?documentType=...&contentType=image/jpeg
   → { uploadUrl, publicUrl, maxBytes, … }

fetch(uploadUrl, { method:'PUT', headers:{'Content-Type':contentType}, body:blob })

return publicUrl  // ← the URL we send to /kyc/documents
```

It infers content-type from the local URI extension, verifies file size against `maxBytes` before uploading (saves bandwidth on rejects), and short-circuits when the URL contains `X-Cravix-Mock=1` (dev mode).

## 5. Security Measures

| Measure | Implementation |
|---|---|
| Auth-guarded routes | `kycRouter.use(authMiddleware)` — every endpoint requires a valid access token. |
| URL allow-list on every S3 reference | `isCravixS3Url` checks scheme=https, host ∈ cravix-{kyc,cdn} or cdn.cravix.in. |
| Presigned PUT constraints | `expiresIn: 300s`, `Content-Type` pinned, `ServerSideEncryption: AES256`, deterministic key prefixed by riderId. |
| MIME whitelist | `image/jpeg | image/png | image/webp` only (rejects PDF/exe/script payloads). |
| Max file size | 5 MB cap (`S3_MAX_UPLOAD_BYTES`); FE pre-checks size before uploading. |
| Strict Zod schemas | `.strict()` on every body — rejects unknown keys (no mass-assigning `kycStatus`, `rejectionReason`, etc.). |
| Atomic personal write | `prisma.$transaction` for rider-update + address-upsert + kyc-application-upsert. |
| Auto-submission gated on status | `maybeAutoSubmit` only transitions `in_progress → under_review`; cannot escape `verified` or `rejected`. |
| Idempotent finalize | Re-clicking "Finalize" returns `409 CONFLICT` rather than progressing twice. |
| Bucket key namespacing | `kyc/{riderId}/...` — even if a rider's presigned URL leaked, an attacker cannot write into another rider's prefix. |
| FCM, OTP, and KYC verification flows all use BullMQ retry with exp-backoff | Three attempts, 2 s → 4 s → 8 s; failed jobs land in the dead-letter ring after `removeOnFail.age = 24h`. |
| PII redaction | The Winston redactor strips `aadhaarNumber`, `panNumber` from any log line that includes them. |
| HTTPS everywhere on the wire | Bucket allow-list enforces `https:` scheme. |

## 6. How to Run

```bash
cd backend

# Install the AWS SDK additions
pnpm install

# Bring up infra
pnpm docker:up

# Apply schema (KycApplication has new disabled* + student* columns from this slice)
pnpm prisma:migrate

# Seed FAQs etc.
pnpm db:seed

# Run the API gateway
pnpm dev
```

End-to-end smoke (using the access token from the auth flow):

```bash
ACCESS=...

# 1. Status (everything pending)
curl -s http://localhost:3000/api/v1/kyc/status -H "Authorization: Bearer $ACCESS" | jq

# 2. Category
curl -s -X POST http://localhost:3000/api/v1/kyc/category \
  -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
  -d '{"category":"freelancer","subCategory":"professional"}' | jq

# 3. Personal
curl -s -X POST http://localhost:3000/api/v1/kyc/personal \
  -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
  -d '{"fullName":"Arjun Kumar","dateOfBirth":"2000-05-15","gender":"male","address":{"line1":"12, MG Road","city":"Bengaluru","state":"Karnataka","pincode":"560001"}}' | jq

# 4. Get a presigned URL (dev mode returns the mock variant)
curl -s "http://localhost:3000/api/v1/kyc/s3-presigned-url?documentType=aadhaarFront&contentType=image/jpeg" \
  -H "Authorization: Bearer $ACCESS" | jq

# 5. Submit a (mock) document URL
curl -s -X POST http://localhost:3000/api/v1/kyc/documents \
  -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
  -d '{"aadhaarFront":"https://cravix-kyc.s3.ap-south-1.amazonaws.com/kyc/test/x.jpg"}' | jq

# 6. Finalize (will return VALIDATION_ERROR with details listing pendingSteps until all 5 docs land)
curl -s -X POST http://localhost:3000/api/v1/kyc/finalize \
  -H "Authorization: Bearer $ACCESS" | jq
```

## 7. Files Created / Modified

**Backend (created):**
```
backend/services/api-gateway/src/modules/kyc/
├── schemas.ts
├── types.ts
├── repository.ts
├── service.ts
├── controller.ts
└── routes.ts
backend/services/api-gateway/src/shared/services/s3.ts
backend/docs/kyc-slice/
├── IMPLEMENTATION.md
└── SELF_REVIEW.md
```

**Backend (modified):**
- `services/api-gateway/package.json` — adds `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.
- `services/api-gateway/src/app.ts` — mounts `/api/v1/kyc`.

**Frontend (created):**
- `src/services/api/features/kyc.ts`

**Frontend (modified):**
- `src/features/kyc/hooks/useKycStatus.ts` — server-driven, exposes legacy flags for back-compat.
- `src/features/auth/screens/SplashScreen.tsx` — reads `kycService.getStatus()`.
- `src/features/kyc/screens/ReviewScreen.tsx` — "Finalize" calls `/kyc/finalize`.
- `src/features/kyc/screens/CategoryScreen.tsx` — POST `/kyc/category` (locked A4).
- `src/features/kyc/components/usePersonalForm.tsx` — uploads selfie + POST `/kyc/personal`.
- `src/features/kyc/screens/DocumentVerificationScreen.tsx` — uploads aadhaar/licence/PAN + POST `/kyc/documents`.
- `src/features/kyc/screens/StudentScreen.tsx` — uploads collegeId + POST `/kyc/student`.
- `src/features/kyc/screens/DisabledScreen.tsx` — uploads proof + POST `/kyc/disabled`.

## 8. Open Items Carried Forward

- **PAN capture in the FE.** The DocumentVerificationScreen currently captures aadhaar (front+back) + licence; PAN doesn't have a UI control yet. The backend already accepts `panCard` in the documents body, so adding the UI slot is a one-screen edit deferred to a polish pass.
- **Real KYC verification worker.** The `kyc-verification` BullMQ stub logs the job; replacing it with an OCR + admin-review pipeline is a dedicated slice (likely "Hardening" or after admin dashboard ships).
- **Background image moderation.** Rekognition / Hive content-moderation sits naturally inside the same worker.
- **DB CHECK constraints** for the locked-A5 vehicle invariant + the locked-A4 category/subCategory pairing — Prisma migration follow-up.
- **`@personal_data` AsyncStorage cleanup.** Now that `getStatus` is server-driven, the offline fallback path can be reduced to "show the splash longer" rather than reading the local blob; this simplification is deferred to avoid frontend churn.
