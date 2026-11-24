/** Every SQL statement that touches the `users` table lives here. */
const { db } = require('../config/db');

const PUBLIC_COLUMNS = `
  u.id,
  u.student_id  AS studentId,
  u.full_name   AS fullName,
  u.email,
  u.role,
  u.program,
  u.year_level  AS yearLevel,
  u.campus_id   AS campusId,
  ca.name       AS campusName,
  ca.slug       AS campusSlug,
  u.status,
  u.last_seen_at AS lastSeenAt,
  u.created_at  AS createdAt
`;

const FROM_JOINS = `
  FROM users u
  LEFT JOIN campuses ca ON ca.id = u.campus_id
`;

function findPublicById(id) {
  return db.prepare(`SELECT ${PUBLIC_COLUMNS} ${FROM_JOINS} WHERE u.id = ?`).get(id);
}

function findByEmail(email) {
  return db
    .prepare(`SELECT ${PUBLIC_COLUMNS}, u.password_hash AS passwordHash ${FROM_JOINS} WHERE u.email = ?`)
    .get(email);
}

function findByIdWithHash(id) {
  return db
    .prepare(`SELECT ${PUBLIC_COLUMNS}, u.password_hash AS passwordHash ${FROM_JOINS} WHERE u.id = ?`)
    .get(id);
}

function existsByEmail(email) {
  return !!db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
}

function existsByStudentId(studentId) {
  return !!db.prepare('SELECT 1 FROM users WHERE student_id = ?').get(studentId);
}

function create({
  studentId,
  fullName,
  email,
  passwordHash,
  role = 'student',
  program = null,
  yearLevel = null,
  campusId = null,
}) {
  const info = db
    .prepare(
      `INSERT INTO users (student_id, full_name, email, password_hash, role, program, year_level, campus_id)
       VALUES (@studentId, @fullName, @email, @passwordHash, @role, @program, @yearLevel, @campusId)`
    )
    .run({ studentId, fullName, email, passwordHash, role, program, yearLevel, campusId });

  return findPublicById(info.lastInsertRowid);
}

function touchLastSeen(id) {
  db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").run(id);
}

function countAll() {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
}

/** Admin user list with per-user activity counts. */
function list({ q, role, status, limit = 200 } = {}) {
  const where = [];
  const params = {};

  if (q) {
    where.push('(u.full_name LIKE @q OR u.email LIKE @q OR u.student_id LIKE @q)');
    params.q = `%${q}%`;
  }
  if (role && role !== 'all') {
    where.push('u.role = @role');
    params.role = role;
  }
  if (status && status !== 'all') {
    where.push('u.status = @status');
    params.status = status;
  }

  return db
    .prepare(
      `SELECT ${PUBLIC_COLUMNS},
              (SELECT COUNT(*) FROM listings l WHERE l.seller_id = u.id AND l.status <> 'removed') AS listingCount,
              (SELECT COUNT(*) FROM orders o WHERE o.buyer_id = u.id) AS purchaseCount,
              (SELECT COUNT(*) FROM orders o WHERE o.seller_id = u.id AND o.status = 'completed') AS salesCount
         ${FROM_JOINS}
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY u.created_at DESC
        LIMIT @limit`
    )
    .all({ ...params, limit });
}

function setStatus(id, status) {
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
  return findPublicById(id);
}

function setCampus(id, campusId) {
  db.prepare('UPDATE users SET campus_id = ? WHERE id = ?').run(campusId, id);
  return findPublicById(id);
}

module.exports = {
  findPublicById,
  findByEmail,
  findByIdWithHash,
  existsByEmail,
  existsByStudentId,
  create,
  touchLastSeen,
  countAll,
  list,
  setStatus,
  setCampus,
};
