import { useState } from 'react';
import { toast } from 'sonner';
import { getChallenge, savingsAdd, savingsRemove } from '../lib/api';
import { useNostr } from '../hooks/useNostr';

export function SavingsForm({
  pubkey,
  balanceMsats,
  savingsMsats,
  onSuccess,
}: {
  pubkey: string;
  balanceMsats: number;
  savingsMsats: number;
  onSuccess?: () => void;
}) {
  const { signEvent } = useNostr();
  const [amountSats, setAmountSats] = useState('');
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const sats = parseInt(amountSats, 10);
    if (!Number.isFinite(sats) || sats <= 0) {
      setError('Enter a valid amount');
      return;
    }
    const amountMsats = sats * 1000;
    if (mode === 'add' && amountMsats > balanceMsats) {
      setError('Insufficient spendable balance');
      return;
    }
    if (mode === 'remove' && amountMsats > savingsMsats) {
      setError('Insufficient savings balance');
      return;
    }

    setLoading(true);
    try {
      const { challenge } = await getChallenge(pubkey);
      const signedChallenge = await signEvent(1, challenge, []);
      if (mode === 'add') {
        await savingsAdd(pubkey, amountMsats, signedChallenge);
        toast.success('Added to savings');
      } else {
        await savingsRemove(pubkey, amountMsats, signedChallenge);
        toast.success('Withdrawn from savings');
      }
      setAmountSats('');
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-900/50 p-4">
      <h3 className="text-lg font-medium">Savings</h3>
      <p className="text-sm text-gray-400">
        Move sats between spendable and savings. Savings can earn APY when configured.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setMode('add')}
          className={`flex-1 py-2 rounded ${mode === 'add' ? 'bg-amber-600' : 'bg-gray-700'}`}
        >
          Add to savings
        </button>
        <button
          onClick={() => setMode('remove')}
          className={`flex-1 py-2 rounded ${mode === 'remove' ? 'bg-amber-600' : 'bg-gray-700'}`}
        >
          Remove
        </button>
      </div>
      <label htmlFor="savings-amount" className="sr-only">
        {mode === 'add' ? 'Amount to add to savings' : 'Amount to remove from savings'}
      </label>
      <input
        id="savings-amount"
        type="number"
        placeholder={mode === 'add' ? `Up to ${(balanceMsats / 1000).toFixed(0)} sats` : `Up to ${(savingsMsats / 1000).toFixed(0)} sats`}
        value={amountSats}
        onChange={(e) => setAmountSats(e.target.value)}
        min={1}
        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white font-mono"
      />
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-2 rounded bg-amber-600 hover:bg-amber-500 disabled:bg-gray-600"
      >
        {loading ? 'Processing...' : mode === 'add' ? 'Add to savings' : 'Remove from savings'}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
