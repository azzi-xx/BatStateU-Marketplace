/** Every SQL statement that touches the `users` table lives here. */
const { db } = require('../config/db');

const PUBLIC_COLUMNS = `
  id,
  student_id  AS studentId,
  full_name   AS fullName,
  email,
  role,
  program,
  year_level  AS yearLevel,
  status,
  last_seen_at AS lastSeenAt,
  created_at  AS createdAt
`;

function findPublicById(id) {
  return db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`).get(id);
}

function findByEmail(email) {
  return db
    .prepare(`SELECT ${PUBLIC_COLUMNS}, password_hash AS passwordHash FROM users WHERE email = ?`)
    .get(email);
}

function findByIdWithHash(id) {
  return db
    .prepare(`SELECT ${PUBLIC_COLUMNS}, password_hash AS passwordHash FROM users WHERE id = ?`)
    .get(id);
}

function existsByEmail(email) {
  return !!db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
}

function existsByStudentId(studentId) {
  return !!db.prepare('SELECT 1 FROM users WHERE student_id = ?').get(studentId);
}

function create({ studentId, fullName, email, passwordHash, role = 'student', program = null, yearLevel = null }) {
  const info = db
    .prepare(
      `INSERT INTO users (student_id, full_name, email, password_hash, role, program, year_level)
       VALUES (@studentId, @fullName, @email, @passwordHash, @role, @program, @yearLevel)`
    )
    .run({ studentId, fullName, email, passwordHash, role, program, yearLevel });

  return findPublicById(info.lastInsertRowid);
}

function touchLastSeen(id) {
  db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").run(id);
}

function countAll() {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
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
};
