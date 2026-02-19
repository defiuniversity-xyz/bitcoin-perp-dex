# Bitcoin Bank — Slide Deck Script
### 14 Slides · Content-Ready for Keynote / Google Slides / Pitch

---

## Slide 1 — Cover

**Title:** Bitcoin Bank

**Subtitle:** The Lightning-Native Bank Built on Nostr

**Visual Direction:**
Dark background. Bitcoin orange accent. Clean sans-serif type. A single Bitcoin symbol centered — not coin-art, just the ₿ glyph in outline. Below the subtitle, a single line of supporting text.

**Body Text (optional byline):**
Open. Instant. Transparent. Yours.

**Speaker Notes:**
Set the tone immediately. This is not a crypto wallet. This is not a DeFi protocol. This is a bank — with Bitcoin as the monetary layer and Nostr as the identity and transparency layer. The aesthetic should be calm and professional, not speculative.

---

## Slide 2 — The Problem

**Title:** Money Hasn't Kept Up With the Internet

**Body:**

| Pain Point | Today's Reality | The Cost |
|---|---|---|
| Settlement Speed | ACH takes 1–3 business days | Merchants wait; consumers are blocked |
| Transaction Fees | Card networks charge 1.5–3.5% | $120B/year in merchant fees globally |
| Identity | Siloed across thousands of institutions | No portability, no transparency |
| Savings Yield | 0.01–0.5% APY — banks keep the rest | Savers lose to inflation |

**Visual Direction:**
Four rows, icon + pain point per row. Use a desaturated color palette for the "problem" side — grays, muted reds. The contrast with the next slide should feel like turning a light on.

**Speaker Notes:**
These are not crypto problems. These are problems every person with a bank account has, whether they know it or not. We are not pitching a niche to Bitcoin enthusiasts — we are describing a universal frustration. The audience should be nodding.

---

## Slide 3 — What Is Bitcoin Bank?

**Title:** A Bank Built on Open Infrastructure

**Body:**
Bitcoin Bank is a full-featured banking platform powered by the Bitcoin Lightning Network and the Nostr protocol.

**Two Products. One Protocol Stack:**

- **Consumer Banking** — Deposit, save, transfer, withdraw, and spend. Accessible from any Nostr-compatible wallet, anywhere in the world.
- **Business POS** — Accept Lightning payments at the counter. No card reader. No chargebacks. Near-zero fees. Settle to USD or hold BTC.

**Protocol Layer:**
Lightning · Nostr · Strike · Brahma (Base L2)

**Visual Direction:**
Split layout. Left: consumer illustration (phone + Lightning bolt). Right: merchant illustration (POS terminal + QR code). Protocol logos at the bottom as a horizontal row.

**Speaker Notes:**
One product for two markets. The consumer product builds the deposit base; the merchant product creates spending demand. They are connected by the same Lightning rails and the same Nostr identity layer — so a consumer can pay a merchant natively, peer to peer.

---

## Slide 4 — The Consumer Product

**Title:** Banking Features. Bitcoin Rails.

**Body:**

| Feature | How It Works |
|---|---|
| ⚡ Deposit | Scan a QR code. Any Lightning wallet. Instant. |
| 🏦 Savings | Earn yield from Lightning routing fees. Real APY. |
| ↔️ Transfer | Send to any Nostr user by public key. Free. |
| 💸 Withdraw | Pay any Lightning invoice or Lightning Address. |
| 💳 Debit Card | BTC-backed USDC on Base. Spend anywhere. |
| 📱 NWC | Connect Zeus or Phoenix. Manage from your phone. |

**Visual Direction:**
Icon grid, 2×3 layout. Each cell: large icon, feature name, one-line description. Clean, spacious, no clutter. Think Apple product page — each feature deserves a beat.

**Speaker Notes:**
This is the complete feature set a consumer needs to replace their bank account. Deposit, save, transfer, pay bills, spend with a card. Every feature uses open protocols. None require email or password. The user's Nostr key is their identity everywhere.

---

## Slide 5 — Consumer User Journey

**Title:** From Zero to Spending in 4 Steps

**Body:**
```
Step 1: Connect Wallet
    Open app → Click "Connect Nostr" → Sign with nos2x / Alby
    ↓
Step 2: Deposit
    Scan LNURL QR from any Lightning wallet
    → Funds credited instantly
    → Zap receipt published to Nostr relays
    ↓
Step 3: Save
    Move sats to Savings
    → Begins earning routing yield daily
    → Balance event published (Kind 30078)
    ↓
Step 4: Spend
    Top up debit card with BTC → USDC conversion
    → Spend anywhere USDC is accepted
    — OR —
    Send Lightning payment from Zeus via NWC
```

**Visual Direction:**
Vertical flow diagram with four nodes. Each node: step number (large, orange), title (bold), 2-line description. Connecting arrows between nodes. Clean, linear, confident.

**Speaker Notes:**
The entire journey takes under 5 minutes on first use. There is no KYC, no account approval, no email verification. The only credential the user needs is their Nostr private key — which they may already have from using other Nostr apps like Damus, Primal, or Amethyst.

---

## Slide 6 — The Bitcoin Debit Card

**Title:** Your Bitcoin. Spendable Everywhere.

**Body:**

**How It Works:**

1. You hold sats in your Bitcoin Bank account (Lightning balance)
2. You allocate an amount to your debit card
3. The bank converts BTC → USDC at the current market rate
4. USDC is deposited into your personal Brahma Console smart contract on Base (Ethereum L2)
5. Spend with your card — anywhere USDC is accepted

**Key Properties:**
- Non-custodial at the card level — USDC held in *your* smart contract, not a shared pool
- No credit check. No application fee.
- Real-time BTC price conversion
- Simulated spend + top-up via web dashboard

**Visual Direction:**
Clean card mockup on the right. On the left, a 5-step numbered flow (matching the list above). A subtle Base L2 logo and Brahma Console logo in the corner. Bitcoin orange to USDC blue gradient element.

**Speaker Notes:**
This solves the "last mile" problem for Bitcoin holders: how do you actually spend it at a coffee shop? You don't need the merchant to accept Bitcoin. You convert at point-of-spend, not at point-of-sale. The merchant sees a USDC payment; you paid with Bitcoin.

---

## Slide 7 — The Business Product

**Title:** A POS Terminal With No Fees and No Chargebacks

**Body:**

**For Merchants Who Accept Lightning:**

- Connect via **Strike OAuth** — delegates Lightning capabilities without storing credentials
- Enter sale amount on the POS keypad
- Generate a Lightning invoice QR code instantly
- Customer pays with any Lightning wallet
- Settlement confirmed in **< 5 seconds**
- Choose: hold BTC or instant fiat conversion via Strike

**Economics:**
| | Card Terminal | Bitcoin Bank POS |
|---|---|---|
| Merchant fee | 1.5–3.5% | ~$0.001 |
| Chargeback risk | Yes | None |
| Settlement time | 1–3 days | Instant |
| Hardware required | Yes | None |

**Visual Direction:**
Left side: the POS interface (large number display, keypad, QR code area) — clean, minimal UI screenshot or mockup. Right side: the comparison table. Orange highlight on the Bitcoin Bank column.

**Speaker Notes:**
The hardware-free angle is significant. Every retail business already has a phone or tablet. Bitcoin Bank POS runs in a browser. The only thing the merchant needs is a Strike account — which is a simple sign-up process. No card reader lease. No PCI compliance hassle.

---

## Slide 8 — Merchant User Journey

**Title:** Accept Your First Lightning Payment in Minutes

**Body:**
```
Step 1: Connect Strike
    Click "Login with Strike" → OAuth authorization
    → Delegated access granted
    ↓
Step 2: Open POS
    Tap POS terminal in the dashboard
    → Large numeric keypad appears
    ↓
Step 3: Enter Amount
    Type sale amount (e.g., $12.50)
    → Tap "Generate Invoice"
    ↓
Step 4: Customer Pays
    QR code appears on screen
    Customer scans with any Lightning wallet
    ↓
Step 5: Confirmed
    Payment detected via LNbits webhook
    → Sales dashboard updates in real time
    → Merchant balance credited
```

**Visual Direction:**
Horizontal flow (5 stages). Each stage has a small UI screenshot or icon above, and the step description below. Use a subtle progress bar above the stages to show the journey as a linear process.

**Speaker Notes:**
From Strike login to first payment takes under 3 minutes. The entire flow is designed to feel like a payment app, not a crypto product. The merchant doesn't need to understand Lightning — they just need to know that the QR code means "scan to pay."

---

## Slide 9 — The Protocol Stack

**Title:** Built on Open Standards. Not Proprietary Infrastructure.

**Body:**

```
┌─────────────────────────────────────────────────────────┐
│                    Bitcoin Bank                          │
├────────────────┬────────────────┬────────────────────────┤
│   IDENTITY     │    VALUE       │      SPENDING          │
│                │                │                        │
│   Nostr        │   Lightning    │   Brahma Console       │
│   NIP-07       │   BOLT11       │   Base L2 (USDC)       │
│   NIP-47 NWC   │   LNURL LUD-16 │                        │
│   NIP-57 Zaps  │   LNbits       │                        │
│   Kind 30078   │                │                        │
├────────────────┴────────────────┴────────────────────────┤
│                  FIAT BRIDGE                             │
│                  Strike API (OAuth 2.0)                  │
└─────────────────────────────────────────────────────────┘
```

**Speaker Notes:**
Every layer in this stack is an open standard with multiple implementations. Nostr has 50+ clients. Lightning has dozens of node implementations. LNbits is open source. Base is a public L2. Strike is the only proprietary component, and it can be replaced by any Lightning-compatible exchange API. This is not lock-in — it is composability.

---

## Slide 10 — Why Nostr?

**Title:** Identity You Own. State Anyone Can Verify.

**Body:**

**Nostr solves three problems simultaneously:**

**1. Authentication Without Passwords**
Your cryptographic keypair IS your identity. Sign a challenge, prove you're you. No email. No SMS. No 2FA codes. No account recovery emails. Either you have your key or you don't.

**2. Portable Identity**
Your `npub` works across every Nostr app. The same identity you use in a social app (Damus, Primal) works in Bitcoin Bank. Your contacts, your social graph, and your financial history all share one key.

**3. Transparent Financial State**
After every balance change, Bitcoin Bank publishes a signed **Kind 30078** event to Nostr relays. Your balance, savings, APY, and transaction history are publicly queryable. This is not a leak — it's a feature. Your bank cannot hide your balance from you, and you can prove your balance to anyone without asking your bank for a statement.

**Visual Direction:**
Three columns, each with a large icon (🔐 Key, 🌐 Globe, 👁 Eye) and a heading + 3-line description. The word "Nostr" should appear in the orange brand color throughout.

**Speaker Notes:**
The Kind 30078 event is the sleeper feature of this product. It turns balance state from a private data silo into a queryable public record — signed by the bank, owned by the user, readable by any Nostr client. This is the foundation of a transparent banking layer on Nostr.

---

## Slide 11 — Why Lightning?

**Title:** The Payments Network Built for the Internet

**Body:**

**Lightning vs. Everything Else:**

| | ACH/Wire | Card Network | Bitcoin On-chain | Lightning |
|---|---|---|---|---|
| Settlement | 1–3 days | 1–3 days | ~10 minutes | **< 1 second** |
| Cost | $15–25 flat | 1.5–3.5% | $1–50 (variable) | **~$0.001** |
| Reversibility | Yes (fraud risk) | Yes (chargeback risk) | No | **No** |
| Permissionless | No | No | Yes | **Yes** |
| Global | Limited | Limited | Yes | **Yes** |

**One More Thing:**
Lightning payments are cryptographically final. The payment preimage is a proof of payment that can be verified by anyone. There is no dispute process — the math either checks out or it doesn't.

**Visual Direction:**
Comparison table as the centerpiece. Lightning column highlighted in orange. Small Lightning bolt icon in the header. Optional animation: each column fades in left-to-right, then the Lightning column pulses.

**Speaker Notes:**
The key insight here is that Lightning is not just "faster Bitcoin." It is a fundamentally different payment primitive — instant, final, and composable with identity (via Nostr). When you combine instant finality with cryptographic identity, you get something that no existing payment network has: a trustless, instant, global payment system with built-in proof of identity.

---

## Slide 12 — Differentiators

**Title:** What Makes Bitcoin Bank Different

**Body:**

| Capability | Traditional Bank | Crypto Wallet | Bitcoin Bank |
|---|---|---|---|
| Settlement speed | 1–3 days | Varies | **Instant** |
| Merchant fees | 1.5–3.5% | N/A | **~$0.001** |
| Identity layer | Proprietary | Private key only | **Nostr (open, portable)** |
| Savings yield | 0.01–0.5% | None | **Routing fees (real yield)** |
| Financial transparency | None | On-chain ledger | **Nostr events (queryable)** |
| Wallet interoperability | None | Limited | **NWC (open standard)** |
| Debit card | Yes (fiat) | Rare | **Yes (BTC-backed USDC)** |
| Merchant POS | Yes (expensive) | No | **Yes (near-zero fees)** |
| Chargebacks | Yes (risk to merchants) | No | **No** |
| Permissionless | No | Yes | **Yes** |

**Visual Direction:**
Full-width table. Bitcoin Bank column in brand colors (orange header, white rows). Traditional Bank and Crypto Wallet columns in gray. Use ✓ and ✗ icons where appropriate. The contrast should make the Bitcoin Bank column impossible to ignore.

**Speaker Notes:**
This slide is designed for the sophisticated audience member who will push back: "Why not just use a crypto wallet?" or "Why not just use Strike?" The answer is that Bitcoin Bank combines features from both categories that have never existed in the same product: banking features, on an open identity layer, with transparent state, and wallet interoperability.

---

## Slide 13 — Architecture

**Title:** Built to Scale. Built to Be Open.

**Body:**

```
USER LAYER
  Consumer (web/NWC)          Business (POS dashboard)
          │                           │
          └─────────────┬─────────────┘
                        │
              Firebase Hosting (CDN)
              React SPA · TypeScript
                        │
                   REST API
                        │
         ┌──────────────▼──────────────┐
         │     Google Cloud Run        │
         │     Python / Flask          │
         │                             │
         │  LNURL · NWC · NIP-57       │
         │  Savings Yield Scheduler    │
         │  Strike OAuth Client        │
         │  Brahma Node.js Service     │
         └──────┬──────────────┬───────┘
                │              │
    ┌───────────▼──┐    ┌───────▼────────┐
    │  SQLite DB   │    │  Nostr Relays  │
    │  (Cloud      │    │  (balance +    │
    │   Storage)   │    │   zap events)  │
    └──────────────┘    └────────────────┘
                │
    ┌───────────▼──────────────────────┐
    │  External Services               │
    │  LNbits · Strike API · Base L2   │
    └──────────────────────────────────┘
```

**Visual Direction:**
Clean diagram (monospace-style or vector). Three tiers (user, app, data) visually distinct. Use color coding: orange for Bitcoin Bank components, blue for GCP, gray for external services.

**Speaker Notes:**
The architecture is deliberately straightforward: a stateless Flask backend on Cloud Run (scales to zero), a static React frontend on Firebase CDN, and a SQLite ledger synced to Cloud Storage. The simplicity is a feature — it means the entire system can be replicated by any competent developer, audited by anyone, and forked into a federated model.

---

## Slide 14 — Call to Action

**Title:** The Bank Is Open. Come In.

**Body:**

**Try It Now:**
- App: https://bitcoin-bank-defi-u.web.app
- API: https://bitcoin-bank-api-59224607951.us-central1.run.app/health

**Get Started in 3 Steps:**
1. Install a Nostr browser extension (nos2x or Alby — free, 2 minutes)
2. Open the app and connect your Nostr wallet
3. Deposit via any Lightning wallet — your first sats arrive in seconds

**For Developers:**
The backend is a Python/Flask app. The frontend is React/TypeScript/Vite. The protocols are all open standards. Everything is extensible.

**What We're Looking For:**
- Early users: people who want a better Bitcoin bank account
- Merchants: businesses ready to accept Lightning payments
- Builders: developers who want to extend the protocol
- Partners: Lightning node operators, NWC wallet teams, Nostr relay operators

**The Question Isn't Whether Bitcoin Banking Will Exist.**
**The Question Is Whether It Will Be Open.**

**Visual Direction:**
Dark, high-contrast slide. Large orange CTA headline at the bottom. QR code linking to the live app URL. Clean, minimal. The last thing the audience sees should be the URL and the QR code — make it trivially easy to try the product.

**Speaker Notes:**
End with conviction, not a request for permission. Bitcoin Bank is live, deployed, and working. This is not a whitepaper or a roadmap — it is a product that exists and can be used today. The ask is for the audience to try it, not to believe in it.

---

## Appendix: Design Notes

### Color Palette
- **Primary:** Bitcoin Orange `#F7931A`
- **Background:** Near-black `#0D0D0D` or deep navy `#0A0E1A`
- **Text:** White `#FFFFFF`, secondary `#A0A0A0`
- **Accent:** Electric blue `#3B82F6` (for protocol/infra elements)
- **Success:** `#22C55E`

### Typography
- **Headings:** Inter or DM Sans, Bold
- **Body:** Inter or DM Sans, Regular
- **Code/Monospace:** JetBrains Mono or Fira Code

### Slide Dimensions
- Standard 16:9 (1920×1080) or 4:3 (1024×768)
- Keynote: "Wide" preset
- Google Slides: "Widescreen 16:9"
- Pitch.com: Any widescreen template

### Exporting This Deck
Each slide in this document maps directly to one Keynote/Slides slide:
- **Title** → Large heading (H1 style)
- **Body** → Content area (tables render well in both tools)
- **Visual Direction** → Notes to designer or yourself during build
- **Speaker Notes** → Paste into presentation speaker notes field
