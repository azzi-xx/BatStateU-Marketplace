/* ==========================================================================
   orders.js — purchases and sales, from request to confirmation.
   ========================================================================== */

(async () => {
  const root = document.getElementById('ordersRoot');
  if (!root) return;

  const user = await App.loadUser();
  if (!user) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/login.html?next=${next}`);
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const requested = params.get('view');
  const view = ['all', 'buying', 'selling'].includes(requested) ? requested : 'all';

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.view === view);
  });

  const ORDER_STATUS = {
    pending: { label: 'Pending', cls: 'pending' },
    completed: { label: 'Completed', cls: 'completed' },
    cancelled: { label: 'Cancelled', cls: 'cancelled' },
  };

  function card(order) {
    const status = ORDER_STATUS[order.status] || { label: order.status, cls: 'outline' };
    const counterpart = order.isBuyer ? order.seller : order.buyer;
    const partnerId = order.isBuyer ? order.seller.id : order.buyer.id;

    const actions = [];

    if (order.status === 'pending' && order.isSeller) {
      actions.push(`<button class="btn btn--primary btn--sm" type="button" data-complete="${order.id}">Confirm sale</button>`);
      actions.push(`<button class="btn btn--ghost btn--sm" type="button" data-cancel="${order.id}">Cancel</button>`);
    }

    if (order.status === 'pending' && order.isBuyer) {
      actions.push(`<button class="btn btn--danger btn--sm" type="button" data-cancel="${order.id}">Cancel request</button>`);
    }

    actions.push(
      `<a class="btn btn--ghost btn--sm" href="/messages.html?listing=${order.listing.id}&partner=${partnerId}">Message</a>`
    );

    return `
      <article class="order-card">
        <a class="order-card__thumb" href="/listing.html?id=${order.listing.id}">${mediaInner(order.listing)}</a>
        <div class="order-card__body">
          <div class="order-card__top">
            <a class="order-card__title" href="/listing.html?id=${order.listing.id}">${escapeHtml(order.listing.title)}</a>
            <span class="pill pill--${status.cls}">${status.label}</span>
          </div>
          <p class="order-card__meta">
            ${order.isBuyer ? 'Seller' : 'Buyer'}: <b>${escapeHtml(counterpart.name)}</b>
            · ${timeAgo(order.createdAt)}
            · Order #${order.id}
          </p>
          ${order.note ? `<p class="order-card__note">“${escapeHtml(order.note)}”</p>` : ''}
          <div class="order-card__actions">
            <span class="order-card__price">${peso(order.amount)}</span>
            <div class="order-card__buttons">${actions.join('')}</div>
          </div>
        </div>
      </article>`;
  }

  function emptyState() {
    const messages = {
      all: ['No orders yet', 'Request an item from the marketplace, or wait for a buyer to request one of yours.'],
      buying: ['Nothing bought yet', 'Open a listing and send the seller a request to buy.'],
      selling: ['No incoming requests', 'When someone requests one of your listings, it will appear here.'],
    };
    const [title, text] = messages[view];

    root.innerHTML = `
      <div class="empty">
        <div class="empty__icon">🧾</div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(text)}</p>
        <a class="btn btn--primary" href="/">Browse the marketplace</a>
      </div>`;
    document.getElementById('orderCount').textContent = '0 orders';
  }

  async function load() {
    const payload = await API.get(`/api/orders?view=${view}`);
    const orders = payload.data;
    const counts = payload.counts || {};

    const countSlot = document.getElementById('orderCount');
    if (countSlot) countSlot.textContent = `${orders.length} order${orders.length === 1 ? '' : 's'}`;

    const tabs = {
      all: counts.buying + counts.selling,
      buying: counts.buying,
      selling: counts.selling,
    };

    document.querySelectorAll('.tab').forEach((tab) => {
      const base = tab.textContent.replace(/\s*\(\d+\)$/, '');
      tab.textContent = `${base} (${tabs[tab.dataset.view] || 0})`;
    });

    if (!orders.length) {
      emptyState();
      return;
    }

    root.innerHTML = orders.map(card).join('');
  }

  root.addEventListener('click', async (event) => {
    const complete = event.target.closest('[data-complete]');
    const cancel = event.target.closest('[data-cancel]');
    if (!complete && !cancel) return;

    const button = complete || cancel;
    const id = complete ? complete.dataset.complete : cancel.dataset.cancel;
    const action = complete ? 'complete' : 'cancel';

    if (action === 'complete' && !window.confirm('Confirm this sale? The listing will be marked sold.')) return;
    if (action === 'cancel' && !window.confirm('Cancel this request? The listing will go back on the market.')) return;

    button.disabled = true;
    const label = button.textContent;
    button.textContent = action === 'complete' ? 'Confirming…' : 'Cancelling…';

    try {
      await API.patch(`/api/orders/${id}`, { action });
      App.toast(action === 'complete' ? 'Sale confirmed.' : 'Request cancelled.');
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
    root.innerHTML = `
      <div class="empty">
        <div class="empty__icon">⚠️</div>
        <h3>Could not load your orders</h3>
        <p>${escapeHtml(error.message)}</p>
        <button class="btn btn--ghost" type="button" onclick="window.location.reload()">Try again</button>
      </div>`;
  }
})();
