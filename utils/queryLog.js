/**
 * In-memory SQL activity recorder.
 *
 * This is the "show me how the data is processed" layer: every statement that
 * runs through `config/db.js` is recorded with the HTTP request that triggered
 * it, its parameters, row count, and duration. Nothing is persisted — the log
 * is a small ring buffer that resets when the server restarts.
 *
 * It lives in `utils/` (Tier 2 toolbox) and is only read by the admin data lab.
 */
const { AsyncLocalStorage } = require('async_hooks');

const MAX_ENTRIES = 300;
const storage = new AsyncLocalStorage();
const entries = [];
let traceSeq = 0;
let entrySeq = 0;

/** Runs `fn` with a trace context so any SQL it triggers can be attributed. */
function runWithRequest(req, fn) {
  const trace = {
    id: ++traceSeq,
    method: req.method,
    path: req.originalUrl,
    startedAt: Date.now(),
  };
  return storage.run(trace, fn);
}

function currentTrace() {
  return storage.getStore() || null;
}

/** Redacts secrets and shortens long strings before anything reaches the UI. */
function sanitize(value, depth = 0) {
  if (depth > 3) return '…';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > 120 ? `${value.slice(0, 120)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => sanitize(item, depth + 1));

  if (typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = /pass(word)?|hash|secret|token/i.test(key)
        ? '[redacted]'
        : sanitize(item, depth + 1);
    }
    return out;
  }

  return String(value);
}

function record({ sql, method, args, durationMs, rowCount, error }) {
  const trace = currentTrace();
  const normalized = String(sql).replace(/\s+/g, ' ').trim();

  entries.unshift({
    id: ++entrySeq,
    at: new Date().toISOString(),
    traceId: trace ? trace.id : null,
    request: trace ? `${trace.method} ${trace.path}` : 'startup',
    method,
    sql: normalized,
    params: sanitize(args),
    durationMs: Number(Number(durationMs).toFixed(2)),
    rowCount: rowCount === undefined ? null : rowCount,
    error: error || null,
  });

  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
}

function list(limit = 60) {
  return entries.slice(0, Math.max(1, Math.min(limit, MAX_ENTRIES)));
}

/** Every statement recorded during this exact HTTP request, oldest last. */
function forCurrentRequest(limit = 30) {
  const trace = currentTrace();
  if (!trace) return [];
  return entries.filter((entry) => entry.traceId === trace.id).slice(0, limit);
}

module.exports = { runWithRequest, record, list, forCurrentRequest, currentTrace };
