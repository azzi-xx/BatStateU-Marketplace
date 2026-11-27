/**
 * External geocoding adapter (OpenStreetMap Nominatim).
 *
 * This is the only file that knows how to talk to the geocoding provider. It is
 * part of the config tier: services call `geocode` / `reverseGeocode` and never
 * build provider URLs themselves.
 *
 * Nominatim's usage policy asks for a descriptive User-Agent and at most one
 * request per second. We only call it when a campus has no cached address, so
 * that is at most five calls for the whole demo, and the throttle below keeps
 * bursts within the policy.
 */
const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
// Nominatim rejects User-Agent strings that contain an email address, so the
// contact goes in the `email` query parameter instead (their documented option).
const CONTACT = (process.env.MAP_CONTACT || '').trim();
const USER_AGENT = 'BatStateU-Marketplace/1.0 (student project)';
const TIMEOUT_MS = Number(process.env.GEOCODER_TIMEOUT_MS) || 8000;
const MIN_INTERVAL_MS = 1000;

let lastRequestAt = 0;
let queue = Promise.resolve();

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Serialises calls and keeps them at least one second apart. */
function throttle(task) {
  const run = queue.then(async () => {
    const sinceLast = Date.now() - lastRequestAt;
    if (sinceLast < MIN_INTERVAL_MS) await wait(MIN_INTERVAL_MS - sinceLast);
    lastRequestAt = Date.now();
    return task();
  });

  // Keep the chain alive even when a request fails.
  queue = run.catch(() => {});
  return run;
}

async function request(path, params) {
  const url = new URL(path, NOMINATIM_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  if (CONTACT) url.searchParams.set('email', CONTACT);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Geocoder responded with ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Looks up a free-text place and returns the best match, or null when the
 * provider knows nothing about it.
 */
async function geocode(query) {
  return throttle(async () => {
    const rows = await request('/search', {
      q: query,
      format: 'jsonv2',
      limit: '1',
      countrycodes: 'ph',
      addressdetails: '0',
    });

    const first = Array.isArray(rows) ? rows[0] : null;
    if (!first) return null;

    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return { latitude, longitude, displayName: first.display_name || null };
  });
}

/** Turns coordinates into a human-readable address, or null when unavailable. */
async function reverseGeocode(latitude, longitude) {
  return throttle(async () => {
    const row = await request('/reverse', {
      lat: String(latitude),
      lon: String(longitude),
      format: 'jsonv2',
      // Zoom 18 resolves campus buildings by name where OpenStreetMap has them.
      // The service falls back to the seeded campus address when the result is
      // just a nearby office/building.
      zoom: '18',
      addressdetails: '0',
    });

    if (!row || row.error || !row.display_name) return null;
    return { displayName: row.display_name };
  });
}

module.exports = { geocode, reverseGeocode, NOMINATIM_URL };
