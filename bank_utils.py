"""Shared bank utilities to avoid circular imports."""

import config
from ledger import get_balance_msats, get_savings_balance_msats, get_recent_transactions
from nostr_utils import create_balance_event_30078
from nostr_publisher import publish_event_async

_bank_key = None


def _get_or_create_bank_key():
    """Get or create bank's PrivateKey."""
    global _bank_key
    if config.BANK_NOSTR_PRIVATE_KEY:
        from nostr.key import PrivateKey
        return PrivateKey(raw_secret=bytes.fromhex(config.BANK_NOSTR_PRIVATE_KEY))
    if _bank_key is None:
        from nostr.key import PrivateKey
        _bank_key = PrivateKey()
    return _bank_key


def get_bank_private_key_hex() -> str:
    """Get bank's private key hex."""
    return _get_or_create_bank_key().hex()


def get_bank_pubkey() -> str:
    """Get bank's public key hex."""
    if config.BANK_NOSTR_PUBKEY:
        return config.BANK_NOSTR_PUBKEY
    return _get_or_create_bank_key().public_key.hex()


def publish_balance_update(pubkey: str) -> None:
    """Publish Kind 30078 balance update to Nostr relays."""
    bank_key_hex = get_bank_private_key_hex()
    balance = get_balance_msats(pubkey)
    savings = get_savings_balance_msats(pubkey)
    txns = get_recent_transactions(pubkey, limit=10)
    txn_summary = [
        {"type": t["type"], "amount_msats": t["amount_msats"], "created_at": t["created_at"]}
        for t in txns
    ]
    try:
        ev = create_balance_event_30078(
            pubkey=pubkey,
            balance_msats=balance,
            transactions_summary=txn_summary,
            bank_private_key_hex=bank_key_hex,
            savings_msats=savings,
            savings_apy=config.SAVINGS_APY,
        )
        publish_event_async(ev)
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Failed to publish balance event")
