"""
Yield source: fetches available yield from Lightning node routing fees or manual pool.
"""

import logging
import time
from pathlib import Path
from typing import Tuple

import config

logger = logging.getLogger(__name__)


def _read_last_run() -> int:
    """Return last yield run timestamp (unix seconds). 0 if never run."""
    path = Path(config.YIELD_LAST_RUN_PATH)
    if not path.exists():
        return 0
    try:
        return int(path.read_text().strip())
    except (ValueError, OSError) as e:
        logger.warning("Could not read last run from %s: %s", path, e)
        return 0


def _write_last_run(ts: int) -> None:
    """Persist last yield run timestamp."""
    path = Path(config.YIELD_LAST_RUN_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(str(ts))


def get_last_run() -> int:
    """Public getter for last run timestamp."""
    return _read_last_run()


def set_last_run(ts: int) -> None:
    """Public setter for last run timestamp (called after successful distribution)."""
    _write_last_run(ts)


def _amount_to_msats(amt) -> int:
    """Convert protobuf Amount or numeric to msats integer."""
    if amt is None:
        return 0
    if hasattr(amt, "msat"):
        return int(amt.msat)
    if isinstance(amt, (int, float)):
        return int(amt)
    return 0


def _fetch_node_fees_since(since_ts: int) -> Tuple[int, str]:
    """
    Fetch routing fees from Greenlight node since given timestamp.
    Uses gl-client to connect, calls ListForwards for settled forwards,
    sums fee_msat for forwards resolved after since_ts.
    Returns (fee_total_msats, error_message). error_message is empty on success.
    """
    if not config.GREENLIGHT_DEVICE_CERT_PATH or not config.GREENLIGHT_DEVICE_KEY_PATH:
        return 0, "GREENLIGHT_DEVICE_CERT_PATH and GREENLIGHT_DEVICE_KEY_PATH must be set"

    try:
        from glclient import Scheduler
    except ImportError:
        return 0, "gl-client not installed (pip install gl-client pyln-grpc-proto)"

    cert_path = Path(config.GREENLIGHT_DEVICE_CERT_PATH)
    key_path = Path(config.GREENLIGHT_DEVICE_KEY_PATH)
    if not cert_path.exists() or not key_path.exists():
        return 0, "Greenlight device cert or key file not found"

    try:
        network = config.GREENLIGHT_NETWORK or "mainnet"
        creds = (cert_path.read_bytes(), key_path.read_bytes())
        scheduler = Scheduler.with_remote(
            network=network,
            device_cert=creds[0],
            device_key=creds[1],
        )
        with scheduler.run() as session:
            node = session.node()
            req = _make_listforwards_request()
            if req is None:
                return 0, "pyln-grpc-proto required for ListForwards (pip install pyln-grpc-proto)"
            resp = node.ListForwards(req)
            total_fees = 0
            forwards = getattr(resp, "forwards", []) or []
            for fwd in forwards:
                resolved = getattr(fwd, "resolved_time", None) or getattr(fwd, "received_time", 0)
                if isinstance(resolved, (int, float)) and resolved < since_ts:
                    continue
                fee = getattr(fwd, "fee_msat", None) or getattr(fwd, "fee", None)
                total_fees += _amount_to_msats(fee)
            return total_fees, ""
    except Exception as e:
        logger.exception("Node fee fetch failed: %s", e)
        return 0, str(e)


def _make_listforwards_request():
    """Build ListforwardsRequest for settled forwards."""
    try:
        from cln.grpc.primitives_pb2 import ListforwardsRequest
        from cln.grpc.primitives_pb2 import ListforwardsForwardsStatus
        req = ListforwardsRequest()
        req.status = ListforwardsForwardsStatus.LISTFORWARDS_FORWARDS_STATUS_SETTLED
        return req
    except ImportError:
        return None  # Let node API use default/empty request


def fetch_available_yield() -> Tuple[int, str]:
    """
    Fetch total available yield from configured source (manual or node).
    Returns (amount_msats, error_message).
    Applies YIELD_MAX_PER_RUN_MSATS cap.
    """
    total = 0
    if config.YIELD_SOURCE == "node":
        last_run = _read_last_run()
        fees, err = _fetch_node_fees_since(last_run)
        if err:
            logger.warning("Node fees unavailable: %s; using manual pool only", err)
        else:
            total += fees
    if config.YIELD_POOL_MSATS and config.YIELD_POOL_MSATS > 0:
        total += config.YIELD_POOL_MSATS
    capped = min(total, config.YIELD_MAX_PER_RUN_MSATS)
    return capped, ""
