/* ==========================================================================
   admin-listings.js — moderation table with soft delete and restore.
   ========================================================================== */

(async () => {
  const ok = await Admin.requireAdmin();
  if (!ok) return;
  Admin.markNav('listings');

  const slot = document.getElementById('listingsTable');
  const filters = document.getElementById('listingFilters');
  const countSlot = document.getElementById('listingCount');

  function row(listing) {
    const removed = listing.status === 'removed';

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="table-thumb">${mediaInner(listing)}</span>
            <span>
              <a class="strong" href="/listing.html?id=${listing.id}">${escapeHtml(listing.title)}</a>
              <span class="table-sub">#${listing.id} · ${listing.views} views</span>
            </span>
          </div>
        </td>
        <td>${escapeHtml(listing.seller.name)}</td>
        <td>${escapeHtml(listing.category.name)}</td>
        <td>${escapeHtml(listing.campus ? listing.campus.name : '—')}</td>
        <td class="num">${peso(listing.price)}</td>
        <td>${Admin.statusPill(listing.status)}</td>
        <td>${timeAgo(listing.createdAt)}</td>
        <td>
          ${
            removed
              ? `<button class="btn btn--primary btn--sm" type="button" data-restore="${listing.id}">Restore</button>`
              : `<button class="btn btn--danger btn--sm" type="button" data-remove="${listing.id}">Remove</button>`
          }
        </td>
      </tr>`;
  }

  function render(listings) {
    if (countSlot) countSlot.textContent = `${listings.length} listing${listings.length === 1 ? '' : 's'}`;

    if (!listings.length) {
      slot.innerHTML = Admin.empty('🔎', 'No listings match', 'Try a different title, seller, or status.');
      return;
    }

    slot.innerHTML = `
      <table class="data-table">
        <thead>
          <tr><th>Item</th><th>Seller</th><th>Category</th><th>Campus</th><th class="num">Price</th><th>Status</th><th>Posted</th><th>Action</th></tr>
        </thead>
        <tbody>${listings.map(row).join('')}</tbody>
      </table>`;
  }

  async function load() {
    const params = new URLSearchParams();
    const q = document.getElementById('listingSearch').value.trim();
    const status = document.getElementById('listingStatus').value;

    if (q) params.set('q', q);
    if (status !== 'all') params.set('status', status);

    const payload = await API.get(`/api/admin/listings?${params.toString()}`);
    render(payload.data);
  }

  filters.addEventListener('submit', (event) => {
    event.preventDefault();
    load().catch((error) => App.toast(error.message, 'error'));
  });

  document.getElementById('listingStatus').addEventListener('change', () => {
    load().catch((error) => App.toast(error.message, 'error'));
  });

  slot.addEventListener('click', async (event) => {
    const remove = event.target.closest('[data-remove]');
    const restore = event.target.closest('[data-restore]');
    if (!remove && !restore) return;

    const button = remove || restore;
    const id = remove ? remove.dataset.remove : restore.dataset.restore;

    if (remove && !window.confirm('Remove this listing from the marketplace?')) return;

    button.disabled = true;
    const label = button.textContent;
    button.textContent = 'Saving…';

    try {
      if (remove) {
        await API.del(`/api/admin/listings/${id}`);
        App.toast('Listing removed.');
      } else {
        await API.post(`/api/admin/listings/${id}/restore`);
        App.toast('Listing restored.');
      }
      await load();
    } catch (error) {
      button.disabled = false;
      button.textContent = label;
      App.toast(error.message, 'error');
    }
  });

  try {
    await load();
  } catch (error) {
    slot.innerHTML = Admin.empty('⚠️', 'Could not load listings', error.message);
  }
})();
