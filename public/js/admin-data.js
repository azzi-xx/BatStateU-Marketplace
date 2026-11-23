/* ==========================================================================
   admin-data.js — data lab: tables, recent rows, live SQL stream, pipeline.
   ========================================================================== */

(async () => {
  const me = await Admin.requireAdmin();
  if (!me) return;
  Admin.markNav('data');

  const tablesWrap = document.getElementById('tablesWrap');
  const recentWrap = document.getElementById('recentWrap');
  const sqlFeed = document.getElementById('sqlFeed');
  const pipelineOut = document.getElementById('pipelineOut');
  const pauseBox = document.getElementById('streamPause');
  const clearBtn = document.getElementById('streamClear');

  let paused = false;
  pauseBox.addEventListener('change', () => {
    paused = pauseBox.checked;
  });

  let knownIds = new Set();
  let feedEntries = [];

  function sqlBlock(entry) {
    const params =
      Array.isArray(entry.params) && entry.params.length
        ? `<div class="sql-feed__params">${escapeHtml(JSON.stringify(entry.params))}</div>`
        : '';

    return `
      <div class="sql-feed__row${entry.error ? ' is-error' : ''}">
        <div class="sql-feed__meta">
          <span class="sql-feed__id">#${entry.id}</span>
          <span class="sql-feed__req">${escapeHtml(entry.request)}</span>
          <span class="sql-feed__stat">${entry.method.toUpperCase()} · ${entry.rowCount ?? '—'} row${entry.rowCount === 1 ? '' : 's'} · ${entry.durationMs} ms</span>
          ${entry.error ? `<span class="sql-feed__err">${escapeHtml(entry.error)}</span>` : ''}
        </div>
        <pre class="sql-feed__sql">${escapeHtml(entry.sql)}</pre>
        ${params}
      </div>`;
  }

  function renderFeed() {
    if (!feedEntries.length) {
      sqlFeed.innerHTML = `
        <div class="empty">
          <div class="empty__icon">⏱</div>
          <h3>Waiting for queries</h3>
          <p>Browse a page or open an order to see the SQL it runs.</p>
        </div>`;
      return;
    }

    sqlFeed.innerHTML = feedEntries.map(sqlBlock).join('');
  }

  async function pollStream() {
    if (paused) return;
    try {
      const payload = await API.get('/api/admin/queries?limit=80');
      const fresh = payload.data || [];
      const newEntries = fresh.filter((entry) => !knownIds.has(entry.id));
      if (!newEntries.length) return;

      newEntries.forEach((entry) => knownIds.add(entry.id));
      feedEntries = fresh;
      renderFeed();
    } catch (error) {
      /* Keep polling silently. */
    }
  }

  clearBtn.addEventListener('click', () => {
    knownIds = new Set();
    feedEntries = [];
    renderFeed();
  });

  async function loadInspect() {
    try {
      const payload = await API.get('/api/admin/inspect');
      const data = payload.data;

      tablesWrap.innerHTML = `
        <table class="data-table">
          <thead>
            <tr><th>Table</th><th class="num">Rows</th><th>Columns</th></tr>
          </thead>
          <tbody>
            ${data.tables
              .map(
                (table) => `
              <tr>
                <td class="strong">${escapeHtml(table.name)}</td>
                <td class="num">${table.rows}</td>
                <td>
                  ${table.columns
                    .map(
                      (column) =>
                        `<span class="col-chip${column.primaryKey ? ' col-chip--pk' : ''}">${escapeHtml(column.name)}<em>${escapeHtml(column.type || 'ANY')}</em></span>`
                    )
                    .join(' ')}
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>`;

      const recent = data.recent;
      recentWrap.innerHTML = `
        <div class="data-lab__panel">
          <h3>Users (${recent.users.length})</h3>
          <table class="data-table data-table--compact">
            <thead><tr><th>Name</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              ${recent.users
                .map(
                  (user) => `
                <tr>
                  <td>${escapeHtml(user.fullName)}</td>
                  <td>${Admin.statusPill(user.role)}</td>
                  <td>${Admin.statusPill(user.status)}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>

        <div class="data-lab__panel">
          <h3>Listings (${recent.listings.length})</h3>
          <table class="data-table data-table--compact">
            <thead><tr><th>Title</th><th>Status</th><th>Price</th></tr></thead>
            <tbody>
              ${recent.listings
                .map(
                  (listing) => `
                <tr>
                  <td>${escapeHtml(listing.title)}</td>
                  <td>${Admin.statusPill(listing.status)}</td>
                  <td class="num">${peso(listing.price)}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>

        <div class="data-lab__panel">
          <h3>Orders (${recent.orders.length})</h3>
          <table class="data-table data-table--compact">
            <thead><tr><th>#</th><th>Status</th><th>Amount</th></tr></thead>
            <tbody>
              ${recent.orders
                .map(
                  (order) => `
                <tr>
                  <td>#${order.id}</td>
                  <td>${Admin.statusPill(order.status)}</td>
                  <td class="num">${peso(order.amount)}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>

        <div class="data-lab__panel">
          <h3>Messages (${recent.messages.length})</h3>
          <table class="data-table data-table--compact">
            <thead><tr><th>From</th><th>To</th><th>Body</th></tr></thead>
            <tbody>
              ${recent.messages
                .map(
                  (message) => `
                <tr>
                  <td>${escapeHtml(message.senderName)}</td>
                  <td>${escapeHtml(message.recipientName)}</td>
                  <td class="msg-cell">${escapeHtml(message.body)}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;
    } catch (error) {
      tablesWrap.innerHTML = Admin.empty('⚠️', 'Could not load inspect data', error.message);
    }
  }

  function renderPipeline(data) {
    const queries = data.queries.length
      ? data.queries.map(sqlBlock).join('')
      : '<div class="admin-note">No SQL was captured for this request (unexpected).</div>';

    pipelineOut.innerHTML = `
      <div class="pipeline-grid">
        <div class="pipeline-card">
          <h3>Raw row from SQLite</h3>
          <p class="admin-note">What <code>models/listing.model.js</code> returns — column names as aliased in SQL.</p>
          <pre class="code-block">${escapeHtml(JSON.stringify(data.raw, null, 2))}</pre>
        </div>
        <div class="pipeline-card">
          <h3>Mapped JSON for the API</h3>
          <p class="admin-note">What <code>listing.service.toApi()</code> sends to the browser — prices in pesos, nested objects.</p>
          <pre class="code-block">${escapeHtml(JSON.stringify(data.api, null, 2))}</pre>
        </div>
      </div>

      <div class="pipeline-card" style="margin-top:14px">
        <h3>Activity on this listing (computed in SQL)</h3>
        <div class="admin-tools" style="margin:0">
          <span class="pill pill--outline">orders: ${JSON.stringify(data.activity.orders)}</span>
          <span class="pill pill--outline">messages: ${data.activity.messages}</span>
        </div>
      </div>

      <div class="pipeline-card" style="margin-top:14px">
        <h3>SQL captured during this request</h3>
        <div class="sql-feed sql-feed--compact">${queries}</div>
      </div>`;
  }

  document.getElementById('pipelineForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = Number(document.getElementById('pipelineId').value);
    if (!Number.isInteger(id) || id < 1) {
      App.toast('Enter a valid listing ID.', 'error');
      return;
    }

    pipelineOut.innerHTML = '<div class="empty"><div class="empty__icon">⏳</div><p>Running the pipeline…</p></div>';

    try {
      const payload = await API.get(`/api/admin/pipeline/${id}`);
      renderPipeline(payload.data);
    } catch (error) {
      pipelineOut.innerHTML = Admin.empty('⚠️', 'Pipeline failed', error.message);
    }
  });

  try {
    await loadInspect();
    await pollStream();
    window.setInterval(pollStream, 2000);
  } catch (error) {
    App.toast(error.message, 'error');
  }
})();
