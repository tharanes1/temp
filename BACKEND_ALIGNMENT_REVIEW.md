# Cravix Rider — Frontend → Backend Alignment Review (Phase 3)

> **Status:** Phase 3 review — six §11.A blocker decisions received from the user 2026-05-01 and locked in §0 below. Awaiting one final clarification (access-token lifetime) and explicit Phase 4 approval before any backend code is written.
> **Mode:** Strict, zero-hallucination. Every claim cites the file:line in the frontend or the section in BACKEND_REQUIREMENTS.md.
> **Scope:** Cravix Rider mobile app (React Native / Expo) at `/Users/jayasilen/Desktop/Cravix-main` against `BACKEND_REQUIREMENTS.md` (uploaded May 2026).
> **Date:** 2026-05-01

---

## 0. Locked Decisions (User Answers to §11.A — 2026-05-01)

These supersede the spec wherever they differ. The `BACKEND_REQUIREMENTS.md` content remains the architectural baseline; the deltas below are the agreed deviations.

| # | Topic | Decision | Spec deviation? | Implementation impact |
|---|---|---|---|---|
| A1 | **OTP length** | **4 digits** | Yes — spec §5.1 said 6. | Zod regex changes from `/^\d{6}$/` to `/^\d{4}$/`. `crypto.randomInt(1000, 9999)`. SMS template updated. Frontend `OtpScreen` (4-digit) is unchanged. |
| A2 | **Token strategy** | **Access token = 3 minutes, refresh token = 2 days.** Frontend's existing `data.token` field maps to the **access token** (used as `Authorization: Bearer` on every API call). A new `data.refreshToken` is added. | Yes — spec §5.1 had access 15 m + refresh 7 d. | `POST /auth/verify` returns `{ data: { token /* access, 3m */, refreshToken /* 2d */, user{...} } }`. Frontend's existing `data.token` reader stays correct. `POST /auth/refresh` consumes the refresh token, rotates it (one-time-use), mints a fresh access token. Tokens stored in `expo-secure-store`. |
| A3 | **KYC document set** | **Spec wins** — `aadhaarFront`, `aadhaarBack`, `panCard`, `drivingLicense`, `selfie`. | No (frontend changes). | `POST /kyc/documents` accepts the spec's 5 fields. **Frontend changes:** `DocumentVerificationScreen` removes RC/bike-photo/insurance/licence-back capture and adds PAN-card capture. RC + bike-photo + insurance number/policy capture moves into a new `/(profile)/vehicle-info` edit flow that calls `PATCH /rider/vehicle` (extended schema — see A5). |
| A4 | **Categories taxonomy** | **Frontend wins** — two-axis: `category ∈ {freelancer, fulltime}` × `subCategory ∈ {student, professional, disabled}`. | Yes — spec §5.3 had single-axis `{student, professional, part_time}`. | New `POST /kyc/category` Zod schema: `{ category: z.enum(['freelancer','fulltime']), subCategory: z.enum(['student','professional','disabled']) }`. Prisma `KycApplication` gets two columns: `category Category`, `subCategory SubCategory` with check constraints. **`subCategory='disabled'`** triggers a new `POST /kyc/disabled` endpoint (formally added — see §6.6). |
| A5 | **Vehicle vs bike type** | Capture **both**: `vehicleType ∈ {petrol, ev}` (fuel / powertrain) AND `bikeType ∈ {bike, bicycle, scooter, ev}` (form factor). | Yes — spec §5.2 only had `vehicleType ∈ {bike, bicycle, scooter, ev}`. | `PATCH /rider/vehicle` Zod schema extended: `{ vehicleType: z.enum(['petrol','ev']).optional(), bikeType: z.enum(['bike','bicycle','scooter','ev']).optional(), make, model, year, registrationNumber, rcImage, bikePhoto, insuranceNumber, insurancePolicy, insuranceExpiry }`. Refinement: `bikeType==='bicycle' ⇒ vehicleType` is null. Prisma `Vehicle` model gets both columns. |
| A6 | **Currency units** | **Display format `₹4,250.34` (rupees, 2 decimals)**. API returns money as **decimal numbers in rupees** (e.g. `4250.34`), not paise integers. | Yes — spec §13 said "integer arithmetic in paise; never floating-point". | All money fields in API responses are `number` rupees with ≤ 2 decimals. **Internally** the backend still stores money as `Decimal(12,2)` in Postgres (Prisma `@db.Decimal(12,2)`) — never IEEE-754 float — to avoid rounding bugs. Conversion `Decimal → number` happens only at the JSON serializer. **No paise integers anywhere on the wire.** Frontend formatter unchanged: `toLocaleString('en-IN', { style:'currency', currency:'INR' })`. |

### Locked-decision corollaries

- **A1:** spec §5.1 example `"otp": "483921"` becomes 4-digit (`"4839"`). Redis key `cravix:otp:{phone}` still stores `bcrypt(otp)`; lockout still triggers after 5 failed attempts.
- **A2:** Refresh tokens are **rotated on every refresh** (one-time-use) — old refresh hash is deleted from Redis, new one stored. Refresh hash lives in Redis at `cravix:refresh:{riderId}` with 2-day TTL. Logout deletes the key. Failed-refresh detection: if a stale (already-rotated) refresh token is presented, all sessions for that rider are revoked (token-reuse detection). Single-device policy — new login replaces the existing refresh key.
- **A2:** Socket.IO handshake uses the **access** token (not refresh), with the socket re-authenticating each time a fresh access is minted.
- **A4:** `KycStatus` enum unchanged. The two-axis category stored as two columns on `KycApplication`. The disabled sub-category routes through `POST /kyc/disabled` (added in §6.6).
- **A5:** Zod refinement and DB CHECK constraint enforce: `bikeType IN ('bike','scooter','ev') ⇒ vehicleType IS NOT NULL`; `bikeType='bicycle' ⇒ vehicleType IS NULL`.
- **A6:** Prisma `Decimal` is used everywhere money appears: `WalletAccount.totalBalance @db.Decimal(12,2)`, `Order.baseEarnings @db.Decimal(8,2)`, etc. All aggregates use `Decimal.sum`, never `+`. Spec §9 model field names that ended in `Paise` (`baseEarningsPaise`, `bonusPaise`, `totalBalancePaise`, `availableBalancePaise`, `pendingSettlementPaise`, `cashInHandPaise`) are **renamed** without the `Paise` suffix and re-typed as `Decimal(12,2)`. Spec §11 envelopes that returned `2500` for `₹25.00` now return `25.00`.

### Operational defaults (user approved 2026-05-01 — "Proceed with defaults")

- **SMS provider:** MSG91 (env `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`). Failover: AWS SNS (deferred, document only).
- **Push provider:** Firebase FCM. Service account JSON to be supplied by the user before the Notifications slice.
- **Payment gateway:** Razorpay (penny-drop + payouts). Webhook signature verified per Razorpay docs.
- **Multi-device:** Single device — new login revokes prior refresh token.
- **Token storage on device:** `expo-secure-store` (iOS Keychain / Android Keystore).
- **S3 buckets:** `cravix-kyc` (private), `cravix-cdn` (public read). User to confirm provisioning + CORS before the KYC slice.
- **Maps API key:** User to provision GCP key with Android-SHA + iOS-bundle pinning before the Location slice.
- **Retention:** Location history 30 d, notifications 90 d, orders kept indefinitely (archived after 1 y), riders soft-deleted (`deletedAt`).
- **Spec-gap UIs to build:** Cash-in-Hand reconcile, monthly statements, delivery-proof photo capture, support-ticket creation. Wallet QR feature **deferred** until properly threat-modelled.
- **DPDPA consent:** new consent capture screen on first login + `riders.consentVersion` column. Implemented in the Auth slice.
- **Open: FCM service-account JSON, Razorpay credentials, GCP Maps key, S3 CORS** — backend will use placeholders/local-mocks until provided. Implementation will not be blocked by their absence.

---

## 1. Executive Summary

The Cravix Rider frontend is a feature-complete React Native (Expo Router) hyperlocal-delivery rider app with **45+ screens** spanning auth, KYC (5 sub-flows), home, orders, shifts, earnings, wallet, profile, emergency, and support. Of those screens, **only two endpoints are wired to a real backend**: `POST /auth/login` and `POST /auth/verify`. **Every other dynamic surface — orders, earnings, leaderboards, wallet, KYC submission, notifications, alerts, demand heatmaps, operating zones, shifts persistence, vehicle info — is currently driven by AsyncStorage, hardcoded mock arrays, or `Math.random()`.**

The supplied `BACKEND_REQUIREMENTS.md` specifies a distributed Express 5.x backend (8 instances behind Nginx, Redis cluster, BullMQ, PgBouncer → PostgreSQL, Socket.IO + Redis adapter) with **11 service domains, ~60 REST endpoints, 14 Socket.IO events, 7 BullMQ queues, 16 Redis key patterns, and a complete Prisma schema**. The architecture is sound and clearly designed for 80K concurrent riders.

The work ahead is therefore **two parallel tracks**:

1. **Backend implementation** — build the 11 services exactly per spec (no deviations, no API drift).
2. **Frontend reconciliation** — replace hardcoded fixtures with API/Socket calls, fix existing bugs that block integration (token-source duality, AsyncStorage keys read-but-never-written, OTP length 4 vs spec 6, currency units rupees vs paise, etc.).

**29 concrete frontend ↔ spec mismatches** are catalogued in §6 below. Most are non-blocking and can be addressed during integration, but **six are hard-blockers** that must be agreed on before backend coding begins:

| # | Blocker | Choice the user must make |
|---|---|---|
| 1 | **OTP length**: frontend uses 4 digits, spec uses 6. | Change frontend to 6, or relax spec to 4? |
| 2 | **Login response shape**: frontend reads `data.token` (single token), spec returns `accessToken`+`refreshToken`. | Add refresh-token flow to frontend, or backend aliases `data.token = accessToken`? |
| 3 | **KYC document set mismatch**: frontend captures Aadhaar (front+back), Licence (front), RC, bike photo, insurance number+policy. Spec accepts Aadhaar, Pan, DL, Selfie. | Confirm authoritative document list. |
| 4 | **Categories taxonomy**: frontend `{freelancer, fulltime} × {student, professional, disabled}`. Spec `category ∈ {student, professional, part_time}`. | Pick one canonical taxonomy. |
| 5 | **Vehicle type vs fuel type**: frontend captures fuel type `{petrol, ev}` and vehicle number; spec captures vehicle type `{bike, bicycle, scooter, ev}`. | Decide what schema we capture. |
| 6 | **Currency units**: frontend renders rupees with decimals (`4,250.34`); spec mandates paise integers (`425034`). | Confirm spec wins (recommended) — frontend formatter must change everywhere. |

Once §11 (Clarification Questions) is answered, backend implementation can begin in the order proposed in §8.4.

---

## 2. Frontend Architecture Overview

### 2.1 Tech stack (verified from `package.json`)

- **Runtime:** React Native 0.81.5, React 19.1.0, Expo SDK 54.
- **Routing:** `expo-router` 6 (file-based).
- **State:** `zustand` 5 (one store: `authStore`), React Context (5 providers).
- **HTTP:** `axios` 1.15.2 (single client at `src/services/api/client.ts`).
- **Realtime:** `socket.io-client` 4.8.3 (declared and instantiated, but **`connect()` is never invoked**).
- **Maps:** `react-native-maps` 1.20.1 with `PROVIDER_GOOGLE` (Android key is the literal placeholder `"YOUR_GOOGLE_MAPS_API_KEY"` in `app.json:13,19`).
- **Camera/Images:** `expo-camera` 17, `expo-image-picker` 17.
- **Location:** `expo-location` 19 (foreground only — no `expo-task-manager`, no background updates).
- **Push:** `expo-notifications` 0.32.17 listed as dep but **never imported anywhere** (verified by grep). No FCM/APNs registration code.
- **i18n:** `i18next` 26 + `react-i18next` 17 with **6 languages**: en, ta, hi, kn, ml, te (`src/core/i18n.ts:6-11`).
- **Persistence:** `@react-native-async-storage/async-storage` 2.2.0 used directly across the codebase (a `storage.ts` wrapper exists at `src/services/storage/storage.ts` but is unused).

### 2.2 Source-tree organisation

```
app/                      ← expo-router routes (mostly thin re-exports)
src/
├── core/                 ← cross-cutting providers, config, navigation, i18n
│   ├── providers/        (AppProvider, UserContext, LanguageContext, SettingsContext, ThemeProvider)
│   ├── config/           (env.ts*, constants.ts, user.ts**, incentives.ts**)
│   ├── i18n.ts
│   └── navigation/router.ts
├── features/             ← feature modules (DDD-ish slicing)
│   ├── auth/             (state/authStore, screens: Splash/Login/Otp/AppGuide)
│   ├── home/             (HomeScreen, HeatmapScreen, OperatingZonesScreen, components, hooks)
│   ├── kyc/              (5 screens: Review, Personal, DocumentVerification, Category, Student, Disabled)
│   ├── orders/           (Orders, DeliveryRequest, ActiveNavigation)
│   ├── earnings/         (EarningsScreen, IncentivesScreen, LeaderboardScreen)
│   ├── shifts/
│   ├── profile/          (Profile, ProfileDetails, VehicleInfo, DigitalDocuments, Settings, Emergency*)
│   ├── wallet/           (CashInHand, Allowance, AccountStatements, PaymentHistory, BankAccounts, AddBank)
│   ├── notifications/    (Notifications, Alerts)
│   ├── support/          (HelpCenter, Instructions, Privacy, Terms)
│   └── map/              (LocationProvider, useLocation)
├── services/
│   ├── api/              (client.ts, endpoints.ts, features/{auth,rider,wallet,orders}.ts)
│   ├── socket/socketClient.ts
│   ├── location/geocode.ts
│   └── storage/storage.ts  ← unused
├── shared/               (UI primitives, store/tourStore, config/maps.ts*)
├── types/index.ts
└── assets/locales/{en,ta,hi,kn,ml,te}/common.json

* env.ts and shared/config/maps.ts contain placeholder URLs/keys that the running code does not actually import.
** user.ts and incentives.ts are seed/fixture files used as defaults by UserContext and IncentivesScreen.
```

### 2.3 Navigation map (45 screens, abbreviated)

`/`(Splash) → `/login` → `/otp` → `/kyc` → `/(tabs)/home` is the happy path. Inside `(tabs)`: home, shifts, orders, earnings, profile (explore is hidden). Modal/secondary stacks: `(home)` (heatmap, alerts, notifications, leaderboard, incentives, operating-zones), `(orders)` (delivery-request, active-navigation, instructions), `(wallet)` (add-bank, payment-history, bank-accounts, cashinhand), `(profile)` (settings, allowance, vehicle-info, account-statements, help-center, profile-details, privacy-policy, app-guide, digital-documents, terms-of-service), `(emergency)` (emergency-contacts, edit-emergency-contact, edit-medical-essentials), `(common)` (warning, modal). Standalone: `/shift-success`. Full mapping is in §3 of the appendix at the end of this document.

### 2.4 Configuration & environment

- `src/core/config/env.ts` declares `API_URL: 'https://api.cravix.com'` and `SOCKET_URL: 'https://socket.cravix.com'` but **no consumer imports `ENV`** (verified by grep). These are dead constants.
- `src/services/api/client.ts:14` hardcodes `baseURL: "http://10.20.79.36:3000"` (LAN dev IP, plain HTTP).
- `src/services/socket/socketClient.ts:15` hardcodes `baseUrl = "http://192.168.1.100:5000"` (different LAN IP, plain HTTP, port 5000).
- The frontend therefore **already encodes the spec's two-port design** (HTTP on 3000, WebSocket on 5000 — see spec §1 architecture diagram), but with hardcoded dev IPs that must be moved to environment-driven config (`.env` + `expo-constants`) before any deploy.
- `app.json` plugin block (L41-L55) only registers `expo-router` and `expo-splash-screen`. **Missing plugin entries** for `expo-camera`, `expo-image-picker`, `expo-location` (with background mode), `expo-notifications`. Production iOS builds will be rejected without `NSLocationWhenInUseUsageDescription`, `NSCameraUsageDescription`, and friends.

---

## 3. Data Flow Analysis

### 3.1 Auth flow (only fully-wired flow)

```
LoginScreen.tsx                          OtpScreen.tsx
  ─ user types phone (no +91 prefix       ─ user types 4-digit code
    enforced in UI)                          (spec wants 6 digits)
  ─ AsyncStorage.setItem('@temp_phone')   ─ AsyncStorage.getItem('@temp_phone')
  ─ authService.login(phone)              ─ authService.verify(phone, otp)
       │ POST /auth/login {phone}              │ POST /auth/verify {phone, otp}
       ▼                                       ▼
  Alert "Code Sent"                       useAuthStore.setAuth(token, user)
  router.push('/otp')                     AsyncStorage.setItem('@user_token')
                                          router.replace('/kyc')
```

`useAuthStore` (`src/features/auth/state/authStore.ts:11-45`) persists `{ token, user, isAuthenticated }` to AsyncStorage `auth-storage` via Zustand `persist` middleware **and separately** the OtpScreen writes `@user_token` (L134). Two sources of truth.

### 3.2 KYC flow (no backend wiring)

CategoryScreen → PersonalScreen → DocumentVerificationScreen → ReviewScreen, with optional Student or Disabled side-flows. **Every screen persists exclusively to AsyncStorage**:
- `@kyc_category`, `@kyc_subcategory` (`CategoryScreen.tsx:61-62`)
- `@personal_data`, `@kyc_profile_photo` (`usePersonalForm.tsx:112`, `PersonalScreen.tsx:72`)
- `@document_verification_data` (`DocumentVerificationScreen.tsx:227-238`) — single blob containing `aadhaarNumber`, `aadhaarFront`, `aadhaarBack`, `licenseNumber`, `licenseFront`, `vehicleType` ∈ `{petrol, ev}`, `vehicleNumber`, `vehicleRC`, `bikePhoto`, `insuranceNumber`, `insurancePolicy`, all images as local `file://` URIs.
- `@student_data`, `@disabled_data` for sub-flows.

`ReviewScreen.tsx:191` "Finalize Verification" button only calls `router.replace('/(tabs)/home')` — **no POST**. Worse, `@kyc_status` is **read** in `SplashScreen.tsx:68` to decide whether to route to home, but is **never written anywhere** — so the splash always falls through to `/kyc`.

**Bug surfaced for the backend team to be aware of:** several screens read AsyncStorage keys that no screen ever writes:

| Read from | Key | Writer |
|---|---|---|
| `DigitalDocumentsScreen.tsx:72-76` | `@aadhaar_data`, `@kyc_aadhaar_front/back`, `@insurance_data`, `@kyc_insurance_image` | none — screen always shows "Pending Upload" |
| `VehicleInfoScreen.tsx:71-74` | `@license_data`, `@kyc_license_image`, `@vehicle_data`, `@kyc_rc_image` | none — screen always shows "Pending Verification" |
| `SplashScreen.tsx:68` | `@kyc_status` | none |

Backend integration replaces all of this with `GET /kyc/status`, `POST /kyc/{category,personal,documents,student}`, and S3 presigned uploads — but the frontend bugs need fixing in lock-step.

### 3.3 Home / Duty toggle / Demand

- `HomeScreen.tsx` calls `useHomeData.toggleDuty(value)` (`src/features/home/hooks/useHomeData.ts:21-32`), which only mutates `UserContext.isOnline` and starts/stops `LocationProvider` foreground tracking. **No `PATCH /rider/status` call.**
- `LocationProvider.tsx:35-49` calls `Location.watchPositionAsync({ accuracy: High, distanceInterval: 10, timeInterval: 5000 })` and updates local state. **It does not emit to Socket.IO** (the spec requires streaming via the `locationUpdate` event).
- `useDemandData.ts:11-47` literally `Math.random()`s 8 demand points around the user every 30 s. The comment at L20 admits "In a real app, this would fetch from a backend API".
- `PerformanceStats.tsx`, `GoalTracker.tsx`, `WeeklyInsights.tsx` are presentational components that **don't accept any data props** — values like `₹0.00 / +12% vs Yesterday`, `₹850 / ₹1,200`, `[40,70,45,90,65,80,50]` are baked into the JSX. Backend integration requires component refactors before API wiring will show anything.

### 3.4 Orders flow

- `OrdersScreen.tsx:101-105` injects two fake missions (`M-AX4`, `M-BY9`) whenever `isOnline && missions.length === 0`. `handleAccept` only removes from local state and routes to `/active-navigation`.
- `DeliveryRequestScreen.tsx:76-92` hardcodes the entire order payload (hub coords, dest coords, items array, base earnings 25, long-distance bonus, distance 3.8, ETA "22m", merchant rating 4.8). This is the screen that should be driven by the `order:new-request` Socket.IO payload.
- `ActiveNavigationScreen.tsx:120-162` derives pickup coords as `location ± (0.003, 0.002)` and drop coords as `location ± (0.008, -0.004)` from the rider's current location — pure offsets, not a real route. The "Arrived" button just `router.replace('/orders')`.

### 3.5 Earnings & Wallet

- `useEarningsData.ts` returns hardcoded `WEEKLY_DATA` and 3 `RECENT_ACTIVITY` entries; mutates the active day's bar by `Math.random()` every 3 s for cosmetic motion.
- `EarningsHeader.tsx:57` displays a hardcoded `₹4,250.34` and **ignores `useUser().walletBalance`** (which itself defaults to `4250.34` in `UserContext.tsx:164`).
- Wallet has no concept of `availableForWithdrawal` / `pendingSettlement` / `cashInHand` as four separate fields — single `walletBalance` only.
- `CashInHandScreen.tsx:156-178` opens UPI app deep links (`gpay://`, `phonepe://`, `paytmmp://`, `bhim://`) via `Linking.openURL` and locally decrements `walletBalance` — **no settlement API call**.
- `QRModal.tsx:104` fakes scan validation with `Math.random() > 0.1` and uses a 3rd-party QR generator at `api.qrserver.com`.
- `BankSelectorModal.tsx:8-19` hardcodes 10 Indian banks. `AddBankScreen` saves into `UserContext.bankData` (single bank, AsyncStorage-persisted) — spec expects an array of bank accounts with `isPrimary`, `verificationStatus`, masked numbers.

### 3.6 Notifications, Alerts, Leaderboard, Incentives

All four are **fully hardcoded fixture lists** in the screens themselves (`NotificationsScreen.tsx:22-95`, `AlertsScreen.tsx:31-80`, `LeaderboardScreen.tsx:26-37`, `core/config/incentives.ts`). No API calls.

### 3.7 Emergency & Medical

- `EmergencyContactsScreen.tsx:51` SOS handler is `console.log(\`Calling ${type}\`)` — does nothing.
- WhatsApp link hardcoded to `+919876543210` (L56).
- Edit screens save to AsyncStorage `@emergency_contact` and `@medical_essentials`. No backend.

---

## 4. API Requirements (Derived from frontend code, mapped to spec)

The table below lists every endpoint the frontend code path implies it needs, the **observed request/response shape from the frontend**, and the corresponding endpoint in `BACKEND_REQUIREMENTS.md` (✅ matches | ⚠ mismatch | ❌ missing in spec).

### 4.1 Auth Service (`/api/v1/auth`)

| Frontend caller | Method + Path | FE request | FE expects | Spec § | Status |
|---|---|---|---|---|---|
| `LoginScreen.tsx:98` (via `authService.login`, `services/api/features/auth.ts:11`) | `POST /auth/login` | `{phone}` | success | 5.1 | ✅ matches |
| `OtpScreen.tsx:129` | `POST /auth/verify` | `{phone, otp}` | `{success, message?, data:{token, user:{id, phone, name?}}}` | 5.1 | ⚠ shape: spec returns `data:{accessToken, refreshToken, user:{id, phone, name, isKycComplete, profileImage}}`. Frontend reads `data.token` only. |
| _(none — commented)_ | `POST /auth/logout` | — | — | 5.1 | ❌ frontend never calls. `auth.ts:21-24` deliberately disables it. Spec requires it for refresh-token revocation. |
| _(missing)_ | `POST /auth/refresh` | `{refreshToken}` | — | 5.1 | ❌ frontend has no refresh logic; 401 interceptor only logs out. |

### 4.2 Rider Service (`/api/v1/rider`)

Frontend has `RIDER_ENDPOINTS` constants defined (`services/api/features/rider.ts:1-5`) but **no service methods call them**. All rider data currently flows through `UserContext` + AsyncStorage.

| Implied caller | Spec method + path | Spec § | Status |
|---|---|---|---|
| `HomeHeader`, `ProfileScreen`, `ProfileDetailsScreen`, `useProfileData.ts:21-33` | `GET /rider/profile` | 5.2 | ❌ frontend uses AsyncStorage `@personal_data.fullName`, `@kyc_profile_photo`. Need to wire. |
| `ProfileScreen` save photo, `usePersonalForm` save personal info | `PATCH /rider/profile` | 5.2 | ❌ frontend currently saves locally only. |
| `useUser.isOnline` read | `GET /rider/status` | 5.2 | ❌ AsyncStorage `@is_online` only. |
| `DutyToggleCard` → `useHomeData.toggleDuty` | `PATCH /rider/status` | 5.2 | ❌ no API call; only mutates context. |
| `VehicleInfoScreen.tsx:71-74` reads | `GET /rider/vehicle` | 5.2 | ❌ reads AsyncStorage keys that are never written → screen always empty. |
| Document Verification submit | `PATCH /rider/vehicle` | 5.2 | ⚠ frontend captures `vehicleType ∈ {petrol, ev}` (fuel type) — spec expects `{bike, bicycle, scooter, ev}`. |

### 4.3 KYC Service (`/api/v1/kyc`)

Spec defines `GET /kyc/status`, `POST /kyc/category|personal|documents|student`, `GET /kyc/s3-presigned-url`. **None are wired.**

| Spec endpoint | FE driver | Mismatch detail |
|---|---|---|
| `GET /kyc/status` | `useKycStatus.ts:5-71` (currently scrapes AsyncStorage) | ⚠ FE computes from local flags. Easy swap. |
| `POST /kyc/category` | `CategoryScreen.tsx:61-62` | ⚠ FE taxonomy `{freelancer, fulltime} × {student, professional, disabled}` ≠ spec `{student, professional, part_time}`. |
| `POST /kyc/personal` | `usePersonalForm.tsx:112` | ⚠ FE captures `email, age, district` not in spec body; spec expects nested `address:{line1,city,state,pincode}`. |
| `POST /kyc/documents` | `DocumentVerificationScreen.tsx:227-238` | ⚠ FE captures Aadhaar (front+back), licence (front), RC, bike photo, insurance number+policy. Spec accepts `aadhaarFront, aadhaarBack, panCard, drivingLicense, selfie`. **Document set diverges substantially.** |
| `POST /kyc/student` | `StudentScreen.tsx:118` | ⚠ FE captures `collegeName, department, courseName, duration, registerNumber, graduationYear, collegeEmail, idProof`. Spec body is `{collegeName, enrollmentNumber, collegeIdImage}`. FE has more fields. |
| _(missing in spec)_ | `DisabledScreen.tsx:104` collects `certificateNumber, details, proofImage` | ❌ **No `POST /kyc/disabled` in spec.** Either add it or merge into `/kyc/personal`. |
| `GET /kyc/s3-presigned-url` | none | ❌ FE has no upload pipeline at all — images stay as local `file://` URIs. Major frontend work needed. |

### 4.4 Orders Service (`/api/v1/orders`)

| Spec endpoint | FE driver | Status |
|---|---|---|
| `GET /orders/active` | `OrdersScreen.tsx`, `ActiveNavigationScreen` | ❌ currently `seedMissions` injects fakes when online. |
| `GET /orders/history` | `OrdersScreen` history tab | ❌ uses `HISTORY_MOCK` (5 entries CX901..CX559). |
| `POST /orders/:id/accept` | `OrdersScreen.handleAccept` (L124-127), `DeliveryRequestScreen.handleAccept` | ❌ no POST — only local state mutation + route. |
| `POST /orders/:id/reject` | `DeliveryRequestScreen` decline path | ❌ — auto-decline timer at 45 s routes to `/warning` only. |
| `PATCH /orders/:id/status` | `ActiveNavigationScreen` "Arrived" button (L74-76) | ❌ — only `router.replace('/orders')`. State machine UI missing for `picked_up | en_route | arrived | delivered | failed`. |
| `POST /orders/:id/delivery-proof` | _(no UI)_ | ❌ — no proof-photo capture screen exists. New screen needed. |

### 4.5 Shifts Service (`/api/v1/shifts`)

| Spec endpoint | FE driver | Status |
|---|---|---|
| `GET /shifts/preferences` | `ShiftsScreen.tsx:47-48` reads `@shift_presets` / `@shift_window` | ❌ AsyncStorage only. Spec §15 explicitly calls this out as a required change to backend authority. |
| `PUT /shifts/preferences` | `ShiftsScreen.tsx:60-61` saves to AsyncStorage and `router.push('/shift-success')` | ❌ |
| `GET /shifts/schedule` | none — but powers the "Revenue projection" card the spec mentions | ❌ — currently hardcoded `₹140 - ₹220` (`ShiftsScreen.tsx:261`). |
| `GET /shifts/active` | none — implied by home header | ❌ |

### 4.6 Earnings Service (`/api/v1/earnings`)

| Spec endpoint | FE driver | Status |
|---|---|---|
| `GET /earnings/summary?period=` | `EarningsHeader`, `StatsGrid`, `EarningsGoalCard` | ❌ all hardcoded; `EarningsHeader.tsx:57` ignores `useUser().walletBalance`. |
| `GET /earnings/chart?period=&groupBy=` | `RevenueChart` via `useEarningsData.ts` | ❌ constant `WEEKLY_DATA`. |
| `GET /earnings/transactions` | `TransactionsList` | ❌ 3 hardcoded entries. |
| `GET /earnings/leaderboard?period=&city=` | `LeaderboardScreen.tsx:26-37` | ❌ 10 hardcoded entries with **full names + i.pravatar.cc avatars** — also violates spec privacy rule (first-name + last initial only). |
| `GET /earnings/incentives` | `IncentivesScreen` reads `core/config/incentives.ts` | ❌ static seed file (`MILESTONES`, `SURGE_DATA`). |

### 4.7 Wallet Service (`/api/v1/wallet`)

| Spec endpoint | FE driver | Status |
|---|---|---|
| `GET /wallet/balance` (4 fields) | `useUser.walletBalance` (single field, default `4250.34`) | ❌ schema mismatch (1 vs 4 fields). Currency unit mismatch (rupees vs paise). |
| `GET /wallet/history` | `PaymentHistoryScreen.tsx:51-58` | ❌ 6 hardcoded transactions. Summary `₹12,450.00` / `₹8,500` baked into JSX. |
| `GET /wallet/cash-in-hand` | `CashInHandScreen` | ❌ — local UPI deep-link UX only. |
| `GET /wallet/bank-accounts` | `BankAccountsScreen` reads `useUser.bankData` (single object) | ❌ — spec returns array. |
| `POST /wallet/bank-accounts` | `AddBankScreen` writes to UserContext only | ❌ — no penny-drop verification. |
| `POST /wallet/withdraw` | _(no UI)_ | ❌ — no bank-withdrawal screen exists. The "withdraw" button on CashInHand only opens a UPI app. |
| `GET /wallet/allowance` | `AllowanceScreen.tsx:77-80` | ❌ hardcoded `₹850.00` + 3 dated entries. |
| _(spec has no monthly statement endpoint)_ | `AccountStatementsScreen.tsx:22-28` reads 5 hardcoded months | ❌ **Gap in spec.** Need `GET /wallet/statements?month=` returning `{month, period, amount, status, type, downloadUrl?}`. |

### 4.8 Location & Maps Service (`/api/v1/location`)

| Spec endpoint | FE driver | Status |
|---|---|---|
| `GET /location/geocode?lat&lng` | `LocationPicker.tsx` (`expo-location.reverseGeocodeAsync`), `services/location/geocode.ts:7` | ⚠ FE currently does device-side reverse geocoding via Expo. Spec moves it server-side (cacheable). FE either keeps Expo (faster, free) or switches — clarify. |
| `GET /location/operating-zones` | `OperatingZonesScreen.tsx` shows hardcoded primary zone | ❌ |
| `GET /location/heatmap?city&bounds` | `useDemandData.ts` (Math.random) | ❌ |

### 4.9 Notifications Service (`/api/v1/notifications`)

| Spec endpoint | FE driver | Status |
|---|---|---|
| `GET /notifications` | `NotificationsScreen.tsx:22-95` | ❌ 8 hardcoded entries. |
| `PATCH /notifications/:id/read` | inline mark-as-read action | ❌ |
| `PATCH /notifications/read-all` | "Clear All" handler | ❌ — only clears local state. |
| `GET /notifications/alerts` | `AlertsScreen.tsx:31-80` | ❌ 6 hardcoded entries. |
| `POST /notifications/fcm-token` | _(no caller)_ | ❌ — `expo-notifications` is in `package.json` but never imported. **No push registration code exists.** |

### 4.10 Emergency & Medical Service (`/api/v1/emergency`)

| Spec endpoint | FE driver | Status |
|---|---|---|
| `GET /emergency/contacts` | `EmergencyContactsScreen` reads `@emergency_contact` | ❌ AsyncStorage only. |
| `POST /emergency/contacts`, `PUT /:id`, `DELETE /:id` | `EditEmergencyContactScreen` | ❌ AsyncStorage only. |
| `GET /emergency/medical`, `PUT /emergency/medical` | `EditMedicalEssentialsScreen` reads/writes `@medical_essentials` | ❌ AsyncStorage only. |
| `POST /emergency/sos` | `EmergencyContactsScreen.tsx:51` | ❌ — handler is `console.log` only. **No real SOS path exists.** |

### 4.11 Support & Content Service (`/api/v1/support`)

| Spec endpoint | FE driver | Status |
|---|---|---|
| `GET /support/faq` | `HelpCenterScreen` (i18n keys) | ⚠ — content currently lives in i18n bundles. Spec moves to backend (admin-editable). Decide cutover. |
| `POST /support/ticket` | _(no UI)_ | ❌ — no ticket-creation screen exists. New screen needed. |
| `GET /support/documents` | `DigitalDocumentsScreen` reads keys never written | ❌ |
| `GET /support/privacy-policy`, `GET /support/terms` | `PrivacyPolicyScreen`, `TermsOfServiceScreen` (i18n) | ⚠ — i18n today. Same admin-driven migration. |

---

## 5. Static vs Dynamic Breakdown

Per-screen classification: which sections are already API-fed vs hardcoded. Full table is below; the headline is **88% of screens have zero backend wiring today**.

| Screen | API-fed today | Hardcoded / mocked |
|---|---|---|
| Splash | `auth-storage`, `@user_token`, `@kyc_status` (never written) | animations |
| Login | `POST /auth/login` ✅ | onboarding text |
| OTP | `POST /auth/verify` ✅ | 4-digit local UI |
| KYC Hub | AsyncStorage flags | progress %, finalize button |
| KYC Personal | AsyncStorage + Expo reverse geocode | PINCODE_PREFIXES table |
| KYC Documents | AsyncStorage | local `file://` URIs |
| KYC Category/Student/Disabled | AsyncStorage | all field labels static |
| Home | UserContext (AsyncStorage) | PerformanceStats, GoalTracker, WeeklyInsights, demand points, banner |
| Operating Zones | `useLocation` for map center | zone info, rules, badge |
| Heatmap | `useLocation` + random demand | insight card text |
| Orders (active) | UserContext.isOnline | seed missions, history list |
| Orders (history) | none | HISTORY_MOCK 5 entries |
| Delivery Request | none | entire `orderData` |
| Active Navigation | `useLocation` only | pickup/drop offsets, ETA, distance |
| Earnings | UserContext (orderStats, secondsOnline) | wallet ₹4,250.34, target ₹2,500, missions 12, 1.2x bonus, weekly bars, 3 transactions |
| Incentives | none | `MILESTONES`, `SURGE_DATA` |
| Leaderboard | none | 10 entries with full names |
| Profile | UserContext, useProfileData | rating 4.9, ProCard ₹1,257, version 4.2.0 |
| Profile Details | AsyncStorage KYC blobs | rating, trips, tenure |
| Vehicle Info | AsyncStorage (keys never written) | "Pending Verification" placeholder |
| Digital Documents | AsyncStorage (keys never written) | placeholders |
| Settings | LanguageContext, SettingsContext | static menu rows, version |
| Cash in Hand | UserContext.walletBalance | UPI app list (4 apps) |
| Bank Accounts | UserContext.bankData | next-settlement copy |
| Add Bank | UserContext | 10-bank list |
| Payment History | none | 6 transactions, summary ₹12,450/₹8,500 |
| Account Statements | none | 5 hardcoded months |
| Allowance | none | balance ₹850, 3 entries |
| Shifts | AsyncStorage | projection ₹140-₹220, time pickers not interactive |
| Notifications | none | 8 entries |
| Alerts | none | 6 entries |
| Help Center | i18n only | tel/email/whatsapp hardcoded |
| Emergency | AsyncStorage | SOS targets `console.log` only |

---

## 6. Issues Identified

Each issue lists severity and proposed disposition. **Blockers** must be resolved before backend work begins.

### 6.1 Hard blockers

1. **OTP length divergence — BLOCKER.** Frontend `OtpScreen` is a 4-digit input; spec §5.1 mandates 6 digits with regex `/^\d{6}$/`. Pick one. **Recommended: change frontend to 6 digits — 6 is industry standard for India and the spec is clear.**

2. **Login response shape — BLOCKER.** Frontend reads `data.token` (single token, `OtpScreen.tsx:131-133`); spec returns `{ accessToken, refreshToken, user{...} }`. The frontend has no refresh-token plumbing at all (no `/auth/refresh` call, no token rotation in axios interceptor, only logout-on-401). **Recommended: keep spec contract, add refresh flow to frontend (`useAuthStore` stores both tokens; axios interceptor on 401 attempts refresh once before logout).**

3. **KYC document set divergence — BLOCKER.** Frontend captures: Aadhaar (front+back), driving licence (front), vehicle RC, bike photo, insurance policy + insurance number, profile selfie (in PersonalScreen). Spec §5.3 accepts `aadhaarFront, aadhaarBack, panCard, drivingLicense, selfie`. PAN is **only in spec**; bike photo, RC, licence-back, insurance are **only in frontend**. **Decision needed:** is PAN required (yes for Indian payouts under ₹2L/yr — recommend keep), and should RC/insurance/bike-photo move into vehicle profile (`PATCH /rider/vehicle`) instead of the KYC documents bundle?

4. **Categories taxonomy divergence — BLOCKER.** Frontend `CategoryScreen` two-axis `{freelancer, fulltime} × {student, professional, disabled}`. Spec single-axis `{student, professional, part_time}`. **Recommended unification:** primary `category ∈ {student, professional, part_time, full_time, disabled}` (single enum, includes disabled and a part_time/full_time split if needed). Frontend Category screen consolidates.

5. **Vehicle type vs fuel type — BLOCKER.** Frontend `DocumentVerificationScreen` captures fuel `{petrol, ev}`. Spec captures vehicle `{bike, bicycle, scooter, ev}`. These are orthogonal axes. **Recommended:** capture both — `vehicleType ∈ {bike, bicycle, scooter, ev}` AND `fuelType ∈ {petrol, electric, none}` (bicycle = none).

6. **Currency units — BLOCKER (low risk if agreed).** Spec is paise integers. Frontend renders `₹4,250.34` (rupees, 2-decimal). All formatters and component prop types must change. **Recommended: spec wins.** Build a single helper `formatPaise(p) → "₹X.YZ"` and replace literal ₹-strings.

### 6.2 High-priority bugs (frontend, regardless of backend)

7. **AsyncStorage keys read but never written.** `@kyc_status`, `@aadhaar_data`, `@kyc_aadhaar_front/back`, `@insurance_data`, `@kyc_insurance_image`, `@license_data`, `@kyc_license_image`, `@vehicle_data`, `@kyc_rc_image`. Result: Splash always falls through to `/kyc`; `DigitalDocumentsScreen` and `VehicleInfoScreen` always show empty placeholders. Backend integration replaces all of these with API reads, but the surfacing screens currently render dead UI. **Action:** delete dead reads or fix writers.

8. **Two sources of truth for the JWT.** `OtpScreen.tsx:134` writes `@user_token` while `useAuthStore.setAuth(token,user)` writes `auth-storage` via Zustand `persist`. `useProfileData.handleLogout` (L53-57) and `SettingsScreen.tsx:81-87` only `removeItem('@user_token')` — the Zustand-persisted token survives → user can re-hydrate as authenticated on next launch. **Action:** consolidate on `authStore.setAuth` / `authStore.logout` exclusively; delete `@user_token` writes/reads.

9. **`socketClient.connect()` never called.** Verified by grep across `src/`. The socket client is dead. **Action:** call `socketClient.connect(accessToken)` on successful login (`OtpScreen` after `setAuth`) and on splash hydrate when `isAuthenticated`. Disconnect on logout.

10. **Socket auth handshake missing.** `socketClient.ts:23` config does not pass `auth: { token }`. Spec §6 requires it. **Action:** wire `auth: { token: accessToken }` in `connect()` and re-attach on reconnection (token may have rotated).

11. **`LocationProvider` does not stream to socket.** `LocationProvider.tsx:35-49` only sets local state. Spec §6 expects `socket.emit('locationUpdate', { latitude, longitude, heading, speed })` on every `watchPositionAsync` callback. **Action:** wire emit in the watch callback, only when rider isOnline. Throttle to ≥ 5 s interval (already configured).

12. **Push notification registration missing.** `expo-notifications` declared but never imported. **Action:** create `src/services/notifications/push.ts` that requests permission, gets the FCM token via `Notifications.getDevicePushTokenAsync()` (or APNs on iOS), and POSTs `/notifications/fcm-token` after auth.

13. **`EarningsHeader` ignores wallet state.** Hardcoded `₹4,250.34` at L57 instead of reading `useUser().walletBalance`. **Action:** consume the value (after currency-unit migration).

14. **Components without data props.** `PerformanceStats`, `GoalTracker`, `WeeklyInsights` have values baked into JSX. They cannot be backend-driven without refactor. **Action:** add props for all numeric values + labels, lift fixtures to a default.

15. **`expo-notifications`, `expo-camera`, `expo-image-picker`, `expo-location` plugin entries missing from `app.json`.** Production builds will fail App Store review. **Action:** add plugin blocks with iOS permission strings (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`).

### 6.3 Mock data masquerading as features

16. `useDemandData.ts:24-37` — `Math.random()` for heatmap. Comment admits real backend is needed.
17. `useEarningsData.ts:46` — `Math.random()` to wiggle the active day's bar. Cosmetic, but misleading.
18. `QRModal.tsx:104` — `Math.random() > 0.1` to fake QR scan validation.
19. `OrdersScreen.tsx:101-105` — `seedMissions` injects fake missions.
20. `DeliveryRequestScreen.tsx:76-92` — entire payload hardcoded.
21. `ActiveNavigationScreen.tsx:120-162` — pickup/drop are coord offsets, not real route.
22. `EmergencyContactsScreen.tsx:51` — SOS handler is `console.log`.

All seven must be removed and replaced with live data on the integration pass.

### 6.4 Privacy & sensitive-data leaks

23. `LoginScreen.tsx:112` `console.error('Login error:', error)` — error object may include phone or full request body. Strip in prod.
24. `OtpScreen.tsx:141` `console.error('OTP Verification Error:', e)` — same.
25. `socketClient.ts:41,45` — connection logs.
26. JWT in `auth-storage` (AsyncStorage) is plaintext on device. Standard for RN, but consider `expo-secure-store` for the JWT/refresh token.

### 6.5 Configuration / DX

27. `src/core/config/env.ts` declares URLs but is not imported anywhere — dead code that creates a false sense of configurability. Both `client.ts` and `socketClient.ts` hardcode IPs. **Action:** make `client.ts` and `socketClient.ts` import from `env.ts`; populate `env.ts` from `expo-constants` (`Constants.expoConfig.extra`) and `app.json`'s `extra` block, supplied per-environment via EAS.

28. `src/services/storage/storage.ts` exists but is unused — every call site uses raw AsyncStorage. **Action:** either route everything through `storage.ts` (typed keys + JSON helpers) or delete the file.

29. `src/core/config/user.ts` and `incentives.ts` are seed/fixture data referenced as defaults. Once API integration is done these should become true defaults / loading-state placeholders, not values that ship to users.

### 6.6 Spec gaps (frontend needs that the spec does not cover)

- **`POST /kyc/disabled`** — frontend has a Disabled sub-flow (`DisabledScreen.tsx`) that captures certificate number, details, proof image. Spec has no matching endpoint. Either add `POST /kyc/disabled` or merge into `/kyc/personal`.
- **`POST /wallet/cash-in-hand/reconcile`** — frontend's COD flow (`CashInHandScreen`) needs a way to mark cash deposited (currently just decrements local balance). Spec only has GETs.
- **`GET /wallet/statements?month=`** — frontend `AccountStatementsScreen` shows monthly statements with download links. Spec only has `/wallet/history`.
- **QR for receive-payment** — `QRModal.tsx` generates QR codes that encode `cravix_pay:{riderId}?amt=...`. Spec has no backend QR endpoint. Either drop the feature, or add `POST /wallet/qr-payment-token` returning a signed short-lived token.
- **Support ticket creation UI** — spec defines `POST /support/ticket` but no screen exists.
- **`POST /orders/:id/delivery-proof`** — spec defines it but no proof-photo capture screen exists.

---

## 7. Required Frontend Changes (before / during integration)

These are **non-negotiable** for the integration pass — most are already implied by §6 above. Listed in execution order.

1. **Replace hardcoded `client.ts` baseURL with env-driven config.** Wire `expo-constants` `extra.apiUrl` and `extra.socketUrl`. Per-env via EAS profiles.
2. **Add Google Maps API key** to `app.json:13,19` and `src/shared/config/maps.ts:14`. Provision key from GCP with rider-app SHA pinning.
3. **Add `expo-notifications`, `expo-camera`, `expo-image-picker`, `expo-location` plugin blocks** with iOS permission strings.
4. **Consolidate JWT storage** on Zustand `authStore` only. Delete `@user_token` writes/reads. Update logout in `useProfileData.ts:53-57` and `SettingsScreen.tsx:81-87` to call `useAuthStore.getState().logout()` and also `POST /auth/logout`.
5. **OTP screen → 6 digits** (or backend → 4 digits — confirm in §11).
6. **Add refresh-token plumbing.**
   - Extend `useAuthStore.state` with `accessToken` + `refreshToken` (rename `token` → `accessToken`).
   - Update axios interceptor: on 401 attempt `POST /auth/refresh` once with stored `refreshToken`; on success retry the original request; on failure logout.
   - Schedule a soft refresh ~1 minute before access-token expiry (decode `exp`).
7. **Wire `socketClient.connect(accessToken)`** on auth success and on splash hydrate; disconnect on logout. Pass `auth: { token }` in `io()` config.
8. **Stream `locationUpdate`** from `LocationProvider` to socket while online. Throttle to 5 s.
9. **Push token registration** — new `src/services/notifications/push.ts`; call after first successful auth; POST to `/notifications/fcm-token`.
10. **KYC pipeline** — change every save handler in KYC screens to: (a) request `/kyc/s3-presigned-url` for each image, (b) PUT image to S3, (c) POST the resulting URLs to `POST /kyc/{personal|documents|student|category}`. Replace AsyncStorage writes with optimistic-update + retry pattern.
11. **Currency unit migration.** Single helper `formatPaise(p: number): string`. Replace every literal `₹...` string. Update all consumer prop types from `number /* rupees */` to `number /* paise */`.
12. **Bank-accounts shape change.** `useUser.bankData` (single object) → list. Update `BankAccountsScreen`, `AddBankScreen`. Wire `GET /wallet/bank-accounts` and `POST /wallet/bank-accounts`. Add penny-drop "verifying…" state.
13. **Wallet schema change.** Replace single `walletBalance` with `{ totalBalance, availableForWithdrawal, pendingSettlement, cashInHand }` (paise). Refactor `EarningsHeader`, `CashInHandScreen` to consume separately.
14. **Add bank-withdrawal UI** to wire `POST /wallet/withdraw` (today only UPI deep-links exist).
15. **Add proof-photo capture screen** for `POST /orders/:id/delivery-proof`.
16. **Replace mocked screens with API hooks**: NotificationsScreen, AlertsScreen, LeaderboardScreen, IncentivesScreen, OperatingZonesScreen, HeatmapScreen (`useDemandData`), PaymentHistoryScreen, AccountStatementsScreen, AllowanceScreen, EarningsScreen.
17. **Refactor data-less components** (`PerformanceStats`, `GoalTracker`, `WeeklyInsights`) to accept props.
18. **Sanitize console logging** — remove `console.error(error)` patterns that may emit sensitive payloads. Use Winston or a dedicated `logger.ts` that strips PII in production.
19. **Wire SOS** — `EmergencyContactsScreen.tsx:51` to actually `POST /emergency/sos` with current location, then dial native phone via `Linking`.
20. **Translation cutover for FAQs / Privacy / Terms** — fetch from `/support/*` and cache 1 h. Keep i18n bundle as offline fallback only.

---

## 8. Proposed Backend Architecture

Adheres exactly to `BACKEND_REQUIREMENTS.md`. No deviations — only fills in implementation details where the spec is silent.

### 8.1 Topology

```
Mobile (RN) ──HTTPS──▶ Nginx (TLS, rate-limit, ip_hash) ──▶ Express x8 (port 3000)
            ──WSS───▶ Nginx ──proxy_pass──▶ Express Socket.IO x8 (port 5000)

Express instances ──▶ PgBouncer ──▶ PostgreSQL (Prisma, connection_limit=5/inst)
                  ──▶ Redis Cluster  (sessions, cache, BullMQ, Socket.IO adapter)
                  ──▶ S3 (cravix-kyc, cravix-cdn) — presigned uploads
                  ──▶ MSG91 (SMS), Firebase Admin (FCM/APNs), Payment Gateway (Razorpay/Cashfree)

BullMQ workers run on every instance; only one claims each job (Redis-backed BRPOPLPUSH).
```

### 8.2 Repository layout (single Git repo, multi-service-per-repo)

```
cravix-backend/
├── packages/
│   ├── shared-config/        # zod-validated env loader, types
│   ├── shared-types/         # API contracts (DTOs), shared between services
│   ├── shared-errors/        # AppError hierarchy
│   ├── shared-logger/        # Winston pino-pretty
│   └── shared-redis/         # ioredis singleton + Socket.IO adapter
├── services/
│   ├── api-gateway/          # public REST (single Express on port 3000) — see 8.3
│   ├── socket-gateway/       # Socket.IO server on port 5000 — see 8.3
│   └── workers/              # BullMQ worker entrypoint (location, notifications, payments, kyc, emergency)
├── prisma/
│   ├── schema.prisma         # exactly per spec §9
│   ├── migrations/
│   └── seed.ts
├── infra/
│   ├── docker/               # Dockerfile per service
│   ├── compose/              # docker-compose for local: nginx, redis, postgres, pgbouncer
│   ├── nginx/                # nginx.conf with ip_hash + WS upgrade
│   └── terraform/            # AWS infra (deferred to post-MVP)
├── docs/
│   └── adr/                  # ADR-001..N as decisions are made
├── package.json              # pnpm workspace root
├── turbo.json
├── tsconfig.base.json
└── .env.example
```

**Why monorepo, not microservices-per-repo:** spec §1 says "Distributed Express.js — 6–8 instances behind a Load Balancer", not 11 separate services. The 11 service domains in spec §5 are **modules within one Express app** (mounted at `/api/v1/{auth,rider,kyc,...}`), not 11 deploy units. Pgsql/Redis/BullMQ are shared. Workers can either run inside the API instances or as a separate `workers` deploy — both are valid; spec §2 says "Run workers on all 8 instances", which is the simplest path. We'll do that.

### 8.3 Module structure within `services/api-gateway/`

Exactly as spec §4 lays out:

```
services/api-gateway/src/
├── index.ts
├── app.ts
├── config/                   # zod-validated config; reads env once at boot
├── middleware/               # error-handler, request-validator (zod), auth (custom JWT), rate-limiter (redis store), request-id, request-logger, cors, helmet+hpp+csp
├── modules/
│   ├── auth/                 (controller/service/repository/routes/schemas/types/events)
│   ├── rider/
│   ├── kyc/
│   ├── orders/
│   ├── shifts/
│   ├── earnings/
│   ├── wallet/
│   ├── location/
│   ├── notifications/
│   ├── emergency/
│   └── support/
├── shared/                   # errors/, utils/, types/, services/cache.ts, services/queue.ts
├── database/{prisma,redis}/
└── health/{controller,routes}.ts
```

`services/socket-gateway/src/` contains the Socket.IO server (port 5000) wired to the same Redis instance, with the JWT auth middleware (spec §6) and event handlers under `events/{order,location,rider,emergency,...}.ts`. Both gateways share `packages/shared-*` and read the same Prisma client.

### 8.4 Implementation sequencing (post-approval)

To deliver value early, ship in vertical slices. Each slice = backend module + frontend wiring + integration tests. After each slice we produce the two documents the spec requires (Implementation Document + Self-Review Report).

1. **Foundation (Sprint 0, ~2 days)** — pnpm workspace, tsconfig, eslint, prettier, Dockerfile, docker-compose (nginx, redis, postgres, pgbouncer), Prisma schema migrate, base `app.ts` middleware chain, structured logger, request-id, error envelope, health endpoints.
2. **Auth slice** — `/auth/login`, `/auth/verify`, `/auth/refresh`, `/auth/logout`. Frontend: 6-digit OTP, refresh-token plumbing, logout consolidation. **Acceptance:** rider can log in, get 200/201 envelopes per spec, token refresh works, logout invalidates server-side.
3. **Rider profile slice** — `/rider/profile`, `/rider/status`, `/rider/vehicle`. Frontend: replace `useProfileData` AsyncStorage reads with API. **Acceptance:** profile screen, vehicle info, online/offline toggle all backend-driven.
4. **Socket gateway slice** — Socket.IO server with JWT auth, `join` room, `locationUpdate` enqueue → `location-updates` BullMQ queue → batched DB writes every 30 s. Frontend: `socketClient.connect(token)` on auth, stream `locationUpdate` from `LocationProvider`. **Acceptance:** rider's location appears in admin namespace within 5 s.
5. **KYC slice** — `/kyc/status`, `/kyc/category|personal|documents|student|disabled`, `/kyc/s3-presigned-url`. Frontend: rewire all KYC screens to upload-then-POST flow. **Acceptance:** end-to-end KYC creates `KycApplication` in DB, S3 has the documents, status transitions correctly.
6. **Orders slice** — `/orders/active`, `/orders/history`, `/orders/:id/accept|reject|status|delivery-proof`; Socket emits `order:new-request`, `order:cancelled`, `order:status-updated`. Frontend: `OrdersScreen`, `DeliveryRequestScreen`, `ActiveNavigationScreen` rewired; remove `seedMissions`. **Acceptance:** an admin-injected order flows to the rider's app, can be accepted/rejected within 45 s, status transitions persist.
7. **Earnings slice** — `/earnings/summary|chart|transactions|leaderboard|incentives`. Frontend: refactor `PerformanceStats` / `GoalTracker` / `WeeklyInsights` to accept props; replace `useEarningsData` mocks. **Acceptance:** earnings header shows real numbers in paise, leaderboard returns first-name + last-initial only.
8. **Wallet slice** — `/wallet/balance|history|cash-in-hand|bank-accounts|withdraw|allowance` + `wallet/statements` (gap §6.6). Frontend: wallet schema migration (4 fields), bank-accounts list, withdrawal UI. **Acceptance:** add bank → penny-drop verification → withdraw → BullMQ payments worker → settled.
9. **Shifts slice** — `/shifts/preferences|schedule|active`. Frontend: ShiftsScreen → backend; remove AsyncStorage as primary. **Acceptance:** preferences sync across devices.
10. **Location & Maps slice** — `/location/geocode|operating-zones|heatmap`. Frontend: replace `useDemandData` mocks; replace device-side geocoding (or keep as cache fallback). **Acceptance:** real heatmap renders.
11. **Notifications slice** — `/notifications`, `/notifications/alerts`, `/notifications/fcm-token`, push delivery via FCM. Frontend: register push token, replace mock screens. **Acceptance:** rider receives FCM push on `order:new-request`.
12. **Emergency slice** — `/emergency/contacts|medical|sos`; SOS BullMQ priority-1 job, admin Socket emit. Frontend: wire SOS button properly. **Acceptance:** SOS triggers ops alert in <5 s.
13. **Support slice** — `/support/faq|ticket|documents|privacy-policy|terms`. Frontend: cutover content sources. **Acceptance:** admin-editable content reflects on next refresh.
14. **Hardening** — load test at 80K concurrent connections (k6 + Socket.IO), security audit (OWASP ASVS), penetration test, observability (Prometheus + Grafana + OpenTelemetry traces), runbooks.

### 8.5 ADRs to be authored alongside implementation

- ADR-001: Single Express monorepo vs separate microservices (decision: monorepo per §8.2 reasoning).
- ADR-002: UUID v7 application-level generation (Postgres `gen_random_uuid()` is v4; we override at app layer).
- ADR-003: Zod as sole validation layer (no express-validator, no Joi).
- ADR-004: Custom JWT middleware (no Passport).
- ADR-005: Socket.IO Redis adapter for cross-instance fan-out.
- ADR-006: BullMQ for location batching + payments + KYC verify.
- ADR-007: Currency in paise integers (no floats).
- ADR-008: Refresh-token rotation strategy + Redis storage.
- ADR-009: S3 presigned-PUT for KYC uploads (no multipart on the API).
- ADR-010: PgBouncer connection-limit budget (5/instance × 8 = 40 → 100 max in pgbouncer).

---

## 9. Security Observations

The spec already satisfies most security requirements. Frontend-side security concerns and additional backend hardening:

### 9.1 Already correct in spec (no changes)

- OTP hashed with bcryptjs before Redis write (spec §5.1, §15.2).
- JWT short TTL (15m) + refresh rotation + Redis revocation list (spec §5.1, §14).
- Helmet 8.x + HPP + CSP (spec §14).
- Rate limiting via express-rate-limit with Redis store (shared across all 8 instances).
- Phone validation with Indian-mobile regex.
- Monetary values as integer paise — no float rounding attacks.
- Leaderboard privacy rule (first name + last initial only).
- `X-Request-ID` for traceability.
- HTTPS at Nginx with HSTS 1 year.

### 9.2 Frontend security gaps to fix

- **JWT in plain AsyncStorage.** Acceptable for many apps but elevated risk because the same token signs Socket.IO + REST. **Recommendation:** use `expo-secure-store` for both `accessToken` and `refreshToken`. Migration is straightforward.
- **No SSL pinning.** `axios` and `socket.io-client` trust the system CA bundle. Not in spec, but recommended for a financial app — use `react-native-cert-pinner` or pin via OkHttp/NSURLSession config.
- **Certificate validation** — `client.ts` baseURL is HTTP today; ensure all envs use HTTPS in production builds (eas-config check).
- **Input echo in console logs** (`LoginScreen.tsx:112`, `OtpScreen.tsx:141`) — strip in production. Wire a `logger` utility.
- **AutoSave AsyncStorage by `Input`** — `src/shared/components/ui/Input.tsx:40,65` saves any field tagged `autoSaveKey`. Audit every usage to ensure no sensitive field (phone, OTP, bank account, ID number) gets autosaved.
- **`@user_token` standalone key** — same JWT in two places. Delete the standalone key.

### 9.3 Backend additions to spec

- **JWT key rotation strategy.** Spec mandates same secret on all 8 instances but doesn't define rotation. **Recommendation:** support `JWT_ACCESS_SECRET_PREVIOUS` env to permit dual-verify during a rolling key rotation; document procedure in an ADR.
- **S3 presigned-URL hardening.** Spec §5.3 says "S3 URLs validated to belong to the cravix-* bucket domain only". Add: require `Content-Length-Range` constraints (e.g. ≤ 5 MB), MIME whitelist (image/jpeg, image/png), short expiry (300s — already in spec), and per-rider per-document-type quota (max 3 attempts/h to prevent S3 cost-bombing).
- **CSP for the API surface.** Even though it's a JSON API, default `helmet()` CSP can be tuned to `default-src 'none'; frame-ancestors 'none'` since no HTML is served.
- **Webhook secrets.** Payment gateway, FCM, MSG91 — define webhook signature validation up-front in the Implementation Document of the Wallet slice.
- **Audit log table.** Spec §9 has tables but no `AuditLog` model. Recommend adding `model AuditLog { id, riderId?, actorType, actorId, action, resource, before Json?, after Json?, ip, userAgent, requestId, createdAt }` partitioned monthly.
- **Per-rider rate limits** (in addition to per-IP). The spec rate-limits OTP per phone but not other endpoints per rider. Recommend defaults: `/orders/:id/accept` → 60/min, `/wallet/withdraw` → 3/24h (already in spec §14), `/auth/refresh` → 30/h.
- **Threat model artifacts.** Build a STRIDE document per service before coding (spoofing of phone in OTP flow; tampering of order status; repudiation in delivery proof; info disclosure via leaderboard; DoS on `locationUpdate`; elevation via JWT replay).

### 9.4 Compliance / regulatory

- **DPDPA 2023 (India)** — riders are Data Principals; document retention, consent flow, right-to-erasure must be designed into KYC and notifications. Add `riders.consentVersion` and `consentGivenAt` to the schema. (Not in spec — flag.)
- **PCI scope** — by routing payments through a gateway (Razorpay/Cashfree), card data never touches our servers. Document this in an ADR to keep future work compliant.
- **RBI KYC norms** — bank-account verification via penny-drop is correct (spec §5.7). Document the audit trail (UTR, gateway response) retention period.

---

## 10. Scalability Observations

### 10.1 Spec is correct on the hot paths

- Location updates → BullMQ → batched DB writes (avoids 80K writes/s to Postgres).
- Online rider count → Redis counter, never `SELECT COUNT(*)`.
- Cache-aside on read-heavy endpoints (profile 60s, leaderboard 5m, zones 3m, geocode 1h).
- PgBouncer with `connection_limit=5/instance` to prevent Postgres connection exhaustion.

### 10.2 Spec gaps / refinements to flag

- **Hot-rider problem.** A single rider receiving many `order:new-request` events in succession can saturate their socket. Spec doesn't define backpressure. Recommend: at most one pending order per rider at a time; if rider already has a pending request, requeue to next rider before 45 s expiry.
- **Order assignment fairness.** Spec §5.4 says `SET order:assigned:{orderId} {riderId} NX EX 3600` — this is correct for racing accepts, but says nothing about *who gets offered* the order. Need an assignment service (haversine within radius, sort by score: distance + rating + recent earnings + completion rate). Recommend an `assignment-engine` module under `orders/` with explicit ranking pipeline.
- **Leaderboard at scale.** Aggregating `EarningsTransaction` per rider per period is expensive at 80K riders. Spec §13 says "leaderboard queries MUST run against materialized summaries". Define `MaterializedView leaderboard_daily` refreshed every 5 min via a scheduled BullMQ job.
- **Heatmap / operating-zones queries.** Polygons + 80K rider geohashing — recommend PostGIS extension on Postgres, or use Redis GeoSet (spec already specifies). Confirm: PostGIS for zones (admin-defined, infrequent change) + Redis GeoSet for live rider positions (frequent).
- **Socket.IO Redis adapter performance.** Adapter pub/sub at 80K connections requires Redis cluster (not single instance) and careful event design. Recommend: namespace events (`/rider`, `/admin`) to limit fan-out scope; never broadcast to all riders.
- **Push token churn.** FCM tokens rotate. Recommend: validation job that prunes stale tokens (errors 404 from FCM) weekly.
- **Earnings settlement window.** "Earnings are settled every Monday by 10 AM" (per FAQ copy) — implies a weekly cron. Spec §7 lists `earnings-settlement` BullMQ queue but no schedule. Recommend explicit cron-style trigger in `services/workers/schedules.ts`.

### 10.3 Frontend scalability concerns

- **Over-fetching on Home screen.** Today every dynamic section comes from a separate hook; once wired, that's 6+ HTTP calls on home mount. Recommend a single `GET /rider/home-snapshot` aggregate endpoint that returns `{ profile, status, todayEarnings, activeIncentives, demandSummary, alertsCount }` — saves 5 round trips.
- **Socket reconnect storms.** Spec config `reconnectionAttempts: 10, reconnectionDelay: 2000, reconnectionDelayMax: 30000` is good; ensure FE matches (currently `attempts:5, delay:1000` — `socketClient.ts:25-28`).
- **Image uploads on slow networks.** KYC documents are typically 1-3 MB JPEGs. Recommend FE compress to `quality:0.7, maxWidth:1600` before presigned-PUT, and show progress UI.
- **AsyncStorage size.** Lots of feature data persisted there today. Once backend is wired, prune unused keys (kyc image URIs, document blobs) to keep storage under the 6 MB Android limit.
- **i18n bundle size.** Six languages × the JSON bundle ships in every download. Recommend remote-loaded translations from `/support/translations/{lang}.json` post-MVP.

---

## 11. Clarification Questions

These must be answered before backend implementation begins. Ranked by blocking severity.

**A. Hard blockers (decide before any code is written)**

1. **OTP length** — 4 (frontend today) or 6 (spec)? Recommend 6.
2. **Login response shape** — Migrate frontend to `accessToken` + `refreshToken`, or have backend alias `data.token = accessToken` for compatibility? Recommend full migration (refresh-token flow is required regardless).
3. **KYC document set** — Authoritative list. Should PAN be required? Should RC, bike photo, insurance, licence-back stay in `/kyc/documents` or move to `/rider/vehicle`?
4. **Rider categories taxonomy** — Single enum `{student, professional, part_time, full_time, disabled}` or two-axis? Recommend single enum.
5. **Vehicle type vs fuel type** — Capture both as separate fields (`vehicleType ∈ {bike, bicycle, scooter, ev}` + `fuelType ∈ {petrol, electric, none}`)? Recommend yes.
6. **Currency units** — Confirm spec wins: paise integers everywhere, frontend formats for display.

**B. Spec gaps (need explicit confirmation)**

7. **`POST /kyc/disabled`** — Add to spec, or merge into `/kyc/personal`?
8. **`GET /wallet/statements?month=`** — Add monthly-statements endpoint, or scope `AccountStatementsScreen` to be built off `/wallet/history` aggregations?
9. **`POST /wallet/cash-in-hand/reconcile`** — Need a way for the rider (or ops) to mark cash deposited. Add endpoint?
10. **Wallet QR feature** — Today `QRModal` generates a QR off `cravix_pay:{riderId}?amt=...`. Should this be a backend feature (signed token, fraud-protected), kept as an offline UPI helper, or removed? Recommend remove until properly designed.
11. **Support ticket UI** — Spec has the endpoint; should we build a HelpCenter "Create Ticket" screen now or defer?
12. **Delivery proof photo screen** — Spec endpoint exists; add capture screen now or defer?
13. **FAQ / Privacy / Terms cutover** — Cut over to `/support/*` immediately (admin-editable) or keep i18n bundles for v1 and migrate post-launch?

**C. Operational decisions**

14. **SMS provider** — Spec mentions MSG91. Confirm; document failover (e.g., AWS SNS as backup).
15. **FCM service account** — Will Anthropic-side or platform-side provide the Firebase project? Need `FCM_SERVICE_ACCOUNT_JSON` value.
16. **Payment gateway** — Razorpay, Cashfree, or other? Affects penny-drop and withdrawal flows.
17. **S3 buckets** — Are `cravix-kyc` and `cravix-cdn` already provisioned with the correct CORS, lifecycle, encryption (SSE-KMS) settings?
18. **Maps API key** — Will be issued for the rider app (Android SHA + iOS bundle id pinned)? Currently `app.json` has the literal placeholder.
19. **Refresh-token revocation on password reset** — Spec does not mention password flow (passwordless OTP only). Confirm: there is no password concept at all? Recommend confirmed — phone+OTP only.
20. **Multi-device login** — Spec doesn't say whether a rider can be logged into 2 phones simultaneously. Recommend single-session: new login revokes prior refresh token. Confirm.
21. **Background location** — Spec implies live location streaming; today FE has no background location. Required for real shift-tracking. Approve adding `expo-task-manager` + background `Location.startLocationUpdatesAsync`?
22. **Admin app** — Several events fan out to "admin namespace". Is the admin app in scope of this engagement, or only the rider-app backend? Affects Socket.IO namespace design.

**D. Compliance**

23. **DPDPA / consent flow** — Need a consent capture screen + `riders.consentVersion`. Add now or defer?
24. **Data retention windows** — Location history (recommend 30d), notifications (recommend 90d), order history (forever, archive after 1y). Confirm.
25. **Rider deletion / right-to-erasure** — Soft delete via `deletedAt` (not in spec §9 but standard) — confirm policy.

---

## STOP — Awaiting Approval

Per the strict protocol in the original prompt:

> After generating the review:
> 👉 STOP
> 👉 WAIT for explicit user approval
> DO NOT proceed further.

**Once you confirm the answers to §11 (especially A1–A6), I will:**

1. Author ADRs 001–010 (§8.5).
2. Stand up the monorepo skeleton (§8.2).
3. Implement Sprint 0 + the Auth slice (§8.4 step 1–2) end-to-end with the two required documents (Implementation Document + Self-Review Report).
4. Then proceed slice-by-slice through the sequence in §8.4, validating each against the corresponding frontend caller before moving on.

No backend code or files will be created until approval is given.

---

## Appendix A — Full Screen → Component → Route Inventory

(Cross-reference for §2.3.)

```
app/index.tsx                                  → SplashScreen                      (auth)
app/login.tsx                                  → LoginScreen                       (auth)
app/otp.tsx                                    → OtpScreen                         (auth)

app/kyc/_layout.tsx                            → KYC Stack
app/kyc/index.tsx                              → ReviewScreen                      (kyc hub)
app/kyc/personal.tsx                           → PersonalScreen                    (kyc)
app/kyc/document-verification.tsx              → DocumentVerificationScreen        (kyc)
app/kyc/category.tsx                           → CategoryScreen                    (kyc)
app/kyc/student.tsx                            → StudentScreen                     (kyc)
app/kyc/disabled.tsx                           → DisabledScreen                    (kyc)
app/kyc/review.tsx                             → ReviewScreen                      (kyc)

app/(tabs)/_layout.tsx                         → CustomTabBar
app/(tabs)/home.tsx                            → HomeScreen                        (tab)
app/(tabs)/shifts.tsx                          → ShiftsScreen                      (tab)
app/(tabs)/orders.tsx                          → OrdersScreen                      (tab)
app/(tabs)/earnings.tsx                        → EarningsScreen                    (tab)
app/(tabs)/profile.tsx                         → ProfileScreen                     (tab)
app/(tabs)/explore.tsx                         → ExploreScreen                     (hidden)

app/(home)/heatmap.tsx                         → HeatmapScreen                     (modal)
app/(home)/notifications.tsx                   → NotificationsScreen
app/(home)/alerts.tsx                          → AlertsScreen
app/(home)/leaderboard.tsx                     → LeaderboardScreen
app/(home)/incentives.tsx                      → IncentivesScreen
app/(home)/operating-zones.tsx                 → OperatingZonesScreen

app/(orders)/active-navigation.tsx             → ActiveNavigationScreen
app/(orders)/delivery-request.tsx              → DeliveryRequestScreen
app/(orders)/instructions.tsx                  → InstructionsScreen                (modal)

app/(wallet)/cashinhand.tsx                    → CashInHandScreen                  (modal)
app/(wallet)/payment-history.tsx               → PaymentHistoryScreen
app/(wallet)/bank-accounts.tsx                 → BankAccountsScreen
app/(wallet)/add-bank.tsx                      → AddBankScreen

app/(profile)/settings.tsx                     → SettingsScreen
app/(profile)/allowance.tsx                    → AllowanceScreen
app/(profile)/vehicle-info.tsx                 → VehicleInfoScreen
app/(profile)/account-statements.tsx           → AccountStatementsScreen
app/(profile)/help-center.tsx                  → HelpCenterScreen
app/(profile)/profile-details.tsx              → ProfileDetailsScreen
app/(profile)/privacy-policy.tsx               → PrivacyPolicyScreen
app/(profile)/app-guide.tsx                    → AppGuideScreen
app/(profile)/digital-documents.tsx            → DigitalDocumentsScreen
app/(profile)/terms-of-service.tsx             → TermsOfServiceScreen

app/(emergency)/emergency-contacts.tsx         → EmergencyContactsScreen
app/(emergency)/edit-emergency-contact.tsx     → EditEmergencyContactScreen
app/(emergency)/edit-medical-essentials.tsx    → EditMedicalEssentialsScreen

app/(common)/warning.tsx                       → WarningScreen
app/(common)/modal.tsx                         → ModalScreen                        (template leftover)

app/shift-success.tsx                          → (inline component)
```

## Appendix B — AsyncStorage Key Catalogue

(See §3.2 and §6.2 for context.)

| Key | Read sites | Write sites | Status |
|---|---|---|---|
| `auth-storage` (Zustand persist) | `authStore.ts:11` (auto) | `authStore.ts:11` (auto) | ✅ in use |
| `@user_token` | `authStore.ts:29`, `useProfileData.ts:54`, `SettingsScreen.tsx:82` | `OtpScreen.tsx:134` | ⚠ duplicate of authStore — consolidate |
| `@temp_phone` | `OtpScreen.tsx:71` | `LoginScreen.tsx:106` | ✅ in use |
| `@kyc_status` | `SplashScreen.tsx:68` | _(none)_ | ❌ never written → splash always falls through |
| `@personal_data` | `useKycStatus.ts:14`, `ProfileDetailsScreen.tsx:87`, `usePersonalForm.tsx:99`, `useProfileData.ts:22`, `UserContext.tsx:58`, `ReviewScreen.tsx:37` | `usePersonalForm.tsx:112` | ✅ in use |
| `@document_verification_data` | `useKycStatus.ts:15`, `ReviewScreen.tsx:38`, `DocumentVerificationScreen.tsx:142` | `DocumentVerificationScreen.tsx:231` | ✅ in use |
| `@kyc_category`, `@kyc_subcategory` | `CategoryScreen.tsx:41-42`, `useKycStatus.ts:16`, `ReviewScreen.tsx:39` | `CategoryScreen.tsx:61-62` | ✅ in use |
| `@student_data` | `useKycStatus.ts:22`, `ProfileDetailsScreen.tsx:88`, `ReviewScreen.tsx:45`, `StudentScreen.tsx:61` | `StudentScreen.tsx:118` | ✅ in use |
| `@disabled_data` | `useKycStatus.ts:28`, `ProfileDetailsScreen.tsx:89`, `ReviewScreen.tsx:51`, `DisabledScreen.tsx:55` | `DisabledScreen.tsx:104` | ✅ in use |
| `@kyc_profile_photo` | `PersonalScreen.tsx:72`, `usePersonalForm.tsx:104`, `useProfileData.ts:23,78`, `UserContext.tsx:53,95,98` | `PersonalScreen.tsx:72`, `usePersonalForm.tsx:104` | ✅ in use |
| `@aadhaar_data`, `@kyc_aadhaar_front`, `@kyc_aadhaar_back`, `@insurance_data`, `@kyc_insurance_image` | `DigitalDocumentsScreen.tsx:72-76` | _(none)_ | ❌ never written |
| `@license_data`, `@kyc_license_image`, `@vehicle_data`, `@kyc_rc_image` | `VehicleInfoScreen.tsx:71-74` | _(none)_ | ❌ never written |
| `@profile_image` | `UserContext.tsx:51, 94, 97` | same | ✅ in use |
| `@rider_name` | `UserContext.tsx:52, 108` | same | ✅ in use |
| `@is_online` | `UserContext.tsx:54, 117` | same | ✅ in use |
| `@bank_data` | `UserContext.tsx:55, 158` | same | ✅ in use |
| `@order_stats` | `UserContext.tsx:78, 149` | same | ✅ in use |
| `@seconds_online` | `UserContext.tsx:81, 125, 136` | same | ✅ in use |
| `@wallet_balance` | _(read-on-hydrate missing)_ | `UserContext.tsx:169` | ⚠ write-only |
| `@emergency_contact` | `EmergencyContactsScreen.tsx:35`, `EditEmergencyContactScreen.tsx:45` | `EditEmergencyContactScreen.tsx:71` | ✅ in use |
| `@medical_essentials` | `EmergencyContactsScreen.tsx:36`, `EditMedicalEssentialsScreen.tsx:47` | `EditMedicalEssentialsScreen.tsx:63` | ✅ in use |
| `@shift_presets`, `@shift_window` | `ShiftsScreen.tsx:47-48` | `ShiftsScreen.tsx:60-61` | ✅ in use (will move to backend per spec §15) |
| `@app_settings` | `SettingsContext.tsx:25, 45` | same | ✅ in use |
| `@app_language` | `LanguageContext.tsx:22, 41` | same | ✅ in use |

## Appendix C — Endpoint Coverage Matrix Summary

| Spec section | Endpoints in spec | Wired today | % coverage |
|---|---:|---:|---:|
| 5.1 Auth | 4 | 2 | 50% |
| 5.2 Rider | 6 | 0 | 0% |
| 5.3 KYC | 7 | 0 | 0% |
| 5.4 Orders | 6 | 0 | 0% |
| 5.5 Shifts | 4 | 0 | 0% |
| 5.6 Earnings | 5 | 0 | 0% |
| 5.7 Wallet | 7 | 0 | 0% |
| 5.8 Location | 3 | 0 | 0% |
| 5.9 Notifications | 5 | 0 | 0% |
| 5.10 Emergency | 7 | 0 | 0% |
| 5.11 Support | 5 | 0 | 0% |
| **Total REST** | **~59** | **2** | **~3.4%** |
| §6 Socket events (C→S) | 6 | 0 | 0% |
| §6 Socket events (S→C) | 8 | 0 | 0% |
| §7 BullMQ queues | 7 | 0 | 0% |

The integration work is therefore substantial — but the spec is precise enough that, with the §11 clarifications resolved, every endpoint and event has an unambiguous contract.

---

*End of review. Awaiting approval to proceed to Phase 4 (backend implementation).*
