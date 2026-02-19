"""
Nostr event publisher for the Futures DEX.

Event Kinds:
  30050 — Market Definition       (d = symbol)
  30051 — Order                   (d = order_id)  [user-signed, also relayed by DEX]
  30052 — Position State          (d = pubkey:market)
  30053 — Funding Rate Update     (d = market)
  1050  — Trade Receipt           (regular, immutable)
  30054 — Oracle Price            (d = market)  — published by price_oracle.py
"""

import json
import logging
import time
from typing import Optional

import config
from nostr_publisher import publish_event_async

logger = logging.getLogger(__name__)


def _sign_event(kind: int, tags: list, content: str) -> dict:
    """Sign an event with the bank's key and return the serialized dict."""
    from nostr.event import Event
    from nostr.key import PrivateKey
    from bank_utils import get_bank_private_key_hex

    pk = PrivateKey(raw_secret=bytes.fromhex(get_bank_private_key_hex()))
    ev = Event(
        content=content,
        public_key=pk.public_key.hex(),
        kind=kind,
        tags=tags,
        created_at=int(time.time()),
    )
    pk.sign_event(ev)
    return {
        "id": ev.id,
        "pubkey": ev.public_key,
        "created_at": ev.created_at,
        "kind": kind,
        "tags": tags,
        "content": content,
        "sig": ev.signature,
    }


# ---------------------------------------------------------------------------
# Kind 30050 — Market Definition
# ---------------------------------------------------------------------------

def publish_market_definition(market_config: dict) -> None:
    """Publish the market parameters so anyone can verify DEX rules."""
    symbol = market_config["symbol"]
    tags = [["d", symbol], ["market", symbol]]
    content = json.dumps(market_config)
    try:
        ev = _sign_event(30050, tags, content)
        publish_event_async(ev)
        logger.debug("Published market definition for %s", symbol)
    except Exception:
        logger.exception("Failed to publish market definition for %s", symbol)


def publish_all_markets() -> None:
    """Publish definitions for all supported markets."""
    from futures_engine import MARKETS
    for mkt in MARKETS.values():
        publish_market_definition(mkt)


# ---------------------------------------------------------------------------
# Kind 30051 — Order (relay on behalf of trader after validation)
# ---------------------------------------------------------------------------

def relay_order_event(order: dict, original_nostr_event: Optional[dict] = None) -> None:
    """
    If the user submitted a signed Nostr event, relay it as-is.
    Otherwise publish a DEX-signed summary.
    """
    if original_nostr_event:
        try:
            publish_event_async(original_nostr_event)
        except Exception:
            logger.exception("Failed to relay order event")
        return

    tags = [
        ["d", order["id"]],
        ["market", order["market"]],
        ["side", order["side"]],
        ["type", order["order_type"]],
        ["status", order["status"]],
    ]
    if order.get("price_usd"):
        tags.append(["price", str(order["price_usd"])])
    content = json.dumps({
        "order_id": order["id"],
        "pubkey": order["pubkey"],
        "market": order["market"],
        "side": order["side"],
        "order_type": order["order_type"],
        "size_sats": order["size_sats"],
        "price_usd": order.get("price_usd"),
        "leverage": order["leverage"],
        "status": order["status"],
        "created_at": order["created_at"],
    })
    try:
        ev = _sign_event(30051, tags, content)
        publish_event_async(ev)
    except Exception:
        logger.exception("Failed to publish order event for %s", order["id"])


# ---------------------------------------------------------------------------
# Kind 30052 — Position State
# ---------------------------------------------------------------------------

def publish_position_event(pos: dict) -> None:
    """Publish a user's open position state."""
    d_tag = f"{pos['pubkey']}:{pos['market']}"
    tags = [
        ["d", d_tag],
        ["market", pos["market"]],
        ["side", pos["side"]],
        ["p", pos["pubkey"]],
    ]
    content = json.dumps({
        "position_id": pos["id"],
        "pubkey": pos["pubkey"],
        "market": pos["market"],
        "side": pos["side"],
        "size_sats": pos["size_sats"],
        "entry_price_usd": pos["entry_price_usd"],
        "collateral_msats": pos["collateral_msats"],
        "leverage": pos["leverage"],
        "liquidation_price_usd": pos["liquidation_price_usd"],
        "funding_cost_msats": pos["funding_cost_msats"],
        "created_at": pos["created_at"],
    })
    try:
        ev = _sign_event(30052, tags, content)
        publish_event_async(ev)
    except Exception:
        logger.exception("Failed to publish position event for %s", pos["id"])


# ---------------------------------------------------------------------------
# Kind 30053 — Funding Rate Update
# ---------------------------------------------------------------------------

def publish_funding_rate_event(fr: dict) -> None:
    """Publish the latest funding rate for a market."""
    tags = [
        ["d", fr["market"]],
        ["market", fr["market"]],
    ]
    content = json.dumps({
        "market": fr["market"],
        "rate": fr["rate"],
        "rate_pct": round(fr["rate"] * 100, 6),
        "mark_price_usd": fr["mark_price_usd"],
        "index_price_usd": fr["index_price_usd"],
        "timestamp": fr["timestamp"],
        "interval_hours": config.FUNDING_INTERVAL_HOURS,
    })
    try:
        ev = _sign_event(30053, tags, content)
        publish_event_async(ev)
    except Exception:
        logger.exception("Failed to publish funding rate event")


# ---------------------------------------------------------------------------
# Kind 1050 — Trade Receipt (regular, immutable)
# ---------------------------------------------------------------------------

def publish_trade_event(trade: dict) -> None:
    """Publish an immutable trade receipt."""
    tags = [
        ["market", trade["market"]],
        ["p", trade["buyer_pubkey"]],
        ["p", trade["seller_pubkey"]],
    ]
    if trade.get("buy_order_id"):
        tags.append(["buy_order", trade["buy_order_id"]])
    if trade.get("sell_order_id"):
        tags.append(["sell_order", trade["sell_order_id"]])

    content = json.dumps({
        "trade_id": trade["id"],
        "market": trade["market"],
        "price_usd": trade["price_usd"],
        "size_sats": trade["size_sats"],
        "buyer_pubkey": trade["buyer_pubkey"],
        "seller_pubkey": trade["seller_pubkey"],
        "timestamp": trade["timestamp"],
    })
    try:
        ev = _sign_event(1050, tags, content)
        publish_event_async(ev)
    except Exception:
        logger.exception("Failed to publish trade event %s", trade.get("id"))


# ---------------------------------------------------------------------------
# Liquidation event (Kind 1051 — informational)
# ---------------------------------------------------------------------------

def publish_liquidation_event(
    pos: dict,
    mark_price: float,
    pnl_msats: int,
    settlement_msats: int,
) -> None:
    tags = [
        ["market", pos["market"]],
        ["p", pos["pubkey"]],
    ]
    content = json.dumps({
        "type": "liquidation",
        "position_id": pos["id"],
        "pubkey": pos["pubkey"],
        "market": pos["market"],
        "side": pos["side"],
        "size_sats": pos["size_sats"],
        "entry_price_usd": pos["entry_price_usd"],
        "mark_price_usd": mark_price,
        "pnl_msats": pnl_msats,
        "settlement_msats": settlement_msats,
        "timestamp": int(time.time()),
    })
    try:
        ev = _sign_event(1051, tags, content)
        publish_event_async(ev)
    except Exception:
        logger.exception("Failed to publish liquidation event")
