# Bitcoin Bank on Lightning + Nostr

Phase 1 MVP implementation of a Lightning-powered Bitcoin "bank" using Nostr for identity and state.

## Features

- **LNURL deposit** (NIP-57 style): Users zap to deposit; invoices are cryptographically bound to Zap Requests
- **Internal ledger**: SQLite-backed authoritative balance and transaction history
- **Withdrawals**: REST API to pay invoices from account balance
- **Kind 30078 publishing**: Balance and statement updates published to Nostr relays

## Quick Start

### 1. Install dependencies

```bash
cd bitcoin-bank-nostr
pip install -r requirements.txt
```

### 2. Run the server

```bash
python app.py
```

Runs on http://localhost:8080 by default.

### 3. Test with Mock Backend

The default backend is `mock` (no real Lightning node required):

**Deposit flow:**
1. GET `http://localhost:8080/.well-known/lnurlp/bank` — returns LNURL-pay config
2. GET `http://localhost:8080/lnurlp/callback?amount=10000&nostr=<9734_event>` — returns invoice
3. GET `http://localhost:8080/api/pending-deposits` — list pending payment_hashes
4. POST `http://localhost:8080/api/simulate-payment` with `{"payment_hash": "..."}` — credit the deposit

**Withdraw (simulate):** Set `DEV_SKIP_AUTH=true` to bypass auth for curl testing:
```bash
DEV_SKIP_AUTH=true python app.py &
curl -X POST "http://localhost:8080/api/withdraw?simulate=1" \
  -H "Content-Type: application/json" \
  -d '{"pubkey":"YOUR_PUBKEY_HEX","invoice":"lnbc1...","amount_msats":5000}'
```

## Configuration

Set via environment variables or `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | http://localhost:8080 | Base URL for LNURL callbacks |
| `CORS_ORIGINS` | localhost:5173, localhost:3000, 127.0.0.1:5173, 127.0.0.1:3000 | Comma-separated allowed origins (add Fleek `.tmnl.co` URL for production) |
| `LNURLP_USERNAME` | bank | LNURL-pay username |
| `BANK_NOSTR_PRIVATE_KEY` | (generated) | Hex private key for signing receipts |
| `BANK_NOSTR_PUBKEY` | (derived) | Bank's Nostr pubkey |
| `NOSTR_RELAYS` | wss://relay.damus.io,wss://nos.lol | Relays for publishing |
| `LEDGER_DB_PATH` | data/ledger.db | SQLite database path |
| `LIGHTNING_BACKEND` | mock | `mock` or `lnbits` |
| `LNBITS_URL` | https://legend.lnbits.com | LNbits URL (when backend=lnbits) |
| `LNBITS_INVOICE_KEY` | | LNbits API key (Invoice/Admin key from wallet) |
| `MIN_DEPOSIT_MSATS` | 1000 | Minimum deposit |
| `MAX_DEPOSIT_MSATS` | 100000000 | Maximum deposit |
| `DEV_SKIP_AUTH` | false | When true and `?simulate=1` with mock backend, skip `signed_challenge` for curl testing |
| `SAVINGS_APY` | 0 | Display APY for savings (e.g. 5.0 for 5%); actual yield from routing fees or manual pool |
| `YIELD_SOURCE` | manual | `manual` or `node` — source of yield for savers |
| `YIELD_POOL_MSATS` | 0 | Manual top-up in msats for testing or operator subsidy (used when manual or added to node fees) |
| `YIELD_MAX_PER_RUN_MSATS` | 1000000 | Cap on yield distributed per run |
| `YIELD_LAST_RUN_PATH` | data/yield_last_run.txt | File storing last distribution timestamp |
| `GREENLIGHT_DEVICE_CERT_PATH` | | Path to Greenlight device cert (when YIELD_SOURCE=node) |
| `GREENLIGHT_DEVICE_KEY_PATH` | | Path to Greenlight device key (when YIELD_SOURCE=node) |
| `GREENLIGHT_NETWORK` | mainnet | mainnet, signet, or testnet for Greenlight |
| `LSP_ENABLED` | false | Set true when LNbits funding source uses LSP (Greenlight/Breez) for JIT channels |
| `NWC_ENABLED` | false | Enable NWC relay listener for wallet app withdrawals (Zeus, etc.) |
| `NWC_RELAYS` | same as NOSTR_RELAYS | Relays for NWC subscription |

### LNbits Production Setup

When using `LIGHTNING_BACKEND=lnbits` for real Lightning deposits:

1. **Create an LNbits wallet**
   - Go to [https://legend.lnbits.com](https://legend.lnbits.com) or your self-hosted LNbits
   - Create a new wallet (or use an existing one)

2. **Get the Invoice/API key**
   - Open the wallet → **API Info** (or **Service** / **Invoice** extension)
   - Copy the **Invoice** or **Admin** API key
   - Set `LNBITS_INVOICE_KEY` in your environment or `.env`

3. **Configure the webhook**
   - LNbits sends a POST request when an invoice is paid
   - Webhook URL: `{BASE_URL}/api/webhook/lightning`
   - Example: if `BASE_URL=https://your-bank.example.com`, webhook = `https://your-bank.example.com/api/webhook/lightning`
   - In LNbits: open your wallet → **Settings** / **Webhooks** → add the webhook URL
   - The bank must be publicly reachable so LNbits can POST to it

4. **Verify deposit flow**
   - Start the bank with `LIGHTNING_BACKEND=lnbits`
   - Use the frontend or LNURL flow to create a deposit invoice
   - Pay with a real Lightning wallet
   - LNbits will POST `payment_hash` to your webhook; the bank credits the ledger

### LSP Integration (JIT Channels)

For "install app and receive immediately" — new users with no inbound capacity can still receive deposits when your Lightning node uses an LSP (Lightning Service Provider) for JIT (Just-In-Time) channels.

**Setup options:**

1. **Greenlight + Breez LSP as LNbits funding source**
   - Use [Blockstream Greenlight](https://greenlight.blockstream.com) with Breez LSP for your node
   - Connect Greenlight as the funding source for LNbits (replacing LND/CLN)
   - When a payment targets your node and you lack inbound capacity, the LSP opens a zero-conf channel and forwards the payment

2. **Configuration**
   - Set `LSP_ENABLED=true` when using an LSP-backed node
   - No code changes required — the bank uses LNbits; JIT is handled by your node's funding source

**Reference:** [Breez LSP documentation](https://sdk-doc-greenlight.breez.technology/guide/connecting_lsp.html), [Nostr & Lightning Deep Dive](NOSTR/Nostr%20%26%20Lightning%20Deep%20Dive.txt)

### Savings Yield

Savings can earn yield from:

1. **Node routing fees** (`YIELD_SOURCE=node`): When the bank's Lightning node (Greenlight/CLN) forwards payments, it earns routing fees. The bank fetches these via `listforwards` and distributes them pro-rata to savers daily.

2. **Operator subsidy** (`YIELD_SOURCE=manual`, `YIELD_POOL_MSATS`): For testing or marketing, the operator can fund a fixed amount per run.

**Prerequisites for node yield:**
- Greenlight node provisioned as LNbits funding source
- Breez LSP (or similar) for JIT inbound capacity
- Device credentials (cert + key) from Greenlight registration
- `gl-client` and `pyln-grpc-proto` Python packages

**Expected yield:** Routing fees are a small % of forwarded volume. Typical 0.1–2% APY depending on node traffic. Use `YIELD_POOL_MSATS` for fixed APY in testing.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/lnurlp/<user>` | GET | LNURL-pay config (NIP-57) |
| `/lnurlp/callback` | GET | Create invoice for deposit |
| `/api/webhook/lightning` | POST | LNbits payment webhook |
| `/api/challenge` | GET | Auth challenge for withdraw (`?pubkey=hex`) |
| `/api/simulate-payment` | POST | Mock: mark invoice paid |
| `/api/pending-deposits` | GET | Mock: list pending |
| `/api/withdraw` | POST | Pay invoice from balance (requires `signed_challenge` from `/api/challenge`). Frontend supports BOLT11 or Lightning Address (user@domain). |
| `/api/transfer` | POST | Internal transfer between accounts. Request: `{"signed_event": <Nostr Kind 33194>}` with content `{"to_pubkey":"hex","amount_msats":N}`. |
| `/api/savings/add` | POST | Move sats from spendable to savings. Request: `{pubkey, amount_msats, signed_challenge}`. |
| `/api/savings/remove` | POST | Move sats from savings to spendable. Request: `{pubkey, amount_msats, signed_challenge}`. |
| `/api/nwc/connect` | POST | Create NWC connection for wallet apps. Request: `{pubkey, signed_challenge}`. Returns `{connection_uri}` to scan in Zeus, etc. |
| `/api/balance/<pubkey>` | GET | Get balance (returns `balance_msats`, `savings_msats`, `savings_apy`) |
| `/api/transactions/<pubkey>` | GET | Get recent transactions |
| `/api/yield/stats` | GET | Yield distribution stats (total_distributed_msats, last_run, saver_count) |
| `/health` | GET | Health check |

## Architecture

```
Nostr (identity + state)     Lightning (value)
       |                            |
   Kind 9734 Zap Request  -->  LNURL callback
   Kind 9735 Zap Receipt   <--  Invoice paid
   Kind 30078 Balance     <--  Ledger update
       |
   SQLite Ledger (source of truth)
```

## Frontend UI

A React app is in `frontend/`:

```bash
cd frontend
npm install
npm run dev
```

Runs at http://localhost:5173. Configure Vite proxy (see `vite.config.ts`) to point at the backend. With the backend on 8080, the proxy forwards `/api` and `/.well-known`, `/lnurlp` to it.

**Requirements:**
- Nostr extension (nos2x, Alby, etc.) for NIP-07
- Lightning wallet with WebLN (Alby, etc.) for deposits

**Testing:** See [docs/TESTING.md](docs/TESTING.md) for unit tests, E2E tests, and manual testing checklist.

### NWC (Nostr Wallet Connect)

When `NWC_ENABLED=true`, wallet apps (Zeus, Phoenix, etc.) can withdraw via NWC instead of the web UI:

1. User connects Nostr in web UI, clicks "Connect NWC"
2. Signs challenge, receives `connection_uri` (e.g. `nostr+walletconnect://...`)
3. Scans QR or pastes into wallet app
4. Wallet app can then `pay_invoice` from the bank balance via Nostr relay

The bank subscribes to Kind 23194 on `NWC_RELAYS`, decrypts with NIP-04, maps client to user, executes pay_invoice, publishes Kind 23195 response.

### Custom Relay (Khatru)

For faster balance sync and reduced dependency on public relays, deploy a bank-specific relay:

1. **Deploy Khatru** or [strfry](https://github.com/hoytech/strfry)
   - [Khatru](https://github.com/nostr-protocol/khatru): Go relay with flexible filters
   - Run for Kind 30078 (balance), 9735 (zap receipts); optionally restrict to bank pubkey

2. **Configure the bank**
   - Add your relay to `NOSTR_RELAYS`: `NOSTR_RELAYS=wss://your-relay.example.com,wss://relay.damus.io,wss://nos.lol`
   - The bank publishes Kind 30078 and 9735 to all listed relays

3. **Optional: Paid entry**
   - Khatru supports NIP-42 auth and payment for write access
   - Use for rate limiting or monetization

4. **Frontend**
   - If the frontend subscribes to balance events, add the custom relay to its relay list for lower latency
