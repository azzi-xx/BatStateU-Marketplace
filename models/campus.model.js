/** Every SQL statement that touches the `campuses` table lives here. */
const { db } = require('../config/db');

function all() {
  return db.prepare('SELECT id, name, slug FROM campuses ORDER BY id ASC').all();
}

function findById(id) {
  return db.prepare('SELECT id, name, slug FROM campuses WHERE id = ?').get(id);
}

function findBySlug(slug) {
  return db.prepare('SELECT id, name, slug FROM campuses WHERE slug = ?').get(slug);
}

module.exports = { all, findById, findBySlug };
