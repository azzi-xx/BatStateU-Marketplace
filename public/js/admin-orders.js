/* ==========================================================================
   admin-orders.js — read-only order table with a status filter.
   ========================================================================== */

(async () => {
  const ok = await Admin.requireAdmin();
  if (!ok) return;
  Admin.markNav('orders');

  const slot = document.getElementById('ordersTable');
  const filters = document.getElementById('orderFilters');
  const countSlot = document.getElementById('orderCount');

  function row(order) {
    return `
      <tr>
        <td>#${order.id}</td>
        <td><a class="strong" href="/listing.html?id=${order.listing.id}">${escapeHtml(order.listing.title)}</a></td>
        <td>${escapeHtml(order.buyer.name)}</td>
        <td>${escapeHtml(order.seller.name)}</td>
        <td class="num">${peso(order.amount)}</td>
        <td>${Admin.statusPill(order.status)}</td>
        <td>${timeAgo(order.createdAt)}</td>
        <td>${order.completedAt ? timeAgo(order.completedAt) : '—'}</td>
      </tr>`;
  }

  function render(orders) {
    if (countSlot) countSlot.textContent = `${orders.length} order${orders.length === 1 ? '' : 's'}`;

    if (!orders.length) {
      slot.innerHTML = Admin.empty('🧾', 'No orders match', 'Try a different status.');
      return;
    }

    slot.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Order</th><th>Item</th><th>Buyer</th><th>Seller</th>
            <th class="num">Amount</th><th>Status</th><th>Requested</th><th>Completed</th>
          </tr>
        </thead>
        <tbody>${orders.map(row).join('')}</tbody>
      </table>`;
  }

  async function load() {
    const status = document.getElementById('orderStatus').value;
    const query = status === 'all' ? '' : `?status=${status}`;
    const payload = await API.get(`/api/admin/orders${query}`);
    render(payload.data);
  }

  filters.addEventListener('submit', (event) => {
    event.preventDefault();
    load().catch((error) => App.toast(error.message, 'error'));
  });

  document.getElementById('orderStatus').addEventListener('change', () => {
    load().catch((error) => App.toast(error.message, 'error'));
  });

  try {
    await load();
  } catch (error) {
    slot.innerHTML = Admin.empty('⚠️', 'Could not load orders', error.message);
  }
})();
