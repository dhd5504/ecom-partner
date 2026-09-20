'use strict';

/* ================================================================
   main.js — Auth, filter, routing, shared helpers
   ================================================================ */

/* ── Format helpers ─────────────────────────────────────────────── */
window.fmt = {
  vnd: (v) => {
    const n = Number(v) || 0;
    return n.toLocaleString('vi-VN') + ' đ';
  },
  vndShort: (v) => {
    const n = Number(v) || 0;
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B đ';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M đ';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + 'K đ';
    return n.toLocaleString('vi-VN') + ' đ';
  },
  vndHtml: (v) => {
    const n = Number(v) || 0;
    let short = n.toLocaleString('vi-VN');
    if (Math.abs(n) >= 1e9) short = (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    else if (Math.abs(n) >= 1e6) short = (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    else if (Math.abs(n) >= 1e3) short = (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return `<span title="${n.toLocaleString('vi-VN')} đ">${short}</span>`;
  },
  numHtml: (v) => {
    const n = Number(v) || 0;
    let short = n.toLocaleString('vi-VN');
    if (Math.abs(n) >= 1e6) short = (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    else if (Math.abs(n) >= 1e3) short = (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return `<span title="${n.toLocaleString('vi-VN')}">${short}</span>`;
  },
  num: (v) => Number(v || 0).toLocaleString('vi-VN'),
  pct: (v) => (Number(v) || 0).toFixed(2) + '%',
};

window.profitClass = (v) => Number(v) >= 0 ? 'text-green' : 'text-red';

window.loadingHtml = () => '<div style="padding:3rem;text-align:center;color:var(--text-dim)"><i class="mdi mdi-loading mdi-spin" style="font-size:2rem"></i></div>';
window.emptyHtml   = () => '<div style="padding:3rem;text-align:center;color:var(--text-dim)">Không có dữ liệu.</div>';

/* ── API helper ─────────────────────────────────────────────────── */
window.fetchApi = async (url) => {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (res.status === 401) { location.href = '/login'; return null; }  // Fix: đúng route /login
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Server error');
    return json.data ?? json;
  } catch (err) {
    console.error('[fetchApi]', url, err);
    throw err;
  }
};

/* ── App state ──────────────────────────────────────────────────── */
window.App = {
  dateFrom: '',
  dateTo:   '',
  campaign: '',
};

window.buildQuery = () => {
  const p = new URLSearchParams({ date_from: App.dateFrom, date_to: App.dateTo });
  if (App.campaign) p.set('campaign_id', App.campaign);
  return p.toString();
};

/* ── Tab routing ────────────────────────────────────────────────── */
const TAB_TITLES = {
  overview: 'Tổng quan',
  campaign: 'Campaign Report',
  zone:     'Zone Report',
  daily:    'Xu hướng',
};
const TAB_LOADERS = {};

window.registerTab = (id, fn) => { TAB_LOADERS[id] = fn; };

// Debounce: chỉ load tab sau khi người dùng dừng click 300ms
// Tránh bắn đồng thời hàng chục API calls khi click liên tiếp
let _tabDebounceTimer = null;

function activateTab(id) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === id);
  });
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === 'tab-' + id);
  });
  document.getElementById('pageTitle').textContent = TAB_TITLES[id] || id;

  // Debounce API calls — hủy request cũ nếu click liên tiếp trong 300ms
  clearTimeout(_tabDebounceTimer);
  _tabDebounceTimer = setTimeout(() => {
    if (TAB_LOADERS[id]) TAB_LOADERS[id]();
  }, 300);
}

/* ── Theme toggle ───────────────────────────────────────────────── */
function initTheme() {
  const saved = localStorage.getItem('partner_theme') || 'light';
  if (saved === 'dark') document.body.classList.add('dark-theme');
  document.getElementById('themeToggle').addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('partner_theme', isDark ? 'dark' : 'light');
    document.getElementById('themeToggle').querySelector('i').className =
      isDark ? 'mdi mdi-weather-sunny' : 'mdi mdi-weather-night';
  });
  if (saved === 'dark') {
    document.getElementById('themeToggle').querySelector('i').className = 'mdi mdi-weather-sunny';
  }
}

/* ── DateRangePicker ────────────────────────────────────────────── */
function initDatePicker() {
  const today = moment();
  const defaultFrom = moment().subtract(7, 'days');

  App.dateFrom = defaultFrom.format('YYYY-MM-DD');
  App.dateTo   = today.format('YYYY-MM-DD');

  $('#reportrange').daterangepicker({
    startDate: defaultFrom,
    endDate:   today,
    maxDate:   today,
    autoApply: true,
    locale: {
      format: 'DD/MM/YYYY',
      applyLabel: 'Áp dụng',
      cancelLabel: 'Hủy',
      fromLabel: 'Từ',
      toLabel: 'Đến',
      customRangeLabel: 'Tùy chọn',
      daysOfWeek: ['CN','T2','T3','T4','T5','T6','T7'],
      monthNames: ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'],
      firstDay: 1,
    },
    ranges: {
      'Hôm nay':      [moment(), moment()],
      'Hôm qua':      [moment().subtract(1,'days'), moment().subtract(1,'days')],
      '7 ngày qua':   [moment().subtract(6,'days'), moment()],
      '14 ngày qua':  [moment().subtract(13,'days'), moment()],
      '30 ngày qua':  [moment().subtract(29,'days'), moment()],
      'Tháng này':    [moment().startOf('month'), moment().endOf('month')],
      'Tháng trước':  [moment().subtract(1,'month').startOf('month'), moment().subtract(1,'month').endOf('month')],
    },
  }, (start, end) => {
    App.dateFrom = start.format('YYYY-MM-DD');
    App.dateTo   = end.format('YYYY-MM-DD');
    $('.daterange-text').text(start.format('DD/MM/YYYY') + ' - ' + end.format('DD/MM/YYYY'));
    
    // Auto-apply
    const active = document.querySelector('.nav-item.active')?.dataset.tab || 'overview';
    activateTab(active);
  });

  $('.daterange-text').text(defaultFrom.format('DD/MM/YYYY') + ' - ' + today.format('DD/MM/YYYY'));
}

/* ── Campaign dropdown ──────────────────────────────────────────── */
async function loadCampaigns() {
  try {
    const data = await window.fetchApi('/api/campaigns/list');
    if (!data) return;
    const sel = document.getElementById('campaignSelect');
    data.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.campaign_id;
      opt.textContent = c.campaign_id;
      sel.appendChild(opt);
    });
  } catch (_) {}
}

/* ── Init ───────────────────────────────────────────────────────── */
async function init() {
  try {
    const res  = await fetch('/api/auth/check', { credentials: 'include' });
    const json = await res.json();
    if (!json.data?.authenticated) { location.href = '/login'; return; }  // Fix: đúng route /login
  } catch (_) { location.href = '/login'; return; }

  initTheme();
  initDatePicker();
  await loadCampaigns();

  // Tab nav
  document.querySelectorAll('.nav-item[data-tab]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      activateTab(el.dataset.tab);
    });
  });

  // Auto-apply filter on change
  document.getElementById('campaignSelect').addEventListener('change', () => {
    App.campaign = document.getElementById('campaignSelect').value;
    const active = document.querySelector('.nav-item.active')?.dataset.tab || 'overview';
    activateTab(active);
  });

  // Logout
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    location.href = '/login.html';
  });

  // Load default tab
  activateTab('overview');
}

init();
