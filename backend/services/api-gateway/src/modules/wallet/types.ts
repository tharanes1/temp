/**
 * Wire-format DTOs for /wallet.  All money fields are `number` rupees with up
 * to 2 decimals (locked A6).
 */

export interface WalletBalanceDto {
  totalBalance: number;
  availableForWithdrawal: number;
  pendingSettlement: number;
  cashInHand: number;
  /** UNIX ms — used for FE staleness checks. */
  asOf: number;
}

export interface WalletTransactionDto {
  id: string;
  type: 'earning' | 'withdrawal' | 'bonus' | 'deduction' | 'refund';
  amount: number; // signed (+ for earnings, - for withdrawals)
  balanceAfter: number;
  description: string;
  timestamp: string;
  status: 'pending' | 'settled' | 'failed';
  referenceId: string | null;
}

export interface CashInHandPendingOrderDto {
  orderId: string;
  amount: number;
  collectedAt: string;
}

export interface CashInHandDto {
  cashInHand: number;
  pendingCodOrders: CashInHandPendingOrderDto[];
  lastReconciled: string | null;
}

export interface BankAccountDto {
  id: string;
  bankName: string;
  accountHolderName: string;
  accountNumberMasked: string;
  ifscCode: string;
  isPrimary: boolean;
  status: 'pending_verification' | 'verified' | 'rejected';
  verifiedAt: string | null;
}

export interface AllowanceDto {
  eligibleAmount: number;
  usedAmount: number;
  nextResetDate: string;
  fuelAllowance: { perKm: number; monthlyEarned: number };
}

export interface StatementDto {
  month: string; // YYYY-MM
  period: string; // human readable
  amount: number;
  status: 'available' | 'processing';
  type: 'earnings_summary';
  downloadUrl: string | null;
}

export interface WithdrawalResponseDto {
  transactionId: string;
  amount: number;
  status: 'pending';
  expectedSettlementBy: string;
}
