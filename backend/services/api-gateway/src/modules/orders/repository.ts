/**
 * Persistence layer for Orders.  Pure Prisma; no business logic.
 */
import { Prisma, type Order, type OrderItem, type OrderStatus } from '@prisma/client';

import { prisma } from '../../config/database.js';

export const orderRepository = {
  async findById(id: string): Promise<(Order & { items: OrderItem[] }) | null> {
    return prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
  },

  async findActiveForRider(riderId: string): Promise<(Order & { items: OrderItem[] }) | null> {
    return prisma.order.findFirst({
      where: {
        riderId,
        status: { in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'EN_ROUTE', 'ARRIVED'] },
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async listHistory(args: {
    riderId: string;
    page: number;
    limit: number;
    status: 'delivered' | 'failed' | 'cancelled' | 'all';
  }): Promise<{ items: (Order & { items: OrderItem[] })[]; total: number }> {
    const where: Prisma.OrderWhereInput = { riderId: args.riderId };
    if (args.status === 'all') {
      where.status = { in: ['DELIVERED', 'FAILED', 'CANCELLED'] };
    } else {
      where.status = args.status.toUpperCase() as OrderStatus;
    }
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (args.page - 1) * args.limit,
        take: args.limit,
      }),
      prisma.order.count({ where }),
    ]);
    return { items, total };
  },

  async createOffered(args: {
    id: string;
    hubName: string;
    hubAddress: string;
    hubLatitude: number;
    hubLongitude: number;
    deliveryAddress: string;
    destLatitude: number;
    destLongitude: number;
    distanceKm: number;
    estimatedTimeMin: number;
    baseEarnings: number;
    bonus: number;
    specialInstructions?: string;
    merchantRating?: number;
    items: { name: string; qty: number; icon: string }[];
  }): Promise<Order> {
    const itemRows = args.items.map((i) => ({ name: i.name, qty: i.qty, icon: i.icon }));
    return prisma.order.create({
      data: {
        id: args.id,
        status: 'PENDING',
        hubName: args.hubName,
        hubAddress: args.hubAddress,
        hubLatitude: new Prisma.Decimal(args.hubLatitude),
        hubLongitude: new Prisma.Decimal(args.hubLongitude),
        deliveryAddress: args.deliveryAddress,
        destLatitude: new Prisma.Decimal(args.destLatitude),
        destLongitude: new Prisma.Decimal(args.destLongitude),
        distanceKm: new Prisma.Decimal(args.distanceKm),
        estimatedTimeMin: args.estimatedTimeMin,
        baseEarnings: new Prisma.Decimal(args.baseEarnings),
        bonus: new Prisma.Decimal(args.bonus),
        specialInstructions: args.specialInstructions ?? null,
        merchantRating: args.merchantRating !== undefined ? new Prisma.Decimal(args.merchantRating) : null,
        items: { createMany: { data: itemRows } },
      },
    });
  },

  async assignToRider(id: string, riderId: string): Promise<Order> {
    return prisma.order.update({
      where: { id },
      data: {
        riderId,
        status: 'ASSIGNED',
        assignedAt: new Date(),
      },
    });
  },

  async accept(id: string, riderId: string): Promise<Order> {
    // The atomic Redis claim has already won — this is the consequent DB write.
    return prisma.order.update({
      where: { id },
      data: {
        riderId,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });
  },

  async transition(args: {
    id: string;
    riderId: string;
    next: 'PICKED_UP' | 'EN_ROUTE' | 'ARRIVED' | 'DELIVERED' | 'FAILED';
    failureReason?: string;
    proofImageUrl?: string;
  }): Promise<Order> {
    const data: Prisma.OrderUpdateInput = { status: args.next };
    const now = new Date();
    if (args.next === 'PICKED_UP') data.pickedUpAt = now;
    if (args.next === 'DELIVERED') data.deliveredAt = now;
    if (args.failureReason !== undefined) data.failureReason = args.failureReason;
    if (args.proofImageUrl !== undefined) data.proofImageUrl = args.proofImageUrl;
    return prisma.order.update({
      where: { id: args.id, riderId: args.riderId },
      data,
    });
  },

  async setProof(id: string, riderId: string, proofImageUrl: string): Promise<Order> {
    return prisma.order.update({
      where: { id, riderId },
      data: { proofImageUrl },
    });
  },

  async setRejectionReason(id: string, reason: string): Promise<Order> {
    return prisma.order.update({
      where: { id },
      data: { rejectionReason: reason },
    });
  },
};
