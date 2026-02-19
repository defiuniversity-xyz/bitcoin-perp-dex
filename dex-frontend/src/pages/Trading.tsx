import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { PriceChart } from '../components/PriceChart'
import { OrderBook } from '../components/OrderBook'
import { OrderForm } from '../components/OrderForm'
import { PositionsList } from '../components/PositionsList'
import { OpenOrders } from '../components/OpenOrders'
import { TradeHistory } from '../components/TradeHistory'
import { FundingRate } from '../components/FundingRate'
import { useMarketStore } from '../stores/useMarketStore'

type BottomTab = 'positions' | 'orders' | 'trades' | 'funding'

const SUPPORTED_MARKETS = ['BTC-USD-PERP']

export function Trading() {
  const { symbol = 'BTC-USD-PERP' } = useParams<{ symbol: string }>()
  const [bottomTab, setBottomTab] = useState<BottomTab>('positions')
  const { setActiveSymbol, startPolling } = useMarketStore()

  useEffect(() => {
    setActiveSymbol(symbol)
    return startPolling(symbol)
  }, [symbol, setActiveSymbol, startPolling])

  if (!SUPPORTED_MARKETS.includes(symbol)) {
    return <Navigate to="/trade/BTC-USD-PERP" replace />
  }

  const bottomTabs: { id: BottomTab; label: string }[] = [
    { id: 'positions', label: 'Positions' },
    { id: 'orders', label: 'Orders' },
    { id: 'trades', label: 'Trades' },
    { id: 'funding', label: 'Funding' },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Desktop 4-panel layout */}
      <div className="hidden md:grid flex-1 overflow-hidden" style={{ gridTemplateColumns: '1fr 280px', gridTemplateRows: '60% 40%' }}>
        {/* Top-left: Price chart */}
        <div className="panel border-r border-b border-border overflow-hidden">
          <PriceChart symbol={symbol} />
        </div>

        {/* Top-right: Order book */}
        <div className="panel border-b border-border overflow-hidden flex flex-col">
          <OrderBook symbol={symbol} />
        </div>

        {/* Bottom-left: Order form + bottom tabs */}
        <div className="panel border-r border-border overflow-hidden flex">
          {/* Order form — fixed width left column */}
          <div className="w-72 border-r border-border overflow-y-auto flex-shrink-0">
            <div className="panel-header">Place Order</div>
            <OrderForm symbol={symbol} />
          </div>

          {/* Bottom tabs panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
              {bottomTabs.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setBottomTab(id)}
                  className={`tab-btn text-xs ${bottomTab === id ? 'tab-btn-active' : 'tab-btn-inactive'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto">
              {bottomTab === 'positions' && <PositionsList />}
              {bottomTab === 'orders' && <OpenOrders />}
              {bottomTab === 'trades' && <TradeHistory symbol={symbol} />}
              {bottomTab === 'funding' && <FundingRate symbol={symbol} />}
            </div>
          </div>
        </div>

        {/* Bottom-right: Funding + market stats */}
        <div className="panel overflow-hidden flex flex-col">
          <div className="panel-header">Funding Rate</div>
          <FundingRate symbol={symbol} />
        </div>
      </div>

      {/* Mobile layout — stacked */}
      <div className="md:hidden flex flex-col h-full overflow-y-auto gap-3 p-3">
        {/* Chart */}
        <div className="panel" style={{ height: 280 }}>
          <PriceChart symbol={symbol} />
        </div>

        {/* Order form */}
        <div className="panel">
          <div className="panel-header">Place Order</div>
          <OrderForm symbol={symbol} />
        </div>

        {/* Orderbook */}
        <div className="panel" style={{ height: 400 }}>
          <OrderBook symbol={symbol} />
        </div>

        {/* Tabs */}
        <div className="panel">
          <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
            {bottomTabs.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setBottomTab(id)}
                className={`tab-btn text-xs ${bottomTab === id ? 'tab-btn-active' : 'tab-btn-inactive'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-32">
            {bottomTab === 'positions' && <PositionsList />}
            {bottomTab === 'orders' && <OpenOrders />}
            {bottomTab === 'trades' && <TradeHistory symbol={symbol} />}
            {bottomTab === 'funding' && <FundingRate symbol={symbol} />}
          </div>
        </div>
      </div>
    </div>
  )
}
