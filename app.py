#!/usr/bin/env python3
"""
Bitcoin Bank on Lightning + Nostr

Flask application implementing Phase 1 MVP:
- LNURL deposit endpoint (NIP-57-style flow)
- Internal ledger (SQLite)
- NWC-based withdrawals
- Basic Kind 30078 balance/statement publishing
"""

import json
import logging
import sys
import time
from datetime import datetime
from urllib.parse import unquote

from flask import Flask, request, jsonify
from flask_cors import CORS

import config
from bank_utils import get_bank_pubkey, get_bank_private_key_hex, publish_balance_update
from ledger import (
    init_db,
    get_or_create_account,
    get_balance_msats,
    get_savings_balance_msats,
    get_all_savers,
    get_total_yield_distributed_msats,
    credit_deposit,
    debit_withdrawal,
    get_recent_transactions,
    transfer_internal,
    savings_add,
    savings_remove,
    nwc_register,
    get_brahma_account,
    create_brahma_account,
)
from lightning import get_lightning_backend, MockLightningBackend
from nostr_utils import (
    validate_zap_request_9734,
    zap_request_description_hash,
    create_zap_receipt_9735,
    verify_event_signature,
    verify_signed_challenge,
)
from nostr_publisher import publish_event_async
from brahma_client import BrahmaClient

brahma_client = BrahmaClient()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, origins=config.CORS_ORIGINS, supports_credentials=True)

# Store pending deposits: payment_hash -> {zap_request, amount_msats, invoice}
# For mock backend we need to look up by payment_hash when webhook/simulate is called
_pending_deposits: dict[str, dict] = {}

# Auth challenges for withdraw: pubkey -> {challenge, expires_at}
_challenges: dict[str, dict] = {}
CHALLENGE_TTL_SECONDS = 300  # 5 minutes


# --- LNURL Pay (NIP-57 style) ---

@app.route("/.well-known/lnurlp/<username>")
def lnurlp_well_known(username):
    """
    LNURL-pay endpoint per LUD-16.
    Returns capability info including allowsNostr and nostrPubkey for NIP-57 Zaps.
    """
    if username != config.LNURLP_USERNAME:
        return jsonify({"status": "ERROR", "reason": "User not found"}), 404

    callback_base = f"{config.BASE_URL.rstrip('/')}/lnurlp/callback"
    return jsonify({
        "callback": callback_base,
        "minSendable": config.MIN_DEPOSIT_MSATS,
        "maxSendable": config.MAX_DEPOSIT_MSATS,
        "metadata": json.dumps([["text/plain", "Bitcoin Bank deposit"]]),
        "tag": "payRequest",
        "allowsNostr": True,
        "nostrPubkey": config.BANK_NOSTR_PUBKEY or get_bank_pubkey(),
    })


@app.route("/lnurlp/callback")
def lnurlp_callback():
    """
    LNURL-pay callback. Receives amount, optional nostr (9734), optional comment.
    Per NIP-57: if nostr is present, validate 9734 and create description_hash invoice.
    """
    amount_msats = request.args.get("amount", type=int)
    if not amount_msats or amount_msats < config.MIN_DEPOSIT_MSATS or amount_msats > config.MAX_DEPOSIT_MSATS:
        return jsonify({"status": "ERROR", "reason": "Invalid amount"}), 400

    nostr_param = request.args.get("nostr")
    zap_request_event = None
    if nostr_param:
        try:
            zap_request_event = json.loads(unquote(nostr_param))
        except Exception as e:
            logger.warning("Failed to parse nostr param: %s", e)
            return jsonify({"status": "ERROR", "reason": "Invalid nostr"}), 400

        expected_pubkey = config.BANK_NOSTR_PUBKEY or get_bank_pubkey()

        parsed = validate_zap_request_9734(zap_request_event, expected_pubkey)
        if not parsed:
            return jsonify({"status": "ERROR", "reason": "Invalid zap request"}), 400
        if parsed["amount_msats"] != amount_msats:
            return jsonify({"status": "ERROR", "reason": "Amount mismatch"}), 400
        if not verify_event_signature(zap_request_event):
            return jsonify({"status": "ERROR", "reason": "Invalid signature"}), 400

    backend = get_lightning_backend()
    description_hash = None
    if zap_request_event:
        description_hash = zap_request_description_hash(zap_request_event)

    try:
        result = backend.create_invoice(
            amount_msats=amount_msats,
            description_hash=description_hash,
            metadata={"zap_request": zap_request_event} if zap_request_event else None,
        )
    except Exception as e:
        logger.exception("Invoice creation failed: %s", e)
        return jsonify({"status": "ERROR", "reason": "Invoice creation failed"}), 500

    payment_hash = result["payment_hash"]
    _pending_deposits[payment_hash] = {
        "amount_msats": amount_msats,
        "zap_request": zap_request_event,
        "invoice": result["invoice"],
    }

    return jsonify({
        "pr": result["invoice"],
        "successAction": {
            "tag": "message",
            "message": "Deposit successful! Check your balance on Nostr.",
        },
    })


# --- Payment webhook (for LNbits) and simulate (for Mock) ---

@app.route("/api/webhook/lightning", methods=["POST"])
def lightning_webhook():
    """LNbits-style webhook: receives payment_hash when invoice is paid."""
    data = request.get_json() or {}
    payment_hash = data.get("payment_hash") or data.get("checking_id")
    if not payment_hash:
        return jsonify({"error": "Missing payment_hash"}), 400

    pending = _pending_deposits.pop(payment_hash, None)
    if not pending:
        logger.warning("Webhook for unknown payment_hash: %s", payment_hash)
        return jsonify({"status": "ignored"}), 200

    _process_deposit(payment_hash, pending)
    return jsonify({"status": "ok"}), 200


@app.route("/api/pending-deposits")
def pending_deposits():
    """List pending deposits (mock backend, dev only)."""
    if config.LIGHTNING_BACKEND != "mock":
        return jsonify({"error": "Only available with mock backend"}), 400
    items = [{"payment_hash": k, "amount_msats": v["amount_msats"]} for k, v in _pending_deposits.items()]
    return jsonify({"pending": items})


@app.route("/api/simulate-payment", methods=["POST"])
def simulate_payment():
    """For Mock backend: mark an invoice as paid (development only)."""
    if config.LIGHTNING_BACKEND != "mock":
        return jsonify({"error": "Only available with mock backend"}), 400

    data = request.get_json() or {}
    payment_hash = data.get("payment_hash")
    if not payment_hash:
        return jsonify({"error": "Missing payment_hash"}), 400

    backend = get_lightning_backend()
    if not isinstance(backend, MockLightningBackend):
        return jsonify({"error": "Not mock backend"}), 400

    if not backend.simulate_payment(payment_hash):
        return jsonify({"error": "Invoice not found"}), 404

    pending = _pending_deposits.pop(payment_hash, None)
    if pending:
        _process_deposit(payment_hash, pending)

    return jsonify({"status": "ok"}), 200


def _process_deposit(payment_hash: str, pending: dict):
    """Credit ledger and publish receipts."""
    amount_msats = pending["amount_msats"]
    zap_request = pending.get("zap_request")

    if zap_request:
        sender_pubkey = zap_request.get("pubkey")
        if not sender_pubkey:
            logger.error("Zap request missing pubkey")
            return
    else:
        sender_pubkey = "anon"
        logger.info("Anonymous deposit - no zap request, crediting to anon")

    tx = credit_deposit(
        pubkey=sender_pubkey,
        amount_msats=amount_msats,
        invoice_id=payment_hash,
        zap_request_id=zap_request.get("id") if zap_request else None,
    )

    bank_key_hex = get_bank_private_key_hex()
    if zap_request:
        try:
            receipt = create_zap_receipt_9735(
                zap_request_event=zap_request,
                bolt11_invoice=pending.get("invoice", ""),
                preimage="mock_preimage",
                bank_private_key_hex=bank_key_hex,
            )
            publish_event_async(receipt)
        except Exception as e:
            logger.exception("Failed to publish zap receipt: %s", e)

    publish_balance_update(sender_pubkey)

    logger.info("Deposit credited: %s +%d msats (tx=%s)", sender_pubkey[:16], amount_msats, tx["tx_id"])


# --- Auth challenge (for withdraw) ---

@app.route("/api/challenge")
def challenge():
    """
    Get a Nostr-signed challenge for withdraw auth.
    Returns {challenge: "bank:timestamp", expires_at: unix_ts}.
    Client signs the challenge string as a Kind 1 event content and sends signed_event in withdraw.
    """
    pubkey = request.args.get("pubkey")
    if not pubkey or len(pubkey) != 64 or not all(c in "0123456789abcdef" for c in pubkey.lower()):
        return jsonify({"error": "Invalid pubkey"}), 400

    now = int(time.time())
    challenge_str = f"bank:{now}"
    _challenges[pubkey] = {"challenge": challenge_str, "expires_at": now + CHALLENGE_TTL_SECONDS}
    return jsonify({"challenge": challenge_str, "expires_at": now + CHALLENGE_TTL_SECONDS})


# --- NWC-style withdrawal (REST API) ---

@app.route("/api/withdraw", methods=["POST"])
def withdraw():
    """
    Withdraw sats by paying an invoice.
    Request: {"invoice": "lnbc1...", "pubkey": "hex", "amount_msats": optional, "signed_challenge": <Nostr event>}
    The signed_challenge must be a Kind 1 event with content = challenge from GET /api/challenge?pubkey=...
    For mock backend, use ?simulate=1 to debit without paying (dev only).
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    invoice = data.get("invoice")
    pubkey = data.get("pubkey")
    amount_msats = data.get("amount_msats")
    signed_challenge = data.get("signed_challenge")
    if not pubkey:
        return jsonify({"error": "Missing pubkey"}), 400

    backend = get_lightning_backend()
    simulate = request.args.get("simulate") == "1" and config.LIGHTNING_BACKEND == "mock"
    skip_auth = simulate and config.DEV_SKIP_AUTH

    # Verify Nostr-signed challenge (prevents impersonation); skip in dev when DEV_SKIP_AUTH=true
    if not skip_auth:
        now = int(time.time())
        stored = _challenges.pop(pubkey, None)
        if not stored:
            return jsonify({"error": "Missing or expired challenge. Call GET /api/challenge?pubkey=..."}), 401
        if stored["expires_at"] < now:
            return jsonify({"error": "Challenge expired"}), 401
        if not signed_challenge:
            return jsonify({"error": "Missing signed_challenge"}), 401
        if not verify_signed_challenge(signed_challenge, stored["challenge"], pubkey):
            return jsonify({"error": "Invalid signature"}), 401

    balance = get_balance_msats(pubkey)
    if balance <= 0:
        return jsonify({"error": "INSUFFICIENT_BALANCE", "message": "Account has no balance"}), 400

    if not simulate and not invoice:
        return jsonify({"error": "Missing invoice"}), 400

    try:
        import hashlib
        inv_hash = hashlib.sha256((invoice or "").encode()).hexdigest()[:32]
    except Exception:
        inv_hash = "simulate"

    if amount_msats is None or amount_msats <= 0:
        try:
            from bolt11 import decode as bolt11_decode
            decoded = bolt11_decode(invoice)
            amount_msats = decoded.amount_msat or 0
        except Exception:
            amount_msats = balance
    if amount_msats > balance:
        return jsonify({"error": "INSUFFICIENT_BALANCE", "message": "Insufficient balance"}), 400

    result = {"preimage": "simulated"}
    if not simulate:
        try:
            result = backend.pay_invoice(invoice)
        except ValueError as e:
            return jsonify({"error": "PAYMENT_FAILED", "message": str(e)}), 400
        except Exception as e:
            logger.exception("Payment failed: %s", e)
            return jsonify({"error": "INTERNAL", "message": "Payment failed"}), 500

    tx = debit_withdrawal(pubkey=pubkey, amount_msats=amount_msats, invoice_id=inv_hash)
    if not tx:
        return jsonify({"error": "INSUFFICIENT_BALANCE", "message": "Insufficient balance"}), 400

    publish_balance_update(pubkey)

    return jsonify({
        "result_type": "pay_invoice",
        "result": {"preimage": result.get("preimage", "")},
        "balance_after_msats": tx["balance_after_msats"],
    })


# --- Internal transfer ---

# Kind 33194 = bank transfer request. Content: JSON {"to_pubkey": "hex", "amount_msats": N}
BANK_TRANSFER_KIND = 33194

_processed_transfer_events: set[str] = set()


@app.route("/api/transfer", methods=["POST"])
def transfer():
    """
    Internal transfer between bank accounts.
    Request: {"signed_event": <Nostr event kind 33194>}
    Event content: JSON {"to_pubkey": "hex", "amount_msats": N}
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    event = data.get("signed_event")
    if not event:
        return jsonify({"error": "Missing signed_event"}), 400

    if event.get("kind") != BANK_TRANSFER_KIND:
        return jsonify({"error": "Invalid event kind"}), 400

    if not verify_event_signature(event):
        return jsonify({"error": "Invalid signature"}), 400

    event_id = event.get("id")
    if event_id in _processed_transfer_events:
        return jsonify({"error": "Already processed", "message": "Transfer already completed"}), 400

    try:
        content = json.loads(event.get("content", "{}"))
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid content"}), 400

    to_pubkey = content.get("to_pubkey")
    amount_msats = content.get("amount_msats")
    if not to_pubkey or not isinstance(amount_msats, (int, float)) or amount_msats <= 0:
        return jsonify({"error": "Invalid content: need to_pubkey and amount_msats"}), 400

    amount_msats = int(amount_msats)
    from_pubkey = event.get("pubkey")

    result = transfer_internal(
        from_pubkey=from_pubkey,
        to_pubkey=to_pubkey,
        amount_msats=amount_msats,
        transfer_id=event_id,
    )
    if not result:
        return jsonify({"error": "INSUFFICIENT_BALANCE", "message": "Insufficient balance"}), 400

    _processed_transfer_events.add(event_id)
    publish_balance_update(from_pubkey)
    publish_balance_update(to_pubkey)

    return jsonify({
        "from_pubkey": from_pubkey,
        "to_pubkey": to_pubkey,
        "amount_msats": amount_msats,
        "from_balance_after_msats": result["from_balance_after"],
        "to_balance_after_msats": result["to_balance_after"],
    })


# --- Savings API ---

def _require_savings_auth(pubkey: str, signed_challenge: dict) -> bool:
    """Verify auth for savings operations; returns True if valid."""
    now = int(time.time())
    stored = _challenges.pop(pubkey, None)
    if not stored or stored["expires_at"] < now or not signed_challenge:
        return False
    return verify_signed_challenge(signed_challenge, stored["challenge"], pubkey)


@app.route("/api/savings/add", methods=["POST"])
def savings_add_endpoint():
    """Move sats from spendable to savings. Request: {pubkey, amount_msats, signed_challenge}"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400
    pubkey = data.get("pubkey")
    amount_msats = data.get("amount_msats")
    signed_challenge = data.get("signed_challenge")
    if not pubkey or not isinstance(amount_msats, (int, float)) or amount_msats <= 0:
        return jsonify({"error": "Missing pubkey or invalid amount_msats"}), 400
    if not _require_savings_auth(pubkey, signed_challenge):
        return jsonify({"error": "Missing or invalid signed_challenge"}), 401
    amount_msats = int(amount_msats)
    result = savings_add(pubkey, amount_msats)
    if not result:
        return jsonify({"error": "INSUFFICIENT_BALANCE", "message": "Insufficient spendable balance"}), 400
    publish_balance_update(pubkey)
    return jsonify({
        "balance_after_msats": result["balance_after_msats"],
        "savings_after_msats": result["savings_after_msats"],
    })


@app.route("/api/savings/remove", methods=["POST"])
def savings_remove_endpoint():
    """Move sats from savings to spendable. Request: {pubkey, amount_msats, signed_challenge}"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400
    pubkey = data.get("pubkey")
    amount_msats = data.get("amount_msats")
    signed_challenge = data.get("signed_challenge")
    if not pubkey or not isinstance(amount_msats, (int, float)) or amount_msats <= 0:
        return jsonify({"error": "Missing pubkey or invalid amount_msats"}), 400
    if not _require_savings_auth(pubkey, signed_challenge):
        return jsonify({"error": "Missing or invalid signed_challenge"}), 401
    amount_msats = int(amount_msats)
    result = savings_remove(pubkey, amount_msats)
    if not result:
        return jsonify({"error": "INSUFFICIENT_SAVINGS", "message": "Insufficient savings balance"}), 400
    publish_balance_update(pubkey)
    return jsonify({
        "balance_after_msats": result["balance_after_msats"],
        "savings_after_msats": result["savings_after_msats"],
    })


# --- Account API ---

@app.route("/api/balance/<pubkey>")
def balance(pubkey):
    """Get balance for a pubkey (spendable + savings)."""
    bal = get_balance_msats(pubkey)
    savings = get_savings_balance_msats(pubkey)
    return jsonify({
        "pubkey": pubkey,
        "balance_msats": bal,
        "savings_msats": savings,
        "savings_apy": config.SAVINGS_APY,
    })


@app.route("/api/transactions/<pubkey>")
def transactions(pubkey):
    """Get recent transactions."""
    limit = request.args.get("limit", 20, type=int)
    limit = min(max(limit, 1), 100)
    txns = get_recent_transactions(pubkey, limit=limit)
    return jsonify({"pubkey": pubkey, "transactions": txns})


# --- Yield stats (optional admin/dashboard) ---

@app.route("/api/yield/stats")
def yield_stats():
    """Return yield distribution stats: total_distributed_msats, last_run, saver_count."""
    from yield_source import get_last_run
    return jsonify({
        "total_distributed_msats": get_total_yield_distributed_msats(),
        "last_run": get_last_run(),
        "saver_count": len(get_all_savers()),
    })


# --- Card / Brahma Console API ---

@app.route("/api/card/status/<pubkey>")
def card_status(pubkey):
    """Get Card/Console status."""
    logger.info(f"Getting card status for {pubkey}")
    account = get_brahma_account(pubkey)
    if not account:
        return jsonify({"has_card": False})
    
    # Fetch live balance from Brahma service
    status = brahma_client.get_console_status(pubkey)
    return jsonify({
        "has_card": True,
        "console_address": account["console_address"],
        "chain_id": account["chain_id"],
        "balance_usdc": status.get("balance", 0),
        "status": status
    })


@app.route("/api/card/apply", methods=["POST"])
def card_apply():
    """Deploy a new Console for the user."""
    data = request.get_json()
    pubkey = data.get("pubkey")
    signed_challenge = data.get("signed_challenge")
    
    if not pubkey or not _require_savings_auth(pubkey, signed_challenge):
        return jsonify({"error": "Auth failed"}), 401

    existing = get_brahma_account(pubkey)
    if existing:
        return jsonify({"error": "Card already exists", "console_address": existing["console_address"]}), 400

    # Call Node.js service
    result = brahma_client.deploy_console(pubkey)
    if result.get("status") != "success":
        return jsonify({"error": "Deployment failed", "details": result}), 500

    console_addr = result["consoleAddress"]
    create_brahma_account(pubkey, console_addr)
    
    return jsonify({
        "status": "success",
        "console_address": console_addr,
        "tx_hash": result.get("txHash")
    })


@app.route("/api/card/topup", methods=["POST"])
def card_topup():
    """Convert BTC to USDC on Card (Mock Bridge)."""
    data = request.get_json()
    pubkey = data.get("pubkey")
    amount_msats = data.get("amount_msats") # Amount to debit from BTC
    signed_challenge = data.get("signed_challenge")

    if not pubkey or not amount_msats or not _require_savings_auth(pubkey, signed_challenge):
        return jsonify({"error": "Auth failed"}), 401

    # Exchange Rate (Mock): 1 sat = 0.0005 USDC ($50k BTC)
    # 1 msat = 0.0000005 USDC
    rate = 0.0000005
    usdc_amount = amount_msats * rate

    # Debit BTC Ledger
    # We reuse debit_withdrawal but with a special invoice_id
    tx = debit_withdrawal(pubkey, amount_msats, f"topup-{int(time.time())}")
    if not tx:
        return jsonify({"error": "Insufficient BTC balance"}), 400

    # Credit Brahma Console (Mock Bridge)
    res = brahma_client.topup_console(pubkey, usdc_amount)
    
    publish_balance_update(pubkey)
    
    return jsonify({
        "status": "success",
        "debited_msats": amount_msats,
        "credited_usdc": usdc_amount,
        "brahma_result": res
    })


@app.route("/api/card/simulate-spend", methods=["POST"])
def card_spend():
    """Simulate a card purchase."""
    data = request.get_json()
    pubkey = data.get("pubkey")
    amount_usdc = data.get("amount_usdc")
    signed_challenge = data.get("signed_challenge")

    if not pubkey or not amount_usdc or not _require_savings_auth(pubkey, signed_challenge):
        return jsonify({"error": "Auth failed"}), 401

    res = brahma_client.simulate_spend(pubkey, amount_usdc)
    if res.get("status") != "success":
         return jsonify({"error": "Spend failed (Insufficient funds?)", "details": res}), 400

    return jsonify({
        "status": "success",
        "spent_usdc": amount_usdc,
        "details": res
    })


# --- Health ---

@app.route("/health")
def health():
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "bitcoin-bank-nostr",
    }), 200


# --- NWC connection ---

@app.route("/api/nwc/connect", methods=["POST"])
def nwc_connect():
    """
    Create NWC connection for wallet apps (Zeus, etc.).
    Request: {pubkey (user), signed_challenge}.
    Returns: {connection_uri: "nostr+walletconnect://..."} for user to scan in wallet app.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400
    pubkey = data.get("pubkey")
    signed_challenge = data.get("signed_challenge")
    if not pubkey or not signed_challenge:
        return jsonify({"error": "Missing pubkey or signed_challenge"}), 400
    now = int(time.time())
    stored = _challenges.pop(pubkey, None)
    if not stored or stored["expires_at"] < now:
        return jsonify({"error": "Missing or expired challenge"}), 401
    if not verify_signed_challenge(signed_challenge, stored["challenge"], pubkey):
        return jsonify({"error": "Invalid signature"}), 401
    import secrets
    from nostr.key import PrivateKey
    secret_hex = secrets.token_hex(32)
    client_pk = PrivateKey(raw_secret=bytes.fromhex(secret_hex))
    client_pubkey = client_pk.public_key.hex()
    nwc_register(client_pubkey, pubkey)
    relay = (config.NWC_RELAYS or config.NOSTR_RELAYS)[0]
    bank_pubkey = get_bank_pubkey()
    from urllib.parse import quote
    connection_uri = f"nostr+walletconnect://{bank_pubkey}?relay={quote(relay)}&secret={secret_hex}"
    return jsonify({"connection_uri": connection_uri})


# --- Init ---

@app.before_request
def before_first_request():
    init_db()


if __name__ == "__main__":
    init_db()
    if config.NWC_ENABLED:
        from nwc_listener import start_nwc_listener
        start_nwc_listener()
    if config.YIELD_SOURCE == "node" or (config.YIELD_POOL_MSATS and config.YIELD_POOL_MSATS > 0):
        from yield_scheduler import start_scheduler
        start_scheduler()
    port = int(__import__("os").environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=config.DEBUG)
