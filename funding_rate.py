"""
Funding rate scheduler.

Every 8 hours (configurable via FUNDING_INTERVAL_HOURS):
  1. Fetch mark price and index price from the oracle
  2. Compute the funding rate:  rate = clamp((mark - index) / index * 0.0003, -0.0075, 0.0075)
  3. Debit longs / credit shorts (or vice versa) for all open positions
  4. Persist the rate to funding_rates table
  5. Publish Kind 30053 Nostr event
"""

import logging
import time

import config
import futures_ledger as ledger
from price_oracle import get_oracle_data

logger = logging.getLogger(__name__)

FUNDING_FACTOR = 0.0003  # sensitivity multiplier
MAX_RATE = 0.0075         # ±0.75% per 8h cap


def compute_funding_rate(mark_price: float, index_price: float) -> float:
    """
    Premium = (mark - index) / index
    Rate    = clamp(premium * FUNDING_FACTOR, -MAX_RATE, MAX_RATE)
    """
    if index_price <= 0:
        return 0.0
    premium = (mark_price - index_price) / index_price
    rate = premium * FUNDING_FACTOR
    return max(-MAX_RATE, min(MAX_RATE, rate))


def apply_funding_for_market(market: str) -> dict:
    """
    Apply funding payments for all open positions in a market.
    Returns summary dict.
    """
    oracle = get_oracle_data(market)
    mark = oracle.get("mark_price_usd")
    index = oracle.get("index_price_usd")
    if not mark or not index:
        logger.warning("Funding: oracle unavailable for %s, skipping", market)
        return {"market": market, "skipped": True}

    rate = compute_funding_rate(mark, index)
    positions = ledger.get_all_open_positions(market)

    credited = 0
    debited = 0

    for pos in positions:
        # Notional value in msats
        from futures_engine import usd_to_msats, sats_to_usd
        notional_msats = usd_to_msats(sats_to_usd(pos["size_sats"], mark), mark)
        payment_msats = int(abs(rate) * notional_msats)

        if payment_msats == 0:
            continue

        if rate > 0:
            # Positive rate: longs pay shorts
            if pos["side"] == "long":
                new_col = pos["collateral_msats"] - payment_msats
                if new_col < 0:
                    new_col = 0
                ledger.update_position_funding(pos["id"], payment_msats, new_col)
                debited += payment_msats
            else:
                new_col = pos["collateral_msats"] + payment_msats
                ledger.update_position_funding(pos["id"], -payment_msats, new_col)
                credited += payment_msats
        else:
            # Negative rate: shorts pay longs
            if pos["side"] == "short":
                new_col = pos["collateral_msats"] - payment_msats
                if new_col < 0:
                    new_col = 0
                ledger.update_position_funding(pos["id"], payment_msats, new_col)
                debited += payment_msats
            else:
                new_col = pos["collateral_msats"] + payment_msats
                ledger.update_position_funding(pos["id"], -payment_msats, new_col)
                credited += payment_msats

    fr_record = ledger.record_funding_rate(market, rate, mark, index)

    try:
        from futures_nostr import publish_funding_rate_event
        publish_funding_rate_event(fr_record)
    except Exception:
        pass

    logger.info(
        "Funding %s: rate=%.6f, mark=%.2f, index=%.2f, positions=%d, debited=%d msats, credited=%d msats",
        market, rate, mark, index, len(positions), debited, credited,
    )

    return {
        "market": market,
        "rate": rate,
        "mark_price_usd": mark,
        "index_price_usd": index,
        "positions_processed": len(positions),
        "total_debited_msats": debited,
        "total_credited_msats": credited,
        "timestamp": int(time.time()),
    }


def run_funding_job():
    """APScheduler job — runs every FUNDING_INTERVAL_HOURS hours."""
    from futures_engine import MARKETS
    logger.info("Funding rate job started")
    for market in MARKETS:
        try:
            result = apply_funding_for_market(market)
            logger.info("Funding result: %s", result)
        except Exception:
            logger.exception("Funding job failed for market %s", market)


def schedule_funding_job(scheduler):
    """Register the funding rate job with an APScheduler instance."""
    hours = config.FUNDING_INTERVAL_HOURS
    scheduler.add_job(
        run_funding_job,
        "interval",
        hours=hours,
        id="funding_rate_job",
        replace_existing=True,
    )
    logger.info("Funding rate job scheduled every %d hours", hours)
