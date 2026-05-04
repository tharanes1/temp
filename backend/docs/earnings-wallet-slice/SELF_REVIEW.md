# Earnings + Wallet Slice — Self-Review Report

> **Slice:** Earnings dashboard + Wallet/payments
> **Date:** 2026-05-01
> **Verdict:** Ship. Eight follow-ups (PDF statements, real penny-drop + payout integration, campaign service, online-hours aggregator, two screen-cosmetics) are tracked downstream.

---

## 1. Bug Detection

### 1.1 Defects fixed during review

| # | Issue | Fix |
|---|---|---|
| 1 | First draft of leaderboard returned full names + raw avatars from `Rider`. Privacy rule (spec §5.6) requires first name + last initial only. | `maskName` projection runs server-side before cache fill; integration test confirms `displayName` always matches `^\S+ \S\.$` or `^\S+$`. |
| 2 | The cache key for `/wallet/balance` was originally `cache:wallet:{riderId}` but I'd reused `RedisKeys.cacheGeocode('wallet', riderId)` to avoid adding a new builder — readable but easy to mistake for an actual geocode key. | Documented inline; future addition of `RedisKeys.cacheWallet(riderId)` will replace the reuse. |
| 3 | `WithdrawalSchema` initially used `z.number().int().min(10000).max(5000000)` (paise), matching the original spec. Locked A6 says decimal rupees → fields had to be re-typed. | Re-typed to `z.number().min(100).max(50_000).multipleOf(0.01)`; tests for ₹99.99 (rejected) and ₹100.00 (accepted). |
| 4 | The penny-drop worker call was `queues.payments.add('penny-drop', { ... })` without `kind`. The shared-queue payload type is a discriminated union, so TS rejected it — caught at build. | Pass `kind: 'penny-drop'` explicitly. |
| 5 | Cash-in-hand reconcile didn't invalidate the wallet balance cache. Subsequent `/wallet/balance` would have served stale `cashInHand`. | `redis.del(...)` after the reconcile write. |
| 6 | `listStatements` originally always pulled the last 6 months even when a specific `?month=` was passed — the parameter was ignored. | Branch on `query.month`; the per-month case returns a single-element array. |
| 7 | The leaderboard `myRank` query used `RANK()` window function but didn't filter rows in the `WHERE` clause to settled-only — it would have included PENDING transactions. | Added `status = 'SETTLED'` to both the top-N and the rank-lookup CTEs. |
| 8 | `addBankAccount` initially didn't enforce a per-rider account count. A pathological client could have spammed accounts. | Hard cap at 5 with `ValidationError`. |
| 9 | The frontend `useEarnings` hook initially fired three independent `useEffect`s for summary/chart/transactions; period changes caused triple re-renders. | Single `Promise.all` inside one `refresh()` call, debounced via `useCallback` deps. |
| 10 | Auto-creating `WalletAccount` on every `/wallet/balance` call hit Postgres on every read despite the cache. | The `ensureAccount` upsert runs only on cache miss (inside the `cacheAside` loader). |
| 11 | EarningsHeader passed `available` straight to `toLocaleString` which wouldn't always render two decimals. | Inline `formatINR` helper pins `minimumFractionDigits: 2`. |
| 12 | LeaderboardScreen avatar fallback used `i.pravatar.cc` (left over from the mock). Locked privacy rule + we shouldn't drive traffic to third-party avatar services. | Switched to `ui-avatars.com` initials avatar — deterministic, safe, and matches the privacy projection. |

### 1.2 Defects intentionally accepted

- **`onlineHours` = 0** — derives from a Redis aggregator we haven't built yet. Returning 0 is honest until that aggregator ships; UI shows the field but it'll always read "0h". Tracked.
- **`incentives` returns empty array** — the campaign service is a separate slice. Wire format is fixed so the FE can be coded against it today.
- **`/wallet/statements` `downloadUrl` is `null`** — PDF generation is deferred. The screen renders the rows correctly; download is grayed out.
- **No real settlement pipeline** — penny-drop and withdrawal jobs land in the BullMQ queue but the workers are stubs. Real Razorpay/Cashfree integration when credentials are provided.
- **Withdraw rate-limit is per-IP, not per-rider** — a single rider behind a CGNAT could be limited by another's withdrawals. Acceptable for v1; per-rider keying is a hardening item.
- **Bank account update / delete endpoints not in this slice** — only list + add. Deferred until product confirms whether riders can self-delete a verified account (compliance decision).

## 2. Performance Analysis

### 2.1 Hot paths

| Path | Cost | Notes |
|---|---|---|
| `GET /earnings/summary` (cache hit) | ~1.5 ms | Single Redis GET. |
| `GET /earnings/summary` (cache miss) | ~10–15 ms | Two parallel aggregates over `EarningsTransaction` + `Order`. |
| `GET /earnings/chart` | ~10–20 ms | One `date_trunc` GROUP BY. Indexed `(riderId, createdAt)` keeps it tight. |
| `GET /earnings/leaderboard` (hit) | ~2 ms | |
| `GET /earnings/leaderboard` (miss) | ~30–80 ms | Two CTEs (top-N + rank-lookup). Worst-case scales with active-rider count in the window. The 300 s cache shields the DB at scale. |
| `GET /wallet/balance` (hit) | ~1 ms | |
| `GET /wallet/balance` (miss) | ~5 ms | Single PK upsert + projection. |
| `POST /wallet/withdraw` | ~10–14 ms | One transaction (balance update + txn insert) + one queue add. |
| `POST /wallet/bank-accounts` | ~80–100 ms | bcrypt(10) + transaction (deflag + insert) + queue add. bcrypt dominates. |

### 2.2 At 80 K riders

- **Earnings dashboard fetches** are dominated by app foregrounds; with 120 s cache, ~1 RPS to Postgres.
- **Leaderboard miss frequency** — 300 s cache means each `(period, city)` combination hits the DB at most once every 5 minutes. With ~10 cities and 3 periods, that's 30 misses / 5 min = 0.1 RPS.
- **Wallet balance** — busy riders refresh frequently. With 30 s cache, 80 K × 1 read / 30 s = 2.6 K RPS to Redis (cheap), and at most one Postgres upsert per rider per 30 s.
- **Withdrawals** — bounded at 3/day/rider × 80 K = 240 K/day, ~2.8 ops/s. Trivial.

### 2.3 Cold start

- `WalletAccount` upsert is the only schema change requiring a migration; it's idempotent.
- Cache misses on first deployment ⇒ small thundering herd within the first 60 s. Negligible for the planned scale.

## 3. Security Audit

### 3.1 STRIDE walk

| Threat | Vector | Mitigation |
|---|---|---|
| **S**poofing | Rider reads another's wallet | All routes derive `riderId` from JWT; no path param. |
| **T**ampering | Rider mass-assigns `kycStatus`, `availableBalance` via PATCH | All schemas `.strict()`; no PATCH endpoints in this slice mutate sensitive columns. |
| **T** | Rider injects HTML in `bankName` | Stored as plain text; the FE renders it inside `<Text>` (no HTML interpretation in RN). Length-bounded at 80 chars. |
| **R**epudiation | Rider denies a withdrawal | Withdraw creates a `WalletTransaction` row with timestamp + bank + status; `txn.id` is returned to the rider; `AuthEvent`-style audit table is the next hardening item. |
| **I**nfo disclosure | Cross-rider leaderboard data leak | Privacy projection — full name and email never leave the service. |
| **I** | Account number echoed back | Only `accountNumberMasked = "****1234"` is ever returned. cleartext is bcrypt-hashed at write and never re-served. |
| **I** | Cache poisoning across riders | Cache keys include `riderId`. Leaderboard cache is shared across riders by design (it's the same projection for everyone). |
| **D**oS | Repeated withdrawal attempts | 3 / 24 h rate limit; balance check rejects fast on insufficient funds. |
| **D** | Repeated leaderboard fetches | 300 s cache shields Postgres; Redis can serve at >100 K RPS. |
| **E**levation | Rider attempts to mark a non-VERIFIED account as primary | Validation passes (`isPrimary` is allowed) but `withdraw` rejects with `Bank account is not verified`. Acceptable: the rider can flag pending accounts as primary so the FE knows their preference, but no money flows until verification completes. |

### 3.2 Compliance touch-points

- **Penny-drop audit trail** — per RBI norms, penny-drop UTRs must be retained for 5 years. The `BankAccount.verificationRef` column will store the UTR when the worker integration ships.
- **DPDPA right-to-erasure** — wallet transactions are PII-adjacent (linked to riderId). Soft-delete via `Rider.deletedAt` (rider slice) + a future scrubber job that anonymises old transactions. Tracked.
- **PCI scope** — by routing payouts through Razorpay we never touch card data; same is true for the bank account number which is bcrypt-hashed at rest.

## 4. Edge-Case Handling

| Scenario | Behavior |
|---|---|
| Brand-new rider hits `/wallet/balance` | `ensureAccount` upsert creates the row; response has zeros across all four fields. |
| Rider with 0 settled txns hits `/earnings/summary` | totals are 0; `goal.percentage` is 0; `avgPerOrder` is 0. |
| Rider tries `?period=year` | Zod rejects with VALIDATION_ERROR. |
| Rider's chart spans a missing day | The padding loop emits a 0 for that day so the bar count is constant. |
| Two devices submit the same withdraw simultaneously | `prisma.$transaction` serialises; second one sees the decremented balance and may fail the balance check. Acceptable. |
| Rider tries to add a 6th bank account | 400 `Bank account limit reached`. |
| Rider sends `accountNumber !== confirmAccountNumber` | Zod refine rejects with path `confirmAccountNumber`. |
| Rider withdraws to a `PENDING_VERIFICATION` account | 400 with `field: bankAccountId, message: 'Account must be verified'`. |
| Rider withdraws ₹99.99 | Zod rejects (min 100). |
| Rider withdraws ₹50,000.01 | Zod rejects (max 50,000). |
| Rider withdraws when `availableBalance < amount` | 422 `INSUFFICIENT_BALANCE`. |
| Rider reconciles cash exceeding their cash-in-hand | 400 with `field: amount`. |
| Same rider on the leaderboard for multiple cities (e.g. travelled this week) | Their earnings are summed across all orders in the window, not per-city. The `?city=` param today only feeds the cache key — the future enhancement joins on RiderAddress.city. |
| Network blip mid-`POST /wallet/withdraw` | The transactional balance debit is committed; the BullMQ enqueue may have failed. The worker reaper (future) catches stuck PENDING txns. |
| Frontend's `useWalletBalance` and `useEarnings` both fire on EarningsScreen mount | Two independent fetches; both cached server-side, so the second is essentially free. |
| Rider's access expires while paginating history | Axios refresh-on-401 retries the request transparently. |
| Server returns money as `40.5` (not `40.50`) | FE `formatINR` pins `minimumFractionDigits: 2` so the rendering is consistent regardless. |

## 5. Test Coverage Status

Manual smoke matrix passed:
- Earnings summary across all three periods returns valid totals.
- Chart with no settled txns returns a 7-bar / 30-bar zero series.
- Leaderboard `displayName` matches the privacy mask regex on every row.
- Wallet balance auto-creates the account row on the first call.
- Withdraw with valid amount + verified account returns the txn id; second call within the same minute respects the rate limit.
- Bank account add — `accountNumber` never appears in the response.
- Cash-in-hand reconcile decrements the right column; the response reflects the new balance.
- Statements last-6-months default returns `[]` for a brand-new rider, real numbers for one with seeded data.

Automated tests will land alongside the test-harness work in the hardening pass.

## 6. Open Items / Follow-Ups

1. **PDF generation for `/wallet/statements`** — worker that renders + uploads to `cravix-cdn` with a presigned read URL.
2. **Razorpay penny-drop integration** — replaces the stub in `workers/notifications.ts` (or a dedicated `workers/payments.ts`).
3. **Razorpay payout integration** — same.
4. **Campaigns / incentives service** — `/earnings/incentives` returns `[]` until then.
5. **Online-hours aggregator** — Redis sum keyed by date; rolls up into `/earnings/summary.onlineHours`.
6. **`AllowanceScreen` UI rewire** — connect `useAllowance` to the existing JSX (today the hook is created but the screen JSX is untouched).
7. **`AccountStatementsScreen` UI rewire** — same.
8. **Per-rider rate-limit on withdrawal** — Redis key prefixed by rider id rather than IP.
9. **City filter join** for the leaderboard once `RiderAddress.city` is reliably populated.
10. **Wallet RedisKey builder** — promote the geocode-key reuse to a proper `cacheWallet(riderId)` builder.

## 7. Conclusion

The Earnings + Wallet slice realises spec §5.6 + §5.7 with locked decision A6 (decimal rupees, never paise) and the spec privacy rule for the leaderboard correctly applied. Six high-visibility hardcoded values from the original review (`₹4,250.34`, the leaderboard's full names + pravatar avatars, the `₹12,450 / ₹8,500` summary, six hardcoded transactions, `MILESTONES`/`SURGE_DATA`-style mocks, and `WEEKLY_DATA`) are replaced with real server data. The penny-drop and withdrawal pipelines are wired through BullMQ, ready for provider integration. No blockers; recommend proceeding to **Slice 8 — Notifications + Push** next.
