/* ==========================================================================
   admin.js — shared guard and small render helpers for /admin pages.
   ========================================================================== */

const Admin = (() => {
  async function requireAdmin() {
    const user = await App.loadUser();

    if (!user) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login.html?next=${next}`);
      return null;
    }

    if (user.role !== 'admin') {
      window.location.replace('/');
      return null;
    }

    return user;
  }

  function markNav(page) {
    document.querySelectorAll('.admin-subnav__item[data-page]').forEach((item) => {
      item.classList.toggle('is-active', item.dataset.page === page);
    });
  }

  function statusPill(status) {
    const labels = {
      pending: 'Pending',
      completed: 'Completed',
      cancelled: 'Cancelled',
      available: 'Available',
      reserved: 'Reserved',
      sold: 'Sold',
      removed: 'Removed',
      active: 'Active',
      suspended: 'Suspended',
      student: 'Student',
      admin: 'Admin',
    };

    const classes = {
      pending: 'pending',
      completed: 'completed',
      cancelled: 'cancelled',
      available: 'available',
      reserved: 'reserved',
      sold: 'sold',
      removed: 'removed',
      active: 'available',
      suspended: 'suspended',
    };

    return `<span class="pill pill--${classes[status] || 'outline'}">${labels[status] || status}</span>`;
  }

  function empty(icon, title, message) {
    return `
      <div class="empty">
        <div class="empty__icon">${icon}</div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
      </div>`;
  }

  return { requireAdmin, markNav, statusPill, empty };
})();
