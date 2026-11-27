/**
 * Campus map integration.
 *
 * Flow: browser -> GET /api/campuses/:id/map -> this service -> SQLite (cache)
 *       -> OpenStreetMap Nominatim (external API, only on a cache miss)
 *       -> JSON response -> Leaflet renders OpenStreetMap tiles in the browser.
 *
 * Coordinates come from the seed. The first time a campus map is opened, the
 * reverse-geocoded display address is fetched from the external provider and
 * cached in the `campuses` table, so later requests never leave the system.
 */
const AppError = require('../utils/AppError');
const campusModel = require('../models/campus.model');
const geocoder = require('../config/geocoder');

const TILE_URL =
  process.env.MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Some networks/IP ranges get a 403 from the OpenStreetMap tile server. If the
// primary tiles fail, the browser swaps to CARTO's OSM-based basemap instead.
const FALLBACK_TILE_URL =
  process.env.MAP_FALLBACK_TILE_URL ||
  'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
const FALLBACK_ATTRIBUTION =
  ATTRIBUTION + ' &copy; <a href="https://carto.com/attributions">CARTO</a>';

const DEFAULT_ZOOM = 16;

// The cached address is refreshed once a day. A fallback (provider unreachable)
// is retried after five minutes, and failed lookups are also stamped so a slow
// provider cannot make every page view wait.
const ADDRESS_TTL_MS = 24 * 60 * 60 * 1000;
const FALLBACK_TTL_MS = 5 * 60 * 1000;

function toApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

function parseSqliteDate(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(' ', 'T') + 'Z');
  return Number.isNaN(date.getTime()) ? null : date;
}

function nowSqlite() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function fallbackAddress(campus) {
  return `${campus.name} Campus, Batangas State University, Batangas, Philippines`;
}

/** Keeps reverse-geocoder noise (a nearby office) from replacing the campus line. */
function looksLikeCampus(text, campus) {
  const value = String(text || '').toLowerCase();
  return (
    value.includes('batangas state university') ||
    value.includes(campus.name.toLowerCase())
  );
}

function osmUrl(latitude, longitude) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${DEFAULT_ZOOM}/${latitude}/${longitude}`;
}

function listCampuses() {
  return campusModel.all().map(toApi);
}

/** Tile settings shared with the browser (no external call, safe to embed). */
function publicConfig() {
  return {
    provider: 'OpenStreetMap',
    tileUrl: TILE_URL,
    attribution: ATTRIBUTION,
    fallbackTileUrl: FALLBACK_TILE_URL,
    fallbackAttribution: FALLBACK_ATTRIBUTION,
    zoom: DEFAULT_ZOOM,
  };
}

/**
 * Returns everything the browser needs to draw the map for one campus.
 * Coordinates are guaranteed by the seed; geocoding is only a safety net for
 * campuses added later without coordinates.
 */
async function getCampusMap(campusId) {
  let campus = campusModel.findById(campusId);
  if (!campus) throw AppError.notFound('That campus does not exist.');

  let { latitude, longitude } = campus;
  let coordinateSource = 'database';

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const match = await geocoder
      .geocode(`${campus.name} Campus, Batangas State University, Batangas, Philippines`)
      .catch(() => null);

    if (match) {
      campus = campusModel.setCoordinates(campus.id, match.latitude, match.longitude);
      latitude = match.latitude;
      longitude = match.longitude;
      coordinateSource = 'nominatim';
    }
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw AppError.unprocessable('This campus does not have map coordinates yet.');
  }

  const checkedAt = parseSqliteDate(campus.mapCheckedAt);
  const cachedIsFallback = !campus.mapAddress || campus.mapAddress === fallbackAddress(campus);
  const ttl = cachedIsFallback ? FALLBACK_TTL_MS : ADDRESS_TTL_MS;
  const isStale = !checkedAt || Date.now() - checkedAt.getTime() > ttl;

  let address = campus.mapAddress;
  let addressSource = campus.mapAddress
    ? campus.mapCheckedAt
      ? 'cache'
      : 'database'
    : 'fallback';

  if (isStale) {
    const place = await geocoder.reverseGeocode(latitude, longitude).catch(() => null);

    if (place && looksLikeCampus(place.displayName, campus)) {
      address = place.displayName;
      addressSource = 'nominatim';
    } else if (!address) {
      address = fallbackAddress(campus);
      addressSource = 'fallback';
    }

    campus = campusModel.setMapAddress(campus.id, address, nowSqlite());
  }

  return {
    campus: toApi(campus),
    coordinates: { latitude, longitude },
    address,
    sources: { coordinates: coordinateSource, address: addressSource },
    map: {
      ...publicConfig(),
      osmUrl: osmUrl(latitude, longitude),
    },
    checkedAt: campus.mapCheckedAt,
  };
}

module.exports = { listCampuses, getCampusMap, publicConfig, toApi };
