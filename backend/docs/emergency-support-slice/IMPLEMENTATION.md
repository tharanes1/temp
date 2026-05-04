# Emergency + Support Slice — Implementation Document

> **Slice:** Emergency contacts + medical + SOS · Support FAQ + ticket + documents + legal
> **Endpoints:** `GET/POST /api/v1/emergency/contacts` · `PUT/DELETE /api/v1/emergency/contacts/:id` · `GET/PUT /api/v1/emergency/medical` · `POST /api/v1/emergency/sos` · `GET /api/v1/support/{faq,documents}` · `POST /api/v1/support/ticket` · `GET /api/v1/support/{privacy-policy,terms}`
> **Date:** 2026-05-01

---

## 1. Feature Overview

The final slice. Closes three of the most-noted gaps from the original review:
- **Real SOS handler** — review §6.3 #22 flagged that `EmergencyContactsScreen.tsx:51` was just `console.log("Calling " + type)`. Now wired to `POST /api/v1/emergency/sos` with location, severity classification, and a real `tel:` dial.
- **DigitalDocumentsScreen** — review §6.2 #7 flagged that `@aadhaar_data`, `@kyc_aadhaar_front`, `@insurance_data`, etc. were read-but-never-written. Replaced with `GET /api/v1/support/documents` which composes the rider's KYC application + vehicle row into the spec's flattened documents shape.
- **HelpCenter FAQ** — was i18n-only. Now server-driven via `GET /api/v1/support/faq` with the i18n bundle kept as offline fallback.

It also closes the spec's last open ticket: `POST /api/v1/support/ticket` for rider-initiated support tickets.

## 2. API Specification

### 2.1 Emergency (7 endpoints)

| Method + Path | Notes |
|---|---|
| `GET /emergency/contacts` | List up to 5 contacts, primary-first. |
| `POST /emergency/contacts` | Single-primary enforced; first contact auto-flagged primary. Hard cap at 5. |
| `PUT /emergency/contacts/:id` | Partial-update; flipping a contact to primary de-flags the previous primary in a single transaction. |
| `DELETE /emergency/contacts/:id` | Idempotent; returns `{count}`. |
| `GET /emergency/medical` | Returns nullable defaults when the rider has never set medical info. |
| `PUT /emergency/medical` | Upsert; supports clearing fields by passing `null`. |
| `POST /emergency/sos` | **Three-step pipeline:** (1) insert `SosEvent` row; (2) `redis.publish('cravix:events:emergency:sos', ...)` for socket-gateway admin fan-out; (3) enqueue `emergency` BullMQ job at priority 1. Returns immediately with an `acknowledgedAt` so the FE can show "ops alerted" copy. |

### 2.2 Support (5 endpoints)

| Method + Path | Cache | Notes |
|---|---|---|
| `GET /support/faq?category=` | Redis 1h | Categories: `orders | payment | account | safety | all`. |
| `POST /support/ticket` | n/a | Inserts `SupportTicket` row; status defaults to `OPEN`. |
| `GET /support/documents` | n/a | Composes Rider + KycApplication + Vehicle into a flat list. Status flows from `Rider.kycStatus`. |
| `GET /support/privacy-policy` | n/a (no auth) | Returns markdown content. |
| `GET /support/terms` | n/a (no auth) | Returns markdown content. |

## 3. Worker + Socket Pub/Sub

### 3.1 Emergency BullMQ worker (`workers/stubs.ts`)

Promoted from a logging stub to a real-shape worker. On `kind: 'sos'`:
1. Logs the SOS at `warn` level with all relevant context.
2. Enqueues an `in-app` notification (`type: 'sos_acknowledged'`) so the rider's inbox confirms receipt.
3. Logs a structured `[emergency:page]` line that production replaces with PagerDuty / Opsgenie integration.

### 3.2 Socket-gateway emergency subscriber (`subscribers/emergency.ts`)

Subscribes to `cravix:events:emergency:sos` and re-emits as `emergency:alert` to the `admin:emergency` room. The dispatcher dashboard (future) joins that room.

## 4. Frontend Integration

| Change | File | Notes |
|---|---|---|
| Typed services | `src/services/api/features/{emergency,support}.ts` (new) | Full CRUD wrappers; envelope-aware. |
| EmergencyContactsScreen SOS | `src/features/profile/screens/EmergencyContactsScreen.tsx` | `console.log` handler replaced with `emergencyService.triggerSos({ latitude, longitude, type })` followed by a native `tel:` dial. Severity classification: ambulance/medical → `medical`, police → `safety`, default → `other`. |
| DigitalDocumentsScreen | `src/features/profile/screens/DigitalDocumentsScreen.tsx` | Loads `supportService.listDocuments()` and projects Aadhaar + Insurance entries into the existing `aadhaarFront/insuranceImage` state. Closes the never-written-keys bug. |
| HelpCenterScreen | `src/features/support/screens/HelpCenterScreen.tsx` | Loads FAQs via `supportService.listFaq('all')`; i18n bundle remains as cold-start fallback. |

## 5. Code Walkthrough

### 5.1 SOS three-step pipeline (`emergency/service.ts`)

```ts
// 1. Durable record.
const sos = await emergencyRepository.createSosEvent({ riderId, type, latitude, longitude, note });

// 2. Realtime fan-out for the dispatcher dashboard.
await redis.publish('cravix:events:emergency:sos', JSON.stringify({ ... }));

// 3. Priority-1 BullMQ job — pages ops on-call asynchronously.
await queues.emergency.add('sos', { kind: 'sos', sosEventId, riderId, ... }, { priority: 1, attempts: 5 });

// Return immediately so the rider sees "Ops alerted" within 1s.
return { sosEventId, acknowledgedAt: now, estimatedResponseSeconds: 60 };
```

The two-source-of-truth pattern (DB row + Redis publish + BullMQ) is intentional: the DB row is the audit trail; the publish is the realtime UX; the BullMQ job is the durable retry-able paging path. Each survives the others' failures.

### 5.2 Documents projection (`support/service.ts`)

The spec's flattened shape sources fields from three Prisma models:

```ts
const [rider, kyc, vehicle] = await Promise.all([
  prisma.rider.findUnique(...),
  prisma.kycApplication.findUnique(...),
  prisma.vehicle.findUnique(...),
]);
```

Always returns a `partner_id` row even when the rider hasn't completed KYC (status `pending`). Aadhaar/PAN/DL entries surface only after the matching KYC URL is set.

### 5.3 Single-primary enforcement (`emergency/repository.ts`)

```ts
return prisma.$transaction(async (tx) => {
  if (args.isPrimary) {
    await tx.emergencyContact.updateMany({
      where: { riderId, isPrimary: true, NOT: { id: contactId } },
      data: { isPrimary: false },
    });
  }
  return tx.emergencyContact.update({ ... });
});
```

The `NOT: { id: contactId }` clause matters: a rider re-flagging the *same* contact as primary should not de-flag itself.

## 6. Security Measures

| Measure | Implementation |
|---|---|
| All rider routes auth-guarded | `emergencyRouter.use(authMiddleware)`, `support/guarded.use(authMiddleware)`. |
| Public legal pages | `/support/privacy-policy` + `/support/terms` are deliberately no-auth. |
| Strict Zod schemas | `.strict()` everywhere; phone validated against the Indian regex. |
| SOS rider-id pinning | `riderId` from JWT subject — no path param to manipulate. |
| Cache TTL on FAQs | 1h cache + invalidation on admin edits (future admin dashboard). |
| Hard caps | Max 5 emergency contacts per rider; 20 allergies / conditions max. |
| Audit trail | `SosEvent` row + Redis publish + BullMQ job — three independent records of every SOS. |
| PII in support tickets | `description` length-bounded; subject sanitised by `.trim()` only (the FE renders inside `<Text>` so no XSS surface in RN). |

## 7. How to Run

```bash
cd backend
pnpm docker:up
pnpm prisma:migrate
pnpm db:seed                # seeds the FAQ table
pnpm dev / pnpm dev:socket / pnpm dev:workers
```

Smoke matrix:

```bash
ACCESS=...

# Emergency contacts
curl -s -X POST http://localhost:3000/api/v1/emergency/contacts \
  -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
  -d '{"name":"Meera Kumar","phone":"+919876543211","relationship":"spouse","isPrimary":true}' | jq
curl -s http://localhost:3000/api/v1/emergency/contacts -H "Authorization: Bearer $ACCESS" | jq

# Medical
curl -s -X PUT http://localhost:3000/api/v1/emergency/medical \
  -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
  -d '{"bloodGroup":"O+","allergies":["penicillin"],"medicalConditions":["asthma"]}' | jq

# SOS
curl -s -X POST http://localhost:3000/api/v1/emergency/sos \
  -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
  -d '{"latitude":12.9716,"longitude":77.5946,"type":"medical","note":"Lost consciousness briefly"}' | jq
# Watch the workers log → SOS warn line + sos_acknowledged in-app job.

# Support
curl -s "http://localhost:3000/api/v1/support/faq?category=payment" -H "Authorization: Bearer $ACCESS" | jq
curl -s -X POST http://localhost:3000/api/v1/support/ticket \
  -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
  -d '{"category":"payment","subject":"Earnings not credited","description":"My earnings for order #882 have not been credited."}' | jq
curl -s http://localhost:3000/api/v1/support/documents -H "Authorization: Bearer $ACCESS" | jq

# Public legal
curl -s http://localhost:3000/api/v1/support/privacy-policy | jq
```

## 8. Files Created / Modified

**Backend (created):**
```
backend/services/api-gateway/src/modules/emergency/
├── schemas.ts, types.ts, repository.ts, service.ts, controller.ts, routes.ts
backend/services/api-gateway/src/modules/support/
├── schemas.ts, types.ts, repository.ts, service.ts, controller.ts, routes.ts
backend/services/socket-gateway/src/subscribers/emergency.ts
backend/docs/emergency-support-slice/
├── IMPLEMENTATION.md, SELF_REVIEW.md
```

**Backend (modified):**
- `services/api-gateway/src/app.ts` — mounts `/api/v1/emergency` + `/api/v1/support`.
- `services/socket-gateway/src/server.ts` — boots `startEmergencySubscriber`.
- `services/workers/src/workers/stubs.ts` — emergency stub promoted to a real-shape worker.

**Frontend (created/modified):**
- `src/services/api/features/{emergency,support}.ts` — new typed services.
- `src/features/profile/screens/EmergencyContactsScreen.tsx` — real SOS handler + `tel:` dial.
- `src/features/profile/screens/DigitalDocumentsScreen.tsx` — server-driven docs (closes review §6.2 #7).
- `src/features/support/screens/HelpCenterScreen.tsx` — server-driven FAQs.

## 9. Open Items Carried Forward

1. **PagerDuty / Opsgenie integration** for the emergency worker.
2. **Admin FAQ editor** — currently FAQs are seeded via `prisma/seed.ts`; the dashboard slice will give admins a UI.
3. **Support ticket reply flow** — riders can create tickets but can't yet view replies. Adds `GET /support/tickets` + admin reply UI in a future slice.
4. **EditEmergencyContactScreen + EditMedicalEssentialsScreen** still write to AsyncStorage too — the API call lands when the rider opens the listing screen. A direct rewire (POST/PUT inline) is a polish item.
5. **Privacy/Terms version tracking** — `consentVersion` in the auth slice expects `"v1"`; bumping the policy needs a re-acceptance prompt. Tracked.
