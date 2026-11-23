/* ==========================================================================
   admin-users.js — search, filter, suspend, reactivate.
   ========================================================================== */

(async () => {
  const me = await Admin.requireAdmin();
  if (!me) return;
  Admin.markNav('users');

  const slot = document.getElementById('usersTable');
  const filters = document.getElementById('userFilters');
  const countSlot = document.getElementById('userCount');

  function row(user) {
    const isSelf = user.id === me.id;
    const isAdmin = user.role === 'admin';
    const canToggle = !isSelf && !isAdmin;
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    const label = user.status === 'active' ? 'Suspend' : 'Activate';

    return `
      <tr>
        <td>
          <span class="strong">${escapeHtml(user.fullName)}</span>
          <span class="table-sub">${escapeHtml(user.email)}</span>
        </td>
        <td>
          ${escapeHtml(user.program || '—')}
          <span class="table-sub">${user.yearLevel ? `Year ${user.yearLevel}` : escapeHtml(user.studentId || '—')}</span>
        </td>
        <td>${Admin.statusPill(user.role)}</td>
        <td>${Admin.statusPill(user.status)}</td>
        <td class="num">${user.listingCount}</td>
        <td class="num">${user.purchaseCount}</td>
        <td class="num">${user.salesCount}</td>
        <td>${timeAgo(user.lastSeenAt) || '—'}</td>
        <td>
          ${
            canToggle
              ? `<button class="btn btn--${user.status === 'active' ? 'danger' : 'primary'} btn--sm"
                         type="button" data-user="${user.id}" data-next="${nextStatus}">${label}</button>`
              : `<span class="admin-note">${isSelf ? 'You' : 'Protected'}</span>`
          }
        </td>
      </tr>`;
  }

  function render(users) {
    if (countSlot) countSlot.textContent = `${users.length} user${users.length === 1 ? '' : 's'}`;

    if (!users.length) {
      slot.innerHTML = Admin.empty('🔎', 'No users match', 'Try a different name, role, or status.');
      return;
    }

    slot.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>User</th><th>Program</th><th>Role</th><th>Status</th>
            <th class="num">Listings</th><th class="num">Buys</th><th class="num">Sales</th>
            <th>Last seen</th><th>Action</th>
          </tr>
        </thead>
        <tbody>${users.map(row).join('')}</tbody>
      </table>`;
  }

  async function load() {
    const params = new URLSearchParams();
    const q = document.getElementById('userSearch').value.trim();
    const role = document.getElementById('userRole').value;
    const status = document.getElementById('userStatus').value;

    if (q) params.set('q', q);
    if (role !== 'all') params.set('role', role);
    if (status !== 'all') params.set('status', status);

    const payload = await API.get(`/api/admin/users?${params.toString()}`);
    render(payload.data);
  }

  filters.addEventListener('submit', (event) => {
    event.preventDefault();
    load().catch((error) => App.toast(error.message, 'error'));
  });

  document.getElementById('userRole').addEventListener('change', () => load().catch((error) => App.toast(error.message, 'error')));
  document.getElementById('userStatus').addEventListener('change', () => load().catch((error) => App.toast(error.message, 'error')));

  slot.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-user]');
    if (!button) return;

    const next = button.dataset.next;
    if (!window.confirm(`Set this account to "${next}"?`)) return;

    button.disabled = true;
    const label = button.textContent;
    button.textContent = 'Saving…';

    try {
      await API.patch(`/api/admin/users/${button.dataset.user}`, { status: next });
      App.toast(`Account ${next === 'suspended' ? 'suspended' : 'reactivated'}.`);
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
    slot.innerHTML = Admin.empty('⚠️', 'Could not load users', error.message);
  }
})();
