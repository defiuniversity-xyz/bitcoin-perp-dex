import { useEffect, useRef } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type Time,
  ColorType,
} from 'lightweight-charts'
import { useEffect as useEffectPoll, useState } from 'react'
import { getOHLCV } from '../lib/futures-api'
import { useMarketStore } from '../stores/useMarketStore'
import { usePositionStore } from '../stores/usePositionStore'

interface Props {
  symbol: string
}

export function PriceChart({ symbol }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const markLineRef = useRef<ISeriesApi<'Line'> | null>(null)
  const liqLineRef = useRef<ISeriesApi<'Line'> | null>(null)

  const markPrice = useMarketStore((s) => s.markets[symbol]?.mark_price_usd)
  const positions = usePositionStore((s) => s.positions.filter((p) => p.market === symbol))
  const liqPrice = positions.length > 0 ? positions[0].liquidation_price_usd : null

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f1629' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1e2d4a' },
        horzLines: { color: '#1e2d4a' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#1e2d4a' },
      timeScale: { borderColor: '#1e2d4a', timeVisible: true },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    })

    chartRef.current = chart

    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor: '#22C55E',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#22C55E',
      wickDownColor: '#EF4444',
    })

    markLineRef.current = chart.addLineSeries({
      color: '#F7931A',
      lineWidth: 1,
      lineStyle: 2,
      title: 'Mark',
    })

    liqLineRef.current = chart.addLineSeries({
      color: '#EF4444',
      lineWidth: 1,
      lineStyle: 3,
      title: 'Liq.',
    })

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [])

  // Poll OHLCV data
  useEffectPoll(() => {
    let mounted = true
    const load = async () => {
      if (!candleSeriesRef.current) return
      try {
        const since = Math.floor(Date.now() / 1000) - 86400 * 3
        const candles = await getOHLCV(symbol, since, 300)
        if (!mounted || !candles.length) return
        const data: CandlestickData[] = candles
          .filter((c) => c.open && c.high && c.low && c.close)
          .map((c) => ({
            time: c.bucket as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        candleSeriesRef.current.setData(data)
      } catch {
        // No data yet
      }
    }
    load()
    const id = setInterval(load, 5000)
    return () => { mounted = false; clearInterval(id) }
  }, [symbol])

  // Update mark price line
  useEffect(() => {
    if (!markLineRef.current || !markPrice) return
    const time = Math.floor(Date.now() / 1000) as Time
    markLineRef.current.update({ time, value: markPrice } as LineData)
  }, [markPrice])

  // Update liquidation price line
  useEffect(() => {
    if (!liqLineRef.current) return
    if (liqPrice) {
      const time = Math.floor(Date.now() / 1000) as Time
      liqLineRef.current.update({ time, value: liqPrice } as LineData)
    }
  }, [liqPrice])

  return (
    <div className="w-full h-full relative">
      {!markPrice && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm z-10">
          Waiting for price data…
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
