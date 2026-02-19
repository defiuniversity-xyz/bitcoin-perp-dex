import { useNostrOrderbook } from '../hooks/useNostrOrderbook'
import { getOrderBook } from '../lib/futures-api'
import { useEffect, useState } from 'react'
import type { OrderBookLevel } from '../hooks/useNostrOrderbook'

interface Props {
  symbol: string
}

export function OrderBook({ symbol }: Props) {
  const { bids: nostrBids, asks: nostrAsks } = useNostrOrderbook(symbol)

  // Fallback: also poll REST orderbook and merge
  const [restBids, setRestBids] = useState<OrderBookLevel[]>([])
  const [restAsks, setRestAsks] = useState<OrderBookLevel[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const ob = await getOrderBook(symbol)
        setRestBids(ob.bids as OrderBookLevel[])
        setRestAsks(ob.asks as OrderBookLevel[])
      } catch { /* ignore */ }
    }
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [symbol])

  // Merge Nostr + REST levels
  const mergeLevels = (a: OrderBookLevel[], b: OrderBookLevel[]): OrderBookLevel[] => {
    const map = new Map<number, number>()
    for (const l of [...a, ...b]) {
      map.set(l.price_usd, (map.get(l.price_usd) ?? 0) + l.size_sats)
    }
    return [...map.entries()]
      .map(([price_usd, size_sats]) => ({ price_usd, size_sats, side: a[0]?.side ?? 'long' as const }))
  }

  const bids = mergeLevels(nostrBids, restBids)
    .sort((a, b) => b.price_usd - a.price_usd)
    .slice(0, 15)

  const asks = mergeLevels(nostrAsks, restAsks)
    .sort((a, b) => a.price_usd - b.price_usd)
    .slice(0, 15)

  const spread = asks[0] && bids[0] ? asks[0].price_usd - bids[0].price_usd : null
  const maxSize = Math.max(...[...bids, ...asks].map((l) => l.size_sats), 1)

  const fmt = (p: number) =>
    p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtSats = (s: number) =>
    s >= 1_000_000 ? `${(s / 1_000_000).toFixed(2)}M` : s.toLocaleString()

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">Order Book</div>

      {/* Header row */}
      <div className="grid grid-cols-3 text-xs text-gray-500 px-3 py-1.5 border-b border-border">
        <span>Price (USD)</span>
        <span className="text-right">Size (sats)</span>
        <span className="text-right">Total</span>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Asks (sells) — displayed in reverse so lowest ask is closest to spread */}
        <div className="flex-1 overflow-y-auto flex flex-col-reverse">
          {asks.map((level) => {
            const pct = (level.size_sats / maxSize) * 100
            return (
              <div
                key={level.price_usd}
                className="relative grid grid-cols-3 text-xs px-3 py-0.5 hover:bg-navy-700 cursor-default"
              >
                <div
                  className="absolute inset-y-0 right-0 bg-short/10"
                  style={{ width: `${pct}%` }}
                />
                <span className="text-short font-mono relative z-10">{fmt(level.price_usd)}</span>
                <span className="text-right font-mono text-gray-300 relative z-10">
                  {fmtSats(level.size_sats)}
                </span>
                <span className="text-right font-mono text-gray-500 relative z-10">
                  {fmtSats(level.size_sats)}
                </span>
              </div>
            )
          })}
        </div>

        {/* Spread */}
        <div className="flex items-center justify-center gap-3 py-2 border-y border-border bg-navy-900 text-xs">
          {spread !== null ? (
            <>
              <span className="text-gray-400">Spread</span>
              <span className="font-mono text-white">${fmt(spread)}</span>
              {asks[0] && (
                <span className="text-gray-500">
                  ({((spread / asks[0].price_usd) * 100).toFixed(3)}%)
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-600">No orders</span>
          )}
        </div>

        {/* Bids (buys) */}
        <div className="flex-1 overflow-y-auto">
          {bids.map((level) => {
            const pct = (level.size_sats / maxSize) * 100
            return (
              <div
                key={level.price_usd}
                className="relative grid grid-cols-3 text-xs px-3 py-0.5 hover:bg-navy-700 cursor-default"
              >
                <div
                  className="absolute inset-y-0 right-0 bg-long/10"
                  style={{ width: `${pct}%` }}
                />
                <span className="text-long font-mono relative z-10">{fmt(level.price_usd)}</span>
                <span className="text-right font-mono text-gray-300 relative z-10">
                  {fmtSats(level.size_sats)}
                </span>
                <span className="text-right font-mono text-gray-500 relative z-10">
                  {fmtSats(level.size_sats)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
