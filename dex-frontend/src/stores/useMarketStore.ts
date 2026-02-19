import { create } from 'zustand'
import { getMarket, type MarketStats } from '../lib/futures-api'

interface MarketState {
  markets: Record<string, MarketStats>
  activeSymbol: string
  setActiveSymbol: (symbol: string) => void
  fetchMarket: (symbol: string) => Promise<void>
  startPolling: (symbol: string) => () => void
}

export const useMarketStore = create<MarketState>((set, get) => ({
  markets: {},
  activeSymbol: 'BTC-USD-PERP',

  setActiveSymbol: (symbol) => set({ activeSymbol: symbol }),

  fetchMarket: async (symbol) => {
    try {
      const data = await getMarket(symbol)
      set((s) => ({ markets: { ...s.markets, [symbol]: data } }))
    } catch {
      // Silently ignore transient oracle failures
    }
  },

  startPolling: (symbol) => {
    get().fetchMarket(symbol)
    const id = setInterval(() => get().fetchMarket(symbol), 3000)
    return () => clearInterval(id)
  },
}))
