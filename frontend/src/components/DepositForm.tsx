import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { fetchLnurlPayConfig, requestDepositInvoice, type LnurlPayConfig } from '../lib/lnurl';
import { useNostr } from '../hooks/useNostr';
import { useWallet } from '../hooks/useWallet';

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol'];

export function DepositForm({
  bankUsername = 'bank',
  onSuccess,
}: {
  bankUsername?: string;
  onSuccess?: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lnurlConfig, setLnurlConfig] = useState<LnurlPayConfig | null>(null);
  const { pubkey, signEvent } = useNostr();

  useEffect(() => {
    fetchLnurlPayConfig(bankUsername)
      .then(setLnurlConfig)
      .catch(() => setLnurlConfig(null));
  }, [bankUsername]);
  const { enable, payInvoice } = useWallet();

  const handleDeposit = async () => {
    setError(null);
    setStatus('Preparing...');

    if (!pubkey) {
      setError('Connect with Nostr first');
      return;
    }

    const sats = parseInt(amount, 10);
    if (isNaN(sats) || sats < 1) {
      setError('Enter a valid amount in sats');
      return;
    }

    const amountMsats = sats * 1000;

    try {
      setStatus('Fetching invoice...');
      const config = await fetchLnurlPayConfig(bankUsername);
      if (amountMsats < config.minSendable || amountMsats > config.maxSendable) {
        setError(`Amount must be between ${config.minSendable / 1000} and ${config.maxSendable / 1000} sats`);
        return;
      }

      const zapRequest = await signEvent(
        9734,
        '',
        [
          ['p', config.nostrPubkey],
          ['amount', String(amountMsats)],
          ['relays', ...RELAYS],
        ]
      );

      const zapRequestJson = JSON.stringify(zapRequest);
      const { pr } = await requestDepositInvoice(config.callback, amountMsats, zapRequestJson);

      setStatus('Pay with your Lightning wallet...');
      await enable();
      await payInvoice(pr);

      setStatus('Deposit successful!');
      setAmount('');
      toast.success('Deposit successful!');
      onSuccess?.();
      setTimeout(() => setStatus(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deposit failed');
      setStatus(null);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-medium">Deposit</h3>
      <label htmlFor="deposit-amount" className="sr-only">
        Amount in sats
      </label>
      <input
        id="deposit-amount"
        type="number"
        placeholder="Amount (sats)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white"
        aria-describedby={lnurlConfig ? 'deposit-range' : undefined}
      />
      {lnurlConfig && (
        <p id="deposit-range" className="text-sm text-gray-400">
          Deposit between {(lnurlConfig.minSendable / 1000).toFixed(0)} and {(lnurlConfig.maxSendable / 1000).toFixed(0)} sats
        </p>
      )}
      <button
        onClick={handleDeposit}
        disabled={!pubkey}
        className="w-full py-2 rounded bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
      >
        {status || 'Deposit'}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
