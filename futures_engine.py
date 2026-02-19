"""
Futures matching engine.

Responsibilities:
  - Accept/validate new orders (margin check, collateral reserve)
  - Match limit orders using price-time priority
  - Execute market orders against resting book
  - Open/close/partially-fill positions
  - Calculate unrealized PnL and margin ratio
  - Liquidation price calculation
"""

import logging
import time
import threading
from typing import Optional, List, Tuple

import config
import futures_ledger as ledger
from price_oracle import get_mark_price

logger = logging.getLogger(__name__)

_engine_lock = threading.Lock()

MARKETS = {
    "BTC-USD-PERP": {
        "symbol": "BTC-USD-PERP",
        "base": "BTC",
        "quote": "USD",
        "max_leverage": config.MAX_LEVERAGE,
        "initial_margin_pct": config.INITIAL_MARGIN_PCT,
        "maintenance_margin_pct": config.MAINTENANCE_MARGIN_PCT,
        "maker_fee_pct": config.MAKER_FEE_PCT,
        "taker_fee_pct": config.TAKER_FEE_PCT,
    }
}


# ---------------------------------------------------------------------------
# Margin / PnL helpers
# ---------------------------------------------------------------------------

def sats_to_usd(sats: int, price_usd: float) -> float:
    return (sats / 1e8) * price_usd


def usd_to_msats(usd: float, price_usd: float) -> int:
    return int((usd / price_usd) * 1e11)  # 1e8 sats * 1e3 ms


def sats_to_msats(sats: int) -> int:
    return sats * 1000


def calc_liquidation_price(
    side: str,
    entry_price_usd: float,
    leverage: int,
    maintenance_margin_pct: float = None,
) -> float:
    """
    Long:  liq = entry * (1 - 1/leverage + maintenance_margin_pct)
    Short: liq = entry * (1 + 1/leverage - maintenance_margin_pct)
    """
    mm = maintenance_margin_pct or config.MAINTENANCE_MARGIN_PCT
    if side == "long":
        return entry_price_usd * (1 - (1 / leverage) + mm)
    else:
        return entry_price_usd * (1 + (1 / leverage) - mm)


def calc_unrealized_pnl_msats(
    side: str,
    size_sats: int,
    entry_price_usd: float,
    mark_price_usd: float,
) -> int:
    """Return unrealized PnL in millisatoshis."""
    if side == "long":
        pct = (mark_price_usd - entry_price_usd) / entry_price_usd
    else:
        pct = (entry_price_usd - mark_price_usd) / entry_price_usd
    return int(pct * sats_to_msats(size_sats))


def calc_margin_ratio(
    collateral_msats: int,
    unrealized_pnl_msats: int,
    size_sats: int,
    mark_price_usd: float,
) -> float:
    """
    margin_ratio = (collateral + unrealized_pnl) / notional_value
    where notional_value is in msats.
    """
    notional_msats = usd_to_msats(sats_to_usd(size_sats, mark_price_usd), mark_price_usd)
    if notional_msats <= 0:
        return 0.0
    equity = collateral_msats + unrealized_pnl_msats
    return equity / notional_msats


def enrich_position(pos: dict) -> dict:
    """Add live PnL, margin ratio, and mark price to a position dict."""
    mark = get_mark_price(pos["market"]) or pos["entry_price_usd"]
    pnl = calc_unrealized_pnl_msats(
        pos["side"], pos["size_sats"], pos["entry_price_usd"], mark
    )
    mr = calc_margin_ratio(
        pos["collateral_msats"], pnl, pos["size_sats"], mark
    )
    return {
        **pos,
        "mark_price_usd": mark,
        "unrealized_pnl_msats": pnl,
        "margin_ratio": round(mr, 6),
        "maintenance_margin_pct": config.MAINTENANCE_MARGIN_PCT,
    }


# ---------------------------------------------------------------------------
# Required collateral for an order
# ---------------------------------------------------------------------------

def required_collateral_msats(
    size_sats: int,
    leverage: int,
    price_usd: float,
    fee_pct: float = None,
) -> int:
    """
    initial_margin = notional_value / leverage
    plus taker fee buffer
    """
    fp = fee_pct or config.TAKER_FEE_PCT
    notional_msats = usd_to_msats(sats_to_usd(size_sats, price_usd), price_usd)
    margin = notional_msats // leverage
    fee = int(notional_msats * fp)
    return margin + fee


# ---------------------------------------------------------------------------
# Place order
# ---------------------------------------------------------------------------

def place_order(
    pubkey: str,
    market: str,
    side: str,
    order_type: str,
    size_sats: int,
    leverage: int,
    price_usd: Optional[float] = None,
    nostr_event_id: Optional[str] = None,
) -> Tuple[Optional[dict], Optional[str]]:
    """
    Validate and place a new order. Returns (order, error_message).
    For market orders, immediately attempts matching.
    """
    if market not in MARKETS:
        return None, f"Unknown market: {market}"
    if side not in ("long", "short"):
        return None, "side must be 'long' or 'short'"
    if order_type not in ("limit", "market"):
        return None, "order_type must be 'limit' or 'market'"
    if size_sats <= 0:
        return None, "size_sats must be positive"
    mkt = MARKETS[market]
    if leverage < 1 or leverage > mkt["max_leverage"]:
        return None, f"leverage must be 1–{mkt['max_leverage']}"
    if order_type == "limit" and (price_usd is None or price_usd <= 0):
        return None, "limit order requires price_usd > 0"

    ref_price = price_usd or get_mark_price(market)
    if not ref_price:
        return None, "Cannot determine price — oracle unavailable"

    needed = required_collateral_msats(size_sats, leverage, ref_price, mkt["taker_fee_pct"])
    collateral = ledger.get_collateral_msats(pubkey)
    if collateral < needed:
        return None, (
            f"Insufficient collateral: need {needed} msats, have {collateral} msats"
        )

    with _engine_lock:
        # Reserve collateral
        result = ledger.debit_collateral(pubkey, needed)
        if not result:
            return None, "Failed to reserve collateral"

        order = ledger.create_order(
            pubkey=pubkey,
            market=market,
            side=side,
            order_type=order_type,
            size_sats=size_sats,
            leverage=leverage,
            price_usd=price_usd,
            nostr_event_id=nostr_event_id,
        )

        # Store reserved amount in a side-channel (we'll track it via the order)
        # Immediately attempt matching
        fills = _match_order(order, ref_price)

    return order, None


def cancel_order(
    pubkey: str,
    order_id: str,
) -> Tuple[bool, Optional[str]]:
    """Cancel an open order and return reserved collateral."""
    order = ledger.get_order(order_id)
    if not order:
        return False, "Order not found"
    if order["pubkey"] != pubkey:
        return False, "Not your order"
    if order["status"] != "open":
        return False, f"Order is {order['status']}, cannot cancel"

    mark = get_mark_price(order["market"]) or 1
    remaining_sats = order["size_sats"] - order["filled_size_sats"]
    mkt = MARKETS.get(order["market"], {})
    refund = required_collateral_msats(
        remaining_sats,
        order["leverage"],
        order["price_usd"] or mark,
        mkt.get("taker_fee_pct", config.TAKER_FEE_PCT),
    )
    ledger.update_order_status(order_id, "cancelled")
    ledger.credit_collateral(pubkey, refund)
    return True, None


# ---------------------------------------------------------------------------
# Matching engine (price-time priority)
# ---------------------------------------------------------------------------

def _match_order(taker_order: dict, ref_price: float) -> List[dict]:
    """
    Try to fill taker_order against resting limit orders.
    Returns list of fill dicts.
    """
    from futures_nostr import publish_trade_event, publish_position_event

    market = taker_order["market"]
    taker_side = taker_order["side"]
    fills = []

    # Opposite side resting orders
    maker_side = "short" if taker_side == "long" else "long"
    resting = ledger.get_open_orders_for_market(market, maker_side)

    # Sort: longs buy at highest price first (ascending for asks), shorts sell at lowest price
    if taker_side == "long":
        # taker wants to buy → match against cheapest asks (short limit orders with lowest price)
        resting = sorted(
            [o for o in resting if o["order_type"] == "limit"],
            key=lambda o: (o["price_usd"], o["created_at"]),
        )
    else:
        # taker wants to sell → match against most expensive bids (long limit orders with highest price)
        resting = sorted(
            [o for o in resting if o["order_type"] == "limit"],
            key=lambda o: (-o["price_usd"], o["created_at"]),
        )

    taker_remaining = taker_order["size_sats"] - taker_order["filled_size_sats"]
    taker_price = taker_order["price_usd"] or ref_price

    for maker in resting:
        if taker_remaining <= 0:
            break
        maker_price = maker["price_usd"]

        # Price check
        if taker_side == "long" and taker_order["order_type"] == "limit":
            if taker_price < maker_price:
                break
        elif taker_side == "short" and taker_order["order_type"] == "limit":
            if taker_price > maker_price:
                break

        fill_size = min(taker_remaining, maker["size_sats"] - maker["filled_size_sats"])
        fill_price = maker_price  # maker sets the price

        if fill_size <= 0:
            continue

        # Execute fill
        _execute_fill(
            taker_order=taker_order,
            maker_order=maker,
            fill_size_sats=fill_size,
            fill_price_usd=fill_price,
        )

        taker_remaining -= fill_size
        taker_order["filled_size_sats"] = taker_order["filled_size_sats"] + fill_size
        fills.append({"size_sats": fill_size, "price_usd": fill_price})

    # Mark taker as filled / partially filled
    total_filled = taker_order["size_sats"] - taker_remaining
    if total_filled >= taker_order["size_sats"]:
        ledger.update_order_status(taker_order["id"], "filled", total_filled)
    elif total_filled > 0:
        ledger.update_order_status(taker_order["id"], "partially_filled", total_filled)

    return fills


def _execute_fill(
    taker_order: dict,
    maker_order: dict,
    fill_size_sats: int,
    fill_price_usd: float,
) -> None:
    """
    Execute a single fill between taker and maker.
    Opens positions for both parties and records the trade.
    """
    from futures_nostr import publish_trade_event, publish_position_event

    market = taker_order["market"]
    mkt = MARKETS.get(market, {})
    mm_pct = config.MAINTENANCE_MARGIN_PCT

    # Collateral for each side (already deducted on order placement)
    for order, is_taker in [(taker_order, True), (maker_order, False)]:
        liq_price = calc_liquidation_price(order["side"], fill_price_usd, order["leverage"])
        ref_price = order["price_usd"] or fill_price_usd
        fee_pct = mkt.get("taker_fee_pct" if is_taker else "maker_fee_pct", config.TAKER_FEE_PCT)
        collateral_reserved = required_collateral_msats(
            order["size_sats"], order["leverage"], ref_price, fee_pct
        )
        fill_collateral = int(collateral_reserved * (fill_size_sats / order["size_sats"]))

        pos = ledger.create_position(
            pubkey=order["pubkey"],
            market=market,
            side=order["side"],
            size_sats=fill_size_sats,
            entry_price_usd=fill_price_usd,
            collateral_msats=fill_collateral,
            leverage=order["leverage"],
            liquidation_price_usd=liq_price,
        )
        try:
            publish_position_event(pos)
        except Exception:
            pass

    # Update maker order status
    new_filled = maker_order["filled_size_sats"] + fill_size_sats
    if new_filled >= maker_order["size_sats"]:
        ledger.update_order_status(maker_order["id"], "filled", new_filled)
    else:
        ledger.update_order_status(maker_order["id"], "partially_filled", new_filled)

    # Record the trade
    buyer = taker_order if taker_order["side"] == "long" else maker_order
    seller = taker_order if taker_order["side"] == "short" else maker_order
    trade = ledger.record_trade(
        market=market,
        buyer_pubkey=buyer["pubkey"],
        seller_pubkey=seller["pubkey"],
        size_sats=fill_size_sats,
        price_usd=fill_price_usd,
        buy_order_id=buyer["id"],
        sell_order_id=seller["id"],
    )
    try:
        publish_trade_event(trade)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Close position (market)
# ---------------------------------------------------------------------------

def close_position(
    pubkey: str,
    position_id: str,
) -> Tuple[bool, Optional[str], Optional[dict]]:
    """
    Close a position at mark price. Returns (success, error, pnl_dict).
    """
    pos = ledger.get_position(position_id)
    if not pos:
        return False, "Position not found", None
    if pos["pubkey"] != pubkey:
        return False, "Not your position", None

    mark = get_mark_price(pos["market"])
    if not mark:
        return False, "Oracle unavailable", None

    pnl_msats = calc_unrealized_pnl_msats(
        pos["side"], pos["size_sats"], pos["entry_price_usd"], mark
    )
    # Return collateral +/- PnL
    settlement = pos["collateral_msats"] + pnl_msats
    insurance_draw = 0
    if settlement < 0:
        insurance_draw = abs(settlement)
        ledger.debit_insurance_fund(insurance_draw)
        settlement = 0

    # Credit insurance fund fee on profit (small percentage)
    fee_msats = 0
    if settlement > pos["collateral_msats"]:
        fee_msats = int((settlement - pos["collateral_msats"]) * config.INSURANCE_FUND_FEE_PCT)
        settlement -= fee_msats
        ledger.credit_insurance_fund(fee_msats)

    ledger.close_position(position_id)
    if settlement > 0:
        ledger.credit_collateral(pubkey, settlement)

    return True, None, {
        "position_id": position_id,
        "pnl_msats": pnl_msats,
        "settlement_msats": settlement,
        "mark_price_usd": mark,
        "insurance_draw_msats": insurance_draw,
        "fee_msats": fee_msats,
    }


# ---------------------------------------------------------------------------
# Market stats
# ---------------------------------------------------------------------------

def get_market_stats(market: str) -> dict:
    from futures_ledger import get_latest_funding_rate, get_total_open_interest_sats, get_recent_trades

    mark = get_mark_price(market)
    index = mark
    fr = get_latest_funding_rate(market)
    oi = get_total_open_interest_sats(market)
    trades = get_recent_trades(market, 2)
    change_pct = 0.0
    if len(trades) >= 2:
        change_pct = (trades[0]["price_usd"] - trades[-1]["price_usd"]) / trades[-1]["price_usd"] * 100

    return {
        "market": market,
        "mark_price_usd": mark,
        "index_price_usd": index,
        "funding_rate": fr["rate"] if fr else 0.0,
        "next_funding_in_seconds": _next_funding_seconds(),
        "open_interest_sats": oi,
        "change_24h_pct": round(change_pct, 4),
        **MARKETS.get(market, {}),
    }


def _next_funding_seconds() -> int:
    interval = config.FUNDING_INTERVAL_HOURS * 3600
    now = int(time.time())
    next_ts = (now // interval + 1) * interval
    return next_ts - now
