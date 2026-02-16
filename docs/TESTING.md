# Bitcoin Bank Testing Guide

## Automated Tests

### Unit Tests (Vitest)

```bash
cd frontend
npm test
```

Runs unit tests for:
- `lnurl.ts` — `isLightningAddress()`, `resolveLightningAddressToInvoice`
- `BalanceDisplay.tsx` — loading, balance rendering
- `TransactionList.tsx` — labels, formatting

### E2E Tests (Playwright)

```bash
cd frontend
npm run test:e2e
```

Uses a mocked Nostr extension and API to test:
- Landing page connect prompt
- Connect flow → dashboard with nav links
- Navigation to Deposit, Withdraw, Transfer pages

**Note:** E2E uses port 5188 by default. Ensure nothing else is running on that port, or the web server will be reused if available.

---

## Manual Testing Checklist

Use this checklist to verify critical flows before release. Requires a Nostr extension (nos2x, Alby) and optionally a WebLN wallet for deposits.

| Flow | Steps | Requires |
|------|-------|----------|
| **Connect** | Click Connect → Approve in Nostr extension | nos2x / Alby |
| **Deposit** | Enter sats → Pay with WebLN | WebLN wallet (Alby) |
| **Withdraw (BOLT11)** | Paste invoice → Sign → Withdraw | Nostr + balance |
| **Withdraw (Lightning Address)** | Enter user@domain + amount → Withdraw | Nostr + balance |
| **Transfer** | Enter npub/hex + amount → Sign → Send | Nostr + recipient |
| **Savings** | Add/Remove sats → Sign | Nostr + balance |
| **NWC Connect** | Click → Sign → Copy/scan URI | Nostr |

### Mock Mode

For testing without real Lightning or Nostr signing:

- **Withdraw (simulate):** Set `DEV_SKIP_AUTH=true` and use `?simulate=1` on the withdraw API
- **Deposit (simulate):** Use `/api/simulate-payment` to credit pending deposits without paying a real invoice

See the main [README](../README.md) for mock flow details.
