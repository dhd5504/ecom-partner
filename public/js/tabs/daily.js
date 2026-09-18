/* ================================================================
   daily.js — Tab Xu hướng: biểu đồ + bảng theo ngày
   ================================================================ */
'use strict';

(function () {
  let _chart = null;

  window.loadDaily = async function () {
    const el = document.getElementById('tab-daily');
    el.innerHTML = window.loadingHtml();
    try {
      const data = await window.fetchApi('/api/metrics/daily?' + window.buildQuery());
      if (!data) return;
      if (!data.length) { el.innerHTML = window.emptyHtml(); return; }

      el.innerHTML = `
        <div class="chart-wrap">
          <div class="chart-title">Xu hướng theo ngày</div>
          <canvas id="daily-chart"></canvas>
        </div>
        <div class="table-wrap">
          <div class="table-title">Chi tiết theo ngày</div>
          <div class="table-scroll">
            <table id="daily-table">
              <thead>
                <tr>
                  <th style="text-align:left">Ngày</th>
                  <th>Đơn</th>
                  <th>Hủy</th>
                  <th>S.Clicks</th>
                  <th>Revenue</th>
                  <th>Reduct</th>
                  <th>Spent</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody></tbody>
              <tfoot></tfoot>
            </table>
          </div>
        </div>
      `;

      const labels = data.map(d => {
        const [, mm, dd] = d.date.split('-');
        return `${dd}/${mm}`;
      });

      // Destroy previous chart if exists
      if (_chart) { _chart.destroy(); _chart = null; }

      const ctx = document.getElementById('daily-chart').getContext('2d');
      _chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Revenue',
              data: data.map(d => d.revenue_vnd),
              borderColor: '#22c55e',
              backgroundColor: 'rgba(34,197,94,.08)',
              tension: 0.3,
              fill: true,
            },
            {
              label: 'Spent',
              data: data.map(d => d.cost_vnd),
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59,130,246,.08)',
              tension: 0.3,
              fill: true,
            },
            {
              label: 'Profit',
              data: data.map(d => d.profit_vnd),
              borderColor: '#a855f7',
              backgroundColor: 'rgba(168,85,247,.08)',
              tension: 0.3,
              fill: true,
            },
            {
              label: 'Reduct',
              data: data.map(d => d.reduct_vnd),
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239,68,68,.05)',
              tension: 0.3,
              fill: false,
              borderDash: [4, 4],
            },
          ],
        },
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: '#94a3b8', usePointStyle: true } },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.dataset.label}: ${window.fmt.vndShort(ctx.raw)}`,
              },
            },
          },
          scales: {
            x: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } },
            y: {
              ticks: {
                color: '#64748b',
                callback: (v) => window.fmt.vndShort(v),
              },
              grid: { color: '#1e293b' },
            },
          },
        },
      });

      // Table body
      const tbody = document.querySelector('#daily-table tbody');
      const tfoot = document.querySelector('#daily-table tfoot');
      let totOrders = 0, totCancelled = 0, totClicks = 0;
      let totRevenue = 0, totReduct = 0, totCost = 0, totProfit = 0;

      data.forEach(d => {
        totOrders    += d.total_orders;
        totCancelled += d.cancelled_orders;
        totClicks    += d.shopee_clicks;
        totRevenue   += d.revenue_vnd;
        totReduct    += d.reduct_vnd;
        totCost      += d.cost_vnd;
        totProfit    += d.profit_vnd;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${d.date}</td>
          <td>${window.fmt.num(d.total_orders)}</td>
          <td>${window.fmt.num(d.cancelled_orders)}</td>
          <td>${window.fmt.num(d.shopee_clicks)}</td>
          <td>${window.fmt.vnd(d.revenue_vnd)}</td>
          <td>${window.fmt.vnd(d.reduct_vnd)}</td>
          <td>${window.fmt.vnd(d.cost_vnd)}</td>
          <td class="${window.profitClass(d.profit_vnd)}">${window.fmt.vnd(d.profit_vnd)}</td>
        `;
        tbody.appendChild(tr);
      });

      tfoot.innerHTML = `
        <tr>
          <td>Tổng</td>
          <td>${window.fmt.num(totOrders)}</td>
          <td>${window.fmt.num(totCancelled)}</td>
          <td>${window.fmt.num(totClicks)}</td>
          <td>${window.fmt.vnd(totRevenue)}</td>
          <td>${window.fmt.vnd(totReduct)}</td>
          <td>${window.fmt.vnd(totCost)}</td>
          <td class="${window.profitClass(totProfit)}">${window.fmt.vnd(totProfit)}</td>
        </tr>
      `;

    } catch (err) {
      el.innerHTML = `<div class="state-empty">Lỗi: ${err.message}</div>`;
    }
  };
})();
