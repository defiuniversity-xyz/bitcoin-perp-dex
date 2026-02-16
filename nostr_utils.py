"""
Nostr utilities for the Bitcoin Bank.

- Parse and validate Kind 9734 (Zap Request)
- Create Kind 9735 (Zap Receipt)
- Create Kind 30078 (Parameterized Replaceable - balance/statement)
- Event signing and serialization
"""

import hashlib
import json
import logging
import time
from typing import Any, Optional

import config

logger = logging.getLogger(__name__)

# NIP-01 event serialization format for ID/signature
def _serialize_event_for_id(event: dict) -> str:
    """Serialize event for hashing per NIP-01: [0, pubkey, created_at, kind, tags, content]"""
    return json.dumps([
        0,
        event.get("pubkey", ""),
        event.get("created_at", 0),
        event.get("kind", 0),
        event.get("tags", []),
        event.get("content", ""),
    ], separators=(",", ":"))

def event_id(event: dict) -> str:
    """Compute event ID (SHA256 of serialized event)."""
    return hashlib.sha256(_serialize_event_for_id(event).encode()).hexdigest()


def validate_zap_request_9734(event: dict, expected_recipient_pubkey: str) -> Optional[dict]:
    """
    Validate a Kind 9734 Zap Request per NIP-57 Appendix D.
    Returns parsed data if valid, None otherwise.
    """
    if event.get("kind") != 9734:
        return None
    tags = event.get("tags") or []
    if not tags:
        return None
    # Get p tag (recipient)
    p_tags = [t[1] for t in tags if len(t) >= 2 and t[0] == "p"]
    if len(p_tags) != 1 or p_tags[0] != expected_recipient_pubkey:
        return None
    # Amount tag
    amount_tags = [t[1] for t in tags if len(t) >= 2 and t[0] == "amount"]
    amount_msats = int(amount_tags[0]) if amount_tags else 0
    if amount_msats <= 0:
        return None
    # Relays
    relay_tags = [t for t in tags if len(t) >= 2 and t[0] == "relays"]
    relays = relay_tags[0][1:] if relay_tags else []
    return {
        "pubkey": event.get("pubkey"),
        "amount_msats": amount_msats,
        "relays": relays,
        "content": event.get("content", ""),
        "tags": tags,
        "created_at": event.get("created_at"),
    }


def zap_request_description_hash(event: dict) -> bytes:
    """Compute SHA256 of serialized 9734 for BOLT11 description_hash (NIP-57)."""
    return hashlib.sha256(_serialize_event_for_id(event).encode()).digest()


def create_zap_receipt_9735(
    zap_request_event: dict,
    bolt11_invoice: str,
    preimage: str,
    bank_private_key_hex: str,
) -> dict:
    """
    Create Kind 9735 Zap Receipt per NIP-57 Appendix E.
    """
    from nostr.key import PrivateKey
    from nostr.event import Event

    kind = 9735
    tags = []
    for t in zap_request_event.get("tags", []):
        if t[0] in ("p", "e", "a") and len(t) >= 2:
            tags.append(t)
    # P tag = zap sender (from 9734 pubkey)
    tags.append(["P", zap_request_event.get("pubkey", "")])
    tags.append(["bolt11", bolt11_invoice])
    tags.append(["description", _serialize_event_for_id(zap_request_event)])
    tags.append(["preimage", preimage])

    content = ""
    created_at = int(time.time())

    pk = PrivateKey(raw_secret=bytes.fromhex(bank_private_key_hex))
    ev = Event(content=content, public_key=pk.public_key.hex(), kind=kind, tags=tags, created_at=created_at)
    pk.sign_event(ev)
    return {
        "id": ev.id,
        "pubkey": ev.public_key,
        "created_at": ev.created_at,
        "kind": kind,
        "tags": ev.tags,
        "content": ev.content,
        "sig": ev.signature,
    }


def create_balance_event_30078(
    pubkey: str,
    balance_msats: int,
    transactions_summary: list,
    bank_private_key_hex: str,
    savings_msats: int = 0,
    savings_apy: float = 0,
) -> dict:
    """
    Create Kind 30078 (Parameterized Replaceable) for balance/statement.
    d tag: bank/balance/<pubkey>
    """
    from nostr.event import Event
    from nostr.key import PrivateKey

    content_obj = {
        "balance_msats": balance_msats,
        "updated_at": int(time.time()),
        "recent_transactions": transactions_summary[-10:],
    }
    if savings_msats or savings_apy:
        content_obj["savings_msats"] = savings_msats
        if savings_apy:
            content_obj["savings_apy"] = savings_apy
    content = json.dumps(content_obj)
    d_tag = f"bank/balance/{pubkey}"
    tags = [["d", d_tag]]
    kind = 30078
    created_at = int(time.time())

    pk = PrivateKey(raw_secret=bytes.fromhex(bank_private_key_hex))
    ev = Event(content=content, public_key=pk.public_key.hex(), kind=kind, tags=tags, created_at=created_at)
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


def verify_event_signature(event: dict) -> bool:
    """Verify Nostr event signature (NIP-01)."""
    try:
        from nostr.event import Event
        from nostr.key import PublicKey

        ev = Event(
            content=event.get("content", ""),
            public_key=event["pubkey"],
            kind=event["kind"],
            tags=event.get("tags", []),
            created_at=event["created_at"],
        )
        ev.signature = event.get("sig", "")
        pk = PublicKey(bytes.fromhex(event["pubkey"]))
        return pk.verify_signed_message_hash(ev.id, ev.signature)
    except Exception as e:
        logger.warning("Signature verification failed: %s", e)
        return False


def verify_signed_challenge(signed_event: dict, expected_challenge: str, expected_pubkey: str) -> bool:
    """
    Verify that a Nostr event is a valid signed challenge response.
    The event should have kind 1 (or any kind), content == expected_challenge,
    pubkey == expected_pubkey, and a valid signature.
    """
    if not signed_event or not expected_challenge or not expected_pubkey:
        return False
    if signed_event.get("pubkey") != expected_pubkey:
        return False
    if signed_event.get("content") != expected_challenge:
        return False
    return verify_event_signature(signed_event)
