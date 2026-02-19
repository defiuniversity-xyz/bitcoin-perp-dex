"""
Futures DEX ledger — SQLite schema and CRUD helpers.

Tables:
  futures_accounts  — per-user collateral balance
  orders            — open/filled/cancelled limit and market orders
  positions         — open leveraged positions
  trades            — immutable fill records
  funding_rates     — 8-hour funding rate history
  insurance_fund    — single-row insurance fund balance
"""

import sqlite3
import time
import uuid
import logging
from contextlib import contextmanager
from pathlib import Path
from typing import Optional, List

import config
from storage_wrapper import get_storage_wrapper, sync_after_write

logger = logging.getLogger(__name__)

FUTURES_DB_PATH = config.FUTURES_DB_PATH


def _get_conn():
    wrapper = get_storage_wrapper()
    # Use a separate DB file for futures
    db_path = FUTURES_DB_PATH
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(db_path)


def init_futures_db():
    """Create all futures tables if they don't exist."""
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS futures_accounts (
                pubkey TEXT PRIMARY KEY,
                collateral_msats INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                pubkey TEXT NOT NULL,
                market TEXT NOT NULL,
                side TEXT NOT NULL,
                order_type TEXT NOT NULL,
                size_sats INTEGER NOT NULL,
                price_usd REAL,
                leverage INTEGER NOT NULL DEFAULT 1,
                status TEXT NOT NULL DEFAULT 'open',
                filled_size_sats INTEGER NOT NULL DEFAULT 0,
                nostr_event_id TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_orders_pubkey ON orders(pubkey)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_orders_market_status ON orders(market, status)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS positions (
                id TEXT PRIMARY KEY,
                pubkey TEXT NOT NULL,
                market TEXT NOT NULL,
                side TEXT NOT NULL,
                size_sats INTEGER NOT NULL,
                entry_price_usd REAL NOT NULL,
                collateral_msats INTEGER NOT NULL,
                leverage INTEGER NOT NULL,
                liquidation_price_usd REAL NOT NULL,
                funding_cost_msats INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_pos_pubkey ON positions(pubkey)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_pos_market ON positions(market)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS trades (
                id TEXT PRIMARY KEY,
                market TEXT NOT NULL,
                buyer_pubkey TEXT NOT NULL,
                seller_pubkey TEXT NOT NULL,
                size_sats INTEGER NOT NULL,
                price_usd REAL NOT NULL,
                buy_order_id TEXT,
                sell_order_id TEXT,
                timestamp INTEGER NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_trades_ts ON trades(timestamp)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS funding_rates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                market TEXT NOT NULL,
                rate REAL NOT NULL,
                mark_price_usd REAL NOT NULL,
                index_price_usd REAL NOT NULL,
                timestamp INTEGER NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_fr_market ON funding_rates(market)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS insurance_fund (
                id INTEGER PRIMARY KEY DEFAULT 1,
                balance_msats INTEGER NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL
            )
        """)
        # Ensure insurance fund row exists
        conn.execute(
            "INSERT OR IGNORE INTO insurance_fund (id, balance_msats, updated_at) VALUES (1, 0, ?)",
            (int(time.time()),),
        )
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


# ---------------------------------------------------------------------------
# Futures accounts
# ---------------------------------------------------------------------------

def get_or_create_futures_account(pubkey: str) -> dict:
    now = int(time.time())
    with _cursor() as cur:
        cur.execute("SELECT * FROM futures_accounts WHERE pubkey = ?", (pubkey,))
        row = cur.fetchone()
        if row:
            return dict(row)
        cur.execute(
            "INSERT INTO futures_accounts (pubkey, collateral_msats, created_at, updated_at) VALUES (?, 0, ?, ?)",
            (pubkey, now, now),
        )
        return {"pubkey": pubkey, "collateral_msats": 0, "created_at": now, "updated_at": now}


def get_collateral_msats(pubkey: str) -> int:
    with _cursor() as cur:
        cur.execute("SELECT collateral_msats FROM futures_accounts WHERE pubkey = ?", (pubkey,))
        row = cur.fetchone()
        return row["collateral_msats"] if row else 0


def credit_collateral(pubkey: str, amount_msats: int) -> dict:
    now = int(time.time())
    get_or_create_futures_account(pubkey)
    with _cursor() as cur:
        cur.execute(
            "UPDATE futures_accounts SET collateral_msats = collateral_msats + ?, updated_at = ? WHERE pubkey = ?",
            (amount_msats, now, pubkey),
        )
        cur.execute("SELECT collateral_msats FROM futures_accounts WHERE pubkey = ?", (pubkey,))
        return {"pubkey": pubkey, "collateral_msats": cur.fetchone()["collateral_msats"]}


def debit_collateral(pubkey: str, amount_msats: int) -> Optional[dict]:
    now = int(time.time())
    with _cursor() as cur:
        cur.execute("SELECT collateral_msats FROM futures_accounts WHERE pubkey = ?", (pubkey,))
        row = cur.fetchone()
        if not row or row["collateral_msats"] < amount_msats:
            return None
        cur.execute(
            "UPDATE futures_accounts SET collateral_msats = collateral_msats - ?, updated_at = ? WHERE pubkey = ?",
            (amount_msats, now, pubkey),
        )
        return {"pubkey": pubkey, "collateral_msats": row["collateral_msats"] - amount_msats}


def adjust_collateral(pubkey: str, delta_msats: int) -> Optional[dict]:
    """Add or subtract from collateral (delta can be negative)."""
    now = int(time.time())
    with _cursor() as cur:
        cur.execute("SELECT collateral_msats FROM futures_accounts WHERE pubkey = ?", (pubkey,))
        row = cur.fetchone()
        if not row:
            return None
        new_bal = row["collateral_msats"] + delta_msats
        if new_bal < 0:
            return None
        cur.execute(
            "UPDATE futures_accounts SET collateral_msats = ?, updated_at = ? WHERE pubkey = ?",
            (new_bal, now, pubkey),
        )
        return {"pubkey": pubkey, "collateral_msats": new_bal}


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

def create_order(
    pubkey: str,
    market: str,
    side: str,
    order_type: str,
    size_sats: int,
    leverage: int,
    price_usd: Optional[float] = None,
    nostr_event_id: Optional[str] = None,
) -> dict:
    now = int(time.time())
    order_id = str(uuid.uuid4())
    with _cursor() as cur:
        cur.execute(
            """INSERT INTO orders
               (id, pubkey, market, side, order_type, size_sats, price_usd, leverage, status,
                filled_size_sats, nostr_event_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', 0, ?, ?, ?)""",
            (order_id, pubkey, market, side, order_type, size_sats, price_usd, leverage,
             nostr_event_id, now, now),
        )
    return get_order(order_id)


def get_order(order_id: str) -> Optional[dict]:
    with _cursor() as cur:
        cur.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def get_open_orders_for_market(market: str, side: Optional[str] = None) -> List[dict]:
    with _cursor() as cur:
        if side:
            cur.execute(
                "SELECT * FROM orders WHERE market = ? AND side = ? AND status = 'open' ORDER BY price_usd, created_at",
                (market, side),
            )
        else:
            cur.execute(
                "SELECT * FROM orders WHERE market = ? AND status = 'open' ORDER BY price_usd, created_at",
                (market,),
            )
        return [dict(r) for r in cur.fetchall()]


def get_orders_for_pubkey(pubkey: str, status: Optional[str] = None) -> List[dict]:
    with _cursor() as cur:
        if status:
            cur.execute(
                "SELECT * FROM orders WHERE pubkey = ? AND status = ? ORDER BY created_at DESC",
                (pubkey, status),
            )
        else:
            cur.execute(
                "SELECT * FROM orders WHERE pubkey = ? ORDER BY created_at DESC LIMIT 50",
                (pubkey,),
            )
        return [dict(r) for r in cur.fetchall()]


def update_order_status(order_id: str, status: str, filled_size_sats: Optional[int] = None) -> Optional[dict]:
    now = int(time.time())
    with _cursor() as cur:
        if filled_size_sats is not None:
            cur.execute(
                "UPDATE orders SET status = ?, filled_size_sats = ?, updated_at = ? WHERE id = ?",
                (status, filled_size_sats, now, order_id),
            )
        else:
            cur.execute(
                "UPDATE orders SET status = ?, updated_at = ? WHERE id = ?",
                (status, now, order_id),
            )
    return get_order(order_id)


# ---------------------------------------------------------------------------
# Positions
# ---------------------------------------------------------------------------

def create_position(
    pubkey: str,
    market: str,
    side: str,
    size_sats: int,
    entry_price_usd: float,
    collateral_msats: int,
    leverage: int,
    liquidation_price_usd: float,
) -> dict:
    now = int(time.time())
    pos_id = str(uuid.uuid4())
    with _cursor() as cur:
        cur.execute(
            """INSERT INTO positions
               (id, pubkey, market, side, size_sats, entry_price_usd, collateral_msats,
                leverage, liquidation_price_usd, funding_cost_msats, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)""",
            (pos_id, pubkey, market, side, size_sats, entry_price_usd, collateral_msats,
             leverage, liquidation_price_usd, now, now),
        )
    return get_position(pos_id)


def get_position(pos_id: str) -> Optional[dict]:
    with _cursor() as cur:
        cur.execute("SELECT * FROM positions WHERE id = ?", (pos_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def get_positions_for_pubkey(pubkey: str) -> List[dict]:
    with _cursor() as cur:
        cur.execute(
            "SELECT * FROM positions WHERE pubkey = ? ORDER BY created_at DESC",
            (pubkey,),
        )
        return [dict(r) for r in cur.fetchall()]


def get_all_open_positions(market: Optional[str] = None) -> List[dict]:
    with _cursor() as cur:
        if market:
            cur.execute("SELECT * FROM positions WHERE market = ?", (market,))
        else:
            cur.execute("SELECT * FROM positions")
        return [dict(r) for r in cur.fetchall()]


def close_position(pos_id: str) -> bool:
    with _cursor() as cur:
        cur.execute("DELETE FROM positions WHERE id = ?", (pos_id,))
        return cur.rowcount > 0


def update_position_funding(pos_id: str, funding_cost_delta_msats: int, new_collateral_msats: int) -> Optional[dict]:
    now = int(time.time())
    with _cursor() as cur:
        cur.execute(
            """UPDATE positions
               SET funding_cost_msats = funding_cost_msats + ?,
                   collateral_msats = ?,
                   updated_at = ?
               WHERE id = ?""",
            (funding_cost_delta_msats, new_collateral_msats, now, pos_id),
        )
    return get_position(pos_id)


def get_total_open_interest_sats(market: str) -> int:
    with _cursor() as cur:
        cur.execute("SELECT COALESCE(SUM(size_sats), 0) FROM positions WHERE market = ?", (market,))
        row = cur.fetchone()
        return row[0] if row else 0


# ---------------------------------------------------------------------------
# Trades
# ---------------------------------------------------------------------------

def record_trade(
    market: str,
    buyer_pubkey: str,
    seller_pubkey: str,
    size_sats: int,
    price_usd: float,
    buy_order_id: Optional[str] = None,
    sell_order_id: Optional[str] = None,
) -> dict:
    trade_id = str(uuid.uuid4())
    ts = int(time.time())
    with _cursor() as cur:
        cur.execute(
            """INSERT INTO trades
               (id, market, buyer_pubkey, seller_pubkey, size_sats, price_usd,
                buy_order_id, sell_order_id, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (trade_id, market, buyer_pubkey, seller_pubkey, size_sats, price_usd,
             buy_order_id, sell_order_id, ts),
        )
    return {
        "id": trade_id, "market": market, "buyer_pubkey": buyer_pubkey,
        "seller_pubkey": seller_pubkey, "size_sats": size_sats, "price_usd": price_usd,
        "buy_order_id": buy_order_id, "sell_order_id": sell_order_id, "timestamp": ts,
    }


def get_recent_trades(market: str, limit: int = 50) -> List[dict]:
    with _cursor() as cur:
        cur.execute(
            "SELECT * FROM trades WHERE market = ? ORDER BY timestamp DESC LIMIT ?",
            (market, limit),
        )
        return [dict(r) for r in cur.fetchall()]


def get_trades_for_pubkey(pubkey: str, limit: int = 50) -> List[dict]:
    with _cursor() as cur:
        cur.execute(
            """SELECT * FROM trades WHERE buyer_pubkey = ? OR seller_pubkey = ?
               ORDER BY timestamp DESC LIMIT ?""",
            (pubkey, pubkey, limit),
        )
        return [dict(r) for r in cur.fetchall()]


def get_ohlcv(market: str, since: int, bucket_seconds: int = 300) -> List[dict]:
    """Aggregate trades into OHLCV candles for the chart."""
    with _cursor() as cur:
        cur.execute(
            """SELECT
                 (timestamp / ?) * ? AS bucket,
                 (SELECT price_usd FROM trades t2
                  WHERE t2.market = ? AND (t2.timestamp / ?) = (t.timestamp / ?)
                  ORDER BY t2.timestamp ASC LIMIT 1) AS open,
                 MAX(price_usd) AS high,
                 MIN(price_usd) AS low,
                 (SELECT price_usd FROM trades t3
                  WHERE t3.market = ? AND (t3.timestamp / ?) = (t.timestamp / ?)
                  ORDER BY t3.timestamp DESC LIMIT 1) AS close,
                 SUM(size_sats) AS volume
               FROM trades t
               WHERE market = ? AND timestamp >= ?
               GROUP BY bucket
               ORDER BY bucket ASC""",
            (bucket_seconds, bucket_seconds,
             market, bucket_seconds, bucket_seconds,
             market, bucket_seconds, bucket_seconds,
             market, since),
        )
        return [dict(r) for r in cur.fetchall()]


# ---------------------------------------------------------------------------
# Funding rates
# ---------------------------------------------------------------------------

def record_funding_rate(
    market: str, rate: float, mark_price_usd: float, index_price_usd: float
) -> dict:
    ts = int(time.time())
    with _cursor() as cur:
        cur.execute(
            """INSERT INTO funding_rates (market, rate, mark_price_usd, index_price_usd, timestamp)
               VALUES (?, ?, ?, ?, ?)""",
            (market, rate, mark_price_usd, index_price_usd, ts),
        )
        row_id = cur.lastrowid
    return {"id": row_id, "market": market, "rate": rate,
            "mark_price_usd": mark_price_usd, "index_price_usd": index_price_usd,
            "timestamp": ts}


def get_latest_funding_rate(market: str) -> Optional[dict]:
    with _cursor() as cur:
        cur.execute(
            "SELECT * FROM funding_rates WHERE market = ? ORDER BY timestamp DESC LIMIT 1",
            (market,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def get_funding_rate_history(market: str, limit: int = 48) -> List[dict]:
    with _cursor() as cur:
        cur.execute(
            "SELECT * FROM funding_rates WHERE market = ? ORDER BY timestamp DESC LIMIT ?",
            (market, limit),
        )
        return [dict(r) for r in cur.fetchall()]


# ---------------------------------------------------------------------------
# Insurance fund
# ---------------------------------------------------------------------------

def get_insurance_fund_balance() -> int:
    with _cursor() as cur:
        cur.execute("SELECT balance_msats FROM insurance_fund WHERE id = 1")
        row = cur.fetchone()
        return row["balance_msats"] if row else 0


def credit_insurance_fund(amount_msats: int) -> int:
    now = int(time.time())
    with _cursor() as cur:
        cur.execute(
            "UPDATE insurance_fund SET balance_msats = balance_msats + ?, updated_at = ? WHERE id = 1",
            (amount_msats, now),
        )
        cur.execute("SELECT balance_msats FROM insurance_fund WHERE id = 1")
        return cur.fetchone()["balance_msats"]


def debit_insurance_fund(amount_msats: int) -> int:
    now = int(time.time())
    with _cursor() as cur:
        cur.execute("SELECT balance_msats FROM insurance_fund WHERE id = 1")
        bal = cur.fetchone()["balance_msats"]
        new_bal = max(0, bal - amount_msats)
        cur.execute(
            "UPDATE insurance_fund SET balance_msats = ?, updated_at = ? WHERE id = 1",
            (new_bal, now),
        )
        return new_bal
