/** Every SQL statement that touches the `categories` table lives here. */
const { db } = require('../config/db');

function all() {
  return db
    .prepare('SELECT id, name, slug FROM categories ORDER BY id ASC')
    .all();
}

function findBySlug(slug) {
  return db.prepare('SELECT id, name, slug FROM categories WHERE slug = ?').get(slug);
}

function findById(id) {
  return db.prepare('SELECT id, name, slug FROM categories WHERE id = ?').get(id);
}

module.exports = { all, findBySlug, findById };
