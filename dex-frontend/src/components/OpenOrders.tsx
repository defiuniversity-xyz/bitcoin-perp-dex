import { useEffect } from 'react'
import { toast } from 'sonner'
import { useWalletStore } from '../stores/useWalletStore'
import { usePositionStore } from '../stores/usePositionStore'
import { cancelOrder } from '../lib/futures-api'
import { buildCancelEvent } from '../lib/nostr-orders'
import type { Order } from '../lib/futures-api'

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h`
}

export function OpenOrders() {
  const { pubkey, refreshCollateral } = useWalletStore()
  const { openOrders, startPolling } = usePositionStore()

  useEffect(() => {
    if (!pubkey) return
    return startPolling(pubkey)
  }, [pubkey, startPolling])

  const handleCancel = async (order: Order) => {
    const nip07 = (window as Window & { nostr?: { signEvent: (e: object) => Promise<object> } }).nostr
    if (!nip07 || !pubkey) {
      toast.error('NIP-07 extension required')
      return
    }
    try {
      const nostrEventId = order.nostr_event_id ?? order.id
      const unsignedEvent = buildCancelEvent(pubkey, nostrEventId)
      const signedEvent = await nip07.signEvent(unsignedEvent)
      await cancelOrder(order.id, signedEvent)
      toast.success('Order cancelled')
      await refreshCollateral()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cancel failed')
    }
  }

  if (!pubkey) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500">
        Connect wallet to view orders
      </div>
    )
  }

  if (!openOrders.length) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500">
        No open orders
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
            <th className="text-left px-3 py-2 font-medium">Type</th>
            <th className="text-right px-3 py-2 font-medium">Size</th>
            <th className="text-right px-3 py-2 font-medium">Price</th>
            <th className="text-right px-3 py-2 font-medium">Filled</th>
            <th className="text-right px-3 py-2 font-medium">Age</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {openOrders.map((order) => {
            const filledPct = order.size_sats > 0
              ? Math.round((order.filled_size_sats / order.size_sats) * 100)
              : 0
            return (
              <tr key={order.id} className="border-b border-border/50 hover:bg-navy-700/30">
                <td className="px-3 py-2 font-mono text-white">{order.market}</td>
                <td className="px-3 py-2">
                  <span className={order.side === 'long' ? 'badge-long' : 'badge-short'}>
                    {order.side === 'long' ? '↑ Long' : '↓ Short'}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-400 capitalize">{order.order_type}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-300">
                  {order.size_sats.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right font-mono text-gray-300">
                  {order.price_usd ? `$${fmt(order.price_usd)}` : 'Market'}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="w-10 h-1 bg-navy-700 rounded-full overflow-hidden">
                      <div className="h-full bg-btc-orange" style={{ width: `${filledPct}%` }} />
                    </div>
                    <span className="font-mono text-gray-400">{filledPct}%</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-gray-500">{timeAgo(order.created_at)}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleCancel(order)}
                    className="text-xs px-2 py-1 rounded bg-navy-600 text-gray-300 hover:bg-short/30 hover:text-short transition-colors"
                  >
                    Cancel
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
