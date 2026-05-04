/**
 * Zod schemas for /api/v1/support/*.
 */
import { z } from 'zod';

export const FaqQuerySchema = z
  .object({
    category: z.enum(['orders', 'payment', 'account', 'safety', 'all']).default('all'),
  })
  .strict();
export type FaqQuery = z.infer<typeof FaqQuerySchema>;

export const TicketCategoryEnum = z.enum(['order', 'payment', 'account', 'safety', 'other']);

export const CreateTicketSchema = z
  .object({
    category: TicketCategoryEnum,
    subject: z.string().trim().min(4).max(200),
    description: z.string().trim().min(10).max(2000),
    orderId: z.string().uuid().optional(),
  })
  .strict();
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
