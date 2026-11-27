/* ==========================================================================
   listing.js — listing detail page, buy requests, and author actions.
   ========================================================================== */

(() => {
  const root = document.getElementById('detailRoot');
  if (!root) return;

  const id = new URLSearchParams(window.location.search).get('id');
  let me = null;
  let listing = null;

  function errorState(title, message) {
    root.innerHTML = `
      <div class="empty" style="margin:40px 0 80px">
        <div class="empty__icon">🫥</div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <a class="btn btn--primary" href="/">Browse the marketplace</a>
      </div>`;
  }

  function actionButtons(item) {
    if (item.isOwner) {
      const request = item.incomingRequest
        ? `<div class="request-note">
             <strong>${escapeHtml(item.incomingRequest.buyerName)} wants to buy this.</strong>
             ${item.incomingRequest.note ? `<p>“${escapeHtml(item.incomingRequest.note)}”</p>` : ''}
             <a class="btn btn--primary btn--sm" href="/orders.html?view=selling">Review the request</a>
           </div>`
        : '';

      return `
        ${request}
        <div class="detail__actions">
          <a class="btn btn--ghost btn--block" href="/sell.html?id=${item.id}">Edit listing</a>
          <button class="btn btn--danger btn--block" type="button" id="deleteListing">Delete listing</button>
        </div>`;
    }

    const next = encodeURIComponent(`/listing.html?id=${item.id}`);

    if (!me) {
      return `
        <div class="detail__actions">
          <a class="btn btn--primary btn--block" href="/login.html?next=${next}">Log in to request</a>
          <a class="btn btn--ghost btn--block" href="/login.html?next=${next}">Log in to message</a>
        </div>`;
    }

    if (item.viewerOrder) {
      return `
        <div class="detail__actions">
          <button class="btn btn--ghost btn--block" type="button" disabled>Request pending</button>
          <button class="btn btn--danger btn--block" type="button" id="cancelRequest">Cancel request</button>
          <a class="btn btn--ghost btn--block" href="/messages.html?listing=${item.id}">Message seller</a>
        </div>`;
    }

    const unavailable = item.status !== 'available';
    return `
      <div class="detail__actions">
        <button class="btn btn--primary btn--block" type="button" id="buyButton" ${unavailable ? 'disabled' : ''}>
          ${unavailable ? `Unavailable — ${statusLabel(item.status).toLowerCase()}` : 'Request to buy'}
        </button>
        <a class="btn btn--ghost btn--block" href="/messages.html?listing=${item.id}">Message seller</a>
      </div>`;
  }

  function campusMapSection(item) {
    if (!item.campus) return '';

    const { latitude, longitude } = item.campus;
    const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
    const osmHref = hasCoordinates
      ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`
      : 'https://www.openstreetmap.org/';

    return `
      <section class="campus-map-card" aria-labelledby="campusMapTitle">
        <div class="campus-map-card__head">
          <h2 id="campusMapTitle">Campus location</h2>
          <span class="campus-map-card__badge">OpenStreetMap</span>
        </div>
        <div class="campus-map" id="campusMap" aria-label="Map showing ${escapeHtml(
          item.campus.name
        )} campus"></div>
        <div class="campus-map-card__foot">
          <p class="campus-map-card__address" id="campusMapAddress">${escapeHtml(
            item.campus.name
          )} Campus · Batangas State University</p>
          <a class="campus-map-card__link" id="campusMapLink" href="${osmHref}"
             target="_blank" rel="noopener">Open in OpenStreetMap ↗</a>
        </div>
        <p class="campus-map-card__credit">Map data &copy; OpenStreetMap contributors</p>
      </section>`;
  }

  function initCampusMap(item) {
    const container = document.getElementById('campusMap');
    if (!container || !item.campus) return;

    const { latitude, longitude } = item.campus;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      container.innerHTML =
        '<p class="campus-map__fallback">Map coordinates are not available for this campus yet.</p>';
      return;
    }

    if (!window.L) {
      container.innerHTML =
        '<p class="campus-map__fallback">The map library could not load. Use the OpenStreetMap link below.</p>';
      return;
    }

    // Tile endpoints come from the server, so changing one config value covers
    // every listing page. The defaults keep the map working if the API is down.
    const config = Object.assign(
      {
        tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        fallbackTileUrl: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        fallbackAttribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        zoom: 16,
      },
      item.map || {}
    );

    const map = L.map(container, { scrollWheelZoom: false }).setView(
      [latitude, longitude],
      config.zoom
    );

    let tiles = L.tileLayer(config.tileUrl, {
      maxZoom: 19,
      attribution: config.attribution,
    }).addTo(map);

    // Some networks get a 403 from the OpenStreetMap tile server. After a few
    // failed tiles, quietly switch to CARTO's OpenStreetMap-based basemap.
    let tileErrors = 0;
    let usingFallback = false;

    function useFallbackTiles() {
      if (usingFallback) return;
      usingFallback = true;

      map.removeLayer(tiles);
      tiles = L.tileLayer(config.fallbackTileUrl, {
        maxZoom: 19,
        attribution: config.fallbackAttribution,
      }).addTo(map);

      const badge = document.querySelector('.campus-map-card__badge');
      if (badge) badge.textContent = 'OpenStreetMap · CARTO';

      const credit = document.querySelector('.campus-map-card__credit');
      if (credit) credit.textContent = 'Map data © OpenStreetMap contributors · © CARTO';
    }

    tiles.on('tileerror', () => {
      tileErrors += 1;
      if (tileErrors >= 3) useFallbackTiles();
    });

    L.marker([latitude, longitude])
      .addTo(map)
      .bindPopup(
        `<strong>${escapeHtml(item.campus.name)} Campus</strong><br>BatStateU Marketplace pickup area`
      )
      .openPopup();

    // The panel is laid out after the first paint; recompute the map size.
    window.setTimeout(() => map.invalidateSize(), 200);

    // Ask our API for the cached, reverse-geocoded address. On the first view
    // this triggers the external Nominatim call; afterwards it comes from SQLite.
    API.get(`/api/campuses/${item.campus.id}/map`)
      .then((payload) => {
        const data = payload && payload.data;
        if (!data) return;

        const address = document.getElementById('campusMapAddress');
        if (address && data.address) address.textContent = data.address;

        const link = document.getElementById('campusMapLink');
        if (link && data.map && data.map.osmUrl) link.href = data.map.osmUrl;
      })
      .catch(() => {
        /* The map itself already works; the address is a progressive enhancement. */
      });
  }

  function render(item) {
    document.title = `${item.title} · BatStateU Marketplace`;

    const seller = item.seller;
    const sellerMeta = [
      seller.program,
      seller.yearLevel ? `Year ${seller.yearLevel}` : null,
      seller.campus ? seller.campus.name : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const campusLabel = item.campus
      ? `<span class="pill pill--campus">📍 ${escapeHtml(item.campus.name)}</span>`
      : '';

    root.innerHTML = `
      <div class="detail">
        <div class="detail__media">
          ${mediaInner(item)}
          ${item.status !== 'available' ? `<span class="badge badge--${item.status}">${statusLabel(item.status)}</span>` : ''}
          ${item.campus ? `<span class="campus-badge">📍 ${escapeHtml(item.campus.name)}</span>` : ''}
        </div>

        <aside class="detail__panel">
          <p class="detail__crumb">${escapeHtml(item.category.name)}${
            item.campus ? ` · ${escapeHtml(item.campus.name)} campus` : ''
          }</p>
          <h1 class="detail__title">${escapeHtml(item.title)}</h1>
          <p class="detail__price">${peso(item.price)}</p>

          <div class="detail__pills">
            <span class="pill pill--${item.status}">${statusLabel(item.status)}</span>
            ${campusLabel}
            <span class="pill">${escapeHtml(conditionLabel(item.condition))}</span>
            <span class="pill">👁 ${item.views} view${item.views === 1 ? '' : 's'}</span>
          </div>

          ${actionButtons(item)}
          ${
            item.isOwner
              ? ''
              : '<p class="detail__note">Requests are confirmed by the seller before the item is marked sold.</p>'
          }

          <div class="seller">
            <div class="seller__avatar">${escapeHtml(initials(seller.name))}</div>
            <div>
              <div class="seller__name">${escapeHtml(seller.name)}${
              seller.organization === 'external'
                ? ' <span class="pill pill--external pill--sm">Outside org</span>'
                : ''
            }</div>
              <div class="seller__meta">${escapeHtml(sellerMeta || 'BatStateU student')}</div>
            </div>
          </div>

          <div class="meta-list">
            <div class="meta-row"><span>Listing ID</span><span>#${item.id}</span></div>
            <div class="meta-row"><span>Category</span><span>${escapeHtml(item.category.name)}</span></div>
            <div class="meta-row"><span>Campus</span><span>${escapeHtml(item.campus ? item.campus.name : 'Not specified')}</span></div>
            <div class="meta-row"><span>Condition</span><span>${escapeHtml(conditionLabel(item.condition))}</span></div>
            <div class="meta-row"><span>Posted</span><span>${fullDate(item.createdAt)}</span></div>
            <div class="meta-row"><span>Last updated</span><span>${timeAgo(item.updatedAt)}</span></div>
          </div>
        </aside>

        <div class="description">
          <h2>Description</h2>
          <p>${item.description ? escapeHtml(item.description) : 'The seller did not add a description.'}</p>
        </div>

        ${campusMapSection(item)}
      </div>`;

    wireActions();
    initCampusMap(item);
  }

  function wireActions() {
    const deleteButton = document.getElementById('deleteListing');
    if (deleteButton) {
      deleteButton.addEventListener('click', async () => {
        if (!window.confirm('Delete this listing? It will disappear from the marketplace.')) return;

        deleteButton.disabled = true;
        deleteButton.textContent = 'Deleting…';

        try {
          await API.del(`/api/listings/${listing.id}`);
          App.toast('Listing deleted.');
          window.setTimeout(() => {
            window.location.href = '/account.html';
          }, 500);
        } catch (error) {
          deleteButton.disabled = false;
          deleteButton.textContent = 'Delete listing';
          App.toast(error.message, 'error');
        }
      });
    }

    const buyButton = document.getElementById('buyButton');
    if (buyButton) buyButton.addEventListener('click', openBuyDialog);

    const cancelButton = document.getElementById('cancelRequest');
    if (cancelButton) {
      cancelButton.addEventListener('click', async () => {
        if (!window.confirm('Cancel your request to buy this item?')) return;

        cancelButton.disabled = true;
        cancelButton.textContent = 'Cancelling…';

        try {
          await API.patch(`/api/orders/${listing.viewerOrder.id}`, { action: 'cancel' });
          App.toast('Request cancelled.');
          window.setTimeout(() => window.location.reload(), 400);
        } catch (error) {
          cancelButton.disabled = false;
          cancelButton.textContent = 'Cancel request';
          App.toast(error.message, 'error');
        }
      });
    }
  }

  function openBuyDialog() {
    const dialog = document.createElement('dialog');
    dialog.className = 'modal';
    dialog.innerHTML = `
      <form class="modal__body" id="buyForm">
        <div class="modal__head">
          <h2>Request to buy</h2>
          <p>${escapeHtml(listing.title)} · ${peso(listing.price)}</p>
        </div>

        <div class="field">
          <label for="buyNote">Message to seller <span class="hint">(optional)</span></label>
          <textarea id="buyNote" maxlength="300" rows="3"
            placeholder="Pick-up place, preferred time, or a question…"></textarea>
        </div>

        <p class="modal__hint">
          The seller has to confirm. Until then this listing is reserved for you and
          other buyers cannot request it.
        </p>

        <div class="modal__foot">
          <button class="btn btn--ghost" type="button" data-close>Cancel</button>
          <button class="btn btn--primary" type="submit" id="buySubmit">Send request</button>
        </div>
      </form>`;

    document.body.appendChild(dialog);
    dialog.showModal();

    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());

    dialog.querySelector('#buyForm').addEventListener('submit', async (event) => {
      event.preventDefault();

      const button = dialog.querySelector('#buySubmit');
      const note = dialog.querySelector('#buyNote').value.trim();

      button.disabled = true;
      button.textContent = 'Sending…';

      try {
        await API.post('/api/orders', { listingId: listing.id, note });
        dialog.close();
        App.toast('Request sent. The seller will confirm it.');
        window.setTimeout(() => window.location.reload(), 500);
      } catch (error) {
        button.disabled = false;
        button.textContent = 'Send request';
        App.toast(error.message, 'error');
      }
    });
  }

  async function init() {
    if (!id || !/^\d+$/.test(id)) {
      errorState('No listing selected', 'Open a listing from the marketplace to see its details.');
      return;
    }

    root.innerHTML = `
      <div class="detail">
        <div class="skeleton skeleton--media" style="border-radius:20px"></div>
        <div class="detail__panel">
          <div class="skeleton skeleton--line short"></div>
          <div class="skeleton skeleton--line"></div>
          <div class="skeleton skeleton--line"></div>
          <div class="skeleton skeleton--line short"></div>
        </div>
      </div>`;

    try {
      const [user, payload] = await Promise.all([App.loadUser(), API.get(`/api/listings/${id}`)]);
      me = user;
      listing = payload.data;
      render(listing);
    } catch (error) {
      errorState(
        error.status === 404 ? 'Listing not found' : 'Could not load this listing',
        error.message
      );
    }
  }

  init();
})();
