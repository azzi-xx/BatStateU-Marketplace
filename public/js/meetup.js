/* ==========================================================================
   meetup.js — seller pins a pickup spot, buyer confirms or asks for another.
   ========================================================================== */

(async () => {
  const root = document.getElementById('meetupRoot');
  if (!root) return;

  const user = await App.loadUser();
  if (!user) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/login.html?next=${next}`);
    return;
  }

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id || !/^\d+$/.test(id)) {
    errorState('No order selected', 'Open an order from Purchases & sales to arrange a meetup.');
    return;
  }

  const MEETUP_STATUS = {
    none: { label: 'Not arranged', cls: 'outline' },
    proposed: { label: 'Location proposed', cls: 'pending' },
    confirmed: { label: 'Location confirmed', cls: 'completed' },
    rejected: { label: 'Needs a new spot', cls: 'cancelled' },
  };

  const DEFAULT_TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const DEFAULT_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  const DEFAULT_FALLBACK = 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
  const DEFAULT_FALLBACK_ATTRIBUTION =
    DEFAULT_ATTRIBUTION + ' &copy; <a href="https://carto.com/attributions">CARTO</a>';

  let order = null;
  let map = null;
  let marker = null;

  function errorState(title, message) {
    root.innerHTML = `
      <div class="empty" style="margin:40px 0 80px">
        <div class="empty__icon">🗺️</div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <a class="btn btn--primary" href="/orders.html">Back to my orders</a>
      </div>`;
  }

  async function load() {
    const payload = await API.get(`/api/orders/${id}`);
    order = payload.data;
    render();
  }

  function canPropose() {
    return (
      order.isSeller && order.status === 'pending' && order.meetup.status !== 'confirmed'
    );
  }

  function controls() {
    const meetup = order.meetup;

    if (order.status !== 'pending') {
      return `<p class="meetup__note">This order is ${escapeHtml(order.status)}. The meetup arrangement is now locked.</p>`;
    }

    if (order.isSeller) {
      if (meetup.status === 'confirmed') {
        return '<p class="meetup__note">The buyer confirmed this location. You can confirm the sale from your orders page.</p>';
      }
      return `
        <form class="meetup-form" id="meetupForm">
          <label for="meetupLabel">Place or landmark <span class="hint">(optional)</span></label>
          <input id="meetupLabel" maxlength="80" autocomplete="off"
                 placeholder="e.g. Main library lobby"
                 value="${escapeHtml(meetup.label || '')}" />
          <p class="meetup-coords" id="meetupCoords"></p>
          <button class="btn btn--primary btn--block" type="submit" id="saveMeetup">
            ${meetup.status === 'none' ? 'Save meetup location' : 'Update meetup location'}
          </button>
        </form>`;
    }

    if (order.isBuyer) {
      if (meetup.status === 'proposed') {
        return `
          <div class="detail__actions">
            <button class="btn btn--primary btn--block" type="button" data-meetup-action="confirm">
              Confirm this location
            </button>
            <button class="btn btn--ghost btn--block" type="button" data-meetup-action="reject">
              Ask for another spot
            </button>
          </div>`;
      }
      if (meetup.status === 'rejected') {
        return '<p class="meetup__note">You asked for another spot. The seller can pin a new location.</p>';
      }
      return '<p class="meetup__note">The seller has not proposed a meetup location yet. You can message them from your orders page.</p>';
    }

    return '<p class="meetup__note">Only the buyer and seller can arrange this meetup.</p>';
  }

  function render() {
    const meetup = order.meetup;
    const meta = MEETUP_STATUS[meetup.status] || MEETUP_STATUS.none;
    const place = meetup.label || (meetup.latitude ? 'Pinned location' : 'Not set yet');
    const hint = canPropose()
      ? 'Click the map to drop a pin, drag it to fine-tune, then save.'
      : 'This is the location the seller proposed for the handover.';

    root.innerHTML = `
      <div class="meetup-page">
        <a class="back-link" href="/orders.html">← Back to orders</a>
        <div class="page-head">
          <div>
            <h1>Arrange a meetup</h1>
            <p>Agree on where to hand over <strong>${escapeHtml(order.listing.title)}</strong>.</p>
          </div>
          <span class="pill pill--${meta.cls}">${meta.label}</span>
        </div>

        <div class="meetup-layout">
          <aside class="meetup-panel">
            <h2>Order #${order.id}</h2>
            <div class="meta-list">
              <div class="meta-row"><span>Item</span><span><a href="/listing.html?id=${order.listing.id}">${escapeHtml(order.listing.title)}</a></span></div>
              <div class="meta-row"><span>Amount</span><span>${peso(order.amount)}</span></div>
              <div class="meta-row"><span>${order.isBuyer ? 'Seller' : 'Buyer'}</span><span>${escapeHtml(
                order.isBuyer ? order.seller.name : order.buyer.name
              )}</span></div>
              <div class="meta-row"><span>Campus</span><span>${escapeHtml(
                order.listing.campus ? order.listing.campus.name : 'Not specified'
              )}</span></div>
              <div class="meta-row"><span>Proposed</span><span>${meetup.proposedAt ? fullDate(meetup.proposedAt) : '—'}</span></div>
              <div class="meta-row"><span>Confirmed</span><span>${meetup.confirmedAt ? fullDate(meetup.confirmedAt) : '—'}</span></div>
            </div>

            <div class="meetup-place">
              <span class="meetup-place__label">Agreed spot</span>
              <strong>${escapeHtml(place)}</strong>
              ${meetup.revision ? `<small>Revision ${meetup.revision}</small>` : ''}
            </div>

            ${controls()}
          </aside>

          <section class="meetup-map-card" aria-labelledby="meetupMapTitle">
            <div class="meetup-map-card__head">
              <h2 id="meetupMapTitle">Pickup location</h2>
              <span class="campus-map-card__badge">OpenStreetMap</span>
            </div>
            <div class="meetup-map" id="meetupMap" aria-label="Map showing the proposed meetup spot"></div>
            <p class="meetup-map__hint">${escapeHtml(hint)}</p>
            <p class="meetup-map__credit" id="meetupCredit">Map data &copy; OpenStreetMap contributors</p>
          </section>
        </div>
      </div>`;

    wire();
    initMap();
  }

  function initMap() {
    const container = document.getElementById('meetupMap');
    if (!container) return;

    if (map) {
      map.remove();
      map = null;
      marker = null;
    }

    if (!window.L) {
      container.innerHTML =
        '<p class="campus-map__fallback">The map library could not load.</p>';
      return;
    }

    const config = order.map || {};
    const meetup = order.meetup;
    const campus = order.listing.campus || {};
    const lat = Number.isFinite(meetup.latitude)
      ? meetup.latitude
      : Number.isFinite(campus.latitude)
        ? campus.latitude
        : 13.75;
    const lng = Number.isFinite(meetup.longitude)
      ? meetup.longitude
      : Number.isFinite(campus.longitude)
        ? campus.longitude
        : 121.05;

    map = L.map(container, { scrollWheelZoom: false }).setView([lat, lng], 16);

    const primary = L.tileLayer(config.tileUrl || DEFAULT_TILE, {
      maxZoom: 19,
      attribution: config.attribution || DEFAULT_ATTRIBUTION,
    }).addTo(map);

    let tileErrors = 0;
    let fallbackLayer = null;
    primary.on('tileerror', () => {
      tileErrors += 1;
      if (tileErrors < 3 || fallbackLayer) return;

      map.removeLayer(primary);
      fallbackLayer = L.tileLayer(config.fallbackTileUrl || DEFAULT_FALLBACK, {
        maxZoom: 19,
        attribution: config.fallbackAttribution || DEFAULT_FALLBACK_ATTRIBUTION,
      }).addTo(map);

      const badge = document.querySelector('.meetup-map-card .campus-map-card__badge');
      if (badge) badge.textContent = 'OpenStreetMap · CARTO';
      const credit = document.getElementById('meetupCredit');
      if (credit) credit.textContent = 'Map data © OpenStreetMap contributors · © CARTO';
    });

    const hasPin = Number.isFinite(meetup.latitude) && Number.isFinite(meetup.longitude);
    if (hasPin) {
      marker = L.marker([meetup.latitude, meetup.longitude], {
        draggable: canPropose(),
      }).addTo(map);
      marker.bindPopup(`<strong>${escapeHtml(meetup.label || 'Meetup spot')}</strong>`);
    }

    function showCoords(latlng) {
      const slot = document.getElementById('meetupCoords');
      if (!slot) return;
      slot.textContent = latlng
        ? `Pin: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`
        : 'Click the map to drop a pin.';
    }

    if (canPropose()) {
      map.on('click', (event) => {
        if (!marker) {
          marker = L.marker(event.latlng, { draggable: true }).addTo(map);
          marker.bindPopup('<strong>Your meetup spot</strong>');
        } else {
          marker.setLatLng(event.latlng);
        }
        marker.openPopup();
        showCoords(marker.getLatLng());
      });

      if (marker) marker.on('dragend', () => showCoords(marker.getLatLng()));
      showCoords(marker ? marker.getLatLng() : null);
    }

    window.setTimeout(() => map && map.invalidateSize(), 200);
  }

  function wire() {
    const form = document.getElementById('meetupForm');
    if (form) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!marker) {
          App.toast('Click the map to drop a pin first.', 'error');
          return;
        }

        const button = document.getElementById('saveMeetup');
        const latlng = marker.getLatLng();
        const label = document.getElementById('meetupLabel').value.trim();

        button.disabled = true;
        button.textContent = 'Saving…';

        try {
          await API.post(`/api/orders/${id}/meetup`, {
            latitude: latlng.lat,
            longitude: latlng.lng,
            label,
          });
          App.toast('Meetup location saved. The buyer will confirm it.');
          await load();
        } catch (error) {
          button.disabled = false;
          button.textContent = 'Save meetup location';
          App.toast(error.message, 'error');
        }
      });
    }

    root.onclick = async (event) => {
      const button = event.target.closest('[data-meetup-action]');
      if (!button) return;

      const action = button.dataset.meetupAction;
      if (
        action === 'reject' &&
        !window.confirm('Ask the seller to pin a different spot? Your current proposal will be rejected.')
      ) {
        return;
      }

      button.disabled = true;
      try {
        await API.patch(`/api/orders/${id}/meetup`, { action });
        App.toast(action === 'confirm' ? 'Location confirmed.' : 'Asked for another spot.');
        await load();
      } catch (error) {
        button.disabled = false;
        App.toast(error.message, 'error');
      }
    };
  }

  try {
    await load();
  } catch (error) {
    errorState(
      error.status === 404 ? 'Order not found' : 'Could not load this order',
      error.message
    );
  }
})();
