"""
Configuration for Bitcoin Bank on Lightning + Nostr.

Set via environment variables or .env file.
"""

import os
from pathlib import Path

# Base
BASE_DIR = Path(__file__).parent.resolve()
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

# CORS - allowed origins for frontend (comma-separated)
# Default: localhost for dev. In production, add your Fleek URL or custom domain.
_DEFAULT_CORS = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", _DEFAULT_CORS).split(",")
    if origin.strip()
]

# LNURL - Bank identity for deposits (NIP-57 style)
# These endpoints are exposed at BASE_URL
BASE_URL = os.getenv("BASE_URL", "http://localhost:8080")
LNURLP_USERNAME = os.getenv("LNURLP_USERNAME", "bank")

# Nostr - Bank's identity (signs Kind 9735 receipts and Kind 30078 balance updates)
# Generate with: python -c "from nostr.key import PrivateKey; k = PrivateKey(); print('nsec:', k.bech32(), 'npub:', k.public_key.bech32())"
BANK_NOSTR_PRIVATE_KEY = os.getenv("BANK_NOSTR_PRIVATE_KEY", "")
BANK_NOSTR_PUBKEY = os.getenv("BANK_NOSTR_PUBKEY", "")

# Relays for publishing Kind 9735 and Kind 30078
NOSTR_RELAYS = [
    r.strip()
    for r in os.getenv("NOSTR_RELAYS", "wss://relay.damus.io,wss://nos.lol").split(",")
    if r.strip()
]

# Ledger
LEDGER_DB_PATH = os.getenv("LEDGER_DB_PATH", str(BASE_DIR / "data" / "ledger.db"))

# Lightning backend: "mock" | "lnbits"
LIGHTNING_BACKEND = os.getenv("LIGHTNING_BACKEND", "mock")

# LNbits (when LIGHTNING_BACKEND=lnbits)
LNBITS_URL = os.getenv("LNBITS_URL", "https://legend.lnbits.com")
LNBITS_INVOICE_KEY = os.getenv("LNBITS_INVOICE_KEY", "")  # Admin key or invoice key
LNBITS_WEBHOOK_SECRET = os.getenv("LNBITS_WEBHOOK_SECRET", "")

# Deposit limits (millisatoshis)
MIN_DEPOSIT_MSATS = int(os.getenv("MIN_DEPOSIT_MSATS", "1000"))
MAX_DEPOSIT_MSATS = int(os.getenv("MAX_DEPOSIT_MSATS", "100000000"))

# Dev only: skip auth challenge when ?simulate=1 (for curl-based testing)
DEV_SKIP_AUTH = os.getenv("DEV_SKIP_AUTH", "false").lower() == "true"

# Savings (optional APY for display; actual yield from routing fees or manual pool)
SAVINGS_APY = float(os.getenv("SAVINGS_APY", "0"))

# Yield distribution (savings earn yield from Lightning routing fees or operator subsidy)
YIELD_SOURCE = os.getenv("YIELD_SOURCE", "manual")  # "manual" | "node"
YIELD_POOL_MSATS = int(os.getenv("YIELD_POOL_MSATS", "0"))  # Manual top-up for testing/operator subsidy
YIELD_MAX_PER_RUN_MSATS = int(os.getenv("YIELD_MAX_PER_RUN_MSATS", "1000000"))  # Cap per run
YIELD_LAST_RUN_PATH = os.getenv("YIELD_LAST_RUN_PATH", str(BASE_DIR / "data" / "yield_last_run.txt"))

# Greenlight (when YIELD_SOURCE=node) - device cert/key for node gRPC
GREENLIGHT_DEVICE_CERT_PATH = os.getenv("GREENLIGHT_DEVICE_CERT_PATH", "")
GREENLIGHT_DEVICE_KEY_PATH = os.getenv("GREENLIGHT_DEVICE_KEY_PATH", "")
GREENLIGHT_NETWORK = os.getenv("GREENLIGHT_NETWORK", "mainnet")  # mainnet | signet | testnet

# LSP (Lightning Service Provider) - for JIT channels when using Greenlight as funding source
# Use Greenlight + Breez LSP as LNbits funding source for zero-conf inbound capacity
# See README LSP Setup section
LSP_ENABLED = os.getenv("LSP_ENABLED", "false").lower() == "true"

# NWC (Nostr Wallet Connect) - relay listener for wallet app withdrawals
NWC_ENABLED = os.getenv("NWC_ENABLED", "false").lower() == "true"
NWC_RELAYS = [
    r.strip()
    for r in os.getenv("NWC_RELAYS", "wss://relay.damus.io,wss://nos.lol").split(",")
    if r.strip()
]
