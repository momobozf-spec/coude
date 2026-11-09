"""SQLite-opslag. Tokens worden enkel gehasht bewaard."""
import hashlib
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  storyteller_name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'nl',
  gift_message TEXT,
  print_interest INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,              -- pending_payment | paid | refunded
  payment_mode TEXT NOT NULL,        -- demo | stripe
  stripe_session_id TEXT,
  amount_cents INTEGER NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  buyer_token_hash TEXT NOT NULL UNIQUE,
  storyteller_token_hash TEXT NOT NULL UNIQUE,
  activated_at TEXT,                 -- toestemming verteller
  consent_version TEXT,
  pin_hash TEXT,
  approver TEXT NOT NULL DEFAULT 'storyteller',  -- storyteller | buyer | family:<id>
  collect_until TEXT,
  extended INTEGER NOT NULL DEFAULT 0,
  host_until TEXT,
  deleted_at TEXT,
  source TEXT NOT NULL DEFAULT 'direct',   -- direct | familie | doorverwijzing | <utm_source>
  referral_code TEXT UNIQUE,                -- eigen code, aangemaakt bij betaling
  referred_by INTEGER REFERENCES orders(id),
  reward_status TEXT                        -- NULL | due | paid  (beloning voor de doorverwijzer)
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  custom INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS stories (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  audio_path TEXT NOT NULL,
  audio_seconds REAL NOT NULL,
  transcript TEXT,
  transcript_flags TEXT,             -- JSON lijst onzekere woorden
  transcript_source TEXT,            -- demo | openai
  readable TEXT,
  readable_ok INTEGER,
  final_text TEXT,
  status TEXT NOT NULL,              -- recorded | transcribed | approved
  shared INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  approved_at TEXT
);
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY,
  story_id INTEGER NOT NULL REFERENCES stories(id),
  path TEXT NOT NULL,
  caption TEXT
);
CREATE TABLE IF NOT EXISTS family (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  can_download INTEGER NOT NULL DEFAULT 0,
  approved_by_storyteller INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pending_links (
  order_id INTEGER PRIMARY KEY REFERENCES orders(id),
  buyer_token TEXT NOT NULL,          -- leesbaar bewaard tot de bevestigingsmail vertrokken is (max. 48 u)
  storyteller_token TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  ts TEXT NOT NULL,
  name TEXT NOT NULL,
  order_id INTEGER,
  detail TEXT
);
"""


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_token() -> str:
    return secrets.token_urlsafe(24)


# Kolommen die later bijkwamen: worden toegevoegd aan bestaande databanken.
MIGRATIONS = {
    "orders": {
        "pin_hash": "TEXT",
        "source": "TEXT NOT NULL DEFAULT 'direct'",
        "referral_code": "TEXT",
        "referred_by": "INTEGER",
        "reward_status": "TEXT",
        "nudged_at": "TEXT",
        "expiry_notice_at": "TEXT",
        "confirmation_sent_at": "TEXT",
    },
}


def init() -> None:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    config.MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as c:
        c.execute("PRAGMA journal_mode=WAL")
        c.executescript(SCHEMA)
        for table, cols in MIGRATIONS.items():
            have = {r["name"] for r in c.execute(f"PRAGMA table_info({table})")}
            for col, decl in cols.items():
                if col not in have:
                    c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")
        c.execute("CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_referral ON orders(referral_code)")


@contextmanager
def connect():
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def log_event(name: str, order_id=None, detail: str = "") -> None:
    with connect() as c:
        c.execute("INSERT INTO events(ts,name,order_id,detail) VALUES (?,?,?,?)",
                  (now(), name, order_id, detail[:500]))
