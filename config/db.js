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
const queryLog = require('../utils/queryLog');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'database', 'marketplace.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * The query log needs to know how long each execution took and how many rows it
 * touched. Statements are prepared once (often at module load) but executed many
 * times, so the wrapper records at execution time, not at prepare time.
 *
 * Only `run`, `get`, and `all` are used by this project. Any other statement
 * method would be passed through untouched if it were ever needed.
 */
const rawPrepare = db.prepare.bind(db);

function wrapStatement(statement, sql) {
  const wrapped = Object.create(statement);

  for (const method of ['run', 'get', 'all']) {
    wrapped[method] = function instrumented(...args) {
      const started = process.hrtime.bigint();
      try {
        const result = statement[method](...args);
        const durationMs = Number(process.hrtime.bigint() - started) / 1e6;

        const rowCount =
          method === 'run'
            ? result.changes
            : method === 'get'
              ? result
                ? 1
                : 0
              : result.length;

        queryLog.record({ sql, method, args, durationMs, rowCount });
        return result;
      } catch (error) {
        const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
        queryLog.record({
          sql,
          method,
          args,
          durationMs,
          rowCount: null,
          error: error.code || error.message,
        });
        throw error;
      }
    };
  }

  return wrapped;
}

db.prepare = function prepareWithLogging(sql) {
  return wrapStatement(rawPrepare(sql), sql);
};

/** Creates any missing tables/indexes. Safe to call on every boot. */
function applySchema() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  db.exec(schema);
  migrate();
}

/**
 * Small additive migrations for databases created before campuses existed.
 * `CREATE TABLE IF NOT EXISTS` leaves an existing table untouched, so new
 * columns have to be added explicitly. Existing rows keep `NULL` until they are
 * reseeded or the user picks a campus from their account page.
 */
function migrate() {
  const hasColumn = (table, column) =>
    db.prepare(`PRAGMA table_info(${table})`).all().some((entry) => entry.name === column);

  if (!hasColumn('users', 'campus_id')) {
    db.exec('ALTER TABLE users ADD COLUMN campus_id INTEGER REFERENCES campuses(id)');
  }
  if (!hasColumn('listings', 'campus_id')) {
    db.exec('ALTER TABLE listings ADD COLUMN campus_id INTEGER REFERENCES campuses(id)');
  }

  // Map integration columns (coordinates + cached reverse-geocoded address).
  if (!hasColumn('campuses', 'latitude')) {
    db.exec('ALTER TABLE campuses ADD COLUMN latitude REAL');
  }
  if (!hasColumn('campuses', 'longitude')) {
    db.exec('ALTER TABLE campuses ADD COLUMN longitude REAL');
  }
  if (!hasColumn('campuses', 'map_address')) {
    db.exec('ALTER TABLE campuses ADD COLUMN map_address TEXT');
  }
  if (!hasColumn('campuses', 'map_checked_at')) {
    db.exec('ALTER TABLE campuses ADD COLUMN map_checked_at TEXT');
  }

  // Meetup columns for databases created before the map meetup feature.
  const orderColumns = {
    meetup_latitude: 'REAL',
    meetup_longitude: 'REAL',
    meetup_label: 'TEXT',
    meetup_status: "TEXT NOT NULL DEFAULT 'none'",
    meetup_revision: 'INTEGER NOT NULL DEFAULT 0',
    meetup_proposed_at: 'TEXT',
    meetup_confirmed_at: 'TEXT',
  };
  for (const [column, definition] of Object.entries(orderColumns)) {
    if (!hasColumn('orders', column)) {
      db.exec(`ALTER TABLE orders ADD COLUMN ${column} ${definition}`);
    }
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_listings_campus ON listings (campus_id)');
}

/** True when the database has no users yet (i.e. `npm run seed` was never run). */
function isEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  return row.n === 0;
}

module.exports = { db, DB_PATH, applySchema, isEmpty };
