const BASE = import.meta.env.VITE_API_URL ?? ''

export interface MarketStats {
  market: string
  mark_price_usd: number | null
  index_price_usd: number | null
  funding_rate: number
  next_funding_in_seconds: number
  open_interest_sats: number
  change_24h_pct: number
  max_leverage: number
  initial_margin_pct: number
  maintenance_margin_pct: number
  maker_fee_pct: number
  taker_fee_pct: number
}

export interface OrderBookEntry {
  price_usd: number
  size_sats: number
  side: 'long' | 'short'
}

export interface OrderBook {
  bids: OrderBookEntry[]
  asks: OrderBookEntry[]
}

export interface Order {
  id: string
  pubkey: string
  market: string
  side: 'long' | 'short'
  order_type: 'limit' | 'market'
  size_sats: number
  price_usd: number | null
  leverage: number
  status: string
  filled_size_sats: number
  nostr_event_id: string | null
  created_at: number
  updated_at: number
}

export interface Position {
  id: string
  pubkey: string
  market: string
  side: 'long' | 'short'
  size_sats: number
  entry_price_usd: number
  collateral_msats: number
  leverage: number
  liquidation_price_usd: number
  funding_cost_msats: number
  created_at: number
  updated_at: number
  // Enriched fields from backend
  mark_price_usd?: number
  unrealized_pnl_msats?: number
  margin_ratio?: number
  maintenance_margin_pct?: number
}

export interface Trade {
  id: string
  market: string
  buyer_pubkey: string
  seller_pubkey: string
  size_sats: number
  price_usd: number
  buy_order_id: string | null
  sell_order_id: string | null
  timestamp: number
}

export interface FundingRate {
  id: number
  market: string
  rate: number
  mark_price_usd: number
  index_price_usd: number
  timestamp: number
}

export interface OHLCVCandle {
  bucket: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// Markets
export const getMarkets = () => apiFetch<MarketStats[]>('/api/futures/markets')
export const getMarket = (symbol: string) => apiFetch<MarketStats>(`/api/futures/market/${symbol}`)

// Orderbook
export const getOrderBook = (symbol: string) => apiFetch<OrderBook>(`/api/futures/orderbook/${symbol}`)

// Collateral
export const getCollateral = (pubkey: string) =>
  apiFetch<{ pubkey: string; collateral_msats: number }>(`/api/futures/collateral/${pubkey}`)

export const depositCollateral = (body: {
  pubkey: string
  amount_msats: number
  signed_challenge: object
}) => apiFetch<{ collateral_msats: number }>('/api/futures/collateral/deposit', {
  method: 'POST',
  body: JSON.stringify(body),
})

export const withdrawCollateral = (body: {
  pubkey: string
  amount_msats: number
  signed_challenge: object
}) => apiFetch<{ collateral_msats: number }>('/api/futures/collateral/withdraw', {
  method: 'POST',
  body: JSON.stringify(body),
})

// Orders
export const placeOrder = (nostr_event: object) =>
  apiFetch<Order>('/api/futures/order', { method: 'POST', body: JSON.stringify({ nostr_event }) })

export const cancelOrder = (orderId: string, nostr_event: object) =>
  apiFetch<{ cancelled: string }>(`/api/futures/order/${orderId}`, {
    method: 'DELETE',
    body: JSON.stringify({ nostr_event }),
  })

export const getOrders = (pubkey: string, status = 'open') =>
  apiFetch<Order[]>(`/api/futures/orders/${pubkey}?status=${status}`)

// Positions
export const getPositions = (pubkey: string) =>
  apiFetch<Position[]>(`/api/futures/positions/${pubkey}`)

export const closePosition = (position_id: string, nostr_event: object) =>
  apiFetch<{ pnl_msats: number; settlement_msats: number }>('/api/futures/position/close', {
    method: 'POST',
    body: JSON.stringify({ position_id, nostr_event }),
  })

// Trades & history
export const getTrades = (symbol: string, limit = 50) =>
  apiFetch<Trade[]>(`/api/futures/trades/${symbol}?limit=${limit}`)

export const getFundingHistory = (symbol: string, limit = 48) =>
  apiFetch<FundingRate[]>(`/api/futures/funding/${symbol}?limit=${limit}`)

export const getOHLCV = (symbol: string, since?: number, bucket = 300) => {
  const params = new URLSearchParams({ bucket: String(bucket) })
  if (since) params.set('since', String(since))
  return apiFetch<OHLCVCandle[]>(`/api/futures/ohlcv/${symbol}?${params}`)
}

// Auth challenge (reuses existing bank endpoint)
export const getChallenge = (pubkey: string) =>
  apiFetch<{ challenge: string; expires_at: number }>(`/api/challenge?pubkey=${pubkey}`)
