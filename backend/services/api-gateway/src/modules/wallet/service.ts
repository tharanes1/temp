/**
 * Wallet service.
 *
 * Locked A6: every money field is decimal rupees (number).
 * Spec §13 #3 said "integer paise"; the locked decision overrides — but the
 * underlying Prisma columns are `Decimal(12,2)` so we still avoid floating-
 * point rounding bugs at the storage layer.
 */
import { ConflictError, NotFoundError, ValidationError } from '@cravix/shared-errors';
import { logger } from '@cravix/shared-logger';
import { queues } from '@cravix/shared-queue';
import { cacheAside, redis, RedisKeys } from '@cravix/shared-redis';
import bcrypt from 'bcryptjs';

import { walletRepository } from './repository.js';
import type {
  AddBankAccountInput,
  HistoryQuery,
  ReconcileInput,
  StatementsQuery,
  WithdrawalInput,
} from './schemas.js';
import type {
  AllowanceDto,
  BankAccountDto,
  CashInHandDto,
  StatementDto,
  WalletBalanceDto,
  WalletTransactionDto,
  WithdrawalResponseDto,
} from './types.js';

const BALANCE_CACHE_TTL = 30; // seconds — spec §5.7

// ─── Mappings ────────────────────────────────────────────────────

const TxnTypeToWire: Record<string, WalletTransactionDto['type']> = {
  EARNING: 'earning',
  WITHDRAWAL: 'withdrawal',
  BONUS: 'bonus',
  DEDUCTION: 'deduction',
  REFUND: 'refund',
};
const StatusToWire = (s: string) => s.toLowerCase() as WalletTransactionDto['status'];

const BankStatusToWire: Record<string, BankAccountDto['status']> = {
  PENDING_VERIFICATION: 'pending_verification',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
};

// ─── Public API ─────────────────────────────────────────────────

export const walletService = {
  async getBalance(riderId: string): Promise<WalletBalanceDto> {
    return cacheAside(RedisKeys.cacheGeocode('wallet', riderId), BALANCE_CACHE_TTL, async () => {
      const acc = await walletRepository.ensureAccount(riderId);
      return {
        totalBalance: Number(acc.totalBalance),
        availableForWithdrawal: Number(acc.availableBalance),
        pendingSettlement: Number(acc.pendingSettlement),
        cashInHand: Number(acc.cashInHand),
        asOf: Date.now(),
      };
    });
  },

  async listHistory(
    riderId: string,
    query: HistoryQuery,
  ): Promise<{ items: WalletTransactionDto[]; total: number; page: number; limit: number }> {
    const { items, total } = await walletRepository.listTransactions({
      riderId,
      page: query.page,
      limit: query.limit,
      type: query.type,
    });
    return {
      items: items.map((r) => ({
        id: r.id,
        type: TxnTypeToWire[r.type] ?? 'earning',
        amount: Number(r.amount),
        balanceAfter: Number(r.balanceAfter),
        description: r.description,
        timestamp: r.createdAt.toISOString(),
        status: StatusToWire(r.status),
        referenceId: r.referenceId,
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  },

  async getCashInHand(riderId: string): Promise<CashInHandDto> {
    const acc = await walletRepository.ensureAccount(riderId);
    const pending = await walletRepository.pendingCodOrders(riderId);
    return {
      cashInHand: Number(acc.cashInHand),
      pendingCodOrders: pending.map((p) => ({
        orderId: p.orderId,
        amount: Number(p.amount.toFixed(2)),
        collectedAt: p.collectedAt.toISOString(),
      })),
      lastReconciled: acc.updatedAt.toISOString(),
    };
  },

  async reconcileCashInHand(riderId: string, input: ReconcileInput): Promise<CashInHandDto> {
    const acc = await walletRepository.ensureAccount(riderId);
    if (Number(acc.cashInHand) < input.amount - 0.001) {
      throw new ValidationError('Reconcile amount exceeds cash-in-hand', [
        { field: 'amount', message: 'Cannot reconcile more than current cash-in-hand' },
      ]);
    }
    await walletRepository.incrementCashInHand(riderId, -input.amount);
    // Invalidate cached balance.
    await redis.del(RedisKeys.cacheGeocode('wallet', riderId));
    logger.info('cash-in-hand reconciled', {
      riderId,
      method: input.method,
      amount: input.amount,
      reference: input.reference ?? null,
    });
    return this.getCashInHand(riderId);
  },

  async listBankAccounts(riderId: string): Promise<BankAccountDto[]> {
    const rows = await walletRepository.listBankAccounts(riderId);
    return rows.map((r) => ({
      id: r.id,
      bankName: r.bankName,
      accountHolderName: r.accountHolderName,
      accountNumberMasked: `****${r.accountNumberLast4}`,
      ifscCode: r.ifscCode,
      isPrimary: r.isPrimary,
      status: BankStatusToWire[r.status] ?? 'pending_verification',
      verifiedAt: r.verifiedAt?.toISOString() ?? null,
    }));
  },

  /**
   * Add a bank account — stores `bcrypt(accountNumber)` (never the cleartext)
   * and the last-4 for display.  Enqueues a `payments:penny-drop` job; the
   * worker (slice 4 stub) flips the row to VERIFIED on success.
   */
  async addBankAccount(riderId: string, input: AddBankAccountInput): Promise<BankAccountDto> {
    const last4 = input.accountNumber.slice(-4);
    const hash = await bcrypt.hash(input.accountNumber, 10);
    const existing = await walletRepository.listBankAccounts(riderId);
    if (existing.length >= 5) {
      throw new ValidationError('Bank account limit reached (5)');
    }
    const isPrimary = input.isPrimary || existing.length === 0;
    const created = await walletRepository.createBankAccount({
      riderId,
      bankName: input.bankName,
      accountHolderName: input.accountHolderName,
      accountNumberHash: hash,
      accountNumberLast4: last4,
      ifscCode: input.ifscCode,
      isPrimary,
    });
    await queues.payments.add('penny-drop', {
      kind: 'penny-drop',
      riderId,
      bankAccountId: created.id,
    });
    return {
      id: created.id,
      bankName: created.bankName,
      accountHolderName: created.accountHolderName,
      accountNumberMasked: `****${created.accountNumberLast4}`,
      ifscCode: created.ifscCode,
      isPrimary: created.isPrimary,
      status: BankStatusToWire[created.status] ?? 'pending_verification',
      verifiedAt: created.verifiedAt?.toISOString() ?? null,
    };
  },

  async withdraw(riderId: string, input: WithdrawalInput): Promise<WithdrawalResponseDto> {
    const acc = await walletRepository.ensureAccount(riderId);
    const available = Number(acc.availableBalance);
    if (available < input.amount) {
      throw new ConflictError('Insufficient available balance', 'INSUFFICIENT_BALANCE');
    }
    const bank = await walletRepository.findBankAccount(riderId, input.bankAccountId);
    if (!bank) throw new NotFoundError('Bank account not found');
    if (bank.status !== 'VERIFIED') {
      throw new ValidationError('Bank account is not verified', [
        { field: 'bankAccountId', message: 'Account must be verified before withdrawals' },
      ]);
    }

    const balanceAfter = available - input.amount;
    const txn = await walletRepository.createWithdrawalTransaction({
      riderId,
      amount: input.amount,
      bankAccountId: input.bankAccountId,
      balanceAfter,
    });
    await queues.payments.add('withdrawal', {
      kind: 'withdrawal',
      riderId,
      bankAccountId: input.bankAccountId,
      amount: input.amount,
      reference: txn.id,
    });
    await redis.del(RedisKeys.cacheGeocode('wallet', riderId));

    // Settlement window: same-day if before 10 AM IST, otherwise next business day.
    const expected = new Date();
    expected.setDate(expected.getDate() + 1);
    expected.setHours(10, 0, 0, 0);

    return {
      transactionId: txn.id,
      amount: input.amount,
      status: 'pending',
      expectedSettlementBy: expected.toISOString(),
    };
  },

  async getAllowance(riderId: string): Promise<AllowanceDto> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthlyEarned = await walletRepository.monthlyEarningsForFuelAllowance(
      riderId,
      monthStart,
      monthEnd,
    );
    return {
      eligibleAmount: 500,
      usedAmount: 0,
      nextResetDate: monthEnd.toISOString().slice(0, 10),
      fuelAllowance: { perKm: 2.0, monthlyEarned: Number(monthlyEarned.toFixed(2)) },
    };
  },

  async listStatements(riderId: string, query: StatementsQuery): Promise<StatementDto[]> {
    const now = new Date();
    const months: { year: number; month: number }[] = [];
    if (query.month) {
      const [y, m] = query.month.split('-').map((s) => Number.parseInt(s, 10));
      months.push({ year: y!, month: m! });
    } else {
      // Last 6 months including the current.
      for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
      }
    }
    const out: StatementDto[] = [];
    for (const m of months) {
      const agg = await walletRepository.monthlyAggregates({ riderId, year: m.year, month: m.month });
      const monthStr = `${m.year}-${String(m.month).padStart(2, '0')}`;
      const period = new Date(m.year, m.month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      out.push({
        month: monthStr,
        period,
        amount: Number(agg.totalEarnings.toFixed(2)),
        status: agg.totalOrders > 0 ? 'available' : 'processing',
        type: 'earnings_summary',
        downloadUrl: null, // PDF generation is a future polish item
      });
    }
    return out;
  },
};
