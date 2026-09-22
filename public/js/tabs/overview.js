'use strict';
/* ── overview.js ── KPI cards + daily bar chart + pie charts ── */

let _ovChart = null, _ovRevPie = null, _ovCostPie = null;
const _ovActiveSet = new Set([0, 1, 3]); // Default: 0=Revenue, 1=Spent (Cost), 3=ROI (%)
const PIE_COLORS = ['#8b5cf6','#3b82f6','#10b981','#f97316','#f43f5e','#eab308','#14b8a6','#ec4899','#64748b'];

const OV_DATASETS = [
  { label: 'Revenue',  key: 'revenue_vnd', color: '#8b5cf6', type: 'bar',  yAxisID: 'yLeft'  },
  { label: 'Spent',    key: 'cost_vnd',    color: '#f43f5e', type: 'bar',  yAxisID: 'yLeft'  },
  { label: 'Profit',   key: 'profit_vnd',  color: '#10b981', type: 'bar',  yAxisID: 'yLeft'  },
  { label: 'ROI (%)',  key: 'roi',         color: '#eab308', type: 'line', yAxisID: 'yRight' },
  { label: 'Orders',   key: 'total_orders',color: '#f97316', type: 'line', yAxisID: 'yRight' },
  { label: 'Reduct',   key: 'reduct_vnd',  color: '#ef4444', type: 'line', yAxisID: 'yLeft', borderDash: [4,4] },
];

async function loadOverview() {
  // 1. KPI
  try {
    const d = await window.fetchApi('/api/metrics?' + window.buildQuery());
    if (!d) return;
    const orders = d.total_orders || 0;
    const clicks = d.shopee_clicks || 0;
    const cr = clicks > 0 ? (orders / clicks * 100) : 0;
    const roi = d.cost_vnd > 0 ? ((d.revenue_vnd - d.cost_vnd - d.reduct_vnd) / d.cost_vnd * 100) : 0;

    document.getElementById('m-clicks').innerHTML      = window.fmt.numHtml(clicks);
    document.getElementById('m-impressions').innerHTML = window.fmt.numHtml(d.impressions);
    document.getElementById('m-orders').innerHTML      = window.fmt.numHtml(orders);
    document.getElementById('m-cr').textContent        = window.fmt.pct(cr);
    document.getElementById('m-revenue').innerHTML     = window.fmt.vndHtml(d.revenue_vnd);
    document.getElementById('m-cost').innerHTML        = window.fmt.vndHtml(d.cost_vnd);
    document.getElementById('m-reduct').innerHTML      = window.fmt.vndHtml(d.reduct_vnd);
    const profitEl = document.getElementById('m-profit');
    profitEl.innerHTML = window.fmt.vndHtml(d.profit_vnd);
    profitEl.className = window.profitClass(d.profit_vnd);
    const roiEl = document.getElementById('m-roi');
    roiEl.textContent = window.fmt.pct(roi);
    roiEl.className = window.profitClass(roi);
  } catch (e) { console.error('[overview] kpi', e); }

  // 2. Daily chart
  try {
    document.getElementById('ovChartLoading').classList.remove('hidden');
    const rows = await window.fetchApi('/api/metrics/daily?' + window.buildQuery());
    document.getElementById('ovChartLoading').classList.add('hidden');
    if (!rows) return;

    const labels = rows.map(r => { const [,mm,dd] = r.date.split('-'); return `${dd}/${mm}`; });

    if (_ovChart) { _ovChart.destroy(); _ovChart = null; }
    const ctx = document.getElementById('ovDailyChart').getContext('2d');

    document.querySelectorAll('.ov-chip').forEach(btn => {
      const idx = +btn.dataset.metric;
      btn.classList.toggle('active', _ovActiveSet.has(idx));
      // clear old event listeners if any
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => {
        const i = +newBtn.dataset.metric;
        if (_ovActiveSet.has(i)) _ovActiveSet.delete(i); else _ovActiveSet.add(i);
        newBtn.classList.toggle('active', _ovActiveSet.has(i));
        _ovChart.data.datasets.forEach((ds, dsIdx) => { ds.hidden = !_ovActiveSet.has(dsIdx); });
        _ovChart.update();
      });
    });

    _ovChart = new Chart(ctx, {
      data: {
        labels,
        datasets: OV_DATASETS.map((ds, i) => {
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
            hidden: !_ovActiveSet.has(i)
          };
        }),
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
  } catch (e) { console.error('[overview] daily chart', e); }

  // 3. Pie charts by campaign
  try {
    const camps = await window.fetchApi('/api/campaigns?' + window.buildQuery());
    if (!camps || !camps.length) return;
    const filteredCamps = camps.filter(c => c.campaign_id !== '__unknown__');

    _buildPie('ovRevenuePie', filteredCamps, 'revenue_vnd', 'Revenue by Campaign', _ovRevPie, (c) => { _ovRevPie = c; });
    _buildPie('ovCostPie',    filteredCamps, 'cost_vnd',    'Spent by Campaign',   _ovCostPie, (c) => { _ovCostPie = c; });
  } catch (e) { console.error('[overview] pie', e); }
}

function _buildPie(canvasId, data, key, title, existing, setter) {
  if (existing) { existing.destroy(); }
  const ctx = document.getElementById(canvasId).getContext('2d');
  setter(new Chart(ctx, {
    type: 'pie',
    data: {
      labels: data.map(d => d.campaign_id),
      datasets: [{ data: data.map(d => d[key] || 0), backgroundColor: PIE_COLORS, borderWidth: 2 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#64748b', font: { size: 11 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${window.fmt.vndShort(c.raw)}` } },
      },
    },
  }));
}

window.registerTab('overview', loadOverview);
