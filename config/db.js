/**
 * Data tier entry point.
 *
 * This is the ONLY file that knows how to open the database. Every SQL statement
 * lives in /models, which requires this module. Controllers and services never
 * import better-sqlite3 directly — that keeps the 3-tier boundary clean.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'database', 'marketplace.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/** Creates any missing tables/indexes. Safe to call on every boot. */
function applySchema() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  db.exec(schema);
}

/** True when the database has no users yet (i.e. `npm run seed` was never run). */
function isEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  return row.n === 0;
}

module.exports = { db, DB_PATH, applySchema, isEmpty };
