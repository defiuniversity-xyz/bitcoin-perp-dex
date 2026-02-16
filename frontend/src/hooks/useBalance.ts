import { useState, useEffect, useCallback } from 'react';
import { getBalance, getTransactions } from '../lib/api';

export function useBalance(pubkey: string | null) {
  const [balanceMsats, setBalanceMsats] = useState<number | null>(null);
  const [savingsMsats, setSavingsMsats] = useState<number | null>(null);
  const [savingsApy, setSavingsApy] = useState<number>(0);
  const [transactions, setTransactions] = useState<
    Array<{ type: string; amount_msats: number; counterparty_pubkey?: string; created_at: number }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!pubkey) {
      setBalanceMsats(null);
      setSavingsMsats(null);
      setTransactions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [balRes, txRes] = await Promise.all([
        getBalance(pubkey),
        getTransactions(pubkey),
      ]);
      setBalanceMsats(balRes.balance_msats);
      setSavingsMsats(balRes.savings_msats ?? 0);
      setSavingsApy(balRes.savings_apy ?? 0);
      setTransactions(txRes.transactions);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [pubkey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balanceMsats, savingsMsats, savingsApy, transactions, loading, error, refresh };
}
