"""
NWC (Nostr Wallet Connect) relay listener.

Subscribes to Kind 23194 on relays where #p = bank pubkey.
Decrypts requests with NIP-04, executes pay_invoice, publishes Kind 23195 response.
"""

import json
import logging
import ssl
import threading
import time

import config
from ledger import get_balance_msats, debit_withdrawal, nwc_lookup_user
from lightning import get_lightning_backend
from nostr_publisher import publish_event_async

logger = logging.getLogger(__name__)

NWC_REQUEST_KIND = 23194
NWC_RESPONSE_KIND = 23195
_processed_request_ids: set[str] = set()


def _get_bank_key():
    """Get bank's private key hex for decryption."""
    from bank_utils import get_bank_private_key_hex
    return get_bank_private_key_hex()


def _decrypt_nwc(encrypted: str, client_pubkey_hex: str) -> dict:
    """Decrypt NWC payload (NIP-04)."""
    from nostr.key import PrivateKey
    pk = PrivateKey(raw_secret=bytes.fromhex(_get_bank_key()))
    plain = pk.decrypt_message(encrypted, client_pubkey_hex)
    return json.loads(plain)


def _encrypt_nwc(payload: dict, client_pubkey_hex: str) -> str:
    """Encrypt NWC response (NIP-04)."""
    from nostr.key import PrivateKey
    pk = PrivateKey(raw_secret=bytes.fromhex(_get_bank_key()))
    return pk.encrypt_message(json.dumps(payload), client_pubkey_hex)


def _create_response_event(
    request_id: str,
    client_pubkey: str,
    result_type: str,
    result: dict = None,
    error: dict = None,
) -> dict:
    """Create Kind 23195 response event."""
    from nostr.event import Event
    from nostr.key import PrivateKey

    payload = {
        "result_type": result_type,
        "result": result,
        "error": error,
    }
    encrypted_content = _encrypt_nwc(payload, client_pubkey)

    pk = PrivateKey(raw_secret=bytes.fromhex(_get_bank_key()))
    tags = [["p", client_pubkey], ["e", request_id]]
    created_at = int(time.time())
    ev = Event(
        public_key=pk.public_key.hex(),
        content=encrypted_content,
        created_at=created_at,
        kind=NWC_RESPONSE_KIND,
        tags=tags,
    )
    pk.sign_event(ev)
    return {
        "id": ev.id,
        "pubkey": ev.public_key,
        "created_at": ev.created_at,
        "kind": NWC_RESPONSE_KIND,
        "tags": ev.tags,
        "content": ev.content,
        "sig": ev.signature,
    }


def _handle_pay_invoice(user_pubkey: str, params: dict) -> tuple[dict | None, dict | None]:
    """Execute pay_invoice. Returns (result, error)."""
    invoice = params.get("invoice")
    if not invoice:
        return None, {"code": "OTHER", "message": "Missing invoice"}
    balance = get_balance_msats(user_pubkey)
    if balance <= 0:
        return None, {"code": "INSUFFICIENT_BALANCE", "message": "No balance"}
    try:
        from bolt11 import decode as bolt11_decode
        decoded = bolt11_decode(invoice)
        amount_msats = decoded.amount_msat or 0
    except Exception:
        amount_msats = balance
    if amount_msats > balance:
        return None, {"code": "INSUFFICIENT_BALANCE", "message": "Insufficient balance"}
    backend = get_lightning_backend()
    try:
        pay_result = backend.pay_invoice(invoice)
    except ValueError as e:
        return None, {"code": "PAYMENT_FAILED", "message": str(e)}
    except Exception as e:
        logger.exception("NWC pay_invoice failed: %s", e)
        return None, {"code": "INTERNAL", "message": "Payment failed"}
    import hashlib
    inv_hash = hashlib.sha256(invoice.encode()).hexdigest()[:32]
    tx = debit_withdrawal(pubkey=user_pubkey, amount_msats=amount_msats, invoice_id=inv_hash)
    if not tx:
        return None, {"code": "INSUFFICIENT_BALANCE", "message": "Debit failed"}
    from bank_utils import publish_balance_update
    publish_balance_update(user_pubkey)
    return {"preimage": pay_result.get("preimage", "")}, None


def _handle_request(event_msg) -> None:
    """Process a single NWC request event."""
    event = event_msg.event
    if event.id in _processed_request_ids:
        return
    client_pubkey = event.public_key
    user_pubkey = nwc_lookup_user(client_pubkey)
    if not user_pubkey:
        logger.warning("NWC: unknown client %s", client_pubkey[:16])
        resp = _create_response_event(
            event.id, client_pubkey, "pay_invoice",
            error={"code": "UNAUTHORIZED", "message": "No wallet connected"}
        )
        publish_event_async(resp)
        _processed_request_ids.add(event.id)
        return
    try:
        payload = _decrypt_nwc(event.content, client_pubkey)
    except Exception as e:
        logger.warning("NWC decrypt failed: %s", e)
        resp = _create_response_event(
            event.id, client_pubkey, "pay_invoice",
            error={"code": "OTHER", "message": "Decrypt failed"}
        )
        publish_event_async(resp)
        _processed_request_ids.add(event.id)
        return
    method = payload.get("method")
    params = payload.get("params", {})
    if method == "pay_invoice":
        result, err = _handle_pay_invoice(user_pubkey, params)
        resp = _create_response_event(
            event.id, client_pubkey, "pay_invoice",
            result=result, error=err
        )
        publish_event_async(resp)
    elif method == "get_balance":
        bal = get_balance_msats(user_pubkey)
        resp = _create_response_event(
            event.id, client_pubkey, "get_balance",
            result={"balance": bal}
        )
        publish_event_async(resp)
    else:
        resp = _create_response_event(
            event.id, client_pubkey, method or "unknown",
            error={"code": "NOT_IMPLEMENTED", "message": f"Method {method} not implemented"}
        )
        publish_event_async(resp)
    _processed_request_ids.add(event.id)


def run_nwc_listener():
    """Background thread: subscribe to Kind 23194, process requests."""
    if not config.NWC_ENABLED:
        return
    from bank_utils import get_bank_pubkey
    bank_pubkey = get_bank_pubkey()
    from nostr.relay_manager import RelayManager
    from nostr.filter import Filter, Filters
    from nostr.event import EventKind

    relay_manager = RelayManager()
    for r in config.NWC_RELAYS:
        relay_manager.add_relay(r)
    relay_manager.add_subscription(
        "nwc-23194",
        Filters([Filter(kinds=[NWC_REQUEST_KIND], pubkey_refs=[bank_pubkey])])
    )
    relay_manager.open_connections({"cert_reqs": ssl.CERT_NONE})
    logger.info("NWC listener started on %s relays for bank %s", len(config.NWC_RELAYS), bank_pubkey[:16])

    while config.NWC_ENABLED:
        try:
            if relay_manager.message_pool.has_events():
                ev_msg = relay_manager.message_pool.get_event()
                if ev_msg.event.kind == NWC_REQUEST_KIND:
                    _handle_request(ev_msg)
            else:
                time.sleep(0.5)
        except Exception as e:
            logger.exception("NWC listener error: %s", e)
            time.sleep(5)


def start_nwc_listener():
    """Start NWC listener in a daemon thread."""
    if not config.NWC_ENABLED:
        return
    t = threading.Thread(target=run_nwc_listener, daemon=True)
    t.start()
    logger.info("NWC listener thread started")
