import { useState } from 'react';
import { toast } from 'sonner';
import { nip19 } from 'nostr-tools';
import { transfer } from '../lib/api';
import { useNostr } from '../hooks/useNostr';

const BANK_TRANSFER_KIND = 33194;

export function TransferForm({
  pubkey,
  onSuccess,
}: {
  pubkey: string;
  onSuccess?: () => void;
}) {
  const [toInput, setToInput] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signEvent } = useNostr();

  const resolvePubkey = (input: string): string => {
    const trimmed = input.trim();
    if (trimmed.startsWith('npub')) {
      try {
        const decoded = nip19.decode(trimmed);
        if (decoded.type === 'npub') return decoded.data;
      } catch {
        throw new Error('Invalid npub');
      }
    }
    if (trimmed.length === 64 && /^[a-fA-F0-9]+$/.test(trimmed)) return trimmed;
    throw new Error('Enter npub or hex pubkey');
  };

  const handleTransfer = async () => {
    setError(null);
    const sats = parseInt(amount, 10);
    if (isNaN(sats) || sats < 1) {
      setError('Enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const toPubkey = resolvePubkey(toInput);
      if (toPubkey === pubkey) {
        setError('Cannot transfer to yourself');
        setLoading(false);
        return;
      }
      const amountMsats = sats * 1000;

      const content = JSON.stringify({ to_pubkey: toPubkey, amount_msats: amountMsats });
      const signedEvent = await signEvent(BANK_TRANSFER_KIND, content, []);

      await transfer(signedEvent);
      setToInput('');
      setAmount('');
      toast.success('Transfer sent!');
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-medium">Transfer</h3>
      <label htmlFor="transfer-recipient" className="sr-only">
        Recipient npub or hex pubkey
      </label>
      <input
        id="transfer-recipient"
        type="text"
        placeholder="Recipient (npub or hex)"
        value={toInput}
        onChange={(e) => setToInput(e.target.value)}
        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white font-mono text-sm"
      />
      <label htmlFor="transfer-amount" className="sr-only">
        Amount in sats
      </label>
      <input
        id="transfer-amount"
        type="number"
        placeholder="Amount (sats)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white"
      />
      <button
        onClick={handleTransfer}
        disabled={loading}
        className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600"
      >
        {loading ? 'Transferring...' : 'Send'}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
