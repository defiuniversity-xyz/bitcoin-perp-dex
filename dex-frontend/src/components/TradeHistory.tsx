import { useEffect, useState } from 'react'
import { getTrades } from '../lib/futures-api'
import type { Trade } from '../lib/futures-api'

interface Props {
  symbol: string
}

export function TradeHistory({ symbol }: Props) {
  const [trades, setTrades] = useState<Trade[]>([])

  useEffect(() => {
    const load = () => getTrades(symbol, 30).then(setTrades).catch(() => {})
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [symbol])

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const fmtTime = (ts: number) => {
    const d = new Date(ts * 1000)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
  }

  if (!trades.length) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500">
        No trades yet
      </div>
    )
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="grid grid-cols-3 text-xs text-gray-500 px-3 py-1.5 border-b border-border sticky top-0 bg-navy-800">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>
      {trades.map((t, i) => {
        const prevPrice = i < trades.length - 1 ? trades[i + 1].price_usd : t.price_usd
        const isUp = t.price_usd >= prevPrice
        return (
          <div key={t.id} className="grid grid-cols-3 text-xs px-3 py-0.5 hover:bg-navy-700/30">
            <span className={`font-mono ${isUp ? 'text-long' : 'text-short'}`}>
              {fmt(t.price_usd)}
            </span>
            <span className="text-right font-mono text-gray-300">
              {t.size_sats.toLocaleString()}
            </span>
            <span className="text-right font-mono text-gray-500">{fmtTime(t.timestamp)}</span>
          </div>
        )
      })}
    </div>
  )
}
