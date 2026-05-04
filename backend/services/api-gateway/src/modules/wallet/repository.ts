/**
 * Persistence for /wallet.  WalletAccount is auto-created on first read so
 * a freshly-onboarded rider doesn't 404 on /wallet/balance.
 */
import { Prisma, type BankAccount, type BankAccountStatus, type WalletAccount, type WalletTransaction } from '@prisma/client';

import { prisma } from '../../config/database.js';
import { newId } from '../../shared/utils/uuid.js';

export const walletRepository = {
  async ensureAccount(riderId: string): Promise<WalletAccount> {
    return prisma.walletAccount.upsert({
      where: { riderId },
      create: { riderId },
      update: {},
    });
  },

  async incrementCashInHand(riderId: string, delta: number): Promise<WalletAccount> {
    return prisma.walletAccount.update({
      where: { riderId },
      data: {
        cashInHand: { increment: new Prisma.Decimal(delta) },
        totalBalance: { increment: new Prisma.Decimal(delta) },
      },
    });
  },

  async listTransactions(args: {
    riderId: string;
    page: number;
    limit: number;
    type: 'earning' | 'withdrawal' | 'bonus' | 'deduction' | 'refund' | 'all';
  }): Promise<{ items: WalletTransaction[]; total: number }> {
    const where: Prisma.WalletTransactionWhereInput = { riderId: args.riderId };
    if (args.type !== 'all') {
      where.type = args.type.toUpperCase() as Prisma.WalletTransactionWhereInput['type'];
    }
    const [items, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (args.page - 1) * args.limit,
        take: args.limit,
      }),
      prisma.walletTransaction.count({ where }),
    ]);
    return { items, total };
  },

  /**
   * Pending cash-in-hand orders — DELIVERED COD orders not yet reconciled.
   * The COD flag isn't a column today; for v1 we approximate with all
   * delivered orders without a corresponding earnings settlement.  When
   * customer-app ships, this becomes a `paymentMethod=cod` filter.
   */
  async pendingCodOrders(riderId: string): Promise<{ orderId: string; amount: number; collectedAt: Date }[]> {
    const rows = await prisma.$queryRaw<{ orderId: string; amount: Prisma.Decimal; collectedAt: Date }[]>(Prisma.sql`
      SELECT o.id AS "orderId",
             o."baseEarnings" + o.bonus AS amount,
             COALESCE(o."deliveredAt", o."acceptedAt") AS "collectedAt"
      FROM "Order" o
      WHERE o."riderId" = ${riderId}::uuid
        AND o.status = 'DELIVERED'
        AND NOT EXISTS (
          SELECT 1 FROM "EarningsTransaction" et
          WHERE et."orderId" = o.id AND et.status = 'SETTLED'
        )
      ORDER BY "collectedAt" DESC
      LIMIT 50
    `);
    return rows.map((r) => ({ orderId: r.orderId, amount: Number(r.amount), collectedAt: r.collectedAt }));
  },

  async listBankAccounts(riderId: string): Promise<BankAccount[]> {
    return prisma.bankAccount.findMany({
      where: { riderId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  },

  async findBankAccount(riderId: string, id: string): Promise<BankAccount | null> {
    return prisma.bankAccount.findFirst({ where: { riderId, id } });
  },

  async createBankAccount(args: {
    riderId: string;
    bankName: string;
    accountHolderName: string;
    accountNumberHash: string;
    accountNumberLast4: string;
    ifscCode: string;
    isPrimary: boolean;
  }): Promise<BankAccount> {
    return prisma.$transaction(async (tx) => {
      if (args.isPrimary) {
        // De-flag any existing primary so there's at most one.
        await tx.bankAccount.updateMany({
          where: { riderId: args.riderId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      return tx.bankAccount.create({
        data: {
          riderId: args.riderId,
          bankName: args.bankName,
          accountHolderName: args.accountHolderName,
          accountNumberHash: args.accountNumberHash,
          accountNumberLast4: args.accountNumberLast4,
          ifscCode: args.ifscCode,
          isPrimary: args.isPrimary,
          status: 'PENDING_VERIFICATION' as BankAccountStatus,
        },
      });
    });
  },

  async createWithdrawalTransaction(args: {
    riderId: string;
    amount: number;
    bankAccountId: string;
    balanceAfter: number;
  }): Promise<WalletTransaction> {
    return prisma.$transaction(async (tx) => {
      // Atomic balance deduction.
      await tx.walletAccount.update({
        where: { riderId: args.riderId },
        data: {
          availableBalance: { decrement: new Prisma.Decimal(args.amount) },
          totalBalance: { decrement: new Prisma.Decimal(args.amount) },
          pendingSettlement: { increment: new Prisma.Decimal(args.amount) },
        },
      });
      return tx.walletTransaction.create({
        data: {
          id: newId(),
          riderId: args.riderId,
          type: 'WITHDRAWAL',
          amount: new Prisma.Decimal(-args.amount),
          balanceAfter: new Prisma.Decimal(args.balanceAfter),
          description: `Bank withdrawal — ****${args.bankAccountId.slice(-4)}`,
          bankAccountId: args.bankAccountId,
          status: 'PENDING',
        },
      });
    });
  },

  async monthlyEarningsForFuelAllowance(riderId: string, monthStart: Date, monthEnd: Date): Promise<number> {
    const rows = await prisma.$queryRaw<{ total: Prisma.Decimal }[]>(Prisma.sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM "EarningsTransaction"
      WHERE "riderId" = ${riderId}::uuid
        AND status = 'SETTLED'
        AND "createdAt" >= ${monthStart}
        AND "createdAt" < ${monthEnd}
    `);
    return rows[0]?.total ? Number(rows[0].total) : 0;
  },

  async monthlyAggregates(args: { riderId: string; year: number; month: number }): Promise<{ totalEarnings: number; totalOrders: number }> {
    const start = new Date(args.year, args.month - 1, 1);
    const end = new Date(args.year, args.month, 1);
    const rows = await prisma.earningsTransaction.aggregate({
      where: {
        riderId: args.riderId,
        status: 'SETTLED',
        createdAt: { gte: start, lt: end },
      },
      _sum: { amount: true },
      _count: { _all: true },
    });
    return {
      totalEarnings: rows._sum.amount ? Number(rows._sum.amount) : 0,
      totalOrders: rows._count._all,
    };
  },
};
