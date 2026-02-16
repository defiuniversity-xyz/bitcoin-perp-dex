"""
Internal ledger for Bitcoin Bank.

SQLite-backed authoritative source of truth for account balances.
Nostr publishes Kind 30078 as a mirror for transparency.
"""

import sqlite3
import logging
from contextlib import contextmanager
from pathlib import Path
from typing import Optional, List, Tuple

import config

logger = logging.getLogger(__name__)


def _get_conn():
    Path(config.LEDGER_DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(config.LEDGER_DB_PATH)


def init_db():
    """Initialize the ledger database schema."""
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS accounts (
                pubkey TEXT PRIMARY KEY,
                balance_msats INTEGER NOT NULL DEFAULT 0,
                savings_balance_msats INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                pubkey TEXT NOT NULL,
                type TEXT NOT NULL,
                amount_msats INTEGER NOT NULL,
                balance_after_msats INTEGER,
                invoice_id TEXT,
                zap_request_id TEXT,
                counterparty_pubkey TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (pubkey) REFERENCES accounts(pubkey)
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tx_pubkey ON transactions(pubkey)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tx_invoice ON transactions(invoice_id)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS nwc_connections (
                client_pubkey TEXT PRIMARY KEY,
                user_pubkey TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
        """)
        try:
            conn.execute("ALTER TABLE accounts ADD COLUMN savings_balance_msats INTEGER NOT NULL DEFAULT 0")
        except sqlite3.OperationalError:
            pass  # Column already exists (new install or prior migration)
        
        conn.execute("""
            CREATE TABLE IF NOT EXISTS brahma_accounts (
                pubkey TEXT PRIMARY KEY,
                console_address TEXT NOT NULL,
                chain_id INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (pubkey) REFERENCES accounts(pubkey)
            )
        """)
        conn.commit()


@contextmanager
def _cursor():
    conn = _get_conn()
    conn.row_factory = sqlite3.Row
    try:
        cur = conn.cursor()
        yield cur
        conn.commit()
    finally:
        conn.close()


def get_or_create_account(pubkey: str) -> dict:
    """Get account by pubkey, creating it if necessary."""
    import time
    now = int(time.time())
    with _cursor() as cur:
        cur.execute(
            "SELECT pubkey, balance_msats, COALESCE(savings_balance_msats,0) as savings_balance_msats, created_at, updated_at FROM accounts WHERE pubkey = ?",
            (pubkey,),
        )
        row = cur.fetchone()
        if row:
            return dict(row)
        cur.execute(
            "INSERT INTO accounts (pubkey, balance_msats, savings_balance_msats, created_at, updated_at) VALUES (?, 0, 0, ?, ?)",
            (pubkey, now, now),
        )
        return {
            "pubkey": pubkey,
            "balance_msats": 0,
            "savings_balance_msats": 0,
            "created_at": now,
            "updated_at": now,
        }


def get_balance_msats(pubkey: str) -> int:
    """Get current spendable balance in millisatoshis."""
    with _cursor() as cur:
        cur.execute("SELECT balance_msats FROM accounts WHERE pubkey = ?", (pubkey,))
        row = cur.fetchone()
        if not row:
            return 0
        return row["balance_msats"]


def get_savings_balance_msats(pubkey: str) -> int:
    """Get current savings balance in millisatoshis."""
    with _cursor() as cur:
        cur.execute("SELECT COALESCE(savings_balance_msats, 0) FROM accounts WHERE pubkey = ?", (pubkey,))
        row = cur.fetchone()
        if not row:
            return 0
        return row[0]


def get_total_savings_msats() -> int:
    """Get sum of all savings balances across all accounts."""
    with _cursor() as cur:
        cur.execute("SELECT COALESCE(SUM(savings_balance_msats), 0) FROM accounts")
        row = cur.fetchone()
        return row[0] if row else 0


def get_all_savers() -> List[Tuple[str, int]]:
    """Get list of (pubkey, savings_balance_msats) for accounts with savings > 0."""
    with _cursor() as cur:
        cur.execute(
            "SELECT pubkey, COALESCE(savings_balance_msats, 0) as savings FROM accounts WHERE COALESCE(savings_balance_msats, 0) > 0"
        )
        return [(r["pubkey"], r["savings"]) for r in cur.fetchall()]


def get_total_yield_distributed_msats() -> int:
    """Get sum of all yield_credit transactions (all-time)."""
    with _cursor() as cur:
        cur.execute(
            "SELECT COALESCE(SUM(amount_msats), 0) AS total FROM transactions WHERE type = 'yield_credit'"
        )
        row = cur.fetchone()
        return row["total"] if row else 0


def yield_credit(pubkey: str, amount_msats: int) -> Optional[dict]:
    """
    Credit yield to a saver's savings balance.
    Returns transaction record or None on error.
    """
    import time
    import uuid
    now = int(time.time())
    tx_id = str(uuid.uuid4())
    with _cursor() as cur:
        cur.execute(
            "SELECT COALESCE(savings_balance_msats, 0) FROM accounts WHERE pubkey = ?",
            (pubkey,),
        )
        row = cur.fetchone()
        if not row:
            return None
        savings_after = row[0] + amount_msats
        cur.execute(
            "UPDATE accounts SET savings_balance_msats = ?, updated_at = ? WHERE pubkey = ?",
            (savings_after, now, pubkey),
        )
        cur.execute(
            """INSERT INTO transactions
               (id, pubkey, type, amount_msats, balance_after_msats, created_at)
               VALUES (?, ?, 'yield_credit', ?, ?, ?)""",
            (tx_id, pubkey, amount_msats, savings_after, now),
        )
    return {
        "tx_id": tx_id,
        "pubkey": pubkey,
        "amount_msats": amount_msats,
        "savings_after_msats": savings_after,
        "created_at": now,
    }


def credit_deposit(
    pubkey: str,
    amount_msats: int,
    invoice_id: str,
    zap_request_id: Optional[str] = None,
) -> dict:
    """
    Credit a deposit to an account. Returns the new balance and transaction record.
    """
    import time
    now = int(time.time())
    import uuid
    tx_id = str(uuid.uuid4())
    with _cursor() as cur:
        cur.execute(
            "UPDATE accounts SET balance_msats = balance_msats + ?, updated_at = ? WHERE pubkey = ?",
            (amount_msats, now, pubkey),
        )
        if cur.rowcount == 0:
            cur.execute(
                "INSERT INTO accounts (pubkey, balance_msats, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (pubkey, amount_msats, now, now),
            )
        cur.execute(
            "SELECT balance_msats FROM accounts WHERE pubkey = ?", (pubkey,)
        )
        new_balance = cur.fetchone()["balance_msats"]
        cur.execute(
            """INSERT INTO transactions
               (id, pubkey, type, amount_msats, balance_after_msats, invoice_id, zap_request_id, created_at)
               VALUES (?, ?, 'deposit', ?, ?, ?, ?, ?)""",
            (tx_id, pubkey, amount_msats, new_balance, invoice_id, zap_request_id, now),
        )
    return {
        "tx_id": tx_id,
        "pubkey": pubkey,
        "amount_msats": amount_msats,
        "balance_after_msats": new_balance,
        "created_at": now,
    }


def debit_withdrawal(
    pubkey: str,
    amount_msats: int,
    invoice_id: str,
) -> Optional[dict]:
    """
    Debit a withdrawal from an account. Returns transaction record or None if insufficient balance.
    """
    import time
    now = int(time.time())
    import uuid
    tx_id = str(uuid.uuid4())
    with _cursor() as cur:
        cur.execute(
            "SELECT balance_msats FROM accounts WHERE pubkey = ?", (pubkey,)
        )
        row = cur.fetchone()
        if not row or row["balance_msats"] < amount_msats:
            return None
        cur.execute(
            "UPDATE accounts SET balance_msats = balance_msats - ?, updated_at = ? WHERE pubkey = ?",
            (amount_msats, now, pubkey),
        )
        new_balance = row["balance_msats"] - amount_msats
        cur.execute(
            """INSERT INTO transactions
               (id, pubkey, type, amount_msats, balance_after_msats, invoice_id, created_at)
               VALUES (?, ?, 'withdrawal', ?, ?, ?, ?)""",
            (tx_id, pubkey, -amount_msats, new_balance, invoice_id, now),
        )
    return {
        "tx_id": tx_id,
        "pubkey": pubkey,
        "amount_msats": amount_msats,
        "balance_after_msats": new_balance,
        "created_at": now,
    }


def transfer_internal(
    from_pubkey: str,
    to_pubkey: str,
    amount_msats: int,
    transfer_id: str,
) -> Optional[dict]:
    """
    Internal transfer: debit from_pubkey, credit to_pubkey.
    Returns dict with both tx records or None if insufficient balance.
    """
    import time
    now = int(time.time())
    if from_pubkey == to_pubkey:
        return None
    if amount_msats <= 0:
        return None

    with _cursor() as cur:
        cur.execute(
            "SELECT balance_msats FROM accounts WHERE pubkey = ?", (from_pubkey,)
        )
        row = cur.fetchone()
        if not row or row["balance_msats"] < amount_msats:
            return None

        from_balance_after = row["balance_msats"] - amount_msats

        cur.execute(
            "UPDATE accounts SET balance_msats = balance_msats - ?, updated_at = ? WHERE pubkey = ?",
            (amount_msats, now, from_pubkey),
        )

        cur.execute(
            "SELECT balance_msats FROM accounts WHERE pubkey = ?", (to_pubkey,)
        )
        to_row = cur.fetchone()
        if to_row:
            to_balance_after = to_row["balance_msats"] + amount_msats
            cur.execute(
                "UPDATE accounts SET balance_msats = ?, updated_at = ? WHERE pubkey = ?",
                (to_balance_after, now, to_pubkey),
            )
        else:
            cur.execute(
                "INSERT INTO accounts (pubkey, balance_msats, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (to_pubkey, amount_msats, now, now),
            )
            to_balance_after = amount_msats

        tx_id_debit = f"{transfer_id}-debit"
        tx_id_credit = f"{transfer_id}-credit"
        cur.execute(
            """INSERT INTO transactions
               (id, pubkey, type, amount_msats, balance_after_msats, counterparty_pubkey, created_at)
               VALUES (?, ?, 'transfer_out', ?, ?, ?, ?)""",
            (tx_id_debit, from_pubkey, -amount_msats, from_balance_after, to_pubkey, now),
        )
        cur.execute(
            """INSERT INTO transactions
               (id, pubkey, type, amount_msats, balance_after_msats, counterparty_pubkey, created_at)
               VALUES (?, ?, 'transfer_in', ?, ?, ?, ?)""",
            (tx_id_credit, to_pubkey, amount_msats, to_balance_after, from_pubkey, now),
        )

    return {
        "from_pubkey": from_pubkey,
        "to_pubkey": to_pubkey,
        "amount_msats": amount_msats,
        "from_balance_after": from_balance_after,
        "to_balance_after": to_balance_after,
        "created_at": now,
    }


def savings_add(pubkey: str, amount_msats: int) -> Optional[dict]:
    """
    Move sats from spendable to savings.
    Returns transaction record or None if insufficient spendable balance.
    """
    import time
    import uuid
    now = int(time.time())
    tx_id = str(uuid.uuid4())
    with _cursor() as cur:
        cur.execute(
            "SELECT balance_msats, COALESCE(savings_balance_msats, 0) FROM accounts WHERE pubkey = ?",
            (pubkey,),
        )
        row = cur.fetchone()
        if not row or row[0] < amount_msats:
            return None
        spendable_after = row[0] - amount_msats
        savings_after = row[1] + amount_msats
        cur.execute(
            "UPDATE accounts SET balance_msats = ?, savings_balance_msats = ?, updated_at = ? WHERE pubkey = ?",
            (spendable_after, savings_after, now, pubkey),
        )
        cur.execute(
            """INSERT INTO transactions
               (id, pubkey, type, amount_msats, balance_after_msats, created_at)
               VALUES (?, ?, 'savings_add', ?, ?, ?)""",
            (tx_id, pubkey, -amount_msats, spendable_after, now),
        )
    return {
        "tx_id": tx_id,
        "pubkey": pubkey,
        "amount_msats": amount_msats,
        "balance_after_msats": spendable_after,
        "savings_after_msats": savings_after,
        "created_at": now,
    }


def savings_remove(pubkey: str, amount_msats: int) -> Optional[dict]:
    """
    Move sats from savings to spendable.
    Returns transaction record or None if insufficient savings balance.
    """
    import time
    import uuid
    now = int(time.time())
    tx_id = str(uuid.uuid4())
    with _cursor() as cur:
        cur.execute(
            "SELECT balance_msats, COALESCE(savings_balance_msats, 0) FROM accounts WHERE pubkey = ?",
            (pubkey,),
        )
        row = cur.fetchone()
        if not row or row[1] < amount_msats:
            return None
        spendable_after = row[0] + amount_msats
        savings_after = row[1] - amount_msats
        cur.execute(
            "UPDATE accounts SET balance_msats = ?, savings_balance_msats = ?, updated_at = ? WHERE pubkey = ?",
            (spendable_after, savings_after, now, pubkey),
        )
        cur.execute(
            """INSERT INTO transactions
               (id, pubkey, type, amount_msats, balance_after_msats, created_at)
               VALUES (?, ?, 'savings_remove', ?, ?, ?)""",
            (tx_id, pubkey, amount_msats, spendable_after, now),
        )
    return {
        "tx_id": tx_id,
        "pubkey": pubkey,
        "amount_msats": amount_msats,
        "balance_after_msats": spendable_after,
        "savings_after_msats": savings_after,
        "created_at": now,
    }


def nwc_register(client_pubkey: str, user_pubkey: str) -> None:
    """Register NWC connection: client_pubkey -> user_pubkey."""
    import time
    now = int(time.time())
    with _cursor() as cur:
        cur.execute(
            "INSERT OR REPLACE INTO nwc_connections (client_pubkey, user_pubkey, created_at) VALUES (?, ?, ?)",
            (client_pubkey, user_pubkey, now),
        )


def nwc_lookup_user(client_pubkey: str) -> Optional[str]:
    """Look up user_pubkey for an NWC client. Returns None if not registered."""
    with _cursor() as cur:
        cur.execute("SELECT user_pubkey FROM nwc_connections WHERE client_pubkey = ?", (client_pubkey,))
        row = cur.fetchone()
        return row["user_pubkey"] if row else None


def get_recent_transactions(pubkey: str, limit: int = 20) -> list:
    """Get recent transactions for an account."""
    with _cursor() as cur:
        cur.execute(
            """SELECT id, type, amount_msats, balance_after_msats, invoice_id, zap_request_id, counterparty_pubkey, created_at
               FROM transactions WHERE pubkey = ? ORDER BY created_at DESC LIMIT ?""",
            (pubkey, limit),
        )
        return [dict(r) for r in cur.fetchall()]


def get_brahma_account(pubkey: str) -> Optional[dict]:
    """Get Brahma Console account details for a user."""
    with _cursor() as cur:
        cur.execute("SELECT * FROM brahma_accounts WHERE pubkey = ?", (pubkey,))
        row = cur.fetchone()
        return dict(row) if row else None


def create_brahma_account(pubkey: str, console_address: str, chain_id: int = 8453) -> dict:
    """Register a deployed Brahma Console."""
    import time
    now = int(time.time())
    with _cursor() as cur:
        cur.execute(
            "INSERT INTO brahma_accounts (pubkey, console_address, chain_id, created_at) VALUES (?, ?, ?, ?)",
            (pubkey, console_address, chain_id, now)
        )
    return {
        "pubkey": pubkey,
        "console_address": console_address,
        "chain_id": chain_id,
        "created_at": now
    }
