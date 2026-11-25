/* ==========================================================================
   admin-dashboard.js — KPI cards, Chart.js charts, recent tables.
   The browser only draws numbers; all counting happens in SQL.
   ========================================================================== */

(async () => {
  const ok = await Admin.requireAdmin();
  if (!ok) return;
  Admin.markNav('dashboard');

  let range = 30;
  const charts = {};

  function kpiCard(label, value, sub) {
    return `
      <div class="kpi">
        <div class="kpi__label">${escapeHtml(label)}</div>
        <div class="kpi__value">${escapeHtml(value)}</div>
        <div class="kpi__sub">${escapeHtml(sub)}</div>
      </div>`;
  }

  function renderKpis(k) {
    document.getElementById('kpiGrid').innerHTML = [
      kpiCard('Transaction Amount', peso(k.revenue), `${peso(k.revenue30d)} in the last 30 days`),
      kpiCard('Orders', String(k.orders.total), `${k.orders.pending} pending · ${k.orders.completed} completed`),
      kpiCard('Listings', String(k.listings.total), `${k.listings.available} available · ${k.listings.sold} sold`),
      kpiCard('Students & admins', String(k.users.total), `${k.users.online} online · ${k.users.students} students`),
      kpiCard('Messages', String(k.messages.total), `${k.users.newThisWeek} new users this week`),
    ].join('');
  }

  function renderRecent(orders) {
    const slot = document.getElementById('recentOrders');

    if (!orders.length) {
      slot.innerHTML = Admin.empty('🧾', 'No orders yet', 'Orders will appear when buyers request items.');
      return;
    }

    slot.innerHTML = `
      <table class="data-table">
        <thead>
          <tr><th>Item</th><th>Buyer</th><th>Seller</th><th class="num">Amount</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${orders
            .map(
              (order) => `
            <tr>
              <td><a class="strong" href="/listing.html?id=${order.listing.id}">${escapeHtml(order.listing.title)}</a></td>
              <td>${escapeHtml(order.buyer.name)}</td>
              <td>${escapeHtml(order.seller.name)}</td>
              <td class="num">${peso(order.amount)}</td>
              <td>${Admin.statusPill(order.status)}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`;
  }

  function renderTopSellers(sellers) {
    const slot = document.getElementById('topSellers');

    if (!sellers.length) {
      slot.innerHTML = Admin.empty('🏆', 'No completed sales', 'Top sellers appear after the first confirmed sale.');
      return;
    }

    slot.innerHTML = `
      <table class="data-table">
        <thead><tr><th>#</th><th>Seller</th><th class="num">Sales</th><th class="num">Transaction Amount</th></tr></thead>
        <tbody>
          ${sellers
            .map(
              (seller, index) => `
            <tr>
              <td>${index + 1}</td>
              <td class="strong">${escapeHtml(seller.name)}</td>
              <td class="num">${seller.sales}</td>
              <td class="num">${peso(seller.revenue)}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`;
  }

  function drawCharts(data, overview) {
    if (typeof Chart === 'undefined') {
      document.getElementById('chartNote').hidden = false;
      return;
    }

    document.getElementById('chartNote').hidden = true;

    Chart.defaults.font.family = 'Inter, Segoe UI, sans-serif';
    Chart.defaults.color = '#6b7280';

    const grid = { color: 'rgba(17, 24, 39, 0.06)' };

    if (charts.activity) charts.activity.destroy();
    charts.activity = new Chart(document.getElementById('activityChart'), {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'New users',
            data: data.users,
            borderColor: '#b5121b',
            backgroundColor: 'rgba(181, 18, 27, 0.08)',
            fill: true,
            tension: 0.35,
            pointRadius: 2,
          },
          {
            label: 'New listings',
            data: data.listings,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.06)',
            fill: true,
            tension: 0.35,
            pointRadius: 2,
          },
          {
            label: 'Completed orders',
            data: data.orders,
            borderColor: '#047857',
            backgroundColor: 'rgba(4, 120, 87, 0.06)',
            fill: true,
            tension: 0.35,
            pointRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 }, grid },
        },
      },
    });

    if (charts.revenue) charts.revenue.destroy();
    charts.revenue = new Chart(document.getElementById('revenueChart'), {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Transaction Amount',
            data: data.revenue,
            backgroundColor: 'rgba(181, 18, 27, 0.72)',
            borderRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid, ticks: { callback: (value) => `₱${value}` } },
        },
      },
    });

    if (charts.category) charts.category.destroy();
    charts.category = new Chart(document.getElementById('categoryChart'), {
      type: 'doughnut',
      data: {
        labels: overview.categories.map((row) => row.name),
        datasets: [
          {
            data: overview.categories.map((row) => row.count),
            backgroundColor: ['#b5121b', '#2563eb', '#7c3aed', '#f0b429', '#047857', '#9ca3af'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } } },
      },
    });
  }

  async function load() {
    const [overview, chartData] = await Promise.all([
      API.get('/api/admin/overview'),
      API.get(`/api/admin/charts?range=${range}`),
    ]);

    renderKpis(overview.data.kpis);
    renderRecent(overview.data.recentOrders);
    renderTopSellers(overview.data.topSellers);
    drawCharts(chartData.data, overview.data);
  }

  document.querySelectorAll('#rangeTabs [data-range]').forEach((button) => {
    button.addEventListener('click', async () => {
      range = Number(button.dataset.range);
      document.querySelectorAll('#rangeTabs .tab').forEach((tab) => {
        tab.classList.toggle('is-active', tab === button);
      });

      try {
        const chartData = await API.get(`/api/admin/charts?range=${range}`);
        const overview = await API.get('/api/admin/overview');
        drawCharts(chartData.data, overview.data);
      } catch (error) {
        App.toast(error.message, 'error');
      }
    });
  });

  try {
    await load();
  } catch (error) {
    App.toast(error.message, 'error');
  }
})();
