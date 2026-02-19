import { create } from 'zustand'
import { getCollateral } from '../lib/futures-api'

interface WalletState {
  pubkey: string | null
  npub: string | null
  collateral_msats: number
  isConnecting: boolean
  connect: () => Promise<void>
  disconnect: () => void
  refreshCollateral: () => Promise<void>
}

function hexToNpub(hex: string): string {
  // Simple display shortener — full npub encoding requires secp256k1 bech32
  return `${hex.slice(0, 8)}...${hex.slice(-8)}`
}

export const useWalletStore = create<WalletState>((set, get) => ({
  pubkey: null,
  npub: null,
  collateral_msats: 0,
  isConnecting: false,

  connect: async () => {
    const nip07 = (window as Window & { nostr?: { getPublicKey: () => Promise<string> } }).nostr
    if (!nip07) {
      throw new Error('No NIP-07 extension found. Install Alby or nos2x.')
    }
    set({ isConnecting: true })
    try {
      const pubkey = await nip07.getPublicKey()
      const npub = hexToNpub(pubkey)
      set({ pubkey, npub })
      await get().refreshCollateral()
    } finally {
      set({ isConnecting: false })
    }
  },

  disconnect: () => set({ pubkey: null, npub: null, collateral_msats: 0 }),

  refreshCollateral: async () => {
    const { pubkey } = get()
    if (!pubkey) return
    try {
      const data = await getCollateral(pubkey)
      set({ collateral_msats: data.collateral_msats })
    } catch {
      // Ignore errors during refresh
    }
  },
}))
