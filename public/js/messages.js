/* ==========================================================================
   messages.js — one thread per (listing, buyer, seller). Polled every 5s.
   ========================================================================== */

(async () => {
  const threadList = document.getElementById('threadList');
  const chatPane = document.getElementById('chatPane');
  if (!threadList || !chatPane) return;

  const user = await App.loadUser();
  if (!user) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/login.html?next=${next}`);
    return;
  }

  const state = {
    threads: [],
    current: null,
    listingId: null,
    partnerId: null,
    loadingThread: false,
  };

  function threadHref(thread) {
    return `/messages.html?listing=${thread.listingId}&partner=${thread.partnerId}`;
  }

  function threadRow(thread) {
    const active =
      Number(state.listingId) === Number(thread.listingId) &&
      Number(state.partnerId) === Number(thread.partnerId);

    return `
      <a class="thread${active ? ' is-active' : ''}" href="${threadHref(thread)}"
         data-listing="${thread.listingId}" data-partner="${thread.partnerId}">
        <div class="thread__thumb">
          ${thread.listingImage ? `<img src="${escapeHtml(thread.listingImage)}" alt="">` : '💬'}
        </div>
        <div>
          <div class="thread__top">
            <span class="thread__name">${escapeHtml(thread.partnerName)}</span>
            <span class="thread__time">${timeAgo(thread.lastAt)}</span>
          </div>
          <div class="thread__title">${escapeHtml(thread.listingTitle)}</div>
          <div class="thread__top">
            <span class="thread__last">${escapeHtml(thread.lastBody || '')}</span>
            ${thread.unread ? `<span class="thread__unread">${thread.unread}</span>` : ''}
          </div>
        </div>
      </a>`;
  }

  function renderThreads() {
    if (!state.threads.length) {
      threadList.innerHTML = `
        <div class="chat__empty" style="padding:30px 18px">
          <div>
            <div class="empty__icon">📭</div>
            <p>No conversations yet.<br>Message a seller from any listing.</p>
          </div>
        </div>`;
      return;
    }

    threadList.innerHTML = state.threads.map(threadRow).join('');
  }

  async function loadThreads() {
    const payload = await API.get('/api/messages');
    state.threads = payload.data || [];
    renderThreads();
  }

  function threadQuery() {
    return state.partnerId ? `?partnerId=${state.partnerId}` : '';
  }

  function renderMessages(scroll = false) {
    const box = document.getElementById('chatMessages');
    if (!box || !state.current) return;

    const messages = state.current.messages || [];

    if (!messages.length) {
      box.innerHTML = `
        <div class="chat__empty">
          <div>
            <div class="empty__icon">👋</div>
            <p>No messages yet. Say hello and ask about the item.</p>
          </div>
        </div>`;
      return;
    }

    box.innerHTML = messages
      .map((message) => {
        const mine = message.senderId === user.id;
        return `
          <div class="msg ${mine ? 'msg--mine' : 'msg--theirs'}">
            <div class="msg__bubble">${escapeHtml(message.body)}</div>
            <div class="msg__meta">${mine ? 'You' : escapeHtml(message.senderName)} · ${timeAgo(message.createdAt)}</div>
          </div>`;
      })
      .join('');

    if (scroll) box.scrollTop = box.scrollHeight;
  }

  function renderChat() {
    if (!state.current) return;

    const { listing, partner } = state.current;

    chatPane.innerHTML = `
      <div class="chat__head">
        <div>
          <div class="chat__title">${escapeHtml(partner.name)}</div>
          <div class="chat__sub">
            about
            <a href="/listing.html?id=${listing.id}"><b>${escapeHtml(listing.title)}</b></a>
            · ${peso(listing.price)}
          </div>
        </div>
        <a class="btn btn--ghost btn--sm" href="/listing.html?id=${listing.id}">View listing</a>
      </div>

      <div class="chat__messages" id="chatMessages"></div>

      <form class="chat__form" id="chatForm">
        <label class="visually-hidden" for="chatBody">Message</label>
        <textarea id="chatBody" maxlength="1000" rows="1" placeholder="Write a message…"></textarea>
        <button class="btn btn--primary" type="submit" id="chatSend">Send</button>
      </form>`;

    document.getElementById('chatForm').addEventListener('submit', sendMessage);
    renderMessages(true);
  }

  async function openThread(listingId, partnerId) {
    state.listingId = listingId;
    state.partnerId = partnerId || null;
    state.loadingThread = true;

    chatPane.innerHTML = `
      <div class="chat__empty">
        <div><div class="empty__icon">⏳</div><p>Opening conversation…</p></div>
      </div>`;

    try {
      const payload = await API.get(`/api/messages/thread/${listingId}${threadQuery()}`);
      state.current = payload;
      state.partnerId = payload.partner.id;
      renderChat();
      renderThreads();
      App.refreshUnread();
    } catch (error) {
      state.current = null;
      chatPane.innerHTML = `
        <div class="chat__empty">
          <div>
            <div class="empty__icon">⚠️</div>
            <p>${escapeHtml(error.message)}</p>
            <a class="btn btn--ghost btn--sm" href="/">Browse listings</a>
          </div>
        </div>`;
    } finally {
      state.loadingThread = false;
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!state.current) return;

    const input = document.getElementById('chatBody');
    const button = document.getElementById('chatSend');
    const body = input.value.trim();
    if (!body) return;

    button.disabled = true;
    button.textContent = 'Sending…';

    try {
      await API.post('/api/messages', {
        listingId: state.current.listing.id,
        recipientId: state.current.partner.id,
        body,
      });

      input.value = '';
      await reloadCurrent();
      await loadThreads();
      App.refreshUnread();
    } catch (error) {
      App.toast(error.message, 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Send';
      input.focus();
    }
  }

  async function reloadCurrent() {
    if (!state.current) return;
    const payload = await API.get(`/api/messages/thread/${state.current.listing.id}${threadQuery()}`);
    state.current = payload;
    renderMessages(true);
  }

  /** Poll: conversation list plus the open thread. The form is untouched. */
  async function poll() {
    if (state.loadingThread) return;
    try {
      await loadThreads();
      if (state.current) await reloadCurrent();
    } catch {
      /* Keep polling silently; the next tick may succeed. */
    }
  }

  threadList.addEventListener('click', (event) => {
    const link = event.target.closest('[data-listing]');
    if (!link) return;
    event.preventDefault();
    window.history.replaceState(null, '', link.getAttribute('href'));
    openThread(link.dataset.listing, link.dataset.partner || null);
  });

  try {
    await loadThreads();

    const params = new URLSearchParams(window.location.search);
    const listingParam = params.get('listing');
    const partnerParam = params.get('partner');

    if (listingParam) {
      await openThread(listingParam, partnerParam);
    } else if (state.threads.length) {
      const first = state.threads[0];
      window.history.replaceState(null, '', threadHref(first));
      await openThread(first.listingId, first.partnerId);
    }

    window.setInterval(poll, 5000);
  } catch (error) {
    threadList.innerHTML = `
      <div class="chat__empty" style="padding:24px">
        <div><div class="empty__icon">⚠️</div><p>${escapeHtml(error.message)}</p></div>
      </div>`;
  }
})();
