import { useState } from 'react'
import { toast } from 'sonner'
import { useWalletStore } from '../stores/useWalletStore'
import { useMarketStore } from '../stores/useMarketStore'
import { usePositionStore } from '../stores/usePositionStore'
import { placeOrder } from '../lib/futures-api'
import { buildOrderEvent } from '../lib/nostr-orders'

interface Props {
  symbol: string
}

type Side = 'long' | 'short'
type OrderType = 'limit' | 'market'

export function OrderForm({ symbol }: Props) {
  const { pubkey, collateral_msats, refreshCollateral } = useWalletStore()
  const market = useMarketStore((s) => s.markets[symbol])
  const refreshPositions = usePositionStore((s) => s.fetch)

  const [side, setSide] = useState<Side>('long')
  const [orderType, setOrderType] = useState<OrderType>('limit')
  const [sizeSats, setSizeSats] = useState('')
  const [priceUsd, setPriceUsd] = useState('')
  const [leverage, setLeverage] = useState(5)
  const [isUSD, setIsUSD] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const markPrice = market?.mark_price_usd
  const maxLeverage = market?.max_leverage ?? 20
  const takerFee = market?.taker_fee_pct ?? 0.0005

  const refPrice = orderType === 'market'
    ? (markPrice ?? 0)
    : (parseFloat(priceUsd) || markPrice || 0)

  const sizeInSats = isUSD && refPrice > 0
    ? Math.floor((parseFloat(sizeSats) / refPrice) * 1e8)
    : parseInt(sizeSats) || 0

  const notionalUSD = refPrice > 0 ? (sizeInSats / 1e8) * refPrice * leverage : 0
  const marginNeeded = refPrice > 0 && sizeInSats > 0
    ? Math.ceil((notionalUSD / refPrice * 1e8 * 1000) / leverage + (notionalUSD / refPrice * 1e8 * 1000 * takerFee))
    : 0
  const feeEstUSD = refPrice > 0 ? (sizeInSats / 1e8) * refPrice * leverage * takerFee : 0

  const liqPrice = refPrice > 0 && leverage > 0 && sizeInSats > 0
    ? side === 'long'
      ? refPrice * (1 - 1 / leverage + (market?.maintenance_margin_pct ?? 0.025))
      : refPrice * (1 + 1 / leverage - (market?.maintenance_margin_pct ?? 0.025))
    : null

  const hasEnoughCollateral = marginNeeded > 0 && collateral_msats >= marginNeeded

  const handleSubmit = async () => {
    if (!pubkey) {
      toast.error('Connect your wallet first')
      return
    }
    if (!sizeInSats || sizeInSats <= 0) {
      toast.error('Enter a valid size')
      return
    }
    if (orderType === 'limit' && (!parseFloat(priceUsd) || parseFloat(priceUsd) <= 0)) {
      toast.error('Enter a valid price for limit order')
      return
    }
    if (!hasEnoughCollateral) {
      toast.error('Insufficient collateral')
      return
    }

    const nip07 = (window as Window & { nostr?: { signEvent: (e: object) => Promise<object> } }).nostr
    if (!nip07) {
      toast.error('NIP-07 extension required')
      return
    }

    setIsSubmitting(true)
    try {
      const unsignedEvent = buildOrderEvent(pubkey, {
        market: symbol,
        side,
        order_type: orderType,
        size_sats: sizeInSats,
        price_usd: orderType === 'limit' ? parseFloat(priceUsd) : undefined,
        leverage,
      })
      const signedEvent = await nip07.signEvent(unsignedEvent)
      await placeOrder(signedEvent)
      toast.success(`${side === 'long' ? '↑ Long' : '↓ Short'} order placed`)
      setSizeSats('')
      await Promise.all([refreshCollateral(), pubkey && refreshPositions(pubkey)])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Order failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Side toggle */}
      <div className="grid grid-cols-2 gap-1 bg-navy-900 p-1 rounded-lg">
        <button
          onClick={() => setSide('long')}
          className={`py-2 rounded-md text-sm font-semibold transition-all ${
            side === 'long' ? 'bg-long text-white shadow' : 'text-gray-400 hover:text-long'
          }`}
        >
          ↑ Long
        </button>
        <button
          onClick={() => setSide('short')}
          className={`py-2 rounded-md text-sm font-semibold transition-all ${
            side === 'short' ? 'bg-short text-white shadow' : 'text-gray-400 hover:text-short'
          }`}
        >
          ↓ Short
        </button>
      </div>

      {/* Order type tabs */}
      <div className="flex gap-1">
        {(['limit', 'market'] as OrderType[]).map((t) => (
          <button
            key={t}
            onClick={() => setOrderType(t)}
            className={`tab-btn ${orderType === t ? 'tab-btn-active' : 'tab-btn-inactive'}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Price (limit only) */}
      {orderType === 'limit' && (
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Price (USD)</label>
          <input
            type="number"
            placeholder={markPrice ? fmt(markPrice) : '0.00'}
            value={priceUsd}
            onChange={(e) => setPriceUsd(e.target.value)}
            className="input-field text-sm"
          />
        </div>
      )}

      {/* Size */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-400">Size</label>
          <button
            onClick={() => setIsUSD((v) => !v)}
            className="text-xs text-btc-orange hover:underline"
          >
            {isUSD ? '→ sats' : '→ USD'}
          </button>
        </div>
        <div className="relative">
          <input
            type="number"
            placeholder="0"
            value={sizeSats}
            onChange={(e) => setSizeSats(e.target.value)}
            className="input-field text-sm pr-14"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
            {isUSD ? 'USD' : 'sats'}
          </span>
        </div>
        {sizeInSats > 0 && markPrice && (
          <div className="text-xs text-gray-500 mt-1">
            ≈ ${fmt((sizeInSats / 1e8) * markPrice)} notional · {(sizeInSats).toLocaleString()} sats
          </div>
        )}
      </div>

      {/* Leverage slider */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-400">Leverage</label>
          <span className="text-sm font-semibold text-white">{leverage}×</span>
        </div>
        <input
          type="range"
          min={1}
          max={maxLeverage}
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
          className="w-full accent-btc-orange"
        />
        <div className="flex justify-between text-xs text-gray-600 mt-0.5">
          <span>1×</span>
          <span>{Math.round(maxLeverage / 2)}×</span>
          <span>{maxLeverage}×</span>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-navy-900 rounded-lg p-3 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">Notional</span>
          <span className="font-mono text-white">${fmt(notionalUSD)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Margin required</span>
          <span className={`font-mono ${hasEnoughCollateral || marginNeeded === 0 ? 'text-white' : 'text-short'}`}>
            {marginNeeded.toLocaleString()} msats
          </span>
        </div>
        {liqPrice && (
          <div className="flex justify-between">
            <span className="text-gray-400">Liq. price</span>
            <span className="font-mono text-short">${fmt(liqPrice)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-400">Est. fee</span>
          <span className="font-mono text-gray-300">${fmt(feeEstUSD)}</span>
        </div>
      </div>

      {/* Collateral balance */}
      {pubkey && (
        <div className="text-xs text-gray-500 text-right">
          Available: {Math.floor(collateral_msats / 1000).toLocaleString()} sats
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !pubkey || !sizeInSats || !hasEnoughCollateral}
        className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
          side === 'long'
            ? 'bg-long hover:bg-green-600 disabled:bg-long-dim text-white'
            : 'bg-short hover:bg-red-600 disabled:bg-short-dim text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isSubmitting
          ? 'Placing…'
          : !pubkey
          ? 'Connect Wallet'
          : `${side === 'long' ? '↑ Long' : '↓ Short'} ${symbol}`}
      </button>
    </div>
  )
}
