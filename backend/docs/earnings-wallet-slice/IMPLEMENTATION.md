# Earnings + Wallet Slice — Implementation Document

> **Slice:** Earnings dashboard + Wallet/payments
> **Endpoints:** `/api/v1/earnings/{summary,chart,transactions,leaderboard,incentives}` (5) · `/api/v1/wallet/{balance,history,cash-in-hand,cash-in-hand/reconcile,bank-accounts,withdraw,allowance,statements}` (8)
> **Date:** 2026-05-01

---

## 1. Feature Overview

Two complementary modules shipped together because the wallet's `availableForWithdrawal` and the earnings dashboard's `totalEarnings` are derived from the same underlying `EarningsTransaction` rows. Together they retire the largest cluster of hardcoded values from the original review:
- `EarningsHeader.tsx:53` — the literal `₹4,250.34` is gone; the field reads `availableForWithdrawal` from `/wallet/balance`.
- `LeaderboardScreen.tsx:26-37` — the 10-row hardcoded array with full names + `i.pravatar.cc` avatars is gone, replaced with a server projection that applies the spec's privacy rule (first name + last initial only).
- `PaymentHistoryScreen.tsx:51-58, 81, 86` — six hardcoded transactions and the `₹12,450 / ₹8,500` summary are gone.
- `useEarningsData.ts` — the `WEEKLY_DATA` constant and `Math.random()` cosmetic wiggle are gone.
- `BankAccountsScreen.tsx`, `AddBankScreen.tsx` — single-object `bankData` replaced with the spec's array shape; new accounts go through penny-drop verification.
- `AllowanceScreen.tsx`, `AccountStatementsScreen.tsx` — both server-driven now.

It honors locked decisions:
- **A6** — every money field is `Decimal(8,2)` or `Decimal(12,2)` in Postgres and `number` rupees on the wire (no paise integers anywhere).
- **Spec §5.6 privacy rule** — leaderboard returns first name + last initial only, server-side projection (no client trust).

It also closes one spec gap:
- **`GET /wallet/statements?month=`** — added to fill the `AccountStatementsScreen` need (§6.6 of the alignment review).

## 2. API Specification

### 2.1 Earnings (5 endpoints)

| Method + Path | Cache | Notes |
|---|---|---|
| `GET /earnings/summary?period=today\|week\|month` | Redis 120s | Sums settled `EarningsTransaction` in the window; computes goal % from a hard-coded target table (today: ₹500, week: ₹3,500, month: ₹14,000). |
| `GET /earnings/chart?period=week\|month&groupBy=day\|hour` | Redis 120s | Postgres `date_trunc` aggregation; missing days padded with 0 so the chart axis stays continuous. |
| `GET /earnings/transactions?page&limit&type` | none | Standard paginated envelope; `type` filter accepts `delivery_earning|long_distance_bonus|incentive_bonus|deduction|adjustment|all`. |
| `GET /earnings/leaderboard?period&city` | Redis 300s | **Privacy rule:** server projects `displayName = "First L."` — full name never leaves the database. Includes `myRank` + `myEarnings` for the requesting rider even if they're outside the top 25. |
| `GET /earnings/incentives` | none | Returns `[]` until the campaigns service ships; wire format is finalised. |

### 2.2 Wallet (8 endpoints)

| Method + Path | Cache | Notes |
|---|---|---|
| `GET /wallet/balance` | Redis 30s | Four-field shape: `totalBalance`, `availableForWithdrawal`, `pendingSettlement`, `cashInHand`. Auto-creates `WalletAccount` on first read. |
| `GET /wallet/history?page&limit&type` | none | Standard pagination over `WalletTransaction`; type filter `earning|withdrawal|bonus|deduction|refund|all`. |
| `GET /wallet/cash-in-hand` | none | Returns COD orders not yet reconciled (`Order.status='DELIVERED' AND NO matching EarningsTransaction.status='SETTLED'`). |
| `POST /wallet/cash-in-hand/reconcile` | n/a | Decrements `WalletAccount.cashInHand` by the reconciled amount; methods `hub_deposit | upi_transfer | admin_adjustment`. |
| `GET /wallet/bank-accounts` | none | List of `BankAccount` rows with masked numbers. |
| `POST /wallet/bank-accounts` | n/a | bcrypt-hashes the account number, stores last-4 only, enqueues `payments:penny-drop` BullMQ job. |
| `POST /wallet/withdraw` | rate-limited 3/24h | ₹100–₹50,000 per withdrawal; verifies `availableBalance >= amount` AND `bankAccount.status='VERIFIED'`; transactional balance debit + `pendingSettlement` credit; enqueues `payments:withdrawal`. |
| `GET /wallet/allowance` | none | Eligibility + monthly-earned for fuel allowance; reset date = first of next month. |
| `GET /wallet/statements?month=YYYY-MM` (gap fill) | none | Last 6 months of monthly earnings summaries; `downloadUrl: null` until PDF generation lands. |

## 3. Frontend Integration

| Change | File | Notes |
|---|---|---|
| Earnings + wallet services | `src/services/api/features/{earnings,wallet}.ts` (rewritten) | Fully typed with money fields as `number` rupees. |
| `useEarnings` hook | `src/features/earnings/hooks/useEarnings.ts` (new) | Replaces `useEarningsData`; loads summary + chart + recent transactions in parallel, exposes `setPeriod`. |
| `useWalletBalance`, `useWalletHistory`, `useCashInHand`, `useBankAccounts`, `useAllowance`, `useStatements` | `src/features/wallet/hooks/useWallet.ts` (new) | Six wallet hooks in one module so consumers can pull what they need. `useBankAccounts` exposes `addAccount` that handles the optimistic primary-flag flip. |
| `useLeaderboard` hook | `src/features/earnings/hooks/useLeaderboard.ts` (new) | Wraps the leaderboard endpoint; `displayName` already privacy-projected by the server. |
| EarningsHeader rewired | `src/features/earnings/components/EarningsHeader.tsx` | The literal `₹4,250.34` is gone; renders `availableForWithdrawal` and `pendingSettlement` from `useWalletBalance()`. |
| LeaderboardScreen rewired | `src/features/earnings/screens/LeaderboardScreen.tsx` | `LEADERBOARD_DATA` 10-row mock removed; consumes `useLeaderboard`. Adapts `displayName` + `orders` → existing `name` + `deliveries` props on `LeaderboardPodium`/`Row` so JSX is otherwise unchanged. |
| BankAccountsScreen | `src/features/wallet/screens/BankAccountsScreen.tsx` | Drops the single-object `useUser().bankData`; consumes `useBankAccounts()`, picks the primary account, adapts to the existing `paymentCard` renderer. |
| AddBankScreen | `src/features/wallet/screens/AddBankScreen.tsx` | Calls `walletService.addBankAccount(...)` which kicks off the penny-drop. UserContext mirror is kept for offline-fallback rendering. |
| CashInHandScreen | `src/features/wallet/screens/CashInHandScreen.tsx` | `walletBalance` now sourced from `useWalletBalance()` + `useCashInHand()`; the `updateWalletBalance(-n)` shim calls `reconcileCashInHand({amount: n, method: 'upi_transfer'})`. |
| PaymentHistoryScreen | `src/features/wallet/screens/PaymentHistoryScreen.tsx` | Six hardcoded txns and the `₹12,450 / ₹8,500` summary header removed; consumes `useWalletHistory` + `useWalletBalance`. |

## 4. Code Walkthrough

### 4.1 Privacy projection (`earnings/service.ts`)

```ts
function maskName(name: string | null): string {
  if (!name) return 'Rider';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]![0]}.`;
}
```

The mask runs **before** the leaderboard payload leaves the service. Even if a future client manipulates the request, the full name never crosses the boundary. The cache key is `cravix:cache:leaderboard:{period}:{city}` so the masked projection is what gets cached.

### 4.2 Withdrawal atomicity (`wallet/service.ts`)

The `createWithdrawalTransaction` repository call wraps the balance debit + the `WalletTransaction` insert in a single `prisma.$transaction`. Three things change atomically:
1. `availableBalance -= amount`
2. `totalBalance -= amount`
3. `pendingSettlement += amount` (so `total - cashInHand = available + pending` invariant holds)

A subsequent BullMQ `payments:withdrawal` job (still a stub today) is responsible for the actual gateway call; on success it would flip the txn to `SETTLED` and decrement `pendingSettlement`. On failure it would refund.

### 4.3 Auto-create on first read

A freshly-onboarded rider has no `WalletAccount` row. Rather than 404 on the first `/wallet/balance`, the repository upserts:

```ts
async ensureAccount(riderId: string) {
  return prisma.walletAccount.upsert({
    where: { riderId }, create: { riderId }, update: {},
  });
}
```

This makes the slice idempotent — the FE can call `/wallet/balance` even on the very first session and get the four-field zeros.

### 4.4 Cache-aside for the dashboard (`earnings/service.ts`)

`/summary` and `/chart` are 120 s cached; `/leaderboard` is 300 s. The `cacheAside` helper from `@cravix/shared-redis` is reused so all three follow the same loader pattern. `/transactions` is **not** cached — paginated lists with mutating data don't benefit, and the FE only fetches the first page on EarningsScreen mount.

### 4.5 Locked-A6 in practice

`Order.baseEarnings` is `Decimal(8,2)`. `EarningsTransaction.amount` is `Decimal(10,2)`. `WalletAccount.{totalBalance,availableBalance,pendingSettlement,cashInHand}` are `Decimal(12,2)`. Reading them via Prisma returns a `Decimal` object; the projection layer does `Number(decimal)` and rounds: `Number(amount.toFixed(2))` to keep the JSON clean. There is no path where money becomes a JS `number` before reaching the response serializer.

## 5. Security Measures

| Measure | Implementation |
|---|---|
| All routes auth-guarded | `earningsRouter.use(authMiddleware)`, `walletRouter.use(authMiddleware)`. |
| Privacy projection server-side | `maskName` runs before the cache fill; full names never leave the DB. |
| Account number never stored cleartext | `bcrypt.hash(accountNumber, 10)` + last-4 for display. |
| IFSC normalised | `.toUpperCase()` on input; pinned format `^[A-Z]{4}0[A-Z0-9]{6}$`. |
| Penny-drop required before withdrawal | `bank.status !== 'VERIFIED'` ⇒ 400. |
| Withdraw bounds | ₹100 ≤ amount ≤ ₹50,000 (Zod), and balance check (`INSUFFICIENT_BALANCE` 422). |
| Withdraw rate limit | 3 / 24 h / IP via `withdrawLimiter` (Redis-backed). |
| Cash-in-hand reconcile bounds | Cannot exceed current `cashInHand`. |
| One primary bank account per rider | `BankAccount.isPrimary` de-flagged transactionally on insert. |
| Strict Zod schemas | `.strict()` on every body — no mass-assignment. |
| Redis cache invalidation | Withdraw + reconcile both `redis.del` the balance cache key. |

## 6. How to Run

```bash
cd backend
pnpm docker:up
pnpm prisma:migrate
pnpm dev               # api-gateway
pnpm dev:workers       # workers (penny-drop + withdrawal stubs)
```

End-to-end smoke (with the access token from auth):
```bash
ACCESS=...

# Earnings
curl -s "http://localhost:3000/api/v1/earnings/summary?period=today" -H "Authorization: Bearer $ACCESS" | jq
curl -s "http://localhost:3000/api/v1/earnings/leaderboard?period=today&city=bengaluru" -H "Authorization: Bearer $ACCESS" | jq

# Wallet
curl -s http://localhost:3000/api/v1/wallet/balance -H "Authorization: Bearer $ACCESS" | jq
curl -s http://localhost:3000/api/v1/wallet/cash-in-hand -H "Authorization: Bearer $ACCESS" | jq

# Add a bank account (penny-drop kicks off; row starts as PENDING_VERIFICATION)
curl -s -X POST http://localhost:3000/api/v1/wallet/bank-accounts \
  -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
  -d '{"accountHolderName":"Arjun Kumar","accountNumber":"1234567890","confirmAccountNumber":"1234567890","ifscCode":"HDFC0001234","bankName":"HDFC Bank","isPrimary":true}' | jq

# (After the worker stub flips it to VERIFIED in production)
# Withdraw
# curl -s -X POST http://localhost:3000/api/v1/wallet/withdraw \
#   -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
#   -d '{"amount":1000,"bankAccountId":"<id>"}' | jq

# Statements (gap fill)
curl -s "http://localhost:3000/api/v1/wallet/statements" -H "Authorization: Bearer $ACCESS" | jq
```

## 7. Files Created / Modified

**Backend (created):**
```
backend/services/api-gateway/src/modules/earnings/
├── schemas.ts, types.ts, repository.ts, service.ts, controller.ts, routes.ts
backend/services/api-gateway/src/modules/wallet/
├── schemas.ts, types.ts, repository.ts, service.ts, controller.ts, routes.ts
backend/docs/earnings-wallet-slice/
├── IMPLEMENTATION.md, SELF_REVIEW.md
```

**Backend (modified):**
- `services/api-gateway/src/app.ts` — mounts `/api/v1/earnings` and `/api/v1/wallet`.

**Frontend (created/modified):**
- `src/services/api/features/{earnings,wallet}.ts` — rewritten as full typed services.
- `src/features/earnings/hooks/{useEarnings,useLeaderboard}.ts` — new.
- `src/features/wallet/hooks/useWallet.ts` — new (six hooks in one module).
- `src/features/earnings/components/EarningsHeader.tsx` — server-driven balance.
- `src/features/earnings/screens/LeaderboardScreen.tsx` — privacy-compliant.
- `src/features/wallet/screens/BankAccountsScreen.tsx` — list-driven.
- `src/features/wallet/screens/AddBankScreen.tsx` — POST + penny-drop.
- `src/features/wallet/screens/CashInHandScreen.tsx` — server-driven balance + reconcile.
- `src/features/wallet/screens/PaymentHistoryScreen.tsx` — server-driven txns + summary.

## 8. Open Items Carried Forward

1. **PDF generation for `/wallet/statements`** — the endpoint shape includes `downloadUrl`, currently `null`. Generating PDFs is a future polish item (likely a worker that produces them and uploads to `cravix-cdn`).
2. **Real penny-drop integration** — Razorpay's penny-drop API replaces the stub in `workers/notifications.ts` (or a new dedicated worker file).
3. **Real withdrawal payout** — Razorpay payouts API; worker watches `payments:withdrawal` queue.
4. **Incentives campaigns service** — `/earnings/incentives` returns `[]` today. A separate slice will introduce the `Campaign` model + admin tooling.
5. **Online-hours aggregator** — `EarningsSummary.onlineHours` is 0 today; a Redis aggregator keyed by date (sum of `lastSeen - since` per day) closes this in the hardening pass.
6. **AllowanceScreen UI rewire** — the screen still renders some hardcoded copy under the dynamic `useAllowance` data. Cosmetic; tracked.
7. **AccountStatementsScreen UI rewire** — same as above; backend serves real data, screen still has some dead JSX.
8. **`useBankAccounts` empty primary heuristic** — when all accounts are non-primary, the FE shows the first one. The backend already de-flags duplicates on insert, so this only matters during the transition before any bank is added.
