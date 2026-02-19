import { useEffect } from 'react'
import { toast } from 'sonner'
import { useWalletStore } from '../stores/useWalletStore'
import { usePositionStore } from '../stores/usePositionStore'
import { closePosition } from '../lib/futures-api'
import { buildClosePositionEvent } from '../lib/nostr-orders'
import type { Position } from '../lib/futures-api'

function PnlCell({ pnl }: { pnl: number }) {
  const sats = Math.round(pnl / 1000)
  const cls = pnl >= 0 ? 'pnl-positive' : 'pnl-negative'
  const sign = pnl >= 0 ? '+' : ''
  return <span className={cls}>{sign}{sats.toLocaleString()} sats</span>
}

function MarginBar({ ratio, maintenance }: { ratio: number; maintenance: number }) {
  const pct = Math.min(100, ratio * 100)
  const danger = ratio < maintenance * 1.5
  const warning = ratio < maintenance * 2
  const color = danger ? 'bg-short' : warning ? 'bg-btc-orange' : 'bg-long'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-navy-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-400">{(ratio * 100).toFixed(1)}%</span>
    </div>
  )
}

export function PositionsList() {
  const { pubkey, refreshCollateral } = useWalletStore()
  const { positions, startPolling } = usePositionStore()

  useEffect(() => {
    if (!pubkey) return
    return startPolling(pubkey)
  }, [pubkey, startPolling])

  const handleClose = async (pos: Position) => {
    const nip07 = (window as Window & { nostr?: { signEvent: (e: object) => Promise<object> } }).nostr
    if (!nip07 || !pubkey) {
      toast.error('NIP-07 extension required')
      return
    }
    try {
      const unsignedEvent = buildClosePositionEvent(pubkey, pos.id)
      const signedEvent = await nip07.signEvent(unsignedEvent)
      const result = await closePosition(pos.id, signedEvent)
      const pnlSats = Math.round(result.pnl_msats / 1000)
      const sign = pnlSats >= 0 ? '+' : ''
      toast.success(`Position closed · PnL: ${sign}${pnlSats.toLocaleString()} sats`)
      await refreshCollateral()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Close failed')
    }
  }

  if (!pubkey) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500">
        Connect wallet to view positions
      </div>
    )
  }

  if (!positions.length) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500">
        No open positions
      </div>
    )
  }

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-border">
            <th className="text-left px-3 py-2 font-medium">Market</th>
            <th className="text-left px-3 py-2 font-medium">Side</th>
            <th className="text-right px-3 py-2 font-medium">Size</th>
            <th className="text-right px-3 py-2 font-medium">Entry</th>
            <th className="text-right px-3 py-2 font-medium">Mark</th>
            <th className="text-right px-3 py-2 font-medium">PnL</th>
            <th className="text-left px-3 py-2 font-medium">Margin</th>
            <th className="text-right px-3 py-2 font-medium">Liq.</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => (
            <tr key={pos.id} className="border-b border-border/50 hover:bg-navy-700/30">
              <td className="px-3 py-2 font-mono text-white">{pos.market}</td>
              <td className="px-3 py-2">
                <span className={pos.side === 'long' ? 'badge-long' : 'badge-short'}>
                  {pos.side === 'long' ? '↑ Long' : '↓ Short'}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-mono text-gray-300">
                {pos.size_sats.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono text-gray-300">
                ${fmt(pos.entry_price_usd)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-white">
                {pos.mark_price_usd ? `$${fmt(pos.mark_price_usd)}` : '—'}
              </td>
              <td className="px-3 py-2 text-right">
                <PnlCell pnl={pos.unrealized_pnl_msats ?? 0} />
              </td>
              <td className="px-3 py-2">
                <MarginBar
                  ratio={pos.margin_ratio ?? 0}
                  maintenance={pos.maintenance_margin_pct ?? 0.025}
                />
              </td>
              <td className="px-3 py-2 text-right font-mono text-short">
                ${fmt(pos.liquidation_price_usd)}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => handleClose(pos)}
                  className="text-xs px-2 py-1 rounded bg-short/20 text-short hover:bg-short/40 transition-colors"
                >
                  Close
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
