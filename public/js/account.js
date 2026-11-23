/* ==========================================================================
   account.js — "My listings" management page.
   ========================================================================== */

(async () => {
  const root = document.getElementById('myListings');
  if (!root) return;

  const user = await App.loadUser();
  if (!user) {
    window.location.replace(`/login.html?next=${encodeURIComponent('/account.html')}`);
    return;
  }

  const nameSlot = document.getElementById('accountName');
  const metaSlot = document.getElementById('accountMeta');
  const countSlot = document.getElementById('listingCount');

  if (nameSlot) nameSlot.textContent = user.fullName;
  if (metaSlot) {
    const parts = [user.program, user.yearLevel ? `Year ${user.yearLevel}` : null, user.studentId]
      .filter(Boolean)
      .join(' · ');
    metaSlot.innerHTML = `${escapeHtml(parts || user.email)}${
      user.organization === 'external'
        ? ' · <span class="pill pill--external">Outside organization</span>'
        : ''
    }`;
  }

  function row(listing) {
    return `
      <div class="row" data-id="${listing.id}">
        <a class="row__thumb" href="/listing.html?id=${listing.id}">${mediaInner(listing)}</a>
        <div>
          <a class="row__title" href="/listing.html?id=${listing.id}">${escapeHtml(listing.title)}</a>
          <p class="row__meta">
            ${escapeHtml(listing.category.name)} ·
            <span class="status-text status-text--${listing.status}">${statusLabel(listing.status)}</span> ·
            ${timeAgo(listing.createdAt)} · ${listing.views} view${listing.views === 1 ? '' : 's'}
          </p>
          <p class="row__price">${peso(listing.price)}</p>
        </div>
        <div class="row__actions">
          <a class="btn btn--ghost btn--sm" href="/listing.html?id=${listing.id}">View</a>
          <a class="btn btn--ghost btn--sm" href="/sell.html?id=${listing.id}">Edit</a>
          <button class="btn btn--danger btn--sm" type="button" data-delete="${listing.id}">Delete</button>
        </div>
      </div>`;
  }

  function emptyState() {
    root.innerHTML = `
      <div class="empty">
        <div class="empty__icon">🏷️</div>
        <h3>You have no listings yet</h3>
        <p>Post textbooks, calculators, uniforms, or dorm gear you no longer need.</p>
        <a class="btn btn--primary" href="/sell.html">Post your first item</a>
      </div>`;
    if (countSlot) countSlot.textContent = '0 listings';
  }

  try {
    const payload = await API.get('/api/listings?mine=1&limit=48&sort=newest');
    const listings = payload.data;

    if (countSlot) {
      countSlot.textContent = `${listings.length} listing${listings.length === 1 ? '' : 's'}`;
    }

    if (!listings.length) {
      emptyState();
      return;
    }

    root.innerHTML = listings.map(row).join('');

    root.querySelectorAll('[data-delete]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = button.dataset.delete;
        if (!window.confirm('Delete this listing? It will disappear from the marketplace.')) return;

        button.disabled = true;
        button.textContent = 'Deleting…';

        try {
          await API.del(`/api/listings/${id}`);
          root.querySelector(`.row[data-id="${id}"]`)?.remove();
          App.toast('Listing deleted.');

          const remaining = root.querySelectorAll('.row').length;
          if (countSlot) {
            countSlot.textContent = `${remaining} listing${remaining === 1 ? '' : 's'}`;
          }
          if (!remaining) emptyState();
        } catch (error) {
          button.disabled = false;
          button.textContent = 'Delete';
          App.toast(error.message, 'error');
        }
      });
    });
  } catch (error) {
    root.innerHTML = `
      <div class="empty">
        <div class="empty__icon">⚠️</div>
        <h3>Could not load your listings</h3>
        <p>${escapeHtml(error.message)}</p>
        <button class="btn btn--ghost" type="button" onclick="window.location.reload()">Try again</button>
      </div>`;
  }
})();
