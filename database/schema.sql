-- ============================================================================
-- BatStateU Marketplace — data tier schema
-- Run automatically by config/db.js on every server start (idempotent).
-- ============================================================================

PRAGMA foreign_keys = ON;

-- Batangas State University has several campuses. Users belong to one, and new
-- listings inherit their seller's campus unless the seller picks another.
CREATE TABLE IF NOT EXISTS campuses (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id    TEXT    NOT NULL UNIQUE,
  full_name     TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  program       TEXT,
  year_level    INTEGER CHECK (year_level IS NULL OR (year_level BETWEEN 1 AND 6)),
  campus_id     INTEGER REFERENCES campuses(id),
  status        TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  last_seen_at  TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS listings (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id    INTEGER NOT NULL REFERENCES categories(id),
  campus_id      INTEGER REFERENCES campuses(id),
  title          TEXT    NOT NULL,
  description    TEXT    NOT NULL DEFAULT '',
  -- Money is stored as an integer number of centavos to avoid floating point drift.
  price_centavos INTEGER NOT NULL CHECK (price_centavos >= 0),
  item_condition TEXT    NOT NULL DEFAULT 'used'
                 CHECK (item_condition IN ('new', 'like_new', 'used', 'for_parts')),
  image_path     TEXT,
  status         TEXT    NOT NULL DEFAULT 'available'
                 CHECK (status IN ('available', 'reserved', 'sold', 'removed')),
  views          INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_listings_status      ON listings (status);
CREATE INDEX IF NOT EXISTS idx_listings_category    ON listings (category_id);
CREATE INDEX IF NOT EXISTS idx_listings_seller      ON listings (seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_created_at  ON listings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_status         ON users (status);

-- ============================================================================
-- Phase 4 — orders (buyer requests → seller confirms)
-- ============================================================================

CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id      INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Price is snapshotted at request time so later edits cannot rewrite history.
  amount_centavos INTEGER NOT NULL CHECK (amount_centavos >= 0),
  status          TEXT    NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'completed', 'cancelled')),
  note            TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_listing ON orders (listing_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer   ON orders (buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller  ON orders (seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at DESC);

-- A listing can only have ONE open request at a time. Enforced by the database,
-- not just by application code.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_pending
  ON orders (listing_id) WHERE status = 'pending';

-- ============================================================================
-- Phase 5 — messages (buyer ↔ seller, threaded per listing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id   INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  sender_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body         TEXT    NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  read_at      TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_listing   ON messages (listing_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender    ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages (recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created   ON messages (created_at DESC);

