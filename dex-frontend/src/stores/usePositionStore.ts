import { create } from 'zustand'
import { getPositions, getOrders, type Position, type Order } from '../lib/futures-api'

interface PositionState {
  positions: Position[]
  openOrders: Order[]
  isLoading: boolean
  fetch: (pubkey: string) => Promise<void>
  startPolling: (pubkey: string) => () => void
}

export const usePositionStore = create<PositionState>((set, get) => ({
  positions: [],
  openOrders: [],
  isLoading: false,

  fetch: async (pubkey) => {
    set({ isLoading: true })
    try {
      const [positions, orders] = await Promise.all([
        getPositions(pubkey),
        getOrders(pubkey, 'open'),
      ])
      set({ positions, openOrders: orders })
    } catch {
      // Ignore transient errors
    } finally {
      set({ isLoading: false })
    }
  },

  startPolling: (pubkey) => {
    get().fetch(pubkey)
    const id = setInterval(() => get().fetch(pubkey), 3000)
    return () => clearInterval(id)
  },
}))
