/* ==========================================================================
   listing.js — listing detail page.
   ========================================================================== */

(() => {
  const root = document.getElementById('detailRoot');
  if (!root) return;

  const id = new URLSearchParams(window.location.search).get('id');

  function errorState(title, message) {
    root.innerHTML = `
      <div class="empty" style="margin:40px 0 80px">
        <div class="empty__icon">🫥</div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <a class="btn btn--primary" href="/">Browse the marketplace</a>
      </div>`;
  }

  function render(listing) {
    document.title = `${listing.title} · BatStateU Marketplace`;

    const seller = listing.seller;
    const sellerMeta = [seller.program, seller.yearLevel ? `Year ${seller.yearLevel}` : null]
      .filter(Boolean)
      .join(' · ');

    const buyDisabled = listing.status !== 'available';
    const buyLabel = buyDisabled ? `Unavailable — ${statusLabel(listing.status).toLowerCase()}` : 'Request to buy';

    root.innerHTML = `
      <div class="detail">
        <div class="detail__media">
          ${mediaInner(listing)}
          ${listing.status !== 'available' ? `<span class="badge badge--${listing.status}">${statusLabel(listing.status)}</span>` : ''}
        </div>

        <aside class="detail__panel">
          <p class="detail__crumb">${escapeHtml(listing.category.name)}</p>
          <h1 class="detail__title">${escapeHtml(listing.title)}</h1>
          <p class="detail__price">${peso(listing.price)}</p>

          <div class="detail__pills">
            <span class="pill pill--${listing.status}">${statusLabel(listing.status)}</span>
            <span class="pill">${escapeHtml(conditionLabel(listing.condition))}</span>
            <span class="pill">👁 ${listing.views} view${listing.views === 1 ? '' : 's'}</span>
          </div>

          <div class="detail__actions">
            <button class="btn btn--primary btn--block" type="button" disabled>${escapeHtml(buyLabel)}</button>
            <button class="btn btn--ghost btn--block" type="button" disabled>Message seller</button>
          </div>
          <p class="detail__note">Buying and messaging arrive in the next phases of this build.</p>

          <div class="seller">
            <div class="seller__avatar">${escapeHtml(initials(seller.name))}</div>
            <div>
              <div class="seller__name">${escapeHtml(seller.name)}</div>
              <div class="seller__meta">${escapeHtml(sellerMeta || 'BatStateU student')}</div>
            </div>
          </div>

          <div class="meta-list">
            <div class="meta-row"><span>Listing ID</span><span>#${listing.id}</span></div>
            <div class="meta-row"><span>Category</span><span>${escapeHtml(listing.category.name)}</span></div>
            <div class="meta-row"><span>Condition</span><span>${escapeHtml(conditionLabel(listing.condition))}</span></div>
            <div class="meta-row"><span>Posted</span><span>${fullDate(listing.createdAt)}</span></div>
            <div class="meta-row"><span>Last updated</span><span>${timeAgo(listing.updatedAt)}</span></div>
          </div>

          ${
            listing.isOwner
              ? `<div class="detail__actions">
                   <a class="btn btn--ghost btn--block" href="/sell.html?id=${listing.id}">Edit listing</a>
                   <button class="btn btn--danger btn--block" type="button" id="deleteListing">Delete listing</button>
                 </div>`
              : ''
          }
        </aside>

        <div class="description">
          <h2>Description</h2>
          <p>${listing.description ? escapeHtml(listing.description) : 'The seller did not add a description.'}</p>
        </div>
      </div>`;

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
      const payload = await API.get(`/api/listings/${id}`);
      render(payload.data);
    } catch (error) {
      errorState(
        error.status === 404 ? 'Listing not found' : 'Could not load this listing',
        error.message
      );
    }
  }

  init();
})();
