/* ================================================================
   main.js — Controller chính: auth check, filter, tabs, helpers
   ================================================================ */

'use strict';

// ── Globals ─────────────────────────────────────────────────────
window.App = {
  dateFrom: '',
  dateTo: '',
  campaignId: '',
  activeTab: 'overview',
};

// ── Format helpers ───────────────────────────────────────────────
window.fmt = {
  /** 1234567 → "1.234.567 đ" */
  vnd(n) {
    if (n === null || n === undefined) return '—';
    const v = Math.round(Number(n));
    return v.toLocaleString('vi-VN') + ' đ';
  },
  /** 12.345 → "12.35%" */
  pct(n, decimals = 2) {
    if (n === null || n === undefined) return '—';
    return Number(n).toFixed(decimals) + '%';
  },
  /** 1234567 → "1,234,567" */
  num(n) {
    if (n === null || n === undefined) return '—';
    return Number(n).toLocaleString('en-US');
  },
  /** Rút gọn VND: 1_500_000 → "1.5M đ" */
  vndShort(n) {
    if (n === null || n === undefined) return '—';
    const v = Number(n);
    if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + 'B đ';
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M đ';
    if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(0) + 'K đ';
    return v.toFixed(0) + ' đ';
  },
};

// ── API helper ───────────────────────────────────────────────────
window.fetchApi = async function fetchApi(path) {
  const res = await fetch(path, { credentials: 'include' });
  if (res.status === 401) { location.href = '/login.html'; return null; }
  const json = await res.json();
  if (json.status === 'error') throw new Error(json.message || 'API error');
  return json.data;
};

// ── Build query string ───────────────────────────────────────────
window.buildQuery = function buildQuery(extra = {}) {
  const p = new URLSearchParams({
    date_from: window.App.dateFrom,
    date_to: window.App.dateTo,
  });
  if (window.App.campaignId) p.set('campaign_id', window.App.campaignId);
  Object.entries(extra).forEach(([k, v]) => v !== undefined && p.set(k, v));
  return p.toString();
};

// ── Loading / empty helpers ──────────────────────────────────────
window.loadingHtml = () =>
  `<div class="state-loading"><div class="spinner"></div><br/>Đang tải...</div>`;
window.emptyHtml = (msg = 'Không có dữ liệu') =>
  `<div class="state-empty">${msg}</div>`;

// ── Color helpers for profit/roi ─────────────────────────────────
window.profitClass = (n) => (n > 0 ? 'text-green' : n < 0 ? 'text-red' : '');
window.profitKpiClass = (n) => (n > 0 ? 'positive' : n < 0 ? 'negative' : 'neutral');

// ── Date defaults ────────────────────────────────────────────────
function isoDate(d) { return d.toISOString().slice(0, 10); }
function initDates() {
  const today = new Date();
  const from7 = new Date(today);
  from7.setDate(today.getDate() - 6);
  window.App.dateFrom = isoDate(from7);
  window.App.dateTo = isoDate(today);
  document.getElementById('date-from').value = window.App.dateFrom;
  document.getElementById('date-to').value = window.App.dateTo;
}

// ── Campaign filter dropdown ─────────────────────────────────────
async function loadCampaignList() {
  try {
    const data = await window.fetchApi(
      `/api/campaigns/list?date_from=${window.App.dateFrom}&date_to=${window.App.dateTo}`
    );
    if (!data) return;
    const sel = document.getElementById('campaign-filter');
    // keep first "Tất cả" option
    while (sel.options.length > 1) sel.remove(1);
    data.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.campaign_id;
      opt.textContent = c.campaign_name || c.campaign_id;
      sel.appendChild(opt);
    });
  } catch (_) { /* ignore */ }
}

// ── Tab routing ──────────────────────────────────────────────────
const TAB_LOADERS = {
  overview: () => typeof loadOverview === 'function' && loadOverview(),
  campaign: () => typeof loadCampaign === 'function' && loadCampaign(),
  zone:     () => typeof loadZone     === 'function' && loadZone(),
  daily:    () => typeof loadDaily    === 'function' && loadDaily(),
};

function activateTab(name) {
  window.App.activeTab = name;
  document.querySelectorAll('.tab-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === name)
  );
  document.querySelectorAll('.tab-content').forEach((el) =>
    el.classList.toggle('active', el.id === `tab-${name}`)
  );
  TAB_LOADERS[name]?.();
}

// ── Apply filter ─────────────────────────────────────────────────
function applyFilter() {
  window.App.dateFrom = document.getElementById('date-from').value;
  window.App.dateTo = document.getElementById('date-to').value;
  window.App.campaignId = document.getElementById('campaign-filter').value;
  loadCampaignList();
  TAB_LOADERS[window.App.activeTab]?.();
}

// ── Auth check + init ────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('/api/auth/check', { credentials: 'include' });
    const json = await res.json();
    if (!json.authenticated) { location.href = '/login.html'; return; }
  } catch (_) { location.href = '/login.html'; return; }

  initDates();
  await loadCampaignList();

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach((btn) =>
    btn.addEventListener('click', () => activateTab(btn.dataset.tab))
  );

  // Filter apply
  document.getElementById('btn-apply').addEventListener('click', applyFilter);

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    location.href = '/login.html';
  });

  // Load default tab
  activateTab('overview');
}

document.addEventListener('DOMContentLoaded', init);
