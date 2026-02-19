import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWalletStore } from '../stores/useWalletStore'
import { usePositionStore } from '../stores/usePositionStore'
import { getTradesForPubkey, getFundingHistory, type Trade } from '../lib/futures-api'

// Minimal typed stub for trades-by-pubkey (not in the main API yet — uses existing trades endpoint)
async function getTradesForPubkey(_pubkey: string): Promise<Trade[]> {
  // The backend /api/futures/trades returns market trades, not user-specific.
  // This is a placeholder — wire up a user-specific endpoint in a future iteration.
  return []
}

export function Portfolio() {
  const { pubkey, collateral_msats, refreshCollateral } = useWalletStore()
  const { positions } = usePositionStore()
  const [closedTrades, setClosedTrades] = useState<Trade[]>([])
  const [fundingHistory, setFundingHistory] = useState<{ rate: number; timestamp: number }[]>([])

  useEffect(() => {
    if (!pubkey) return
    refreshCollateral()
    getTradesForPubkey(pubkey).then(setClosedTrades).catch(() => {})
    getFundingHistory('BTC-USD-PERP', 24)
      .then((h) => setFundingHistory(h.map((r) => ({ rate: r.rate, timestamp: r.timestamp }))))
      .catch(() => {})
  }, [pubkey, refreshCollateral])

  const collateralSats = Math.floor(collateral_msats / 1000)

  const totalUnrealizedPnlMsats = positions.reduce(
    (sum, p) => sum + (p.unrealized_pnl_msats ?? 0),
    0,
  )
  const totalUnrealizedSats = Math.round(totalUnrealizedPnlMsats / 1000)

  if (!pubkey) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-2xl">◉</div>
        <div className="text-gray-400">Connect your wallet to view portfolio</div>
      </div>
    )
  }

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Portfolio</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="panel p-5">
          <div className="text-xs text-gray-400 mb-1">Collateral Balance</div>
          <div className="text-2xl font-mono font-bold text-white">
            {collateralSats.toLocaleString()}
            <span className="text-base text-gray-400 ml-1">sats</span>
          </div>
          <Link
            to="/account"
            className="text-xs text-btc-orange hover:underline mt-2 block"
          >
            + Deposit collateral →
          </Link>
        </div>

        <div className="panel p-5">
          <div className="text-xs text-gray-400 mb-1">Open Positions</div>
          <div className="text-2xl font-mono font-bold text-white">{positions.length}</div>
          <div className="text-xs text-gray-500 mt-2">
            {positions.filter((p) => p.side === 'long').length} long ·{' '}
            {positions.filter((p) => p.side === 'short').length} short
          </div>
        </div>

        <div className="panel p-5">
          <div className="text-xs text-gray-400 mb-1">Unrealized PnL</div>
          <div className={`text-2xl font-mono font-bold ${totalUnrealizedSats >= 0 ? 'text-long' : 'text-short'}`}>
            {totalUnrealizedSats >= 0 ? '+' : ''}{totalUnrealizedSats.toLocaleString()}
            <span className="text-base text-gray-400 ml-1">sats</span>
          </div>
        </div>
      </div>

      {/* Open positions summary */}
      {positions.length > 0 && (
        <div className="panel">
          <div className="panel-header">Open Positions</div>
          <div className="divide-y divide-border">
            {positions.map((pos) => {
              const pnlSats = Math.round((pos.unrealized_pnl_msats ?? 0) / 1000)
              const isProfit = pnlSats >= 0
              return (
                <div key={pos.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={pos.side === 'long' ? 'badge-long' : 'badge-short'}>
                      {pos.side === 'long' ? '↑ Long' : '↓ Short'}
                    </span>
                    <span className="font-mono text-sm text-gray-300">{pos.market}</span>
                    <span className="text-xs text-gray-500">{pos.leverage}×</span>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-mono ${isProfit ? 'text-long' : 'text-short'}`}>
                      {isProfit ? '+' : ''}{pnlSats.toLocaleString()} sats
                    </div>
                    <div className="text-xs text-gray-500">
                      Liq. ${fmt(pos.liquidation_price_usd)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent funding rate history */}
      {fundingHistory.length > 0 && (
        <div className="panel">
          <div className="panel-header">Recent Funding Rates (BTC-USD-PERP)</div>
          <div className="divide-y divide-border">
            {fundingHistory.slice(0, 8).map((fr, i) => {
              const isPositive = fr.rate >= 0
              const date = new Date(fr.timestamp * 1000)
              return (
                <div key={i} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <span className="text-gray-500 text-xs font-mono">
                    {date.toLocaleDateString()} {date.toLocaleTimeString()}
                  </span>
                  <span className={`font-mono ${isPositive ? 'text-btc-orange' : 'text-long'}`}>
                    {isPositive ? '+' : ''}{(fr.rate * 100).toFixed(4)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Closed trades */}
      {closedTrades.length > 0 && (
        <div className="panel">
          <div className="panel-header">Trade History</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-border">
                  <th className="text-left px-4 py-2">Market</th>
                  <th className="text-right px-4 py-2">Price</th>
                  <th className="text-right px-4 py-2">Size</th>
                  <th className="text-right px-4 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {closedTrades.map((t) => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="px-4 py-2 font-mono text-gray-300">{t.market}</td>
                    <td className="px-4 py-2 text-right font-mono">${fmt(t.price_usd)}</td>
                    <td className="px-4 py-2 text-right font-mono">{t.size_sats.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-gray-500">
                      {new Date(t.timestamp * 1000).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
