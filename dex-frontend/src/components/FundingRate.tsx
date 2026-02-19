import { useEffect, useState } from 'react'
import { getFundingHistory } from '../lib/futures-api'
import { useMarketStore } from '../stores/useMarketStore'
import type { FundingRate as FundingRateType } from '../lib/futures-api'

interface Props {
  symbol: string
}

function useCountdown(nextFundingInSeconds: number) {
  const [remaining, setRemaining] = useState(nextFundingInSeconds)
  useEffect(() => {
    setRemaining(nextFundingInSeconds)
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000)
    return () => clearInterval(id)
  }, [nextFundingInSeconds])

  const h = Math.floor(remaining / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  const s = remaining % 60
  return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
}

export function FundingRate({ symbol }: Props) {
  const market = useMarketStore((s) => s.markets[symbol])
  const [history, setHistory] = useState<FundingRateType[]>([])

  const fundingRate = market?.funding_rate ?? 0
  const nextIn = market?.next_funding_in_seconds ?? 0
  const countdown = useCountdown(nextIn)
  const isPositive = fundingRate >= 0

  useEffect(() => {
    getFundingHistory(symbol, 8).then(setHistory).catch(() => {})
    const id = setInterval(() => getFundingHistory(symbol, 8).then(setHistory).catch(() => {}), 30000)
    return () => clearInterval(id)
  }, [symbol])

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Current rate */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Funding Rate (8h)</div>
          <div className={`text-lg font-mono font-semibold ${isPositive ? 'text-btc-orange' : 'text-long'}`}>
            {isPositive ? '+' : ''}{(fundingRate * 100).toFixed(4)}%
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {isPositive ? 'Longs pay shorts' : 'Shorts pay longs'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400 mb-0.5">Next funding</div>
          <div className="text-sm font-mono text-white">{countdown}</div>
        </div>
      </div>

      {/* Mini history bars */}
      {history.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-1">Recent history</div>
          <div className="flex items-end gap-0.5 h-8">
            {history.slice().reverse().map((fr, i) => {
              const h = Math.min(100, Math.abs(fr.rate) / 0.0075 * 100)
              return (
                <div
                  key={fr.id ?? i}
                  className={`flex-1 rounded-sm ${fr.rate >= 0 ? 'bg-btc-orange/60' : 'bg-long/60'}`}
                  style={{ height: `${Math.max(4, h)}%` }}
                  title={`${(fr.rate * 100).toFixed(4)}%`}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
