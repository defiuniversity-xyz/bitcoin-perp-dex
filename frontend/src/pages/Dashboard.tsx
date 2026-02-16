import { useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { ConnectWallet } from '../components/ConnectWallet';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { TransactionList } from '../components/TransactionList';
import { SavingsForm } from '../components/SavingsForm';
import { useNostr } from '../hooks/useNostr';
import { useBalance } from '../hooks/useBalance';
import { getChallenge, nwcConnect } from '../lib/api';

export function Dashboard() {
  const { pubkey, signEvent } = useNostr();
  const { balanceMsats, savingsMsats, savingsApy, transactions, loading, error, refresh } = useBalance(pubkey);
  const [nwcUri, setNwcUri] = useState<string | null>(null);
  const [nwcLoading, setNwcLoading] = useState(false);
  const [nwcCopied, setNwcCopied] = useState(false);
  const [nwcError, setNwcError] = useState<string | null>(null);

  const handleCopyNwc = async () => {
    if (!nwcUri) return;
    try {
      await navigator.clipboard.writeText(nwcUri);
      setNwcCopied(true);
      setTimeout(() => setNwcCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  const handleNwcConnect = async () => {
    if (!pubkey) return;
    setNwcLoading(true);
    setNwcUri(null);
    setNwcError(null);
    try {
      const { challenge } = await getChallenge(pubkey);
      const signedChallenge = await signEvent(1, challenge, []);
      const { connection_uri } = await nwcConnect(pubkey, signedChallenge);
      setNwcUri(connection_uri);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setNwcError(msg || 'Connect NWC failed');
    } finally {
      setNwcLoading(false);
    }
  };

  if (!pubkey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <h1 className="text-3xl font-bold mb-4">Bitcoin Bank</h1>
        <p className="text-gray-400 mb-6">Connect with Nostr to view your balance</p>
        <ConnectWallet />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-xl font-bold">Bitcoin Bank</h1>
        <ConnectWallet />
      </header>

      <div className="space-y-6">
        <BalanceDisplay
          balanceMsats={balanceMsats}
          savingsMsats={savingsMsats}
          savingsApy={savingsApy}
          loading={loading}
        />
        {error && <p className="text-red-400">{error}</p>}

        <SavingsForm
          pubkey={pubkey}
          balanceMsats={balanceMsats ?? 0}
          savingsMsats={savingsMsats ?? 0}
          onSuccess={refresh}
        />

        <div className="flex gap-3 flex-wrap">
          <Link
            to="/deposit"
            className="flex-1 min-w-[80px] py-2 rounded bg-green-600 hover:bg-green-500 text-center min-h-[44px] flex items-center justify-center"
            aria-label="Go to deposit page"
          >
            Deposit
          </Link>
          <Link
            to="/withdraw"
            className="flex-1 min-w-[80px] py-2 rounded bg-amber-600 hover:bg-amber-500 text-center min-h-[44px] flex items-center justify-center"
            aria-label="Go to withdraw page"
          >
            Withdraw
          </Link>
          <Link
            to="/transfer"
            className="flex-1 min-w-[80px] py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-center min-h-[44px] flex items-center justify-center"
            aria-label="Go to transfer page"
          >
            Transfer
          </Link>
          <Link
            to="/card"
            className="flex-1 min-w-[80px] py-2 rounded bg-purple-600 hover:bg-purple-500 text-center min-h-[44px] flex items-center justify-center"
            aria-label="Go to card page"
          >
            Card
          </Link>
          <button
            onClick={handleNwcConnect}
            disabled={nwcLoading}
            className="flex-1 min-w-[80px] py-2 rounded bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 text-center min-h-[44px]"
            aria-label="Connect NWC for Zeus or Phoenix"
            aria-busy={nwcLoading}
          >
            {nwcLoading ? '...' : 'Connect NWC'}
          </button>
        </div>
        {nwcError && (
          <p className="text-red-400 text-sm" role="alert">
            {nwcError}
          </p>
        )}
        {nwcUri && (
          <div className="rounded border border-gray-600 p-3 space-y-3">
            <p className="text-sm text-gray-400">Scan in Zeus/Phoenix or copy:</p>
            <div className="flex justify-center bg-white p-3 rounded">
              <QRCode value={nwcUri} size={180} />
            </div>
            <div className="flex gap-2">
              <code className="flex-1 break-all text-xs bg-gray-800 p-2 rounded">{nwcUri}</code>
              <button
                onClick={handleCopyNwc}
                className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm whitespace-nowrap min-h-[44px] min-w-[44px]"
                aria-label="Copy NWC connection URI"
              >
                {nwcCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        <div>
          <h2 className="text-lg font-medium mb-3">Recent Transactions</h2>
          <TransactionList transactions={transactions} />
        </div>
      </div>
    </div>
  );
}
