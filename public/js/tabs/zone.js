'use strict';
/* ── zone.js ── Zone sortable table ── */

let _zoneData = [], _zoneSort = { col: 'revenue_vnd', dir: -1 };

async function loadZone() {
  const el = document.getElementById('zoneBody');
  const grid = document.getElementById('zoneSummaryGrid');
  document.getElementById('zoneLoading').classList.remove('hidden');
  el.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--text-dim)"><i class="mdi mdi-loading mdi-spin"></i> Đang tải...</td></tr>';

  try {
    const data = await window.fetchApi('/api/zones?' + window.buildQuery());
    document.getElementById('zoneLoading').classList.add('hidden');
    if (!data) return;
    _zoneData = data;
    _renderZoneSummary(data, grid);
    _renderZoneTable();
  } catch (e) {
    document.getElementById('zoneLoading').classList.add('hidden');
    el.innerHTML = `<tr><td colspan="10" style="color:#f43f5e;padding:1rem">Lỗi: ${e.message}</td></tr>`;
  }
}

function _renderZoneSummary(data, grid) {
  let totRevenue = 0, totCost = 0, totProfit = 0, totOrders = 0, totClicks = 0, totReduct = 0;
  data.forEach(r => {
    totRevenue += r.revenue_vnd    || 0;
    totCost    += r.cost_vnd       || 0;
    totProfit  += r.profit_vnd     || 0;
    totOrders  += r.total_orders   || 0;
    totClicks  += r.shopee_clicks  || 0;
    totReduct  += r.reduct_vnd     || 0;
  });
  const roi = totCost > 0 ? ((totRevenue - totCost - totReduct) / totCost * 100) : 0;
  grid.innerHTML = [
    ['Zones',   window.fmt.numHtml(data.length)],
    ['S.Clicks', window.fmt.numHtml(totClicks)],
    ['Đơn',     window.fmt.numHtml(totOrders)],
    ['Revenue',  window.fmt.vndHtml(totRevenue)],
    ['Reduct',   window.fmt.vndHtml(totReduct)],
    ['Spent',    window.fmt.vndHtml(totCost)],
    ['Profit',   window.fmt.vndHtml(totProfit)],
    ['ROI',      window.fmt.pct(roi)],
  ].map(([l,v]) => `<div class="camp-summary-card"><div class="csc-label">${l}</div><div class="csc-value">${v}</div></div>`).join('');
}

let _zonePage = 1;
const _zonePerPage = 20;

function _renderZoneTable() {
  const tbody = document.getElementById('zoneBody');
  const pag = document.getElementById('zonePagination');
  const sorted = [..._zoneData].sort((a, b) => _zoneSort.dir * ((a[_zoneSort.col] || 0) > (b[_zoneSort.col] || 0) ? 1 : -1));

  const totalPages = Math.ceil(sorted.length / _zonePerPage) || 1;
  if (_zonePage > totalPages) _zonePage = totalPages;
  const start = (_zonePage - 1) * _zonePerPage;
  const pageData = sorted.slice(start, start + _zonePerPage);

  tbody.innerHTML = pageData.map(r => {
    const alias = r.zone_alias === '__unknown__' ? '<span style="color:var(--text-dim);font-style:italic">Không xác định</span>' : r.zone_alias;
    const roi = r.cost_vnd > 0 ? ((r.revenue_vnd - r.cost_vnd - r.reduct_vnd) / r.cost_vnd * 100) : 0;
    return `<tr>
      <td>${alias}</td>
      <td class="text-r">${window.fmt.num(r.impressions)}</td>
      <td class="text-r">${window.fmt.num(r.shopee_clicks)}</td>
      <td class="text-r">${window.fmt.num(r.total_orders)}</td>
      <td class="text-r">${window.fmt.vnd(r.revenue_vnd)}</td>
      <td class="text-r">${window.fmt.vnd(r.reduct_vnd)}</td>
      <td class="text-r">${window.fmt.vnd(r.cost_vnd)}</td>
      <td class="text-r ${window.profitClass(r.profit_vnd)}">${window.fmt.vnd(r.profit_vnd)}</td>
      <td class="text-r ${window.profitClass(roi)}">${window.fmt.pct(roi)}</td>
    </tr>`;
  }).join('');

  pag.innerHTML = `
    <div class="pagination">
      <span class="page-info">Trang <strong>${_zonePage} / ${totalPages}</strong></span>
      <div style="display:flex;gap:0.5rem">
        <button class="btn-page" id="z-prev" ${_zonePage <= 1 ? 'disabled' : ''}><i class="mdi mdi-chevron-left"></i> Trước</button>
        <button class="btn-page" id="z-next" ${_zonePage >= totalPages ? 'disabled' : ''}>Sau <i class="mdi mdi-chevron-right"></i></button>
      </div>
    </div>
  `;

  if (_zonePage > 1) {
    document.getElementById('z-prev').onclick = () => { _zonePage--; _renderZoneTable(); };
  }
  if (_zonePage < totalPages) {
    document.getElementById('z-next').onclick = () => { _zonePage++; _renderZoneTable(); };
  }
}

document.querySelectorAll('#zoneTable th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.sort;
    if (_zoneSort.col === col) { _zoneSort.dir *= -1; }
    else { _zoneSort.col = col; _zoneSort.dir = -1; }
    document.querySelectorAll('#zoneTable th.sortable').forEach(h => h.classList.remove('active'));
    th.classList.add('active');
    th.querySelector('i').className = _zoneSort.dir === -1 ? 'mdi mdi-sort-descending' : 'mdi mdi-sort-ascending';
    _zonePage = 1;
    _renderZoneTable();
  });
});

window.registerTab('zone', loadZone);
