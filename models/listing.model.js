/**
 * Every SQL statement that touches the `listings` table lives here.
 *
 * The joins to `users` and `categories` are done in the data tier on purpose:
 * the application tier receives ready-to-use rows and contains no SQL.
 */
const { db } = require('../config/db');

const LIST_COLUMNS = `
  l.id,
  l.title,
  l.description,
  l.price_centavos  AS priceCentavos,
  l.item_condition  AS itemCondition,
  l.image_path      AS imagePath,
  l.status,
  l.views,
  l.created_at      AS createdAt,
  l.updated_at      AS updatedAt,
  c.id   AS categoryId,
  c.name AS categoryName,
  c.slug AS categorySlug,
  ca.id   AS campusId,
  ca.name AS campusName,
  ca.slug AS campusSlug,
  u.id         AS sellerId,
  u.full_name  AS sellerName,
  u.program    AS sellerProgram,
  u.year_level AS sellerYearLevel,
  u.email      AS sellerEmail,
  uc.id        AS sellerCampusId,
  uc.name      AS sellerCampusName,
  uc.slug      AS sellerCampusSlug
`;

const FROM_JOINS = `
  FROM listings l
  JOIN categories c ON c.id = l.category_id
  LEFT JOIN campuses ca ON ca.id = l.campus_id
  JOIN users      u ON u.id = l.seller_id
  LEFT JOIN campuses uc ON uc.id = u.campus_id
`;

/** Whitelist of sort keys — never interpolate raw user input into SQL. */
const SORT_MAP = {
  newest: 'l.created_at DESC, l.id DESC',
  oldest: 'l.created_at ASC, l.id ASC',
  price_asc: 'l.price_centavos ASC, l.id DESC',
  price_desc: 'l.price_centavos DESC, l.id DESC',
  popular: 'l.views DESC, l.created_at DESC',
};

function buildWhere({ q, categorySlug, campusSlug, sellerId, includeRemoved }) {
  const where = [];
  const params = {};

  if (!includeRemoved) where.push("l.status <> 'removed'");
  if (q) {
    where.push('(l.title LIKE @q OR l.description LIKE @q OR c.name LIKE @q OR ca.name LIKE @q)');
    params.q = `%${q}%`;
  }
  if (categorySlug) {
    where.push('c.slug = @categorySlug');
    params.categorySlug = categorySlug;
  }
  if (campusSlug) {
    where.push('ca.slug = @campusSlug');
    params.campusSlug = campusSlug;
  }
  if (sellerId) {
    where.push('l.seller_id = @sellerId');
    params.sellerId = sellerId;
  }

  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

function list({ q, categorySlug, campusSlug, sellerId, includeRemoved = false, sort = 'newest', limit = 12, offset = 0 }) {
  const { sql: whereSql, params } = buildWhere({ q, categorySlug, campusSlug, sellerId, includeRemoved });
  const orderBy = SORT_MAP[sort] || SORT_MAP.newest;

  const total = db
    .prepare(
      `SELECT COUNT(*) AS n
         FROM listings l
         JOIN categories c ON c.id = l.category_id
         LEFT JOIN campuses ca ON ca.id = l.campus_id
         ${whereSql}`
    )
    .get(params).n;

  const rows = db
    .prepare(`SELECT ${LIST_COLUMNS} ${FROM_JOINS} ${whereSql} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset });

  return { rows, total };
}

function findById(id) {
  return db.prepare(`SELECT ${LIST_COLUMNS} ${FROM_JOINS} WHERE l.id = ?`).get(id);
}

function insert({ sellerId, categoryId, campusId, title, description, priceCentavos, itemCondition, imagePath }) {
  const info = db
    .prepare(
      `INSERT INTO listings (seller_id, category_id, campus_id, title, description, price_centavos, item_condition, image_path)
       VALUES (@sellerId, @categoryId, @campusId, @title, @description, @priceCentavos, @itemCondition, @imagePath)`
    )
    .run({ sellerId, categoryId, campusId, title, description, priceCentavos, itemCondition, imagePath });

  return findById(info.lastInsertRowid);
}

function update(id, { categoryId, campusId, title, description, priceCentavos, itemCondition, imagePath }) {
  db.prepare(
    `UPDATE listings
        SET category_id    = @categoryId,
            campus_id      = @campusId,
            title          = @title,
            description    = @description,
            price_centavos = @priceCentavos,
            item_condition = @itemCondition,
            image_path     = COALESCE(@imagePath, image_path),
            updated_at     = datetime('now')
      WHERE id = @id`
  ).run({ id, categoryId, campusId, title, description, priceCentavos, itemCondition, imagePath });

  return findById(id);
}

function setStatus(id, status) {
  db.prepare("UPDATE listings SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
  return findById(id);
}

function incrementViews(id) {
  db.prepare('UPDATE listings SET views = views + 1 WHERE id = ?').run(id);
}

function countAll() {
  return db.prepare("SELECT COUNT(*) AS n FROM listings WHERE status <> 'removed'").get().n;
}

/** Admin listing table: includes removed rows so moderation stays visible. */
function adminList({ q, status, limit = 200 } = {}) {
  const where = [];
  const params = {};

  if (q) {
    where.push('(l.title LIKE @q OR u.full_name LIKE @q)');
    params.q = `%${q}%`;
  }
  if (status && status !== 'all') {
    where.push('l.status = @status');
    params.status = status;
  }

  return db
    .prepare(
      `SELECT ${LIST_COLUMNS} ${FROM_JOINS}
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY l.created_at DESC
        LIMIT @limit`
    )
    .all({ ...params, limit });
}

module.exports = {
  list,
  findById,
  insert,
  update,
  setStatus,
  incrementViews,
  countAll,
  adminList,
  SORT_MAP,
};
