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

  function render(item) {
    document.title = `${item.title} · BatStateU Marketplace`;

    const seller = item.seller;
    const sellerMeta = [seller.program, seller.yearLevel ? `Year ${seller.yearLevel}` : null]
      .filter(Boolean)
      .join(' · ');

    root.innerHTML = `
      <div class="detail">
        <div class="detail__media">
          ${mediaInner(item)}
          ${item.status !== 'available' ? `<span class="badge badge--${item.status}">${statusLabel(item.status)}</span>` : ''}
        </div>

        <aside class="detail__panel">
          <p class="detail__crumb">${escapeHtml(item.category.name)}</p>
          <h1 class="detail__title">${escapeHtml(item.title)}</h1>
          <p class="detail__price">${peso(item.price)}</p>

          <div class="detail__pills">
            <span class="pill pill--${item.status}">${statusLabel(item.status)}</span>
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
              <div class="seller__name">${escapeHtml(seller.name)}</div>
              <div class="seller__meta">${escapeHtml(sellerMeta || 'BatStateU student')}</div>
            </div>
          </div>

          <div class="meta-list">
            <div class="meta-row"><span>Listing ID</span><span>#${item.id}</span></div>
            <div class="meta-row"><span>Category</span><span>${escapeHtml(item.category.name)}</span></div>
            <div class="meta-row"><span>Condition</span><span>${escapeHtml(conditionLabel(item.condition))}</span></div>
            <div class="meta-row"><span>Posted</span><span>${fullDate(item.createdAt)}</span></div>
            <div class="meta-row"><span>Last updated</span><span>${timeAgo(item.updatedAt)}</span></div>
          </div>
        </aside>

        <div class="description">
          <h2>Description</h2>
          <p>${item.description ? escapeHtml(item.description) : 'The seller did not add a description.'}</p>
        </div>
      </div>`;

    wireActions();
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
