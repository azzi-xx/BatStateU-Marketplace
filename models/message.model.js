/**
 * Every SQL statement that touches the `messages` table lives here.
 *
 * A "thread" is identified by (listing_id, two participants). The seller is
 * always listing.seller_id; the other participant is the buyer.
 */
const { db } = require('../config/db');

const MESSAGE_COLUMNS = `
  m.id,
  m.listing_id   AS listingId,
  m.sender_id    AS senderId,
  m.recipient_id AS recipientId,
  m.body,
  m.read_at      AS readAt,
  m.created_at   AS createdAt,
  u.full_name    AS senderName
`;

function listBetween(listingId, a, b) {
  return db
    .prepare(
      `SELECT ${MESSAGE_COLUMNS}
         FROM messages m
         JOIN users u ON u.id = m.sender_id
        WHERE m.listing_id = @listingId
          AND ((m.sender_id = @a AND m.recipient_id = @b)
            OR (m.sender_id = @b AND m.recipient_id = @a))
        ORDER BY m.id ASC`
    )
    .all({ listingId, a, b });
}

function insert({ listingId, senderId, recipientId, body }) {
  const info = db
    .prepare(
      `INSERT INTO messages (listing_id, sender_id, recipient_id, body)
       VALUES (@listingId, @senderId, @recipientId, @body)`
    )
    .run({ listingId, senderId, recipientId, body });
  return db.prepare(`SELECT ${MESSAGE_COLUMNS} FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`).get(info.lastInsertRowid);
}

function markRead(listingId, readerId, partnerId) {
  db.prepare(
    `UPDATE messages SET read_at = datetime('now')
      WHERE listing_id = @listingId AND recipient_id = @readerId AND sender_id = @partnerId AND read_at IS NULL`
  ).run({ listingId, readerId, partnerId });
}

/**
 * Conversation list: one row per (listing, other person), newest first.
 * The aggregation is done in SQL, not in the browser.
 */
function threadsFor(userId) {
  return db
    .prepare(
      `
      WITH threads AS (
        SELECT
          listing_id,
          CASE WHEN sender_id = @me THEN recipient_id ELSE sender_id END AS partner_id,
          MAX(created_at) AS last_at,
          COUNT(*)        AS message_count,
          SUM(CASE WHEN recipient_id = @me AND read_at IS NULL THEN 1 ELSE 0 END) AS unread
        FROM messages
        WHERE sender_id = @me OR recipient_id = @me
        GROUP BY listing_id, partner_id
      )
      SELECT
        t.listing_id    AS listingId,
        t.partner_id    AS partnerId,
        t.last_at       AS lastAt,
        t.message_count AS messageCount,
        t.unread,
        l.title         AS listingTitle,
        l.image_path    AS listingImage,
        l.price_centavos AS priceCentavos,
        l.status        AS listingStatus,
        u.full_name     AS partnerName,
        (
          SELECT body FROM messages m2
           WHERE m2.listing_id = t.listing_id
             AND ((m2.sender_id = t.partner_id AND m2.recipient_id = @me)
               OR (m2.sender_id = @me AND m2.recipient_id = t.partner_id))
           ORDER BY m2.id DESC LIMIT 1
        ) AS lastBody
      FROM threads t
      JOIN listings l ON l.id = t.listing_id
      JOIN users    u ON u.id = t.partner_id
      ORDER BY t.last_at DESC
      `
    )
    .all({ me: userId });
}

function unreadCount(userId) {
  return db
    .prepare('SELECT COUNT(*) AS n FROM messages WHERE recipient_id = ? AND read_at IS NULL')
    .get(userId).n;
}

function existsBetween(listingId, a, b) {
  return !!db
    .prepare(
      `SELECT 1 FROM messages
        WHERE listing_id = @listingId
          AND ((sender_id = @a AND recipient_id = @b) OR (sender_id = @b AND recipient_id = @a))
        LIMIT 1`
    )
    .get({ listingId, a, b });
}

module.exports = { listBetween, insert, markRead, threadsFor, unreadCount, existsBetween };
