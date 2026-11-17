/* ==========================================================================
   api.js — the only place the browser talks to the Express API.
   Presentation layer: no database, no SQL, just HTTP + formatting helpers.
   ========================================================================== */

const API = (() => {
  async function request(method, path, { body, form } = {}) {
    const options = { method, credentials: 'same-origin', headers: {} };

    if (form) {
      options.body = form;
    } else if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(path, options);
    } catch {
      throw new Error('Cannot reach the server. Is it running?');
    }

    const type = response.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await response.json() : null;

    if (!response.ok) {
      const error = new Error(payload?.error?.message || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, { body }),
    patch: (path, body) => request('PATCH', path, { body }),
    del: (path) => request('DELETE', path),
    postForm: (path, form) => request('POST', path, { form }),
    patchForm: (path, form) => request('PATCH', path, { form }),
  };
})();

/* ----------------------------------------------------------- formatting -- */

const CONDITION_LABELS = {
  new: 'Brand new',
  like_new: 'Like new',
  used: 'Used',
  for_parts: 'For parts',
};

const STATUS_LABELS = {
  available: 'Available',
  reserved: 'Reserved',
  sold: 'Sold',
  removed: 'Removed',
};

const CATEGORY_THEME = {
  books: '📚',
  electronics: '💻',
  uniforms: '👕',
  supplies: '✏️',
  dorm: '🛏️',
  others: '📦',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function peso(amount) {
  const n = Number(amount) || 0;
  return (
    '₱' +
    n.toLocaleString('en-PH', {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

function parseServerDate(value) {
  if (!value) return null;
  const text = String(value);
  const iso = text.includes('T') ? text : text.replace(' ', 'T') + 'Z';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function timeAgo(value) {
  const date = parseServerDate(value);
  if (!date) return '';

  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;

  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fullDate(value) {
  const date = parseServerDate(value);
  if (!date) return '—';
  return date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
}

function conditionLabel(value) {
  return CONDITION_LABELS[value] || 'Used';
}

function statusLabel(value) {
  return STATUS_LABELS[value] || value;
}

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function categoryClass(slug) {
  return `media--${CATEGORY_THEME[slug] ? slug : 'others'}`;
}

/** Inner HTML for a listing photo area: real photo or a themed placeholder. */
function mediaInner(listing) {
  if (listing.imagePath) {
    return `<img src="${escapeHtml(listing.imagePath)}" alt="${escapeHtml(listing.title)}" loading="lazy">`;
  }
  const emoji = CATEGORY_THEME[listing.category.slug] || CATEGORY_THEME.others;
  const label = escapeHtml(listing.category.name);
  return `<div class="media-placeholder ${categoryClass(listing.category.slug)}">
    <span>${emoji}</span><em>${label}</em>
  </div>`;
}

/** Validates a ?next= redirect target so it can never point off-site. */
function safeNext(value, fallback = '/') {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}
