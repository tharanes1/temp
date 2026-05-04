/**
 * Wallet hooks — balance + bank-accounts + cash-in-hand + history + allowance + statements.
 *
 * Replaces every hardcoded ₹ value across the wallet screens.  The single
 * `useWalletBalance` hook is the source of truth for `EarningsHeader` (now
 * displays `availableForWithdrawal` instead of the literal `₹4,250.34`).
 */
import { useCallback, useEffect, useState } from 'react';

import {
  walletService,
  type Allowance,
  type BankAccount,
  type CashInHand,
  type Statement,
  type WalletBalance,
  type WalletTransaction,
} from '@/services/api/features/wallet';

// ─── Balance ────────────────────────────────────────────────────

export function useWalletBalance() {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const b = await walletService.getBalance();
      setBalance(b);
    } catch (e: unknown) {
      const msg = (e as { message?: string } | undefined)?.message ?? 'Failed to load wallet';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { balance, loading, error, refresh };
}

// ─── History ────────────────────────────────────────────────────

export function useWalletHistory(initial = { page: 1, limit: 20 }) {
  const [items, setItems] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await walletService.getHistory(initial);
      setItems(data);
    } catch (e: unknown) {
      const msg = (e as { message?: string } | undefined)?.message ?? 'Failed to load history';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [initial]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}

// ─── Cash in hand ───────────────────────────────────────────────

export function useCashInHand() {
  const [data, setData] = useState<CashInHand | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await walletService.getCashInHand();
      setData(r);
    } catch (e: unknown) {
      const msg = (e as { message?: string } | undefined)?.message ?? 'Failed to load cash-in-hand';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reconcile = useCallback(async (args: { amount: number; method: 'hub_deposit' | 'upi_transfer'; reference?: string }) => {
    const updated = await walletService.reconcileCashInHand(args);
    setData(updated);
    return updated;
  }, []);

  return { data, loading, error, refresh, reconcile };
}

// ─── Bank accounts ──────────────────────────────────────────────

export function useBankAccounts() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await walletService.getBankAccounts();
      setAccounts(list);
    } catch (e: unknown) {
      const msg = (e as { message?: string } | undefined)?.message ?? 'Failed to load bank accounts';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addAccount = useCallback(
    async (body: Parameters<typeof walletService.addBankAccount>[0]) => {
      const created = await walletService.addBankAccount(body);
      setAccounts((prev) => {
        // Push to top + ensure single primary on the FE side too.
        const next = prev.map((a) => (created.isPrimary ? { ...a, isPrimary: false } : a));
        return [created, ...next];
      });
      return created;
    },
    [],
  );

  return { accounts, loading, error, refresh, addAccount };
}

// ─── Allowance + statements ─────────────────────────────────────

export function useAllowance() {
  const [data, setData] = useState<Allowance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await walletService.getAllowance());
    } catch (e: unknown) {
      setError((e as { message?: string } | undefined)?.message ?? 'Failed to load allowance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useStatements() {
  const [items, setItems] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await walletService.getStatements());
    } catch (e: unknown) {
      setError((e as { message?: string } | undefined)?.message ?? 'Failed to load statements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
