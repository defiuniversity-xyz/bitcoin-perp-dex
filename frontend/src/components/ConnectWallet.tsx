import { useNostr } from '../hooks/useNostr';

export function ConnectWallet() {
  const { pubkey, error, connect, disconnect } = useNostr();

  if (pubkey) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400 truncate max-w-[120px]" title={pubkey}>
          {pubkey.slice(0, 16)}...
        </span>
        <button
          onClick={disconnect}
          className="px-3 py-1 text-sm rounded bg-gray-600 hover:bg-gray-500 min-h-[44px] min-w-[44px]"
          aria-label="Disconnect wallet"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={connect}
        className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white min-h-[44px]"
        aria-label="Connect with Nostr extension"
      >
        Connect with Nostr
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
