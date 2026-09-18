/* ================================================================
   campaign.js — Tab Campaign: bảng theo campaign
   ================================================================ */
'use strict';

(function () {
  let _data = [];
  let _sortCol = 'cost_vnd';
  let _sortAsc = false;

  function renderTable(rows) {
    if (!rows.length) {
      document.getElementById('tab-campaign').innerHTML = window.emptyHtml('Không có dữ liệu campaign');
      return;
    }

    // Tính summary
    const sum = rows.reduce((acc, r) => {
      acc.impressions      += r.impressions;
      acc.propeller_clicks += r.propeller_clicks;
      acc.shopee_clicks    += r.shopee_clicks;
      acc.total_orders     += r.total_orders;
      acc.cancelled_orders += r.cancelled_orders;
      acc.revenue_vnd      += r.revenue_vnd;
      acc.reduct_vnd       += r.reduct_vnd;
      acc.cost_vnd         += r.cost_vnd;
      acc.profit_vnd       += r.profit_vnd;
      return acc;
    }, { impressions:0, propeller_clicks:0, shopee_clicks:0, total_orders:0,
         cancelled_orders:0, revenue_vnd:0, reduct_vnd:0, cost_vnd:0, profit_vnd:0 });

    const cols = [
      { key: 'campaign_name', label: 'Campaign', align: 'left' },
      { key: 'impressions',      label: 'Impressions' },
      { key: 'propeller_clicks', label: 'P.Clicks' },
      { key: 'shopee_clicks',    label: 'S.Clicks' },
      { key: 'total_orders',     label: 'Đơn' },
      { key: 'cancelled_orders', label: 'Hủy' },
      { key: 'revenue_vnd',      label: 'Revenue' },
      { key: 'reduct_vnd',       label: 'Reduct' },
      { key: 'cost_vnd',         label: 'Spent' },
      { key: 'profit_vnd',       label: 'Profit' },
      { key: 'roi_pct',          label: 'ROI' },
      { key: 'cr_pct',           label: 'CR' },
      { key: 'cpo_vnd',          label: 'CPO' },
    ];

    const thHtml = cols.map(c => {
      const cls = _sortCol === c.key ? (_sortAsc ? 'sort-asc' : 'sort-desc') : '';
      return `<th class="${cls}" data-col="${c.key}">${c.label}</th>`;
    }).join('');

    const fmtCell = (key, row) => {
      const v = row[key];
      if (['revenue_vnd','reduct_vnd','cost_vnd','profit_vnd','cpo_vnd'].includes(key))
        return `<span class="${key === 'profit_vnd' ? window.profitClass(v) : ''}">${window.fmt.vnd(v)}</span>`;
      if (key === 'roi_pct') return `<span class="${window.profitClass(v)}">${window.fmt.pct(v)}</span>`;
      if (key === 'cr_pct')  return window.fmt.pct(v);
      if (['impressions','propeller_clicks','shopee_clicks','total_orders','cancelled_orders'].includes(key))
        return window.fmt.num(v);
      return v ?? '—';
    };

    const tbodyHtml = rows.map(r => `
      <tr>
        <td>${r.campaign_name || r.campaign_id}</td>
        ${cols.slice(1).map(c => `<td>${fmtCell(c.key, r)}</td>`).join('')}
      </tr>
    `).join('');

    const tfootHtml = `
      <tr>
        <td>Tổng</td>
        <td>${window.fmt.num(sum.impressions)}</td>
        <td>${window.fmt.num(sum.propeller_clicks)}</td>
        <td>${window.fmt.num(sum.shopee_clicks)}</td>
        <td>${window.fmt.num(sum.total_orders)}</td>
        <td>${window.fmt.num(sum.cancelled_orders)}</td>
        <td>${window.fmt.vnd(sum.revenue_vnd)}</td>
        <td>${window.fmt.vnd(sum.reduct_vnd)}</td>
        <td>${window.fmt.vnd(sum.cost_vnd)}</td>
        <td class="${window.profitClass(sum.profit_vnd)}">${window.fmt.vnd(sum.profit_vnd)}</td>
        <td></td><td></td><td></td>
      </tr>
    `;

    document.getElementById('tab-campaign').innerHTML = `
      <div class="table-wrap">
        <div class="table-title">Campaign Report</div>
        <div class="table-scroll">
          <table>
            <thead><tr>${thHtml}</tr></thead>
            <tbody>${tbodyHtml}</tbody>
            <tfoot>${tfootHtml}</tfoot>
          </table>
        </div>
      </div>
    `;

    // Sort on header click
    document.querySelectorAll('#tab-campaign thead th').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (_sortCol === col) _sortAsc = !_sortAsc;
        else { _sortCol = col; _sortAsc = false; }
        sortAndRender();
      });
    });
  }

  function sortAndRender() {
    const sorted = [..._data].sort((a, b) => {
      const va = a[_sortCol] ?? -Infinity;
      const vb = b[_sortCol] ?? -Infinity;
      if (typeof va === 'string') return _sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return _sortAsc ? va - vb : vb - va;
    });
    renderTable(sorted);
  }

  window.loadCampaign = async function () {
    document.getElementById('tab-campaign').innerHTML = window.loadingHtml();
    try {
      const data = await window.fetchApi('/api/campaigns?' + window.buildQuery());
      if (!data) return;
      _data = data;
      _sortCol = 'cost_vnd';
      _sortAsc = false;
      sortAndRender();
    } catch (err) {
      document.getElementById('tab-campaign').innerHTML =
        `<div class="state-empty">Lỗi: ${err.message}</div>`;
    }
  };
})();
