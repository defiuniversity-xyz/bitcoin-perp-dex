import { useState } from 'react';
import { toast } from 'sonner';
import { getChallenge, withdraw } from '../lib/api';
import {
  isLightningAddress,
  resolveLightningAddressToInvoice,
} from '../lib/lnurl';
import { useNostr } from '../hooks/useNostr';

export function WithdrawForm({
  pubkey,
  onSuccess,
}: {
  pubkey: string;
  onSuccess?: () => void;
}) {
  const { signEvent } = useNostr();
  const [input, setInput] = useState('');
  const [amountSats, setAmountSats] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLA = isLightningAddress(input);
  const placeholder = isLA
    ? 'e.g. satoshi@bitcoin.org'
    : 'Lightning invoice (lnbc...) or Lightning Address (user@domain)';

  const handleWithdraw = async () => {
    setError(null);
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Enter a Lightning invoice or Lightning Address');
      return;
    }

    if (isLightningAddress(trimmed)) {
      const sats = parseInt(amountSats, 10);
      if (!Number.isFinite(sats) || sats <= 0) {
        setError('Enter amount in sats for Lightning Address');
        return;
      }
    }

    setLoading(true);
    try {
      let invoice: string;
      let amountMsats: number | undefined;
      if (isLightningAddress(trimmed)) {
        const sats = parseInt(amountSats, 10);
        amountMsats = sats * 1000;
        invoice = await resolveLightningAddressToInvoice(trimmed, amountMsats);
      } else {
        invoice = trimmed;
      }

      const { challenge } = await getChallenge(pubkey);
      const signedChallenge = await signEvent(1, challenge, []);
      await withdraw(pubkey, invoice, signedChallenge, amountMsats);
      setInput('');
      setAmountSats('');
      toast.success('Withdrawal successful!');
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Withdraw failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-medium">Withdraw</h3>
      <label htmlFor="withdraw-input" className="sr-only">
        Lightning invoice or Lightning Address
      </label>
      <textarea
        id="withdraw-input"
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={2}
        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white font-mono text-sm"
      />
      {isLA && (
        <>
          <label htmlFor="withdraw-amount" className="sr-only">
            Amount in sats
          </label>
          <input
            id="withdraw-amount"
            type="number"
            placeholder="Amount (sats)"
            value={amountSats}
            onChange={(e) => setAmountSats(e.target.value)}
            min={1}
            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white font-mono text-sm"
            aria-label="Amount in sats for Lightning Address"
          />
        </>
      )}
      <button
        onClick={handleWithdraw}
        disabled={loading}
        className="w-full py-2 rounded bg-amber-600 hover:bg-amber-500 disabled:bg-gray-600"
      >
        {loading ? 'Withdrawing...' : 'Withdraw'}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
