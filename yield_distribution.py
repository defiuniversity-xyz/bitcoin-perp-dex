"""
Yield distribution: pro-rata allocation of routing fees (or manual pool) to savers.
"""

import logging
from typing import Any, Dict, List, Tuple

from bank_utils import publish_balance_update
from ledger import get_total_savings_msats, get_all_savers, yield_credit

logger = logging.getLogger(__name__)


def distribute_yield(amount_msats: int) -> Dict[str, Any]:
    """
    Distribute yield pro-rata to all savers.
    Returns dict with saver_count, total_distributed_msats, credits.
    """
    if amount_msats <= 0:
        return {"saver_count": 0, "total_distributed_msats": 0, "credits": []}

    total_savings = get_total_savings_msats()
    if total_savings == 0:
        logger.info("No savers; skipping yield distribution")
        return {"saver_count": 0, "total_distributed_msats": 0, "credits": []}

    savers = get_all_savers()
    if not savers:
        return {"saver_count": 0, "total_distributed_msats": 0, "credits": []}

    # Floor each share to avoid sub-msat; track remainder
    shares: List[Tuple[str, int, int]] = []  # (pubkey, savings, floored_share)
    total_floored = 0
    for pubkey, savings in savers:
        share = (savings * amount_msats) // total_savings
        total_floored += share
        shares.append((pubkey, savings, share))

    remainder = amount_msats - total_floored
    if remainder > 0 and shares:
        # Give remainder to largest saver (by savings balance)
        largest_idx = max(range(len(shares)), key=lambda i: shares[i][1])
        pubkey, savings, share = shares[largest_idx]
        shares[largest_idx] = (pubkey, savings, share + remainder)

    credits = []
    total_distributed = 0
    for pubkey, _, share in shares:
        if share > 0:
            result = yield_credit(pubkey, share)
            if result:
                credits.append({"pubkey": pubkey, "amount_msats": share})
                total_distributed += share
                try:
                    publish_balance_update(pubkey)
                except Exception as e:
                    logger.warning("Failed to publish balance update for %s: %s", pubkey[:16], e)
                logger.info("Yield credited: %s +%d msats", pubkey[:16] + "...", share)

    return {
        "saver_count": len(credits),
        "total_distributed_msats": total_distributed,
        "credits": credits,
    }
