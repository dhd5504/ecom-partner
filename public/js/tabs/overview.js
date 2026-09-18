/* ================================================================
   overview.js — Tab Tổng quan: KPI cards
   ================================================================ */
'use strict';

async function loadOverview() {
  const el = document.getElementById('tab-overview');
  el.innerHTML = window.loadingHtml();
  try {
    const data = await window.fetchApi('/api/metrics?' + window.buildQuery());
    if (!data) return;

    const {
      cost_vnd, revenue_vnd, reduct_vnd, profit_vnd,
      roi_pct, total_orders, cancelled_orders,
      shopee_clicks, impressions, propeller_clicks,
      cr_pct, cpo_vnd,
    } = data;

    el.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Chi phí Ads (Spent)</div>
          <div class="kpi-value neutral">${window.fmt.vnd(cost_vnd)}</div>
          <div class="kpi-sub">PropellerAds → VND</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Hoa hồng (Revenue)</div>
          <div class="kpi-value neutral">${window.fmt.vnd(revenue_vnd)}</div>
          <div class="kpi-sub">Đơn đang xử lý + hoàn thành</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Đơn hủy (Reduct)</div>
          <div class="kpi-value ${reduct_vnd > 0 ? 'negative' : 'neutral'}">${window.fmt.vnd(reduct_vnd)}</div>
          <div class="kpi-sub">Hoa hồng đã biết của đơn hủy</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Lợi nhuận (Profit)</div>
          <div class="kpi-value ${window.profitKpiClass(profit_vnd)}">${window.fmt.vnd(profit_vnd)}</div>
          <div class="kpi-sub">Revenue − Spent − Reduct</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">ROI</div>
          <div class="kpi-value ${window.profitKpiClass(roi_pct)}">${window.fmt.pct(roi_pct)}</div>
          <div class="kpi-sub">Profit / Spent × 100</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Tổng đơn</div>
          <div class="kpi-value neutral">${window.fmt.num(total_orders)}</div>
          <div class="kpi-sub">${window.fmt.num(cancelled_orders)} đơn hủy</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">CR (Shopee)</div>
          <div class="kpi-value neutral">${window.fmt.pct(cr_pct)}</div>
          <div class="kpi-sub">Đơn / Click Shopee</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">CPO</div>
          <div class="kpi-value neutral">${window.fmt.vnd(cpo_vnd)}</div>
          <div class="kpi-sub">Spent / Tổng đơn</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Impressions</div>
          <div class="kpi-value neutral">${window.fmt.num(impressions)}</div>
          <div class="kpi-sub">Propeller</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Click Propeller</div>
          <div class="kpi-value neutral">${window.fmt.num(propeller_clicks)}</div>
          <div class="kpi-sub">Propeller ghi nhận</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Click Shopee</div>
          <div class="kpi-value neutral">${window.fmt.num(shopee_clicks)}</div>
          <div class="kpi-sub">Shopee Affiliate ghi nhận</div>
        </div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="state-empty">Lỗi tải dữ liệu: ${err.message}</div>`;
  }
}
