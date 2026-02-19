"""
Price oracle — fetches BTC/USD index price from Kraken, computes mark price,
and publishes a signed Nostr oracle event (Kind 30054).
"""

import json
import logging
import time
import threading
from typing import Optional

import requests

import config

logger = logging.getLogger(__name__)

_CACHE_TTL = 30  # seconds
_cache: dict = {"price": None, "ts": 0}
_cache_lock = threading.Lock()

KRAKEN_URL = "https://api.kraken.com/0/public/Ticker?pair=XBTUSD"


def _fetch_kraken_price() -> Optional[float]:
    """Fetch the last BTC/USD trade price from Kraken."""
    try:
        resp = requests.get(KRAKEN_URL, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        result = data.get("result", {})
        pair = list(result.keys())[0] if result else None
        if not pair:
            return None
        last_price = float(result[pair]["c"][0])
        return last_price
    except Exception as e:
        logger.warning("Kraken price fetch failed: %s", e)
        return None


def get_index_price(market: str = "BTC-USD-PERP") -> Optional[float]:
    """
    Return cached BTC/USD index price, refreshing if stale.
    Cache TTL is 30 seconds.
    """
    if market != "BTC-USD-PERP":
        return None  # only BTC-USD supported initially

    now = time.time()
    with _cache_lock:
        if _cache["price"] is not None and (now - _cache["ts"]) < _CACHE_TTL:
            return _cache["price"]

    price = _fetch_kraken_price()
    if price:
        with _cache_lock:
            _cache["price"] = price
            _cache["ts"] = now
        logger.debug("Oracle: BTC/USD index price = %.2f", price)
        return price

    # Return stale cache rather than None on failure
    with _cache_lock:
        if _cache["price"] is not None:
            logger.warning("Oracle: returning stale price %.2f", _cache["price"])
            return _cache["price"]
    return None


def get_mark_price(market: str = "BTC-USD-PERP") -> Optional[float]:
    """
    Mark price = index price (no futures basis in MVP).
    In production this would incorporate the order-book mid-price with an EMA.
    """
    return get_index_price(market)


def get_oracle_data(market: str = "BTC-USD-PERP") -> dict:
    """Return a dict with index_price, mark_price, and timestamp."""
    index = get_index_price(market)
    mark = get_mark_price(market)
    return {
        "market": market,
        "index_price_usd": index,
        "mark_price_usd": mark,
        "timestamp": int(time.time()),
    }


def publish_oracle_event(market: str = "BTC-USD-PERP") -> None:
    """
    Publish a signed Nostr Kind 30054 oracle event with the current price.
    Kind 30054 is a parameterized replaceable event (d = market symbol).
    """
    try:
        from nostr.event import Event
        from nostr.key import PrivateKey
        from nostr_publisher import publish_event_async
        from bank_utils import get_bank_private_key_hex

        data = get_oracle_data(market)
        if not data["index_price_usd"]:
            return

        pk = PrivateKey(raw_secret=bytes.fromhex(get_bank_private_key_hex()))
        content = json.dumps(data)
        tags = [["d", market], ["market", market]]
        ev = Event(
            content=content,
            public_key=pk.public_key.hex(),
            kind=30054,
            tags=tags,
            created_at=int(time.time()),
        )
        pk.sign_event(ev)
        event_dict = {
            "id": ev.id,
            "pubkey": ev.public_key,
            "created_at": ev.created_at,
            "kind": 30054,
            "tags": tags,
            "content": content,
            "sig": ev.signature,
        }
        publish_event_async(event_dict)
    except Exception as e:
        logger.warning("Failed to publish oracle event: %s", e)
