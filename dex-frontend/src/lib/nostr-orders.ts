/**
 * Helpers for building and parsing Kind 30051 order events.
 * The event content is a JSON string with order parameters.
 */

export interface OrderEventContent {
  market: string
  side: 'long' | 'short'
  order_type: 'limit' | 'market'
  size_sats: number
  price_usd?: number
  leverage: number
}

export function buildOrderEventContent(params: OrderEventContent): string {
  return JSON.stringify(params)
}

/**
 * Build an unsigned Kind 30051 Nostr event object ready for NIP-07 signing.
 */
export function buildOrderEvent(pubkey: string, params: OrderEventContent) {
  const content = buildOrderEventContent(params)
  const orderId = crypto.randomUUID()
  return {
    kind: 30051,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', orderId],
      ['market', params.market],
      ['side', params.side],
      ['type', params.order_type],
      ...(params.price_usd ? [['price', String(params.price_usd)]] : []),
    ],
    content,
  }
}

/**
 * Build an unsigned cancellation event (Kind 5) referencing the order event.
 */
export function buildCancelEvent(pubkey: string, orderNostrEventId: string) {
  return {
    kind: 5,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['e', orderNostrEventId]],
    content: 'cancel',
  }
}

/**
 * Build a signed event for position close actions — a generic Kind 1 with a
 * structured content tag so the backend can authenticate the request.
 */
export function buildClosePositionEvent(pubkey: string, positionId: string) {
  return {
    kind: 1,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['action', 'close_position'], ['position_id', positionId]],
    content: `close:${positionId}`,
  }
}

// Nostr relay constants for orderbook subscription
export const DEX_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
]
