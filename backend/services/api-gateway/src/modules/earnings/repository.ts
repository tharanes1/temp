/**
 * Persistence for the Earnings module.  Pure Prisma; aggregates over
 * EarningsTransaction filtered by createdAt window.
 */
import { Prisma, type EarningsType, type TransactionStatus } from '@prisma/client';

import { prisma } from '../../config/database.js';

export interface PeriodWindow {
  start: Date;
  end: Date;
}

export const earningsRepository = {
  async aggregate(args: { riderId: string; window: PeriodWindow }): Promise<{
    total: number;
    orderCount: number;
    distanceKm: number;
  }> {
    const [{ _sum, _count }, distanceRow] = await Promise.all([
      prisma.earningsTransaction.aggregate({
        where: {
          riderId: args.riderId,
          createdAt: { gte: args.window.start, lt: args.window.end },
          status: 'SETTLED',
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      // Distance lives on Order, not EarningsTransaction.
      prisma.order.aggregate({
        where: {
          riderId: args.riderId,
          status: 'DELIVERED',
          deliveredAt: { gte: args.window.start, lt: args.window.end },
        },
        _sum: { distanceKm: true },
      }),
    ]);
    return {
      total: _sum.amount ? Number(_sum.amount) : 0,
      orderCount: _count._all,
      distanceKm: distanceRow._sum.distanceKm ? Number(distanceRow._sum.distanceKm) : 0,
    };
  },

  async listTransactions(args: {
    riderId: string;
    page: number;
    limit: number;
    type:
      | 'delivery_earning'
      | 'long_distance_bonus'
      | 'incentive_bonus'
      | 'deduction'
      | 'adjustment'
      | 'all';
  }): Promise<{
    items: { id: string; type: EarningsType; orderId: string | null; amount: Prisma.Decimal; description: string; status: TransactionStatus; createdAt: Date }[];
    total: number;
  }> {
    const where: Prisma.EarningsTransactionWhereInput = { riderId: args.riderId };
    if (args.type !== 'all') {
      where.type = args.type.toUpperCase() as EarningsType;
    }
    const [items, total] = await Promise.all([
      prisma.earningsTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (args.page - 1) * args.limit,
        take: args.limit,
        select: {
          id: true,
          type: true,
          orderId: true,
          amount: true,
          description: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.earningsTransaction.count({ where }),
    ]);
    return { items, total };
  },

  /**
   * Group settled earnings by day in the window — used for the chart.
   * Implemented via Prisma raw because we need date_trunc + sum.
   */
  async groupByDay(args: { riderId: string; window: PeriodWindow }): Promise<{ day: Date; total: number }[]> {
    const rows = await prisma.$queryRaw<{ day: Date; total: Prisma.Decimal }[]>(
      Prisma.sql`
        SELECT date_trunc('day', "createdAt") AS day, SUM(amount) AS total
        FROM "EarningsTransaction"
        WHERE "riderId" = ${args.riderId}::uuid
          AND status = 'SETTLED'
          AND "createdAt" >= ${args.window.start}
          AND "createdAt" < ${args.window.end}
        GROUP BY 1
        ORDER BY 1
      `,
    );
    return rows.map((r) => ({ day: r.day, total: Number(r.total) }));
  },

  async groupByHour(args: { riderId: string; window: PeriodWindow }): Promise<{ hour: Date; total: number }[]> {
    const rows = await prisma.$queryRaw<{ hour: Date; total: Prisma.Decimal }[]>(
      Prisma.sql`
        SELECT date_trunc('hour', "createdAt") AS hour, SUM(amount) AS total
        FROM "EarningsTransaction"
        WHERE "riderId" = ${args.riderId}::uuid
          AND status = 'SETTLED'
          AND "createdAt" >= ${args.window.start}
          AND "createdAt" < ${args.window.end}
        GROUP BY 1
        ORDER BY 1
      `,
    );
    return rows.map((r) => ({ hour: r.hour, total: Number(r.total) }));
  },

  /**
   * Top riders by settled earnings inside the window.  City filter is left
   * as a future addition — RiderAddress.city would be the join column.
   */
  async leaderboard(args: { window: PeriodWindow; limit: number; riderId: string }): Promise<{
    rows: { riderId: string; total: Prisma.Decimal; orders: bigint; name: string | null; profileImage: string | null }[];
    myEarnings: number;
    myRank: number | null;
  }> {
    const rows = await prisma.$queryRaw<
      { riderId: string; total: Prisma.Decimal; orders: bigint; name: string | null; profileImage: string | null }[]
    >(Prisma.sql`
      SELECT et."riderId", SUM(et.amount) AS total, COUNT(*)::bigint AS orders,
             r.name, r."profileImage"
      FROM "EarningsTransaction" et
      JOIN "Rider" r ON r.id = et."riderId"
      WHERE et.status = 'SETTLED'
        AND et."createdAt" >= ${args.window.start}
        AND et."createdAt" < ${args.window.end}
      GROUP BY et."riderId", r.name, r."profileImage"
      ORDER BY total DESC
      LIMIT ${args.limit}
    `);

    // Lookup the requesting rider's own total + rank, even if they're outside the top N.
    const myRow = await prisma.$queryRaw<{ total: Prisma.Decimal; rank: bigint }[]>(Prisma.sql`
      WITH ranked AS (
        SELECT "riderId", SUM(amount) AS total,
               RANK() OVER (ORDER BY SUM(amount) DESC) AS rank
        FROM "EarningsTransaction"
        WHERE status = 'SETTLED'
          AND "createdAt" >= ${args.window.start}
          AND "createdAt" < ${args.window.end}
        GROUP BY "riderId"
      )
      SELECT total, rank FROM ranked WHERE "riderId" = ${args.riderId}::uuid
    `);

    const my = myRow[0];
    return {
      rows,
      myEarnings: my ? Number(my.total) : 0,
      myRank: my ? Number(my.rank) : null,
    };
  },
};
