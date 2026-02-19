import { useEffect, useRef, useState } from 'react'
import { SimplePool } from 'nostr-tools'
import { DEX_RELAYS } from '../lib/nostr-orders'

export interface OrderBookLevel {
  price_usd: number
  size_sats: number
  side: 'long' | 'short'
}

interface NostrOrderEvent {
  id: string
  pubkey: string
  kind: number
  tags: string[][]
  content: string
  created_at: number
}

/**
 * Subscribe to Kind 30051 order events from Nostr relays and aggregate into
 * bid/ask levels. Cancelled/filled orders are removed when a newer event
 * for the same d-tag arrives with status != 'open'.
 */
export function useNostrOrderbook(market: string) {
  const [bids, setBids] = useState<OrderBookLevel[]>([])
  const [asks, setAsks] = useState<OrderBookLevel[]>([])
  const poolRef = useRef<SimplePool | null>(null)
  const ordersRef = useRef<Map<string, { event: NostrOrderEvent; content: Record<string, unknown> }>>(new Map())

  useEffect(() => {
    const pool = new SimplePool()
    poolRef.current = pool

    const sub = pool.subscribeMany(
      DEX_RELAYS,
      [{ kinds: [30051], '#market': [market] }],
      {
        onevent(event: NostrOrderEvent) {
          try {
            const dTag = event.tags.find((t) => t[0] === 'd')?.[1]
            if (!dTag) return
            const content = JSON.parse(event.content) as Record<string, unknown>

            const existing = ordersRef.current.get(dTag)
            if (existing && existing.event.created_at >= event.created_at) return

            ordersRef.current.set(dTag, { event, content })
            recompute()
          } catch {
            // Malformed event
          }
        },
      },
    )

    function recompute() {
      const bidLevels = new Map<number, number>()
      const askLevels = new Map<number, number>()

      for (const { content } of ordersRef.current.values()) {
        if (content.status && content.status !== 'open') continue
        if (content.market !== market) continue
        if (content.order_type !== 'limit') continue

        const price = Number(content.price_usd)
        const remaining = Number(content.size_sats) - Number(content.filled_size_sats ?? 0)
        if (!price || remaining <= 0) continue

        const roundedPrice = Math.round(price * 100) / 100

        if (content.side === 'long') {
          bidLevels.set(roundedPrice, (bidLevels.get(roundedPrice) ?? 0) + remaining)
        } else {
          askLevels.set(roundedPrice, (askLevels.get(roundedPrice) ?? 0) + remaining)
        }
      }

      setBids(
        [...bidLevels.entries()]
          .sort((a, b) => b[0] - a[0])
          .slice(0, 20)
          .map(([price_usd, size_sats]) => ({ price_usd, size_sats, side: 'long' as const })),
      )
      setAsks(
        [...askLevels.entries()]
          .sort((a, b) => a[0] - b[0])
          .slice(0, 20)
          .map(([price_usd, size_sats]) => ({ price_usd, size_sats, side: 'short' as const })),
      )
    }

    return () => {
      sub.close()
      pool.close(DEX_RELAYS)
      ordersRef.current.clear()
    }
  }, [market])

  return { bids, asks }
}
