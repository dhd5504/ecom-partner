'use strict';
/* ── campaign.js ── Campaign sortable table ── */

let _campData = [], _campSort = { col: 'revenue_vnd', dir: -1 };

async function loadCampaign() {
  const el = document.getElementById('campBody');
  const grid = document.getElementById('campSummaryGrid');
  document.getElementById('campLoading').classList.remove('hidden');
  el.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--text-dim)"><i class="mdi mdi-loading mdi-spin"></i> Đang tải...</td></tr>';

  try {
    const data = await window.fetchApi('/api/campaigns?' + window.buildQuery());
    document.getElementById('campLoading').classList.add('hidden');
    if (!data) return;
    _campData = data;
    _renderCampaignSummary(data, grid);
    _renderCampaignTable();
  } catch (e) {
    document.getElementById('campLoading').classList.add('hidden');
    el.innerHTML = `<tr><td colspan="10" style="color:#f43f5e;padding:1rem">Lỗi: ${e.message}</td></tr>`;
  }
}

function _renderCampaignSummary(data, grid) {
  let totRevenue = 0, totCost = 0, totProfit = 0, totOrders = 0, totClicks = 0, totReduct = 0;
  data.forEach(r => {
    totRevenue += r.revenue_vnd || 0;
    totCost    += r.cost_vnd    || 0;
    totProfit  += r.profit_vnd  || 0;
    totOrders  += r.total_orders|| 0;
    totClicks  += r.shopee_clicks|| 0;
    totReduct  += r.reduct_vnd  || 0;
  });
  const roi = totCost > 0 ? ((totRevenue - totCost - totReduct) / totCost * 100) : 0;
  grid.innerHTML = [
    ['S.Clicks', window.fmt.numHtml(totClicks)],
    ['Đơn',     window.fmt.numHtml(totOrders)],
    ['Revenue',  window.fmt.vndHtml(totRevenue)],
    ['Reduct',   window.fmt.vndHtml(totReduct)],
    ['Spent',    window.fmt.vndHtml(totCost)],
    ['Profit',   window.fmt.vndHtml(totProfit)],
    ['ROI',      window.fmt.pct(roi)],
  ].map(([l,v]) => `<div class="camp-summary-card"><div class="csc-label">${l}</div><div class="csc-value">${v}</div></div>`).join('');
}

let _campPage = 1;
const _campPerPage = 20;

function _renderCampaignTable() {
  const tbody = document.getElementById('campBody');
  const pag = document.getElementById('campPagination');
  const sorted = [..._campData].sort((a, b) => _campSort.dir * ((a[_campSort.col] || 0) > (b[_campSort.col] || 0) ? 1 : -1));

  const totalPages = Math.ceil(sorted.length / _campPerPage) || 1;
  if (_campPage > totalPages) _campPage = totalPages;
  const start = (_campPage - 1) * _campPerPage;
  const pageData = sorted.slice(start, start + _campPerPage);

  tbody.innerHTML = pageData.map(r => {
    const roi = r.cost_vnd > 0 ? ((r.revenue_vnd - r.cost_vnd - r.reduct_vnd) / r.cost_vnd * 100) : 0;
    return `<tr>
      <td>${r.campaign_id}</td>
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
      <span class="page-info">Trang <strong>${_campPage} / ${totalPages}</strong></span>
      <div style="display:flex;gap:0.5rem">
        <button class="btn-page" id="c-prev" ${_campPage <= 1 ? 'disabled' : ''}><i class="mdi mdi-chevron-left"></i> Trước</button>
        <button class="btn-page" id="c-next" ${_campPage >= totalPages ? 'disabled' : ''}>Sau <i class="mdi mdi-chevron-right"></i></button>
      </div>
    </div>
  `;

  if (_campPage > 1) {
    document.getElementById('c-prev').onclick = () => { _campPage--; _renderCampaignTable(); };
  }
  if (_campPage < totalPages) {
    document.getElementById('c-next').onclick = () => { _campPage++; _renderCampaignTable(); };
  }
}

// Sortable headers
document.querySelectorAll('#campTable th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.sort;
    if (_campSort.col === col) { _campSort.dir *= -1; }
    else { _campSort.col = col; _campSort.dir = -1; }
    document.querySelectorAll('#campTable th.sortable').forEach(h => h.classList.remove('active'));
    th.classList.add('active');
    th.querySelector('i').className = _campSort.dir === -1 ? 'mdi mdi-sort-descending' : 'mdi mdi-sort-ascending';
    _campPage = 1;
    _renderCampaignTable();
  });
});

window.registerTab('campaign', loadCampaign);
