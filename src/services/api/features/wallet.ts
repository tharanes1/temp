/**
 * Wallet service — wraps /api/v1/wallet/*.
 * Locked A6 — money is `number` rupees (no paise integers).
 */
import apiClient from '../client';

export const WALLET_ENDPOINTS = {
  BALANCE: '/api/v1/wallet/balance',
  HISTORY: '/api/v1/wallet/history',
  CASH_IN_HAND: '/api/v1/wallet/cash-in-hand',
  CASH_RECONCILE: '/api/v1/wallet/cash-in-hand/reconcile',
  BANK_ACCOUNTS: '/api/v1/wallet/bank-accounts',
  WITHDRAW: '/api/v1/wallet/withdraw',
  ALLOWANCE: '/api/v1/wallet/allowance',
  STATEMENTS: '/api/v1/wallet/statements',
} as const;

export interface WalletBalance {
  totalBalance: number;
  availableForWithdrawal: number;
  pendingSettlement: number;
  cashInHand: number;
  asOf: number;
}

export interface WalletTransaction {
  id: string;
  type: 'earning' | 'withdrawal' | 'bonus' | 'deduction' | 'refund';
  amount: number;
  balanceAfter: number;
  description: string;
  timestamp: string;
  status: 'pending' | 'settled' | 'failed';
  referenceId: string | null;
}

export interface CashInHandPendingOrder {
  orderId: string;
  amount: number;
  collectedAt: string;
}

export interface CashInHand {
  cashInHand: number;
  pendingCodOrders: CashInHandPendingOrder[];
  lastReconciled: string | null;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountHolderName: string;
  accountNumberMasked: string;
  ifscCode: string;
  isPrimary: boolean;
  status: 'pending_verification' | 'verified' | 'rejected';
  verifiedAt: string | null;
}

export interface AddBankAccountBody {
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  bankName: string;
  isPrimary?: boolean;
}

export interface Allowance {
  eligibleAmount: number;
  usedAmount: number;
  nextResetDate: string;
  fuelAllowance: { perKm: number; monthlyEarned: number };
}

export interface Statement {
  month: string;
  period: string;
  amount: number;
  status: 'available' | 'processing';
  type: 'earnings_summary';
  downloadUrl: string | null;
}

export interface WithdrawalResponse {
  transactionId: string;
  amount: number;
  status: 'pending';
  expectedSettlementBy: string;
}

interface Envelope<T> {
  success: true;
  data: T;
}
interface Paged<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const walletService = {
  async getBalance(): Promise<WalletBalance> {
    const { data } = await apiClient.get<Envelope<WalletBalance>>(WALLET_ENDPOINTS.BALANCE);
    return data.data;
  },
  async getHistory(args: { page?: number; limit?: number; type?: WalletTransaction['type'] | 'all' } = {}): Promise<Paged<WalletTransaction>> {
    const { data } = await apiClient.get<Paged<WalletTransaction>>(WALLET_ENDPOINTS.HISTORY, {
      params: { page: args.page ?? 1, limit: args.limit ?? 20, type: args.type ?? 'all' },
    });
    return data;
  },
  async getCashInHand(): Promise<CashInHand> {
    const { data } = await apiClient.get<Envelope<CashInHand>>(WALLET_ENDPOINTS.CASH_IN_HAND);
    return data.data;
  },
  async reconcileCashInHand(args: { amount: number; method: 'hub_deposit' | 'upi_transfer' | 'admin_adjustment'; reference?: string }): Promise<CashInHand> {
    const { data } = await apiClient.post<Envelope<CashInHand>>(WALLET_ENDPOINTS.CASH_RECONCILE, args);
    return data.data;
  },
  async getBankAccounts(): Promise<BankAccount[]> {
    const { data } = await apiClient.get<Envelope<BankAccount[]>>(WALLET_ENDPOINTS.BANK_ACCOUNTS);
    return data.data;
  },
  async addBankAccount(body: AddBankAccountBody): Promise<BankAccount> {
    const { data } = await apiClient.post<Envelope<BankAccount>>(WALLET_ENDPOINTS.BANK_ACCOUNTS, body);
    return data.data;
  },
  async withdraw(args: { amount: number; bankAccountId: string }): Promise<WithdrawalResponse> {
    const { data } = await apiClient.post<Envelope<WithdrawalResponse>>(WALLET_ENDPOINTS.WITHDRAW, args);
    return data.data;
  },
  async getAllowance(): Promise<Allowance> {
    const { data } = await apiClient.get<Envelope<Allowance>>(WALLET_ENDPOINTS.ALLOWANCE);
    return data.data;
  },
  async getStatements(month?: string): Promise<Statement[]> {
    const { data } = await apiClient.get<Envelope<Statement[]>>(WALLET_ENDPOINTS.STATEMENTS, {
      params: month ? { month } : {},
    });
    return data.data;
  },
};
