import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getMarkets } from '../lib/futures-api'
import { useMarketStore } from '../stores/useMarketStore'
import type { MarketStats } from '../lib/futures-api'

function MarketCard({ market }: { market: MarketStats }) {
  const isUp = (market.change_24h_pct ?? 0) >= 0
  const fundingPositive = market.funding_rate >= 0
  const markPrice = market.mark_price_usd

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtSats = (s: number) =>
    s >= 1_000_000 ? `${(s / 1_000_000).toFixed(2)}M` : s.toLocaleString()

  return (
    <Link
      to={`/trade/${market.market}`}
      className="panel p-5 hover:border-btc-orange/40 transition-colors cursor-pointer block"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-btc-orange text-xl font-bold">₿</span>
            <span className="font-bold text-white text-lg">{market.market}</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Perpetual · up to {market.max_leverage}×</div>
        </div>
        <div className={`text-sm font-semibold px-2 py-1 rounded ${
          isUp ? 'bg-long/20 text-long' : 'bg-short/20 text-short'
        }`}>
          {isUp ? '+' : ''}{market.change_24h_pct?.toFixed(2) ?? '0.00'}%
        </div>
      </div>

      {/* Mark price */}
      <div className="mb-4">
        {markPrice ? (
          <div className="text-3xl font-mono font-bold text-white">
            ${fmt(markPrice)}
          </div>
        ) : (
          <div className="text-xl text-gray-600">Loading…</div>
        )}
        <div className="text-xs text-gray-500 mt-0.5">Mark price</div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-0.5">Open Interest</div>
          <div className="text-sm font-mono text-gray-200">
            {fmtSats(market.open_interest_sats)} sats
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-0.5">Funding (8h)</div>
          <div className={`text-sm font-mono ${fundingPositive ? 'text-btc-orange' : 'text-long'}`}>
            {fundingPositive ? '+' : ''}{(market.funding_rate * 100).toFixed(4)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-0.5">Maker / Taker</div>
          <div className="text-sm font-mono text-gray-400">
            {(market.maker_fee_pct * 100).toFixed(2)}% / {(market.taker_fee_pct * 100).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-4 flex gap-2">
        <div className="flex-1 text-center py-2 bg-long/10 hover:bg-long/20 text-long text-sm font-semibold rounded-lg transition-colors">
          ↑ Long
        </div>
        <div className="flex-1 text-center py-2 bg-short/10 hover:bg-short/20 text-short text-sm font-semibold rounded-lg transition-colors">
          ↓ Short
        </div>
      </div>
    </Link>
  )
}

export function Markets() {
  const { markets, setActiveSymbol } = useMarketStore()
  const marketList = Object.values(markets)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getMarkets()
        const { markets: storeMarkets } = useMarketStore.getState()
        const updated = { ...storeMarkets }
        for (const m of data) updated[m.market] = m
        useMarketStore.setState({ markets: updated })
      } catch { /* ignore */ }
    }
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8">
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          <span className="text-btc-orange">₿</span>itcoin Perpetuals
        </h1>
        <p className="text-gray-400 max-w-xl">
          Trade BTC perpetual futures on Lightning. Collateral deposited instantly.
          Orderbook published to Nostr. Every trade verifiable on-chain.
        </p>
      </div>

      {/* Market cards */}
      {marketList.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Loading skeleton */}
          {[1, 2].map((i) => (
            <div key={i} className="panel p-5 animate-pulse">
              <div className="h-6 bg-navy-700 rounded w-40 mb-4" />
              <div className="h-10 bg-navy-700 rounded w-32 mb-4" />
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-8 bg-navy-700 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {marketList.map((m) => (
            <MarketCard key={m.market} market={m} />
          ))}
        </div>
      )}

      {/* Protocol callout */}
      <div className="mt-12 panel p-6 bg-navy-800/50">
        <div className="flex flex-wrap gap-8 justify-center text-center">
          {[
            { label: 'Powered by', value: 'Lightning', sub: 'instant collateral settlement' },
            { label: 'Orderbook on', value: 'Nostr', sub: 'Kind 30051 events, public & verifiable' },
            { label: 'Auth via', value: 'NIP-07', sub: 'your key, your orders' },
          ].map(({ label, value, sub }) => (
            <div key={value}>
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className="text-lg font-bold text-btc-orange">{value}</div>
              <div className="text-xs text-gray-600 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
