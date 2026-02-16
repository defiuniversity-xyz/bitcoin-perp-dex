"""
Yield scheduler: runs daily yield distribution (fetch + distribute).
"""

import logging
import time
from typing import Optional

import config
from yield_distribution import distribute_yield
from yield_source import fetch_available_yield, set_last_run

logger = logging.getLogger(__name__)


def run_yield_job() -> dict:
    """
    Single run: fetch available yield, distribute pro-rata, update last_run.
    Returns dict with success, total_distributed_msats, saver_count, error.
    """
    amount_msats, err = fetch_available_yield()
    if err:
        return {"success": False, "error": err, "total_distributed_msats": 0, "saver_count": 0}
    if amount_msats <= 0:
        logger.info("No yield to distribute")
        return {"success": True, "total_distributed_msats": 0, "saver_count": 0}
    result = distribute_yield(amount_msats)
    set_last_run(int(time.time()))
    logger.info("Yield distributed: %d msats to %d savers", result["total_distributed_msats"], result["saver_count"])
    return {
        "success": True,
        "total_distributed_msats": result["total_distributed_msats"],
        "saver_count": result["saver_count"],
        "credits": result.get("credits", []),
    }


def start_scheduler() -> Optional[object]:
    """
    Start APScheduler with daily yield job at 4 AM UTC.
    Returns scheduler instance or None if disabled.
    """
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
    except ImportError:
        logger.warning("APScheduler not installed; yield job will not run on schedule")
        return None

    sched = BackgroundScheduler()
    sched.add_job(
        run_yield_job,
        "cron",
        hour=4,
        minute=0,
        id="yield_distribution",
    )
    sched.start()
    logger.info("Yield scheduler started (daily 4 AM UTC)")
    return sched
