/* ==========================================================================
   marketplace.js — home page: search, category filter, sorting, pagination.
   ========================================================================== */

(() => {
  const grid = document.getElementById('listingGrid');
  if (!grid) return;

  const SORTS = ['newest', 'oldest', 'price_asc', 'price_desc', 'popular'];
  const params = new URLSearchParams(window.location.search);

  const state = {
    q: (params.get('q') || '').slice(0, 80),
    category: params.get('category') || '',
    campus: params.get('campus') || '',
    sort: SORTS.includes(params.get('sort')) ? params.get('sort') : 'newest',
    page: Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1),
  };

  const els = {
    chips: document.getElementById('categoryChips'),
    campusChips: document.getElementById('campusChips'),
    sort: document.getElementById('sortSelect'),
    count: document.getElementById('resultCount'),
    pagination: document.getElementById('pagination'),
    searchForm: document.getElementById('heroSearch'),
    searchInput: document.getElementById('qInput'),
    stats: document.getElementById('heroStats'),
  };

  let categories = [];
  let campuses = [];
  let requestSeq = 0;

  els.searchInput.value = state.q;
  els.sort.value = state.sort;

  /* ------------------------------------------------------------- helpers -- */

  function syncUrl() {
    const url = new URL(window.location.href);
    url.search = '';
    if (state.q) url.searchParams.set('q', state.q);
    if (state.category) url.searchParams.set('category', state.category);
    if (state.campus) url.searchParams.set('campus', state.campus);
    if (state.sort !== 'newest') url.searchParams.set('sort', state.sort);
    if (state.page > 1) url.searchParams.set('page', String(state.page));
    window.history.replaceState({}, '', url);
  }

  function skeletons(count = 8) {
    grid.innerHTML = Array.from({ length: count })
      .map(
        () => `
        <div class="skeleton-card">
          <div class="skeleton skeleton--media"></div>
          <div class="skeleton skeleton--line short"></div>
          <div class="skeleton skeleton--line"></div>
          <div class="skeleton skeleton--line short"></div>
        </div>`
      )
      .join('');
    els.pagination.innerHTML = '';
    els.count.textContent = 'Loading…';
  }

  function emptyState(title, message) {
    grid.innerHTML = `
      <div class="empty">
        <div class="empty__icon">🔍</div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <button class="btn btn--ghost" type="button" id="resetFilters">Clear filters</button>
      </div>`;
    els.pagination.innerHTML = '';
    els.count.textContent = 'No results';

    const reset = document.getElementById('resetFilters');
    if (reset) {
      reset.addEventListener('click', () => {
        state.q = '';
        state.category = '';
        state.campus = '';
        state.page = 1;
        els.searchInput.value = '';
        renderChips();
        renderCampusChips();
        load();
      });
    }
  }

  function card(listing) {
    const badge =
      listing.status === 'available'
        ? ''
        : `<span class="badge badge--${listing.status}">${statusLabel(listing.status)}</span>`;

    const campusBadge = listing.campus
      ? `<span class="campus-badge">📍 ${escapeHtml(listing.campus.name)}</span>`
      : '';

    return `
      <article class="card">
        <a class="card__media" href="/listing.html?id=${listing.id}" aria-label="${escapeHtml(listing.title)}">
          ${mediaInner(listing)}
          ${badge}
          ${campusBadge}
        </a>
        <div class="card__body">
          <p class="card__price">${peso(listing.price)}</p>
          <a class="card__title" href="/listing.html?id=${listing.id}">${escapeHtml(listing.title)}</a>
          <p class="card__meta">${escapeHtml(listing.category.name)} · ${escapeHtml(conditionLabel(listing.condition))}</p>
          <p class="card__seller"><b>${escapeHtml(listing.seller.name)}</b> · ${timeAgo(listing.createdAt)}</p>
        </div>
      </article>`;
  }

  function pageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages = new Set([1, total, current - 1, current, current + 1]);
    const sorted = [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
    const output = [];

    sorted.forEach((n, index) => {
      if (index > 0 && n - sorted[index - 1] > 1) output.push('…');
      output.push(n);
    });

    return output;
  }

  function renderPagination(pagination) {
    const { page, totalPages } = pagination;
    if (totalPages <= 1) {
      els.pagination.innerHTML = '';
      return;
    }

    const buttons = pageNumbers(page, totalPages).map((item) => {
      if (item === '…') return '<span class="page-ellipsis">…</span>';
      return `<button class="page-btn${item === page ? ' is-active' : ''}" type="button" data-page="${item}">${item}</button>`;
    });

    els.pagination.innerHTML = `
      <button class="page-btn" type="button" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>Prev</button>
      ${buttons.join('')}
      <button class="page-btn" type="button" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>Next</button>
    `;

    els.pagination.querySelectorAll('[data-page]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = Number(button.dataset.page);
        if (!Number.isFinite(next) || next < 1 || next > totalPages) return;
        state.page = next;
        load();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  function renderChips() {
    const items = [{ slug: '', name: 'All items' }, ...categories];

    els.chips.innerHTML = items
      .map(
        (category) => `
        <button class="chip${state.category === category.slug ? ' is-active' : ''}" type="button"
                data-category="${escapeHtml(category.slug)}">${escapeHtml(category.name)}</button>`
      )
      .join('');

    els.chips.querySelectorAll('[data-category]').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.category = chip.dataset.category;
        state.page = 1;
        renderChips();
        load();
      });
    });
  }

  function renderCampusChips() {
    const items = [{ slug: '', name: 'All campuses' }, ...campuses];

    els.campusChips.innerHTML = items
      .map(
        (campus) => `
        <button class="chip chip--campus${state.campus === campus.slug ? ' is-active' : ''}" type="button"
                data-campus="${escapeHtml(campus.slug)}">${escapeHtml(campus.name)}</button>`
      )
      .join('');

    els.campusChips.querySelectorAll('[data-campus]').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.campus = chip.dataset.campus;
        state.page = 1;
        renderCampusChips();
        load();
      });
    });
  }

  /* ---------------------------------------------------------------- load -- */

  async function load() {
    const seq = ++requestSeq;
    skeletons();
    syncUrl();

    const query = new URLSearchParams({ page: String(state.page), limit: '12', sort: state.sort });
    if (state.q) query.set('q', state.q);
    if (state.category) query.set('category', state.category);
    if (state.campus) query.set('campus', state.campus);

    try {
      const payload = await API.get(`/api/listings?${query.toString()}`);
      if (seq !== requestSeq) return;

      const { data, pagination } = payload;

      if (!data.length) {
        emptyState(
          state.q ? `No results for “${state.q}”` : 'Nothing here yet',
          state.q
            ? 'Try a different keyword, or clear the filters to see everything.'
            : 'Be the first to post something for sale on campus.'
        );
      } else {
        grid.innerHTML = data.map(card).join('');
        els.count.textContent = `${pagination.total} item${pagination.total === 1 ? '' : 's'}`;
        renderPagination(pagination);
      }

      if (els.stats) {
        els.stats.innerHTML = `<strong>${pagination.total}</strong> listing${pagination.total === 1 ? '' : 's'} live across BatStateU campuses`;
      }
    } catch (error) {
      if (seq !== requestSeq) return;
      emptyState('Could not load listings', error.message);
    }
  }

  /* -------------------------------------------------------------- events -- */

  els.searchForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    state.q = els.searchInput.value.trim().slice(0, 80);
    state.page = 1;
    load();
  });

  els.sort.addEventListener('change', () => {
    state.sort = els.sort.value;
    state.page = 1;
    load();
  });

  (async () => {
    try {
      const [categoryPayload, campusPayload] = await Promise.all([
        API.get('/api/categories'),
        API.get('/api/campuses'),
      ]);
      categories = categoryPayload.data;
      campuses = campusPayload.data;
    } catch {
      categories = [];
      campuses = [];
    }
    renderChips();
    renderCampusChips();
    load();
  })();
})();
