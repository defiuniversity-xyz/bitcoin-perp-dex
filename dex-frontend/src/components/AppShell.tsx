import { NavLink, Outlet } from 'react-router-dom'
import { WalletConnect } from './WalletConnect'
import { useMarketStore } from '../stores/useMarketStore'

const NAV_ITEMS = [
  { to: '/', label: 'Markets', icon: '◈' },
  { to: '/trade/BTC-USD-PERP', label: 'Trade', icon: '⚡' },
  { to: '/portfolio', label: 'Portfolio', icon: '◉' },
  { to: '/account', label: 'Account', icon: '◎' },
]

export function AppShell() {
  const activeSymbol = useMarketStore((s) => s.activeSymbol)
  const market = useMarketStore((s) => s.markets[activeSymbol])

  const markPrice = market?.mark_price_usd
  const fundingRate = market?.funding_rate ?? 0
  const fundingSign = fundingRate > 0 ? '+' : ''

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top navbar */}
      <header className="flex items-center justify-between px-4 py-3 bg-navy-900 border-b border-border flex-shrink-0 h-14">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="text-btc-orange text-xl font-bold">₿</span>
            <span className="font-bold text-white hidden sm:block">Perp DEX</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-navy-700 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-navy-800'
                  }`
                }
              >
                <span>{icon}</span>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Center: live market ticker */}
        {markPrice && (
          <div className="hidden lg:flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-mono">{activeSymbol}</span>
              <span className="font-mono font-semibold text-white">
                ${markPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md ${
              fundingRate > 0 ? 'bg-orange-900/30 text-btc-orange' : 'bg-green-900/30 text-long'
            }`}>
              <span>Funding</span>
              <span className="font-mono">
                {fundingSign}{(fundingRate * 100).toFixed(4)}%
              </span>
            </div>
          </div>
        )}

        {/* Right: wallet */}
        <WalletConnect />
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-navy-900 border-t border-border z-50 flex">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors ${
                isActive ? 'text-btc-orange' : 'text-gray-500'
              }`
            }
          >
            <span className="text-lg">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Page content */}
      <main className="flex-1 overflow-hidden md:pb-0 pb-16">
        <Outlet />
      </main>
    </div>
  )
}
