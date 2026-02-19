import { useWalletStore } from '../stores/useWalletStore'
import { toast } from 'sonner'

export function WalletConnect() {
  const { pubkey, npub, collateral_msats, isConnecting, connect, disconnect } = useWalletStore()

  const handleConnect = async () => {
    try {
      await connect()
      toast.success('Wallet connected')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect')
    }
  }

  if (!pubkey) {
    return (
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="btn-primary text-sm px-4 py-2"
      >
        {isConnecting ? 'Connecting…' : 'Connect Wallet'}
      </button>
    )
  }

  const collateralSats = Math.floor(collateral_msats / 1000)
  const collateralUSD = null // calculated in parent if needed

  return (
    <div className="flex items-center gap-3">
      <div className="text-right hidden sm:block">
        <div className="text-xs text-gray-400">Collateral</div>
        <div className="text-sm font-mono text-white">
          {collateralSats.toLocaleString()} sats
        </div>
      </div>
      <div className="flex items-center gap-2 bg-navy-700 border border-border rounded-lg px-3 py-2">
        <div className="w-2 h-2 rounded-full bg-long animate-pulse" />
        <span className="text-sm font-mono text-gray-300">{npub}</span>
        <button
          onClick={disconnect}
          className="text-gray-500 hover:text-short transition-colors ml-1 text-xs"
          title="Disconnect"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
