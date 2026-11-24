/**
 * Read-only queries for the admin data lab.
 *
 * Nothing here mutates data. The goal is to show the shape of the database and
 * the activity around one listing, while keeping every SQL statement in the data
 * tier as usual.
 */
const { db } = require('../config/db');

/** Table names are hardcoded: PRAGMA cannot take a bound parameter. */
const TABLES = ['users', 'campuses', 'categories', 'listings', 'orders', 'messages'];

function tableCounts() {
  return db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM users)      AS users,
         (SELECT COUNT(*) FROM campuses)   AS campuses,
         (SELECT COUNT(*) FROM categories) AS categories,
         (SELECT COUNT(*) FROM listings)   AS listings,
         (SELECT COUNT(*) FROM orders)     AS orders,
         (SELECT COUNT(*) FROM messages)   AS messages`
    )
    .get();
}

function tableColumns() {
  return TABLES.map((table) => ({
    table,
    columns: db.prepare(`PRAGMA table_info(${table})`).all().map((column) => ({
      name: column.name,
      type: column.type,
      notNull: Boolean(column.notnull),
      primaryKey: Boolean(column.pk),
    })),
  }));
}

/** Recent messages, joined so the page can render names without extra calls. */
function recentMessages(limit = 6) {
  return db
    .prepare(
      `SELECT
         m.id,
         m.listing_id   AS listingId,
         l.title        AS listingTitle,
         m.sender_id    AS senderId,
         s.full_name    AS senderName,
         m.recipient_id AS recipientId,
         r.full_name    AS recipientName,
         m.body,
         m.read_at      AS readAt,
         m.created_at   AS createdAt
       FROM messages m
       JOIN listings l ON l.id = m.listing_id
       JOIN users    s ON s.id = m.sender_id
       JOIN users    r ON r.id = m.recipient_id
       ORDER BY m.id DESC
       LIMIT ?`
    )
    .all(limit);
}

/** Per-listing counts used by the pipeline panel. */
function listingActivity(listingId) {
  const orders = db
    .prepare(
      `SELECT status, COUNT(*) AS count
         FROM orders
        WHERE listing_id = ?
        GROUP BY status`
    )
    .all(listingId);

  const messages = db
    .prepare('SELECT COUNT(*) AS count FROM messages WHERE listing_id = ?')
    .get(listingId);

  return {
    orders: orders.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {}),
    messages: messages.count,
  };
}

module.exports = { TABLES, tableCounts, tableColumns, recentMessages, listingActivity };
