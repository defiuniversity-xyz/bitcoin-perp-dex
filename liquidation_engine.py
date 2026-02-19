"""
Liquidation engine.

Runs every 60 seconds. For every open position:
  1. Compute current margin ratio using mark price
  2. If margin_ratio < MAINTENANCE_MARGIN_PCT → trigger liquidation
  3. Close position at mark price, settle PnL
  4. Remaining collateral (if any) goes back to user, deficit drawn from insurance fund
  5. Liquidation fee credited to insurance fund
"""

import logging
import time

import config
import futures_ledger as ledger
from price_oracle import get_mark_price
from futures_engine import (
    calc_unrealized_pnl_msats,
    calc_margin_ratio,
    enrich_position,
)

logger = logging.getLogger(__name__)

LIQUIDATION_FEE_PCT = 0.005  # 0.5% of notional taken as liquidation fee


def check_and_liquidate_position(pos: dict) -> bool:
    """
    Check a single position and liquidate if margin ratio is below maintenance.
    Returns True if liquidated.
    """
    mark = get_mark_price(pos["market"])
    if not mark:
        return False

    pnl = calc_unrealized_pnl_msats(pos["side"], pos["size_sats"], pos["entry_price_usd"], mark)
    mr = calc_margin_ratio(pos["collateral_msats"], pnl, pos["size_sats"], mark)

    if mr >= config.MAINTENANCE_MARGIN_PCT:
        return False

    logger.warning(
        "LIQUIDATION: position %s (pubkey=%.8s, market=%s, side=%s, size=%d sats) "
        "margin_ratio=%.4f < maintenance=%.4f mark=%.2f",
        pos["id"], pos["pubkey"], pos["market"], pos["side"],
        pos["size_sats"], mr, config.MAINTENANCE_MARGIN_PCT, mark,
    )

    # Settlement
    equity = pos["collateral_msats"] + pnl
    from futures_engine import usd_to_msats, sats_to_usd
    notional_msats = usd_to_msats(sats_to_usd(pos["size_sats"], mark), mark)
    liq_fee = int(notional_msats * LIQUIDATION_FEE_PCT)

    if equity >= liq_fee:
        # User has enough equity to pay the fee
        settlement_to_user = equity - liq_fee
        ledger.credit_insurance_fund(liq_fee)
    elif equity > 0:
        # Equity positive but not enough for full fee; take what's available
        ledger.credit_insurance_fund(equity)
        settlement_to_user = 0
    else:
        # Negative equity (bad debt)
        bad_debt = abs(equity) + liq_fee
        ledger.debit_insurance_fund(bad_debt)
        settlement_to_user = 0

    # Close position
    ledger.close_position(pos["id"])

    # Return remaining collateral to user
    if settlement_to_user > 0:
        ledger.credit_collateral(pos["pubkey"], settlement_to_user)

    logger.info(
        "Liquidated %s: pnl=%d msats, equity=%d msats, settlement=%d msats, fee=%d msats",
        pos["id"], pnl, equity, settlement_to_user, liq_fee,
    )

    # Publish liquidation event (position closed)
    try:
        from futures_nostr import publish_liquidation_event
        publish_liquidation_event(pos, mark, pnl, settlement_to_user)
    except Exception:
        pass

    return True


def run_liquidation_scan():
    """Scan all open positions across all markets for under-margined positions."""
    from futures_engine import MARKETS
    total_liquidated = 0
    for market in MARKETS:
        positions = ledger.get_all_open_positions(market)
        for pos in positions:
            try:
                if check_and_liquidate_position(pos):
                    total_liquidated += 1
            except Exception:
                logger.exception("Error checking position %s", pos.get("id"))

    if total_liquidated:
        logger.info("Liquidation scan: liquidated %d positions", total_liquidated)


def schedule_liquidation_job(scheduler):
    """Register the liquidation scan with an APScheduler instance."""
    scheduler.add_job(
        run_liquidation_scan,
        "interval",
        seconds=60,
        id="liquidation_scan",
        replace_existing=True,
    )
    logger.info("Liquidation scan scheduled every 60 seconds")
