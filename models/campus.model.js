/** Every SQL statement that touches the `campuses` table lives here. */
const { db } = require('../config/db');

const COLUMNS = `
  id,
  name,
  slug,
  latitude,
  longitude,
  map_address    AS mapAddress,
  map_checked_at AS mapCheckedAt
`;

function all() {
  return db.prepare(`SELECT ${COLUMNS} FROM campuses ORDER BY id ASC`).all();
}

function findById(id) {
  return db.prepare(`SELECT ${COLUMNS} FROM campuses WHERE id = ?`).get(id);
}

function findBySlug(slug) {
  return db.prepare(`SELECT ${COLUMNS} FROM campuses WHERE slug = ?`).get(slug);
}

/** Fills in coordinates discovered by the external geocoder. */
function setCoordinates(id, latitude, longitude) {
  db.prepare('UPDATE campuses SET latitude = ?, longitude = ? WHERE id = ?').run(
    latitude,
    longitude,
    id
  );
  return findById(id);
}

/** Caches the reverse-geocoded display address (and when it was checked). */
function setMapAddress(id, mapAddress, mapCheckedAt) {
  db.prepare('UPDATE campuses SET map_address = ?, map_checked_at = ? WHERE id = ?').run(
    mapAddress,
    mapCheckedAt,
    id
  );
  return findById(id);
}

module.exports = { all, findById, findBySlug, setCoordinates, setMapAddress };
