/**
 * Zod schemas for /api/v1/wallet/*.
 *
 * Locked decisions reflected:
 *   A6 — money is decimal rupees (no paise integers).
 *   IFSC pinned to the standard 11-char format (4 alpha + 0 + 6 alphanumeric).
 */
import { z } from 'zod';

// ─── History query ──────────────────────────────────────────────

export const HistoryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    type: z.enum(['earning', 'withdrawal', 'bonus', 'deduction', 'refund', 'all']).default('all'),
  })
  .strict();
export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;

// ─── Bank accounts ──────────────────────────────────────────────

export const AddBankAccountSchema = z
  .object({
    accountHolderName: z.string().trim().min(2).max(80),
    accountNumber: z.string().regex(/^\d{9,18}$/, 'Invalid account number'),
    confirmAccountNumber: z.string().regex(/^\d{9,18}$/, 'Invalid account number'),
    ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code').transform((v) => v.toUpperCase()),
    bankName: z.string().trim().min(2).max(80),
    isPrimary: z.boolean().default(false),
  })
  .strict()
  .refine((v) => v.accountNumber === v.confirmAccountNumber, {
    message: 'accountNumber must match confirmAccountNumber',
    path: ['confirmAccountNumber'],
  });
export type AddBankAccountInput = z.infer<typeof AddBankAccountSchema>;

export const BankAccountIdParamSchema = z
  .object({ bankAccountId: z.string().min(1).max(64) })
  .strict();

// ─── Withdraw ───────────────────────────────────────────────────

/**
 * Spec withdraw bounds: ₹100 minimum, ₹50,000 maximum.  Both expressed in
 * decimal rupees per locked A6.
 */
export const WithdrawalSchema = z
  .object({
    amount: z.number().min(100).max(50_000).multipleOf(0.01),
    bankAccountId: z.string().min(1).max(64),
  })
  .strict();
export type WithdrawalInput = z.infer<typeof WithdrawalSchema>;

// ─── Statements (gap fill, §6.6 of the alignment review) ───────

export const StatementsQuerySchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM').optional(),
  })
  .strict();
export type StatementsQuery = z.infer<typeof StatementsQuerySchema>;

// ─── Cash-in-hand reconciliation (gap fill) ─────────────────────

export const ReconcileSchema = z
  .object({
    amount: z.number().positive().multipleOf(0.01),
    method: z.enum(['hub_deposit', 'upi_transfer', 'admin_adjustment']),
    reference: z.string().trim().max(100).optional(),
  })
  .strict();
export type ReconcileInput = z.infer<typeof ReconcileSchema>;
