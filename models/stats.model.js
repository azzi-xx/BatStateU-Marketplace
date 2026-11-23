/**
 * Read-only aggregations for the admin dashboard.
 *
 * All counting happens in SQL — the browser receives finished numbers and
 * Chart.js only draws them. This keeps the payload small and the figures exact.
 */
const { db } = require('../config/db');

function overview() {
  const users = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN role = 'student'  THEN 1 ELSE 0 END) AS students,
         SUM(CASE WHEN role = 'admin'    THEN 1 ELSE 0 END) AS admins,
         SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended,
         SUM(CASE WHEN last_seen_at >= datetime('now', '-5 minutes') THEN 1 ELSE 0 END) AS online,
         SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS newThisWeek
       FROM users`
    )
    .get();

  const listings = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status <> 'removed' THEN 1 ELSE 0 END) AS total,
         SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available,
         SUM(CASE WHEN status = 'reserved'  THEN 1 ELSE 0 END) AS reserved,
         SUM(CASE WHEN status = 'sold'      THEN 1 ELSE 0 END) AS sold,
         SUM(CASE WHEN status = 'removed'   THEN 1 ELSE 0 END) AS removed,
         SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS newThisWeek
       FROM listings`
    )
    .get();

  const orders = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN amount_centavos ELSE 0 END), 0) AS revenueCentavos,
         COALESCE(SUM(CASE WHEN status = 'completed' AND completed_at >= datetime('now', '-30 days')
                           THEN amount_centavos ELSE 0 END), 0) AS revenue30dCentavos,
         COALESCE(SUM(CASE WHEN status = 'completed' AND completed_at >= datetime('now', '-7 days')
                           THEN amount_centavos ELSE 0 END), 0) AS revenue7dCentavos
       FROM orders`
    )
    .get();

  const messages = db
    .prepare('SELECT COUNT(*) AS total FROM messages')
    .get();

  return {
    users: {
      total: users.total || 0,
      students: users.students || 0,
      admins: users.admins || 0,
      suspended: users.suspended || 0,
      online: users.online || 0,
      newThisWeek: users.newThisWeek || 0,
    },
    listings: {
      total: listings.total || 0,
      available: listings.available || 0,
      reserved: listings.reserved || 0,
      sold: listings.sold || 0,
      removed: listings.removed || 0,
      newThisWeek: listings.newThisWeek || 0,
    },
    orders: {
      total: orders.total || 0,
      pending: orders.pending || 0,
      completed: orders.completed || 0,
      cancelled: orders.cancelled || 0,
      revenueCentavos: orders.revenueCentavos || 0,
      revenue30dCentavos: orders.revenue30dCentavos || 0,
      revenue7dCentavos: orders.revenue7dCentavos || 0,
    },
    messages: { total: messages.total || 0 },
  };
}

function newUsersByDay(since) {
  return db
    .prepare('SELECT date(created_at) AS day, COUNT(*) AS count FROM users WHERE created_at >= ? GROUP BY day')
    .all(since);
}

function newListingsByDay(since) {
  return db
    .prepare('SELECT date(created_at) AS day, COUNT(*) AS count FROM listings WHERE created_at >= ? GROUP BY day')
    .all(since);
}

function completedOrdersByDay(since) {
  return db
    .prepare(
      `SELECT date(completed_at) AS day, COUNT(*) AS count, COALESCE(SUM(amount_centavos), 0) AS revenueCentavos
         FROM orders
        WHERE status = 'completed' AND completed_at >= ?
        GROUP BY day`
    )
    .all(since);
}

function listingsByCategory() {
  return db
    .prepare(
      `SELECT c.name AS name, COUNT(l.id) AS count
         FROM categories c
         LEFT JOIN listings l ON l.category_id = c.id AND l.status <> 'removed'
        GROUP BY c.id
        ORDER BY c.id`
    )
    .all();
}

function listingsByStatus() {
  return db
    .prepare("SELECT status, COUNT(*) AS count FROM listings WHERE status <> 'removed' GROUP BY status")
    .all();
}

function topSellers(limit = 5) {
  return db
    .prepare(
      `SELECT u.id AS sellerId, u.full_name AS name,
              COUNT(o.id) AS sales,
              COALESCE(SUM(o.amount_centavos), 0) AS revenueCentavos
         FROM orders o
         JOIN users u ON u.id = o.seller_id
        WHERE o.status = 'completed'
        GROUP BY u.id
        ORDER BY revenueCentavos DESC
        LIMIT ?`
    )
    .all(limit);
}

module.exports = {
  overview,
  newUsersByDay,
  newListingsByDay,
  completedOrdersByDay,
  listingsByCategory,
  listingsByStatus,
  topSellers,
};
