'use strict';
/* ── daily.js ── Daily table + chart ── */

let _dailyChart = null;

const DAILY_DATASETS = [
  { label: 'Revenue',  key: 'revenue_vnd', color: '#8b5cf6', type: 'bar',  yAxisID: 'yLeft'  },
  { label: 'Spent',    key: 'cost_vnd',    color: '#f43f5e', type: 'bar',  yAxisID: 'yLeft'  },
  { label: 'Profit',   key: 'profit_vnd',  color: '#10b981', type: 'bar',  yAxisID: 'yLeft'  },
  { label: 'ROI (%)',  key: 'roi',         color: '#eab308', type: 'line', yAxisID: 'yRight' },
  { label: 'Clicks',   key: 'shopee_clicks',color: '#f97316',type: 'line', yAxisID: 'yRight'},
  { label: 'Orders',   key: 'total_orders',color: '#22c55e', type: 'line', yAxisID: 'yRight' },
  { label: 'Reduct',   key: 'reduct_vnd',  color: '#ef4444', type: 'line', yAxisID: 'yLeft', borderDash: [4,4] },
];

async function loadDaily() {
  document.getElementById('dailyLoading').classList.remove('hidden');
  const tbody = document.getElementById('dailyBody');
  const tfoot = document.getElementById('dailyFoot');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-dim)"><i class="mdi mdi-loading mdi-spin"></i> Đang tải...</td></tr>';
  tfoot.innerHTML = '';

  try {
    const rows = await window.fetchApi('/api/metrics/daily?' + window.buildQuery());
    document.getElementById('dailyLoading').classList.add('hidden');
    if (!rows) return;

    _renderDailyChart(rows);
    _renderDailyTable(rows, tbody, tfoot);
  } catch (e) {
    document.getElementById('dailyLoading').classList.add('hidden');
    tbody.innerHTML = `<tr><td colspan="8" style="color:#f43f5e;padding:1rem">Lỗi: ${e.message}</td></tr>`;
  }
}

function _renderDailyChart(rows) {
  const labels = rows.map(r => { const [,mm,dd] = r.date.split('-'); return `${dd}/${mm}`; });
  if (_dailyChart) { _dailyChart.destroy(); _dailyChart = null; }
  const ctx = document.getElementById('dailyChart').getContext('2d');

  const activeSet = new Set([0, 1, 2, 3]);
  document.querySelectorAll('.daily-chip').forEach(btn => {
    // clear old event listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      const idx = +newBtn.dataset.metric;
      newBtn.classList.toggle('active');
      if (activeSet.has(idx)) activeSet.delete(idx); else activeSet.add(idx);
      _dailyChart.data.datasets.forEach((ds, i) => { ds.hidden = !activeSet.has(i); });
      _dailyChart.update();
    });
  });

  _dailyChart = new Chart(ctx, {
    data: {
      labels,
      datasets: DAILY_DATASETS.map((ds, i) => {
        let rowData;
        if (ds.key === 'roi') {
          rowData = rows.map(r => r.cost_vnd > 0 ? ((r.revenue_vnd - r.cost_vnd - r.reduct_vnd) / r.cost_vnd * 100) : 0);
        } else {
          rowData = rows.map(r => r[ds.key]);
        }
        return {
          type: ds.type,
          label: ds.label,
          data: rowData,
          backgroundColor: ds.color + (ds.type === 'bar' ? '99' : ''),
          borderColor: ds.color,
          borderWidth: ds.type === 'line' ? 2 : 0,
          pointRadius: ds.type === 'line' ? 3 : 0,
          tension: 0.3,
          borderDash: ds.borderDash,
          yAxisID: ds.yAxisID,
          hidden: !activeSet.has(i)
        };
      })
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { 
          callbacks: { 
            label: (c) => ` ${c.dataset.label}: ${c.dataset.label === 'ROI (%)' ? window.fmt.pct(c.raw) : (c.dataset.yAxisID === 'yRight' ? window.fmt.num(c.raw) : window.fmt.vndShort(c.raw))}` 
          } 
        },
      },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,.05)' } },
        yLeft:  { position: 'left',  ticks: { color: '#64748b', callback: v => window.fmt.vndShort(v) }, grid: { color: 'rgba(0,0,0,.05)' } },
        yRight: { position: 'right', ticks: { color: '#f97316', callback: v => window.fmt.num(v) }, grid: { display: false } },
      },
    },
  });
}

function _renderDailyTable(rows, tbody, tfoot) {
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-dim)">Không có dữ liệu</td></tr>';
    return;
  }

  let totOrders = 0, totCancels = 0, totClicks = 0;
  let totRev = 0, totReduct = 0, totCost = 0, totProfit = 0;

  tbody.innerHTML = rows.map(r => {
    totOrders  += r.total_orders;
    totCancels += r.cancelled_orders;
    totClicks  += r.shopee_clicks;
    totRev     += r.revenue_vnd;
    totReduct  += r.reduct_vnd;
    totCost    += r.cost_vnd;
    totProfit  += r.profit_vnd;

    return `<tr>
      <td>${r.date.split('-').reverse().join('/')}</td>
      <td class="text-r">${window.fmt.num(r.total_orders)}</td>
      <td class="text-r">${window.fmt.num(r.shopee_clicks)}</td>
      <td class="text-r">${window.fmt.vnd(r.revenue_vnd)}</td>
      <td class="text-r">${window.fmt.vnd(r.reduct_vnd)}</td>
      <td class="text-r">${window.fmt.vnd(r.cost_vnd)}</td>
      <td class="text-r ${window.profitClass(r.profit_vnd)}">${window.fmt.vnd(r.profit_vnd)}</td>
    </tr>`;
  }).join('');

  tfoot.innerHTML = `<tr class="summary-row">
    <td>TỔNG CỘNG</td>
    <td class="text-r">${window.fmt.num(totOrders)}</td>
    <td class="text-r">${window.fmt.num(totClicks)}</td>
    <td class="text-r">${window.fmt.vnd(totRev)}</td>
    <td class="text-r">${window.fmt.vnd(totReduct)}</td>
    <td class="text-r">${window.fmt.vnd(totCost)}</td>
    <td class="text-r ${window.profitClass(totProfit)}">${window.fmt.vnd(totProfit)}</td>
  </tr>`;
}

window.registerTab('daily', loadDaily);
