#!/usr/bin/env python3
"""
Quick integration test for Bitcoin Bank MVP.

Run with: python test_flow.py
Requires the server to be running (python app.py in another terminal),
or run: python test_flow.py --with-server
"""

import argparse
import json
import sys
import threading
import time

import requests


def run_test(base_url: str = "http://localhost:8080"):
    print("=== Bitcoin Bank MVP Integration Test ===\n")

    # 1. Health
    r = requests.get(f"{base_url}/health")
    assert r.status_code == 200, f"Health failed: {r.status_code}"
    print("[OK] Health check")

    # 2. LNURL config
    r = requests.get(f"{base_url}/.well-known/lnurlp/bank")
    assert r.status_code == 200
    j = r.json()
    assert j.get("allowsNostr") and j.get("nostrPubkey")
    print(f"[OK] LNURL config (nostrPubkey: {j['nostrPubkey'][:16]}...)")

    # 3. Deposit flow
    r = requests.get(f"{base_url}/lnurlp/callback", params={"amount": 10000})
    assert r.status_code == 200
    inv = r.json().get("pr", "")
    assert inv
    print(f"[OK] Invoice created: {inv[:40]}...")

    # 4. Pending + simulate (mock backend)
    r = requests.get(f"{base_url}/api/pending-deposits")
    assert r.status_code == 200
    pending = r.json().get("pending", [])
    assert pending, "No pending deposits"
    ph = pending[0]["payment_hash"]
    r = requests.post(f"{base_url}/api/simulate-payment", json={"payment_hash": ph})
    assert r.status_code == 200
    assert r.json().get("status") == "ok"
    print("[OK] Simulate payment (deposit credited)")

    # 5. Balance
    r = requests.get(f"{base_url}/api/balance/anon")
    assert r.status_code == 200
    bal = r.json().get("balance_msats", 0)
    assert bal >= 10000
    print(f"[OK] Balance: {bal} msats")

    # 6. Withdraw (simulate)
    r = requests.post(
        f"{base_url}/api/withdraw",
        params={"simulate": "1"},
        json={"pubkey": "anon", "invoice": "lnbc1fake", "amount_msats": 3000},
    )
    assert r.status_code == 200
    j = r.json()
    assert "balance_after_msats" in j
    print(f"[OK] Withdraw: balance_after={j['balance_after_msats']} msats")

    # 7. Transactions
    r = requests.get(f"{base_url}/api/transactions/anon")
    assert r.status_code == 200
    txns = r.json().get("transactions", [])
    assert len(txns) >= 2
    print(f"[OK] Transactions: {len(txns)} records")

    print("\n=== All tests passed ===")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--with-server", action="store_true", help="Start server in background")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    base = f"http://localhost:{args.port}"

    if args.with_server:
        from app import app

        def run():
            app.run(host="0.0.0.0", port=args.port, use_reloader=False)

        t = threading.Thread(target=run, daemon=True)
        t.start()
        time.sleep(2)

    try:
        run_test(base)
    except AssertionError as e:
        print(f"\n[FAIL] {e}", file=sys.stderr)
        sys.exit(1)
    except requests.exceptions.ConnectionError as e:
        print(f"\n[FAIL] Cannot connect to {base}. Is the server running?", file=sys.stderr)
        print("Run: python app.py", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
