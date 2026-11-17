/* ==========================================================================
   app.js — shared shell: navbar auth state, dropdown menu, heartbeat, toasts.
   ========================================================================== */

const App = (() => {
  let user = null;
  let loaded = false;

  async function loadUser(force = false) {
    if (loaded && !force) return user;
    try {
      const payload = await API.get('/api/auth/me');
      user = payload.user || null;
    } catch {
      user = null;
    }
    loaded = true;
    return user;
  }

  function currentUser() {
    return user;
  }

  async function logout() {
    try {
      await API.post('/api/auth/logout');
    } catch {
      /* ignore — we still clear the local view */
    }
    user = null;
    loaded = true;
    window.location.href = '/';
  }

  function toast(message, variant = 'info') {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }

    const node = document.createElement('div');
    node.className = `toast${variant === 'error' ? ' toast--error' : ''}`;
    node.textContent = message;
    stack.appendChild(node);

    window.setTimeout(() => {
      node.style.opacity = '0';
      node.style.transition = 'opacity .2s ease';
      window.setTimeout(() => node.remove(), 220);
    }, 3600);
  }

  function renderNav(slot) {
    if (!user) {
      slot.innerHTML = `
        <a class="btn btn--ghost" href="/login.html">Log in</a>
        <a class="btn btn--primary" href="/register.html">Sign up</a>
      `;
      return;
    }

    const isAdmin = user.role === 'admin';
    slot.innerHTML = `
      <a class="btn btn--ghost" href="/account.html">My listings</a>
      <a class="btn btn--primary" href="/sell.html">+ Sell item</a>
      <div class="nav__user">
        <button class="avatar" id="navUserBtn" type="button" aria-haspopup="true" aria-expanded="false"
                aria-label="Account menu">${escapeHtml(initials(user.fullName))}</button>
        <div class="menu" id="navMenu" hidden>
          <div class="menu__head">
            <div class="menu__name">${escapeHtml(user.fullName)}</div>
            <div class="menu__email">${escapeHtml(user.email)}</div>
          </div>
          <a class="menu__item" href="/account.html">My listings</a>
          <a class="menu__item" href="/sell.html">Sell an item</a>
          ${isAdmin ? '<span class="menu__item" style="cursor:default">Administrator</span>' : ''}
          <button class="menu__item menu__item--danger" id="navLogout" type="button">Log out</button>
        </div>
      </div>
    `;

    const button = slot.querySelector('#navUserBtn');
    const menu = slot.querySelector('#navMenu');

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = menu.hasAttribute('hidden');
      menu.toggleAttribute('hidden', !open);
      button.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('click', () => {
      menu.setAttribute('hidden', '');
      button.setAttribute('aria-expanded', 'false');
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        menu.setAttribute('hidden', '');
        button.setAttribute('aria-expanded', 'false');
      }
    });

    slot.querySelector('#navLogout').addEventListener('click', logout);
  }

  function startHeartbeat() {
    if (!user) return;
    const ping = () => API.post('/api/auth/heartbeat').catch(() => {});
    ping();
    window.setInterval(ping, 60_000);
  }

  async function init() {
    await loadUser();
    const slot = document.getElementById('navActions');
    if (slot) renderNav(slot);
    startHeartbeat();

    // Keep the nav search box in sync with the current query.
    const navSearch = document.querySelector('.nav__search input');
    if (navSearch) {
      const q = new URLSearchParams(window.location.search).get('q');
      if (q && !navSearch.value) navSearch.value = q;
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return { loadUser, currentUser, logout, toast };
})();
