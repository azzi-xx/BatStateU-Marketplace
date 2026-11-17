-- ============================================================================
-- BatStateU Marketplace — data tier schema
-- Run automatically by config/db.js on every server start (idempotent).
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id    TEXT    NOT NULL UNIQUE,
  full_name     TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  program       TEXT,
  year_level    INTEGER CHECK (year_level IS NULL OR (year_level BETWEEN 1 AND 6)),
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
