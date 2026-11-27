/**
 * Every SQL statement that touches the `orders` table lives here.
 *
 * Status transitions are wrapped in transactions so the order row and the
 * listing row can never disagree about what happened.
 */
const { db } = require('../config/db');

const ORDER_SELECT = `
  SELECT
    o.id,
    o.listing_id      AS listingId,
    o.buyer_id        AS buyerId,
    o.seller_id       AS sellerId,
    o.amount_centavos AS amountCentavos,
    o.status,
    o.note,
    o.created_at      AS createdAt,
    o.updated_at      AS updatedAt,
    o.completed_at    AS completedAt,
    o.meetup_latitude    AS meetupLatitude,
    o.meetup_longitude   AS meetupLongitude,
    o.meetup_label       AS meetupLabel,
    o.meetup_status      AS meetupStatus,
    o.meetup_revision    AS meetupRevision,
    o.meetup_proposed_at AS meetupProposedAt,
    o.meetup_confirmed_at AS meetupConfirmedAt,
    l.title           AS listingTitle,
    l.image_path      AS listingImage,
    l.status          AS listingStatus,
    c.name            AS categoryName,
    c.slug            AS categorySlug,
    lca.id            AS listingCampusId,
    lca.name          AS listingCampusName,
    lca.slug          AS listingCampusSlug,
    lca.latitude      AS listingCampusLatitude,
    lca.longitude     AS listingCampusLongitude,
    b.full_name       AS buyerName,
    s.full_name       AS sellerName
  FROM orders o
  JOIN listings  l ON l.id = o.listing_id
  JOIN categories c ON c.id = l.category_id
  LEFT JOIN campuses lca ON lca.id = l.campus_id
  JOIN users     b ON b.id = o.buyer_id
  JOIN users     s ON s.id = o.seller_id
`;

function findById(id) {
  return db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(id);
}

function findPendingForListing(listingId) {
  return db
    .prepare(`${ORDER_SELECT} WHERE o.listing_id = @listingId AND o.status = 'pending'`)
    .get({ listingId });
}

function listForBuyer(buyerId) {
  return db.prepare(`${ORDER_SELECT} WHERE o.buyer_id = ? ORDER BY o.created_at DESC`).all(buyerId);
}

function listForSeller(sellerId) {
  return db.prepare(`${ORDER_SELECT} WHERE o.seller_id = ? ORDER BY o.created_at DESC`).all(sellerId);
}

/** Admin order table: newest first, optionally filtered by status. */
function listAll({ status = 'all', limit = 200 } = {}) {
  const params = { limit };
  let where = '';

  if (status && status !== 'all') {
    where = 'WHERE o.status = @status';
    params.status = status;
  }

  return db.prepare(`${ORDER_SELECT} ${where} ORDER BY o.created_at DESC LIMIT @limit`).all(params);
}

/** Used by the messaging rules: has this user ever tried to buy this listing? */
function existsForListingAndBuyer(listingId, buyerId) {
  return !!db
    .prepare('SELECT 1 FROM orders WHERE listing_id = ? AND buyer_id = ? LIMIT 1')
    .get(listingId, buyerId);
}

function insert({ listingId, buyerId, sellerId, amountCentavos, note }) {
  const info = db
    .prepare(
      `INSERT INTO orders (listing_id, buyer_id, seller_id, amount_centavos, note)
       VALUES (@listingId, @buyerId, @sellerId, @amountCentavos, @note)`
    )
    .run({ listingId, buyerId, sellerId, amountCentavos, note });
  return findById(info.lastInsertRowid);
}

/**
 * Request + reserve in one transaction.
 * Throws SQLITE_CONSTRAINT_UNIQUE if another pending order already exists.
 */
const createWithReservation = db.transaction((payload) => {
  const order = insert(payload);
  db.prepare("UPDATE listings SET status = 'reserved', updated_at = datetime('now') WHERE id = ? AND status = 'available'").run(
    payload.listingId
  );
  return order;
});

/** Seller confirms → order completed, listing sold. */
const completeWithListing = db.transaction((id) => {
  const order = findById(id);
  db.prepare(
    "UPDATE orders SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).run(id);
  db.prepare("UPDATE listings SET status = 'sold', updated_at = datetime('now') WHERE id = ?").run(order.listingId);
  return findById(id);
});

/** Cancel → order cancelled, listing goes back on the market. */
const cancelWithRelease = db.transaction((id) => {
  const order = findById(id);
  db.prepare(
    "UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?"
  ).run(id);
  db.prepare(
    "UPDATE listings SET status = 'available', updated_at = datetime('now') WHERE id = ? AND status = 'reserved'"
  ).run(order.listingId);
  return findById(id);
});

function countPendingForSeller(sellerId) {
  return db
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE seller_id = ? AND status = 'pending'")
    .get(sellerId).n;
}

/** Seller pins a meetup spot. A rejection simply starts a new revision. */
function proposeMeetup(id, { latitude, longitude, label }) {
  db.prepare(
    `UPDATE orders
        SET meetup_latitude    = @latitude,
            meetup_longitude   = @longitude,
            meetup_label       = @label,
            meetup_status      = 'proposed',
            meetup_revision    = meetup_revision + 1,
            meetup_proposed_at = datetime('now'),
            meetup_confirmed_at = NULL,
            updated_at         = datetime('now')
      WHERE id = @id`
  ).run({ id, latitude, longitude, label });
  return findById(id);
}

/** Buyer confirms or rejects the current proposal. */
function respondMeetup(id, status) {
  const confirmedAt = status === 'confirmed' ? ", meetup_confirmed_at = datetime('now')" : '';
  db.prepare(
    `UPDATE orders
        SET meetup_status = @status${confirmedAt},
            updated_at    = datetime('now')
      WHERE id = @id`
  ).run({ id, status });
  return findById(id);
}

module.exports = {
  findById,
  findPendingForListing,
  listForBuyer,
  listForSeller,
  listAll,
  existsForListingAndBuyer,
  insert,
  createWithReservation,
  completeWithListing,
  cancelWithRelease,
  countPendingForSeller,
  proposeMeetup,
  respondMeetup,
};
