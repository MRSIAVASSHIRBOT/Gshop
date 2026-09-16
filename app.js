/* ==========================================================
   G_SHOP - App.js v2.0
   منطق اصلی سایت
   ========================================================== */

/* ==========================================================
   CONFIG
   ========================================================== */
const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8787'
  : 'https://gahop.mrsiavashirbot.workers.dev';

const CART_KEY = 'gshop_cart_v7';
const WISH_KEY = 'gshop_wish_v7';
const RECENT_KEY = 'gshop_recent_v7';
const COMPARE_KEY = 'gshop_compare_v7';
const USER_KEY = 'gshop_user_v7';
const ORDERS_KEY = 'gshop_orders_v7';
const THEME_KEY = 'gshop_theme';
const ADMIN_TOKEN_KEY = 'gshop_admin_token';
const SETTINGS_CACHE_KEY = 'gshop_settings_cache';

const SUPPORT_TG = 'Alisdt98';
const PHONE = '09120507960';
const INSTAGRAM = 'g__shop11';

const COLOR_MAP = {
  'مشکی':'black','آبی':'blue','سفید':'white','قرمز':'قرمز','سبز':'سبز','خاکی':'خاکی','طوسی':'طوسی','خاکستری':'طوسی'
};

const IRAN_PROVINCES = [
  'آذربایجان شرقی','آذربایجان غربی','اردبیل','اصفهان','البرز','ایلام','بوشهر',
  'تهران','چهارمحال و بختیاری','خراسان جنوبی','خراسان رضوی','خراسان شمالی',
  'خوزستان','زنجان','سمنان','سیستان و بلوچستان','فارس','قزوین','قم','کردستان',
  'کرمان','کرمانشاه','کهگیلویه و بویراحمد','گلستان','گیلان','لرستان','مازندران',
  'مرکزی','هرمزگان','همدان','یزد'
];

/* ==========================================================
   UTILS
   ========================================================== */
const $  = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];
const fmt = (n) => new Intl.NumberFormat('fa-IR').format(n) + ' تومان';
const fmtNum = (n) => new Intl.NumberFormat('fa-IR').format(n);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const nf = (n) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const rafThrottle = (fn) => { let ticking = false; return (...a) => { if (!ticking) { requestAnimationFrame(() => { fn(...a); ticking = false; }); ticking = true; } }; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function api(path, opts = {}) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token && path.startsWith('/api/admin/')) headers['X-Admin-Token'] = token;
  const r = await fetch(API + path, { ...opts, headers });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || 'خطای شبکه');
    err.status = r.status;
    throw err;
  }
  return data;
}

function toast(msg, type = 'ok', timeout = 3200) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => {
    el.style.transition = 'all .3s';
    el.style.transform = 'translateX(120%)';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, timeout);
}

function confirmDialog(title, msg) {
  return new Promise(resolve => {
    const overlay = $('#confirmOverlay');
    $('#confirmTitle').textContent = title;
    $('#confirmMsg').textContent = msg;
    overlay.classList.add('on');
    const cleanup = (val) => {
      overlay.classList.remove('on');
      $('#confirmYes').onclick = null;
      $('#confirmNo').onclick = null;
      resolve(val);
    };
    $('#confirmYes').onclick = () => cleanup(true);
    $('#confirmNo').onclick = () => cleanup(false);
  });
}

/* ==========================================================
   STATE
   ========================================================== */
const state = {
  products: [],
  cart: [],
  wishlist: [],
  recent: [],
  compare: [],
  myOrders: [],
  filter: 'all',
  sort: 'default',
  search: '',
  category: '',
  settings: {},
  isAdmin: false,
  adminView: 'dashboard',
  adminOrders: [],
};

/* ==========================================================
   THEME
   ========================================================== */
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  updateThemeIcon(next);
}
function updateThemeIcon(theme) {
  const icon = $('#themeIcon');
  if (!icon) return;
  icon.innerHTML = theme === 'dark'
    ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
    : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>';
}

/* ==========================================================
   LOCAL STORAGE
   ========================================================== */
function loadLocal() {
  try { state.cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { state.cart = []; }
  try { state.wishlist = JSON.parse(localStorage.getItem(WISH_KEY) || '[]'); } catch { state.wishlist = []; }
  try { state.recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { state.recent = []; }
  try { state.compare = JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]'); } catch { state.compare = []; }
  try { state.myOrders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); } catch { state.myOrders = []; }
  try { state.settings = JSON.parse(localStorage.getItem(SETTINGS_CACHE_KEY) || '{}'); } catch { state.settings = {}; }
}
function saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); renderBadges(); }
function saveWish() { localStorage.setItem(WISH_KEY, JSON.stringify(state.wishlist)); renderBadges(); renderWishDrawer(); }
function saveRecent() { localStorage.setItem(RECENT_KEY, JSON.stringify(state.recent.slice(0, 8))); }
function saveCompare() { localStorage.setItem(COMPARE_KEY, JSON.stringify(state.compare)); renderCompareBar(); }
function saveMyOrders() { localStorage.setItem(ORDERS_KEY, JSON.stringify(state.myOrders.slice(0, 30))); renderOrdersDrawer(); }
function saveUserInfo(info) { try { localStorage.setItem(USER_KEY, JSON.stringify(info)); } catch {} }
function loadUserInfo() { try { return JSON.parse(localStorage.getItem(USER_KEY) || '{}'); } catch { return {}; } }

function renderBadges() {
  const cartN = state.cart.reduce((s, i) => s + i.qty, 0);
  const cartBadge = $('#cartBadge');
  if (cartBadge) {
    cartBadge.textContent = fmtNum(cartN);
    cartBadge.style.display = cartN > 0 ? 'grid' : 'none';
  }
  const wishBadge = $('#wishBadge');
  if (wishBadge) {
    wishBadge.textContent = fmtNum(state.wishlist.length);
    wishBadge.style.display = state.wishlist.length > 0 ? 'grid' : 'none';
  }
}

/* ==========================================================
   SHIPPING CALC
   ========================================================== */
function calcShipping(province, afterDiscountTotal) {
  const freeThreshold = state.settings.free_shipping_threshold || 1000000;
  if (afterDiscountTotal >= freeThreshold) return 0;
  if (['تهران','البرز','قم'].includes(province)) return state.settings.shipping_tehran || 35000;
  if (['اصفهان','مرکزی','قزوین','سمنان','مازندران','گلستان','گیلان','زنجان','همدان'].includes(province)) return state.settings.shipping_middle || 45000;
  return state.settings.shipping_other || 55000;
}

/* ==========================================================
   SETTINGS
   ========================================================== */
async function loadSettings() {
  try {
    const r = await api('/api/settings');
    state.settings = r.settings || {};
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(state.settings));
    applySettings();
  } catch (e) {
    if (Object.keys(state.settings).length) applySettings();
  }
}

function applySettings() {
  const s = state.settings;
  if (s.brand_name) {
    ['#brandName', '#brandNameMobile', '#brandNameFooter', '#brandNameAdmin'].forEach(sel => {
      const el = $(sel);
      if (el) el.textContent = s.brand_name;
    });
    document.title = s.brand_name + ' — ' + (s.brand_tagline || 'پوشاک اسپرت');
  }
  if (s.hero_lead) { const el = $('#heroLead'); if (el) el.innerHTML = s.hero_lead; }
  if (s.hero_tag) { const el = $('#heroTag'); if (el) el.textContent = s.hero_tag; }
  if (s.hero_line1) { const el = $('#heroLine1'); if (el) el.textContent = s.hero_line1; }
  if (s.hero_line2) { const el = $('#heroLine2'); if (el) el.textContent = s.hero_line2; }
  if (s.footer_desc) { const el = $('#footerDesc'); if (el) el.textContent = s.footer_desc; }
  if (s.phone) {
    const el = $('#footerPhone'); if (el) el.href = 'tel:' + s.phone;
    const mm = $('#mmPhone'); if (mm) mm.href = 'tel:' + s.phone;
  }
  if (s.telegram) {
    const el = $('#footerTelegram'); if (el) el.href = 'https://t.me/' + s.telegram.replace('@','');
    const mm = $('#mmTelegram'); if (mm) mm.href = 'https://t.me/' + s.telegram.replace('@','');
    const lc = $('#liveChat'); if (lc) lc.href = 'https://t.me/' + s.telegram.replace('@','');
  }
  if (s.instagram) {
    const el = $('#footerInstagram'); if (el) el.href = 'https://instagram.com/' + s.instagram.replace('@','');
    const mm = $('#mmInstagram'); if (mm) mm.href = 'https://instagram.com/' + s.instagram.replace('@','');
    const ig = $('#instagramLink'); if (ig) ig.href = 'https://instagram.com/' + s.instagram.replace('@','');
  }
  if (s.ticker_items) {
    try {
      const items = JSON.parse(s.ticker_items);
      if (Array.isArray(items) && items.length) {
        const track = $('#tickerTrack');
        if (track) {
          const html = items.concat(items).map(t => `<span>${esc(t)}</span>`).join('');
          track.innerHTML = html;
        }
      }
    } catch {}
  }
  if (s.countdown_end) {
    const t = new Date(s.countdown_end).getTime();
    if (!isNaN(t)) localStorage.setItem('gshop_countdown_target', String(t));
  }
  if (s.countdown_label) {
    const el = $('#countdownLabel');
    if (el) el.innerHTML = s.countdown_label;
  }
}

/* ==========================================================
   PRODUCTS
   ========================================================== */
function totalStock(p) { return p.variants.reduce((s, v) => s + v.stock, 0); }
function colorStock(p, c) { return p.variants.filter(v => v.color === c).reduce((s, v) => s + v.stock, 0); }

function getVariantsMap(p) {
  const m = {};
  p.variants.forEach(v => { m[v.color] = m[v.color] || {}; m[v.color][v.size] = v.stock; });
  return m;
}

async function loadProducts() {
  const grid = $('#grid');
  if (!grid) return;
  grid.innerHTML = Array(4).fill(0).map(() => `<div class="skeleton skel-card"></div>`).join('');
  try {
    const { products } = await api('/api/products');
    state.products = products;
    populateCategories();
    renderGrid();
    renderRecent();
  } catch (e) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:80px 30px;text-align:center;color:var(--dim);border:1px dashed var(--line-2);border-radius:var(--r-lg)">
      <p>خطا در بارگذاری محصولات. اتصال اینترنت را بررسی کنید.</p>
      <button class="chip" onclick="loadProducts()" style="margin-top:16px">🔄 تلاش دوباره</button>
    </div>`;
  }
}
window.loadProducts = loadProducts;

function populateCategories() {
  const sel = $('#categorySelect');
  if (!sel) return;
  const cats = [...new Set(state.products.map(p => p.category).filter(Boolean))];
  const labels = { tshirt:'تیشرت', hoodie:'هودی', shirt:'پیراهن', pants:'شلوار', jacket:'کاپشن', accessory:'اکسسوری' };
  sel.innerHTML = '<option value="">همه دسته‌ها</option>' +
    cats.map(c => `<option value="${esc(c)}">${esc(labels[c] || c)}</option>`).join('');
}

function getFiltered() {
  let list = [...state.products];
  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  }
  if (state.category) list = list.filter(p => p.category === state.category);
  if (state.filter === 'instock') list = list.filter(p => totalStock(p) > 0);
  if (state.filter === 'new') list = list.filter(p => p.tag === 'NEW');
  if (state.filter === 'sale') list = list.filter(p => p.compare_price && p.compare_price > p.price);
  if (state.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
  else if (state.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
  else if (state.sort === 'rating') list.sort((a, b) => b.rating_avg - a.rating_avg);
  else if (state.sort === 'stock') list.sort((a, b) => totalStock(b) - totalStock(a));
  else if (state.sort === 'newest') list.sort((a, b) => b.id - a.id);
  return list;
}

function productCardHTML(p, idx = 0) {
  const stock = totalStock(p);
  const colors = [...new Set(p.variants.map(v => v.color))];
  const isWished = state.wishlist.some(w => w.id === p.id);
  const isCompared = state.compare.includes(p.id);
  const hasDiscount = p.compare_price && p.compare_price > p.price;
  const discountPct = hasDiscount ? Math.round((1 - p.price / p.compare_price) * 100) : 0;

  const dots = colors.slice(0, 4).map(c => {
    const avail = colorStock(p, c) > 0;
    const cls = COLOR_MAP[c] || 'black';
    return `<span class="dot dot--${cls} ${avail ? '' : 'off'}" title="${esc(c)}"></span>`;
  }).join('') + (colors.length > 4 ? `<span style="font-size:10px;color:var(--dim);margin-inline-start:2px">+${colors.length - 4}</span>` : '');

  let badges = '';
  if (hasDiscount) badges += `<span class="pbadge" style="background:var(--red);color:#fff">٪${nf(discountPct)}-</span>`;
  if (p.tag && p.tag !== 'NEW') badges += `<span class="pbadge">${esc(p.tag)}</span>`;
  if (p.tag === 'NEW') badges += `<span class="pbadge">NEW</span>`;
  if (stock === 0) badges += `<span class="pbadge pbadge--danger">ناموجود</span>`;
  else if (stock <= 3) badges += `<span class="pbadge pbadge--warn">آخرین موجودی</span>`;

  return `
    <article class="pcard reveal" data-pid="${p.id}" style="transition-delay:${Math.min(idx * 40, 200)}ms">
      <div class="pcard__img">
        <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">
        <div class="pcard__badges">${badges}</div>
        <button class="pcard__wish ${isWished ? 'on' : ''}" data-wish="${p.id}" title="افزودن به علاقه‌مندی" aria-label="علاقه‌مندی">
          <svg viewBox="0 0 24 24" fill="${isWished ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
        <button class="pcard__compare ${isCompared ? 'on' : ''}" data-compare="${p.id}" title="مقایسه" aria-label="مقایسه">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
          </svg>
        </button>
        <div class="pcard__quick">مشاهده و خرید</div>
      </div>
      <div class="pcard__info">
        <div class="pcard__name">${esc(p.name)}</div>
        <div class="pcard__meta">
          <span class="pcard__price">${hasDiscount ? `<del>${fmtNum(p.compare_price)}</del>` : ''}${fmt(p.price)}</span>
          <span class="pcard__colors">${dots}</span>
        </div>
      </div>
    </article>
  `;
}

function renderGrid() {
  const grid = $('#grid');
  if (!grid) return;
  const list = getFiltered();
  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:80px 30px;text-align:center;color:var(--dim);border:1px dashed var(--line-2);border-radius:var(--r-lg)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--faint);margin:0 auto 16px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <p>محصولی پیدا نشد.</p>
    </div>`;
    return;
  }
  grid.innerHTML = list.map((p, i) => productCardHTML(p, i)).join('');
  bindProductCards(grid);
  observeReveals();
}

function renderRecent() {
  const sec = $('#recentSec');
  if (!sec) return;
  if (!state.recent.length) { sec.style.display = 'none'; return; }
  const recentProducts = state.recent.map(id => state.products.find(p => p.id === id)).filter(Boolean);
  if (!recentProducts.length) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  const grid = $('#recentGrid');
  grid.innerHTML = recentProducts.map((p, i) => productCardHTML(p, i)).join('');
  bindProductCards(grid);
}

function bindProductCards(container) {
  container.querySelectorAll('.pcard').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-wish]')) return;
      if (e.target.closest('[data-compare]')) return;
      openProduct(Number(card.dataset.pid));
    });
  });
  container.querySelectorAll('[data-wish]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleWish(Number(btn.dataset.wish));
    });
  });
  container.querySelectorAll('[data-compare]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCompare(Number(btn.dataset.compare));
    });
  });
}

function toggleWish(pid) {
  const idx = state.wishlist.findIndex(w => w.id === pid);
  const p = state.products.find(x => x.id === pid);
  if (!p) return;
  if (idx >= 0) {
    state.wishlist.splice(idx, 1);
    toast('از علاقه‌مندی‌ها حذف شد');
  } else {
    state.wishlist.push({ id: p.id, name: p.name, price: p.price, image: p.image });
    toast('به علاقه‌مندی‌ها اضافه شد ❤');
  }
  saveWish();
  renderGrid();
  renderRecent();
}

function renderWishDrawer() {
  const body = $('#wishBody');
  if (!body) return;
  if (!state.wishlist.length) {
    body.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--dim)">
      <div style="font-size:48px;margin-bottom:16px">❤</div>
      <p>هنوز چیزی به علاقه‌مندی‌ها اضافه نکردی.</p>
    </div>`;
    return;
  }
  body.innerHTML = state.wishlist.map(w => `
    <div class="citem">
      <div class="citem__img"><img src="${esc(w.image)}" alt=""></div>
      <div class="citem__info">
        <div class="citem__name">${esc(w.name)}</div>
        <div class="citem__meta">${fmt(w.price)}</div>
        <div class="citem__row">
          <button class="citem__rm" data-wish-rm="${w.id}">حذف</button>
          <button style="font-size:12px;color:var(--lime);font-weight:600" data-wish-view="${w.id}">مشاهده →</button>
        </div>
      </div>
    </div>
  `).join('');
  body.querySelectorAll('[data-wish-rm]').forEach(b => {
    b.onclick = () => toggleWish(Number(b.dataset.wishRm));
  });
  body.querySelectorAll('[data-wish-view]').forEach(b => {
    b.onclick = () => {
      closeWishDrawer();
      openProduct(Number(b.dataset.wishView));
    };
  });
}

/* ==========================================================
   MY ORDERS DRAWER
   ========================================================== */
function renderOrdersDrawer() {
  const body = $('#ordersBody');
  if (!body) return;
  if (!state.myOrders.length) {
    body.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--dim)">
      <div style="font-size:48px;margin-bottom:16px">📋</div>
      <p>هنوز سفارشی ثبت نکردی.</p>
    </div>`;
    return;
  }
  const statuses = {
    pending:   { label: 'در انتظار', color: 'var(--gold)' },
    confirmed: { label: 'تایید شده', color: 'var(--purple)' },
    shipped:   { label: 'ارسال شده', color: 'var(--green)' },
    delivered: { label: 'تحویل شده', color: 'var(--lime)' },
    cancelled: { label: 'لغو شده', color: 'var(--red)' },
  };
  body.innerHTML = state.myOrders.map(o => {
    const st = statuses[o.status] || statuses.pending;
    return `
      <div class="oh-item">
        <div class="oh-head">
          <span class="oh-no mono">${esc(o.orderNo)}</span>
          <span class="oh-date">${esc(o.date || '')}</span>
        </div>
        <div style="font-size:12px;color:${st.color};font-weight:700;margin-bottom:6px">● ${st.label}</div>
        <div class="oh-body">${o.itemsSummary || ''}</div>
        <div class="oh-foot">
          <span style="font-size:12px;color:var(--dim)">${fmtNum(o.totalQty || 0)} عدد</span>
          <span class="oh-total">${fmt(o.total)}</span>
        </div>
      </div>
    `;
  }).join('');
}

function addMyOrder(order) {
  const itemsSummary = (order.items || []).map(i => `• ${esc(i.name)} — ${esc(i.color)} · ${esc(i.size)} ×${i.qty}`).join('<br>');
  state.myOrders.unshift({
    orderNo: order.orderNo,
    total: order.total,
    totalQty: (order.items || []).reduce((s, i) => s + i.qty, 0),
    status: 'pending',
    date: new Date().toLocaleString('fa-IR'),
    itemsSummary,
  });
  saveMyOrders();
}

function openOrdersDrawer() {
  renderOrdersDrawer();
  $('#ordersDrawer').classList.add('on');
  $('#scrim').classList.add('on');
  document.body.classList.add('no-scroll');
}
function closeOrdersDrawer() {
  $('#ordersDrawer').classList.remove('on');
  $('#scrim').classList.remove('on');
  if (!$('#drawer').classList.contains('on') && !$('#wishDrawer').classList.contains('on') && !$('#mobileMenu').classList.contains('on')) {
    document.body.classList.remove('no-scroll');
  }
}

/* ==========================================================
   COMPARE
   ========================================================== */
function toggleCompare(pid) {
  const idx = state.compare.indexOf(pid);
  if (idx >= 0) {
    state.compare.splice(idx, 1);
    toast('از مقایسه حذف شد');
  } else {
    if (state.compare.length >= 4) {
      toast('حداکثر ۴ محصول قابل مقایسه است', 'err');
      return;
    }
    state.compare.push(pid);
    toast('به مقایسه اضافه شد');
  }
  saveCompare();
  renderGrid();
  renderRecent();
}

function renderCompareBar() {
  const bar = $('#compareBar');
  if (!bar) return;
  if (!state.compare.length) {
    bar.classList.remove('on');
    return;
  }
  bar.classList.add('on');
  const items = $('#compareItems');
  const countEl = $('#compareCount');
  items.innerHTML = state.compare.map(id => {
    const p = state.products.find(x => x.id === id);
    if (!p) return '';
    return `<div class="compare-bar__item"><img src="${esc(p.image)}" alt=""><button data-cmp-rm="${id}" aria-label="حذف">×</button></div>`;
  }).join('');
  countEl.textContent = fmtNum(state.compare.length);
  items.querySelectorAll('[data-cmp-rm]').forEach(b => {
    b.onclick = () => toggleCompare(Number(b.dataset.cmpRm));
  });
  const btn = $('#compareBtn');
  btn.disabled = state.compare.length < 2;
}

function openCompareModal() {
  if (state.compare.length < 2) return;
  const products = state.compare.map(id => state.products.find(p => p.id === id)).filter(Boolean);
  const modal = $('#modal');
  const box = $('#modalBox');

  const stockOf = (p) => totalStock(p);
  const colorsOf = (p) => [...new Set(p.variants.map(v => v.color))].join(' · ');
  const sizesOf = (p) => [...new Set(p.variants.map(v => v.size))].join(' · ');

  box.classList.add('modal__box--wide');
  box.innerHTML = `
    <div class="compare-table">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h2 style="margin:0">مقایسه محصولات</h2>
        <button class="close-x" id="cmpClose" aria-label="بستن"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div style="overflow-x:auto">
        <table>
          <tr>
            <th></th>
            ${products.map(p => `<td style="text-align:center"><img src="${esc(p.image)}" alt=""><div class="cmp-name">${esc(p.name)}</div><div class="cmp-price">${fmt(p.price)}</div></td>`).join('')}
          </tr>
          <tr><th>قیمت</th>${products.map(p => `<td>${fmt(p.price)}${p.compare_price && p.compare_price > p.price ? `<br><del style="color:var(--faint);font-size:11px">${fmtNum(p.compare_price)}</del>` : ''}</td>`).join('')}</tr>
          <tr><th>موجودی</th>${products.map(p => `<td>${stockOf(p) > 0 ? `${fmtNum(stockOf(p))} عدد` : '<span style="color:var(--red)">ناموجود</span>'}</td>`).join('')}</tr>
          <tr><th>رنگ‌ها</th>${products.map(p => `<td style="font-size:12px">${esc(colorsOf(p))}</td>`).join('')}</tr>
          <tr><th>سایزها</th>${products.map(p => `<td style="font-size:12px">${esc(sizesOf(p))}</td>`).join('')}</tr>
          <tr><th>امتیاز</th>${products.map(p => `<td>${p.rating_avg ? `★ ${p.rating_avg.toFixed(1)}` : '—'}</td>`).join('')}</tr>
          <tr><th>توضیحات</th>${products.map(p => `<td style="font-size:12px;line-height:1.7">${esc((p.description || '').slice(0, 120))}...</td>`).join('')}</tr>
        </table>
      </div>
      <button class="checkout-btn" id="cmpClear" style="margin-top:20px;background:var(--ink-3);color:var(--text)">پاک کردن مقایسه</button>
    </div>
  `;
  $('#cmpClose').onclick = () => { modal.classList.remove('on'); box.classList.remove('modal__box--wide'); };
  $('#cmpClear').onclick = () => {
    state.compare = [];
    saveCompare();
    renderGrid();
    renderRecent();
    modal.classList.remove('on');
    box.classList.remove('modal__box--wide');
  };
  modal.onclick = e => { if (e.target === modal) { modal.classList.remove('on'); box.classList.remove('modal__box--wide'); } };
  modal.classList.add('on');
}

/* ==========================================================
   PRODUCT DETAIL
   ========================================================== */
async function openProduct(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;

  state.recent = [id, ...state.recent.filter(x => x !== id)].slice(0, 8);
  saveRecent();

  let reviews = [];
  try { reviews = (await api(`/api/products/${id}/reviews`)).reviews || []; }
  catch (e) { }

  const variantsMap = getVariantsMap(p);
  const colors = Object.keys(variantsMap);
  const sizes = [...new Set(p.variants.map(v => v.size))];
  const gallery = [p.image, ...(p.gallery || []).map(g => g.url)];

  let selectedColor = colors.find(c => colorStock(p, c) > 0) || colors[0];
  let selectedSize = sizes.find(s => (variantsMap[selectedColor]?.[s] || 0) > 0) || sizes[0];
  let qty = 1;
  let zoomed = false;

  const modal = $('#modal');
  const box = $('#modalBox');
  box.classList.remove('modal__box--wide');

  function renderReviews() {
    if (!reviews.length) return '';
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    const stars = (n) => '★'.repeat(n) + `<span class="off">${'★'.repeat(5 - n)}</span>`;
    return `
      <div class="reviews">
        <div class="reviews__head">
          <h4>نظرات (${fmtNum(reviews.length)})</h4>
          <span class="rstar">${stars(Math.round(avg))} <span style="color:var(--dim);font-family:'Space Grotesk',sans-serif;font-size:13px">${avg.toFixed(1)}</span></span>
        </div>
        <div class="rlist">
          ${reviews.slice(0, 10).map(r => `
            <div class="ritem">
              <div class="rhead"><b>${esc(r.name)}</b><span>${esc(r.created_at?.split(' ')[0] || '')}</span></div>
              <div class="rstar" style="font-size:12px;margin-bottom:6px">${stars(r.rating)}</div>
              <div class="rbody">${esc(r.comment)}</div>
            </div>
          `).join('')}
        </div>
        <button class="chip" id="writeReview" style="margin-top:14px;width:100%">✎ نوشتن نظر</button>
      </div>
    `;
  }

  function sizeLabel(s) {
    const guide = { 'S': 'کوچک', 'M': 'متوسط', 'L': 'بزرگ', 'XL': 'خیلی بزرگ', 'XXL': '۲XL', 'XXXL': '۳XL' };
    return guide[s] || '';
  }

  function render() {
    const stockOfSize = variantsMap[selectedColor]?.[selectedSize] || 0;
    const details = p.details || {};
    const hasDiscount = p.compare_price && p.compare_price > p.price;

    box.innerHTML = `
      <button class="close-x" id="pClose" style="position:absolute;top:16px;left:16px;z-index:5;background:var(--ink-1)" aria-label="بستن">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div style="padding:0;overflow:hidden;border-radius:var(--r-xl)">
        <div class="gallery">
          <div class="gallery__main" id="galleryMain">
            <img id="galleryMainImg" src="${esc(gallery[0])}" alt="">
            <div class="gallery__zoom-hint">🔍 برای بزرگ‌نمایی کلیک کن</div>
            ${gallery.length > 1 ? `
              <div class="gallery__thumbs">
                ${gallery.map((g, i) => `
                  <div class="gallery__thumb ${i === 0 ? 'on' : ''}" data-idx="${i}">
                    <img src="${esc(g)}" alt="">
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
          <div class="detail">
            ${p.tag ? `<span class="tag" style="align-self:flex-start;margin-bottom:14px">${esc(p.tag)}</span>` : ''}
            <h2>${esc(p.name)}</h2>
            <div class="detail__price">
              ${hasDiscount ? `<del style="color:var(--faint);font-weight:400;font-size:14px;margin-left:8px">${fmtNum(p.compare_price)}</del>` : ''}
              ${fmt(p.price)}
            </div>
            <p class="detail__desc">${esc(p.description || '')}</p>

            <div class="detail__row">رنگ</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${colors.map(c => {
                const avail = colorStock(p, c) > 0;
                const sel = c === selectedColor;
                return `<button class="chip ${sel ? 'active' : ''}" data-color="${esc(c)}" ${!avail ? 'disabled style="opacity:.35;cursor:not-allowed"' : ''}>
                  ${esc(c)}${!avail ? ' ✕' : ''}
                </button>`;
              }).join('')}
            </div>

            <div class="detail__row" style="margin-top:16px;display:flex;justify-content:space-between;align-items:center">
              <span>سایز</span>
              <button id="sizeGuideBtn" style="color:var(--lime);font-size:11px;text-decoration:underline">راهنمای سایز</button>
            </div>
            <div class="size-grid">
              ${sizes.map(s => {
                const q = variantsMap[selectedColor]?.[s] || 0;
                const avail = q > 0;
                const sel = s === selectedSize && avail;
                const lbl = sizeLabel(s);
                return `<button class="size-btn ${sel ? 'on' : ''}" data-size="${esc(s)}" ${!avail ? 'disabled' : ''}>
                  ${esc(s)}${lbl ? `<small>${lbl}</small>` : ''}
                </button>`;
              }).join('')}
            </div>

            <div style="font-size:12px;color:${stockOfSize > 0 ? 'var(--green)' : 'var(--red)'};margin-top:14px">
              ${stockOfSize > 0 ? '✓ موجودی این سایز: ' + fmtNum(stockOfSize) + ' عدد' : '✕ این سایز موجود نیست'}
            </div>

            ${stockOfSize === 0 ? `
              <button class="chip" id="notifyMe" style="margin-top:12px;width:100%">🔔 بهم خبر بده وقتی موجود شد</button>
            ` : `
              <div style="display:flex;align-items:center;gap:12px;margin-top:18px">
                <div class="qty-ctrl" style="padding:4px">
                  <button id="pMinus">−</button>
                  <span>${fmtNum(qty)}</span>
                  <button id="pPlus">+</button>
                </div>
                <button class="checkout-btn" id="pAdd" style="flex:1" ${stockOfSize < qty ? 'disabled' : ''}>
                  افزودن به سبد — ${fmt(p.price * qty)}
                </button>
              </div>
            `}

            <div style="display:flex;gap:8px;margin-top:14px">
              <button class="chip" id="shareBtn" style="flex:1">🔗 اشتراک‌گذاری</button>
              <button class="chip ${state.wishlist.some(w=>w.id===p.id)?'active':''}" id="wishBtn" style="flex:1">
                ${state.wishlist.some(w=>w.id===p.id)?'❤ در علاقه‌مندی':'♡ علاقه‌مندی'}
              </button>
            </div>

            ${Object.keys(details).length ? `
              <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--line)">
                <div style="font-size:12px;color:var(--dim);margin-bottom:10px;letter-spacing:.05em">مشخصات</div>
                ${Object.entries(details).map(([k, v]) => `
                  <div style="display:flex;justify-content:space-between;font-size:12.5px;padding:6px 0;border-bottom:1px solid var(--line)">
                    <span style="color:var(--dim)">${esc(k)}</span>
                    <span>${esc(v)}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${renderReviews()}
          </div>
        </div>
      </div>
    `;

    $('#pClose').onclick = close;

    const galleryMain = $('#galleryMain');
    const galleryImg = $('#galleryMainImg');
    if (galleryMain) {
      galleryMain.onclick = (e) => {
        if (e.target.closest('.gallery__thumbs')) return;
        zoomed = !zoomed;
        galleryMain.classList.toggle('zoom', zoomed);
        if (zoomed) {
          const rect = galleryMain.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          galleryImg.style.transformOrigin = `${x}% ${y}%`;
        }
      };
      galleryMain.onmousemove = (e) => {
        if (!zoomed) return;
        const rect = galleryMain.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        galleryImg.style.transformOrigin = `${x}% ${y}%`;
      };
    }

    box.querySelectorAll('.gallery__thumb').forEach(t => {
      t.onclick = (e) => {
        e.stopPropagation();
        const i = Number(t.dataset.idx);
        $('#galleryMainImg').src = gallery[i];
        zoomed = false;
        galleryMain.classList.remove('zoom');
        box.querySelectorAll('.gallery__thumb').forEach(x => x.classList.remove('on'));
        t.classList.add('on');
      };
    });

    box.querySelectorAll('[data-color]').forEach(b => {
      b.onclick = () => {
        selectedColor = b.dataset.color;
        if ((variantsMap[selectedColor]?.[selectedSize] || 0) <= 0) {
          selectedSize = sizes.find(s => (variantsMap[selectedColor]?.[s] || 0) > 0) || sizes[0];
        }
        qty = 1; zoomed = false; render();
      };
    });

    box.querySelectorAll('[data-size]').forEach(b => {
      b.onclick = () => { selectedSize = b.dataset.size; qty = 1; render(); };
    });

    if ($('#pPlus')) $('#pPlus').onclick = () => { if (qty < stockOfSize) { qty++; render(); } };
    if ($('#pMinus')) $('#pMinus').onclick = () => { if (qty > 1) { qty--; render(); } };

    if ($('#pAdd')) $('#pAdd').onclick = () => {
      addToCart(p, selectedColor, selectedSize, qty, $('#pAdd'));
      close();
    };

    if ($('#sizeGuideBtn')) $('#sizeGuideBtn').onclick = showSizeGuide;

    if ($('#shareBtn')) $('#shareBtn').onclick = async () => {
      const url = `${location.origin}${location.pathname}?id=${p.id}`;
      const shareData = { title: p.name, text: `تیشرت ${p.name} از G_SHOP`, url };
      try {
        if (navigator.share) await navigator.share(shareData);
        else { await navigator.clipboard.writeText(url); toast('لینک کپی شد ✓'); }
      } catch (e) { }
    };

    if ($('#wishBtn')) $('#wishBtn').onclick = () => {
      toggleWish(p.id);
      render();
    };

    if ($('#notifyMe')) $('#notifyMe').onclick = () => {
      showNotifyModal(p, selectedColor, selectedSize);
    };

    if ($('#writeReview')) $('#writeReview').onclick = () => {
      showReviewModal(p.id, async () => {
        reviews = (await api(`/api/products/${p.id}/reviews`)).reviews || [];
        render();
      });
    };
  }

  function close() {
    modal.classList.remove('on');
    box.classList.remove('modal__box--wide');
    setTimeout(() => { modal.innerHTML = '<div class="modal__box" id="modalBox"></div>'; }, 300);
  }

  modal.onclick = e => { if (e.target === modal) close(); };
  render();
  modal.classList.add('on');
}

/* ==========================================================
   FLY TO CART
   ========================================================== */
function flyToCart(fromEl) {
  if (!fromEl) return;
  const cartIcon = $('#openCart');
  if (!cartIcon) return;
  const from = fromEl.getBoundingClientRect();
  const to = cartIcon.getBoundingClientRect();
  const dot = document.createElement('div');
  dot.className = 'fly-dot';
  dot.style.left = from.left + from.width / 2 - 10 + 'px';
  dot.style.top = from.top + from.height / 2 - 10 + 'px';
  document.body.appendChild(dot);
  requestAnimationFrame(() => {
    dot.style.left = to.left + to.width / 2 - 10 + 'px';
    dot.style.top = to.top + to.height / 2 - 10 + 'px';
    dot.style.transform = 'scale(.3)';
    dot.style.opacity = '.3';
  });
  setTimeout(() => dot.remove(), 750);
}

/* ==========================================================
   SIZE GUIDE
   ========================================================== */
function showSizeGuide() {
  const modal = $('#modal');
  const box = $('#modalBox');
  box.classList.remove('modal__box--wide');
  box.innerHTML = `
    <button class="close-x" id="sgClose" style="position:absolute;top:16px;left:16px" aria-label="بستن">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <h2>راهنمای سایز</h2>
    <p class="sub">سایز مناسب خودت رو با این جدول پیدا کن.</p>
    <div style="overflow-x:auto;margin-top:14px">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:var(--ink-2)">
            <th style="padding:12px;text-align:right;border:1px solid var(--line)">سایز</th>
            <th style="padding:12px;text-align:right;border:1px solid var(--line)">دور سینه</th>
            <th style="padding:12px;text-align:right;border:1px solid var(--line)">قد</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="padding:10px 12px;border:1px solid var(--line)">M</td><td style="padding:10px 12px;border:1px solid var(--line)">۹۶-۱۰۰ سانتی‌متر</td><td style="padding:10px 12px;border:1px solid var(--line)">۱۶۵-۱۷۲ سانتی‌متر</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid var(--line)">L</td><td style="padding:10px 12px;border:1px solid var(--line)">۱۰۰-۱۰۶ سانتی‌متر</td><td style="padding:10px 12px;border:1px solid var(--line)">۱۷۲-۱۷۸ سانتی‌متر</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid var(--line)">XL</td><td style="padding:10px 12px;border:1px solid var(--line)">۱۰۶-۱۱۲ سانتی‌متر</td><td style="padding:10px 12px;border:1px solid var(--line)">۱۷۸-۱۸۴ سانتی‌متر</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid var(--line)">XXL</td><td style="padding:10px 12px;border:1px solid var(--line)">۱۱۲-۱۱۸ سانتی‌متر</td><td style="padding:10px 12px;border:1px solid var(--line)">۱۸۴-۱۹۰ سانتی‌متر</td></tr>
        </tbody>
      </table>
    </div>
    <div style="margin-top:16px;padding:12px;background:var(--ink-2);border-radius:var(--r-sm);font-size:12.5px;color:var(--dim);line-height:1.8">
      💡 <b style="color:var(--text)">نکته:</b> اگه بین دو سایز هستی و استایل راحت دوست داری، سایز بزرگ‌تر رو انتخاب کن.
    </div>
  `;
  $('#sgClose').onclick = () => { modal.classList.remove('on'); };
  modal.classList.add('on');
}

/* ==========================================================
   NOTIFY ME
   ========================================================== */
function showNotifyModal(p, color, size) {
  const modal = $('#modal');
  const box = $('#modalBox');
  box.classList.remove('modal__box--wide');
  box.innerHTML = `
    <button class="close-x" id="nmClose" style="position:absolute;top:16px;left:16px" aria-label="بستن">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <h2>🔔 بهم خبر بده</h2>
    <p class="sub">وقتی «${esc(p.name)} - ${esc(color)} - ${esc(size)}» موجود شد بهت پیام می‌دیم.</p>
    <div class="field">
      <label>شماره موبایل</label>
      <input type="tel" id="nmPhone" placeholder="۰۹۱۲۱۲۳۴۵۶۷" inputmode="tel">
    </div>
    <div class="err" id="nmErr"></div>
    <button class="checkout-btn" id="nmSubmit">ثبت درخواست</button>
  `;
  $('#nmClose').onclick = () => modal.classList.remove('on');
  $('#nmSubmit').onclick = async () => {
    const phone = $('#nmPhone').value.trim();
    if (!phone) { $('#nmErr').textContent = 'شماره الزامی است'; $('#nmErr').classList.add('on'); return; }
    try {
      await api('/api/stock-alert', {
        method: 'POST',
        body: JSON.stringify({ productId: p.id, color, size, phone }),
      });
      toast('به‌محض موجود شدن خبرت می‌کنیم ✓');
      modal.classList.remove('on');
    } catch (e) {
      $('#nmErr').textContent = e.message;
      $('#nmErr').classList.add('on');
    }
  };
  modal.classList.add('on');
}

/* ==========================================================
   REVIEW MODAL
   ========================================================== */
function showReviewModal(productId, onDone) {
  const modal = $('#modal');
  const box = $('#modalBox');
  box.classList.remove('modal__box--wide');
  let rating = 5;
  box.innerHTML = `
    <button class="close-x" id="rvClose" style="position:absolute;top:16px;left:16px" aria-label="بستن">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <h2>نوشتن نظر</h2>
    <p class="sub">نظرت رو با بقیه به اشتراک بذار.</p>
    <div class="field">
      <label>امتیاز</label>
      <div id="rvStars" style="font-size:28px;color:var(--gold);cursor:pointer;letter-spacing:4px">★★★★★</div>
    </div>
    <div class="field">
      <label>نام</label>
      <input type="text" id="rvName" placeholder="اسمت چیه؟">
    </div>
    <div class="field">
      <label>نظر</label>
      <textarea id="rvComment" placeholder="تجربه‌ات از این محصول چطور بود؟"></textarea>
    </div>
    <div class="err" id="rvErr"></div>
    <button class="checkout-btn" id="rvSubmit">ارسال نظر</button>
  `;

  const starsEl = $('#rvStars');
  function renderStars() {
    starsEl.innerHTML = '★'.repeat(rating) + `<span style="color:var(--faint)">${'★'.repeat(5 - rating)}</span>`;
  }
  starsEl.onclick = (e) => {
    const rect = starsEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = 1 - x / rect.width;
    rating = Math.max(1, Math.min(5, Math.ceil(pct * 5)));
    renderStars();
  };
  renderStars();

  $('#rvClose').onclick = () => modal.classList.remove('on');
  $('#rvSubmit').onclick = async () => {
    const name = $('#rvName').value.trim();
    const comment = $('#rvComment').value.trim();
    const err = $('#rvErr');
    err.classList.remove('on');
    if (!name || !comment) { err.textContent = 'نام و متن نظر الزامی است'; err.classList.add('on'); return; }
    try {
      await api(`/api/products/${productId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ name, comment, rating }),
      });
      toast('نظرت ثبت شد. بعد از تایید نمایش داده می‌شه ✓');
      modal.classList.remove('on');
      onDone?.();
    } catch (e) {
      err.textContent = e.message;
      err.classList.add('on');
    }
  };
  modal.classList.add('on');
}

/* ==========================================================
   CART
   ========================================================== */
function addToCart(product, color, size, qty = 1, fromEl) {
  const existing = state.cart.find(i => i.id === product.id && i.color === color && i.size === size);
  const variant = product.variants.find(v => v.color === color && v.size === size);
  const stock = variant?.stock || 0;
  const already = existing?.qty || 0;

  if (stock < already + qty) {
    toast(`موجودی کافی نیست (باقی‌مانده: ${fmtNum(stock)})`, 'err');
    return false;
  }
  if (existing) existing.qty += qty;
  else state.cart.push({ id: product.id, name: product.name, price: product.price, image: product.image, color, size, qty });
  saveCart();
  if (fromEl) flyToCart(fromEl);
  toast('به سبد اضافه شد ✓');
  setTimeout(() => openCartDrawer(), 400);
  return true;
}

function changeQty(idx, delta) {
  const item = state.cart[idx];
  if (!item) return;
  const product = state.products.find(p => p.id === item.id);
  if (!product) return;
  if (delta > 0) {
    const stock = product.variants.find(v => v.color === item.color && v.size === item.size)?.stock || 0;
    if (stock < item.qty + delta) return toast('موجودی کافی نیست', 'err');
    item.qty += delta;
  } else {
    item.qty -= 1;
    if (item.qty <= 0) state.cart.splice(idx, 1);
  }
  saveCart();
  renderCartDrawer();
}

function removeItem(idx) {
  state.cart.splice(idx, 1);
  saveCart();
  renderCartDrawer();
}

function openCartDrawer() {
  renderCartDrawer();
  $('#drawer').classList.add('on');
  $('#scrim').classList.add('on');
  document.body.classList.add('no-scroll');
}
function closeCartDrawer() {
  $('#drawer').classList.remove('on');
  $('#scrim').classList.remove('on');
  if (!$('#wishDrawer').classList.contains('on') && !$('#mobileMenu').classList.contains('on') && !$('#ordersDrawer').classList.contains('on')) {
    document.body.classList.remove('no-scroll');
  }
}
function openWishDrawer() {
  renderWishDrawer();
  $('#wishDrawer').classList.add('on');
  $('#scrim').classList.add('on');
  document.body.classList.add('no-scroll');
}
function closeWishDrawer() {
  $('#wishDrawer').classList.remove('on');
  $('#scrim').classList.remove('on');
  if (!$('#drawer').classList.contains('on') && !$('#mobileMenu').classList.contains('on') && !$('#ordersDrawer').classList.contains('on')) {
    document.body.classList.remove('no-scroll');
  }
}

function renderCartDrawer() {
  const body = $('#cartBody');
  const foot = $('#cartFoot');
  if (!body) return;

  if (!state.cart.length) {
    body.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--dim)">
      <div style="font-size:48px;margin-bottom:16px">🛒</div>
      <p style="margin-bottom:20px">سبد خرید خالی است</p>
      <button class="btn btn--primary" style="font-size:13px;padding:12px 24px" onclick="closeCartDrawer();document.getElementById('products').scrollIntoView({behavior:'smooth'})">دیدن محصولات</button>
    </div>`;
    foot.innerHTML = '';
    return;
  }

  const subtotal = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const coupon = JSON.parse(sessionStorage.getItem('gshop_coupon') || 'null');
  let discount = 0;
  if (coupon) {
    discount = coupon.type === 'percent'
      ? Math.round(subtotal * coupon.value / 100)
      : Math.min(coupon.value, subtotal);
  }
  const afterDiscount = subtotal - discount;
  const freeThreshold = state.settings.free_shipping_threshold || 1000000;
  const isFreeShip = afterDiscount >= freeThreshold;

  body.innerHTML = state.cart.map((i, idx) => `
    <div class="citem">
      <div class="citem__img"><img src="${esc(i.image)}" alt=""></div>
      <div class="citem__info">
        <div class="citem__name">${esc(i.name)}</div>
        <div class="citem__meta">${esc(i.color)} · ${esc(i.size)}</div>
        <div class="citem__row">
          <div class="qty-ctrl">
            <button data-act="inc" data-idx="${idx}" aria-label="افزایش">+</button>
            <span>${fmtNum(i.qty)}</span>
            <button data-act="dec" data-idx="${idx}" aria-label="کاهش">−</button>
          </div>
          <span class="citem__price">${fmt(i.price * i.qty)}</span>
        </div>
        <button class="citem__rm" data-act="rm" data-idx="${idx}">حذف</button>
      </div>
    </div>
  `).join('');

  body.querySelectorAll('[data-act]').forEach(b => {
    b.onclick = () => {
      const idx = Number(b.dataset.idx);
      if (b.dataset.act === 'inc') changeQty(idx, 1);
      else if (b.dataset.act === 'dec') changeQty(idx, -1);
      else removeItem(idx);
    };
  });

  foot.innerHTML = `
    <div class="coupon">
      <input type="text" id="couponInput" placeholder="کد تخفیف" value="${coupon?.code || ''}">
      <button id="couponBtn">${coupon ? 'حذف' : 'اعمال'}</button>
    </div>
    <div class="ctotals">
      <div class="ctotals__row"><span>جمع کالاها</span><span>${fmt(subtotal)}</span></div>
      ${discount > 0 ? `<div class="ctotals__row green"><span>تخفیف ${esc(coupon.code)}</span><span>− ${fmt(discount)}</span></div>` : ''}
      <div class="ctotals__row"><span>هزینه ارسال</span><span style="color:${isFreeShip ? 'var(--green)' : 'var(--dim)'};font-size:12px">${isFreeShip ? 'رایگان ✓' : 'در مرحله بعد'}</span></div>
      <div class="ctotals__row big"><span>مبلغ نهایی</span><span>${fmt(afterDiscount)}${isFreeShip ? '' : ' + ارسال'}</span></div>
    </div>
    <button class="checkout-btn" id="checkoutBtn">تکمیل خرید</button>
  `;

  $('#couponBtn').onclick = async () => {
    if (coupon) {
      sessionStorage.removeItem('gshop_coupon');
      toast('کد تخفیف حذف شد');
      renderCartDrawer();
      return;
    }
    const code = $('#couponInput').value.trim().toUpperCase();
    if (!code) return;
    try {
      const r = await api('/api/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ code, subtotal }),
      });
      sessionStorage.setItem('gshop_coupon', JSON.stringify(r.coupon));
      toast(`کد «${r.coupon.code}» اعمال شد — ${r.coupon.label || ''}`);
      renderCartDrawer();
    } catch (e) { toast(e.message, 'err'); }
  };

  $('#checkoutBtn').onclick = () => openCheckout({ subtotal, discount, coupon });
}

/* ==========================================================
   CHECKOUT
   ========================================================== */
function openCheckout({ subtotal, discount, coupon }) {
  const modal = $('#modal');
  const box = $('#modalBox');
  box.classList.remove('modal__box--wide');

  const saved = loadUserInfo();

  function render(provinceVal, showSaved) {
    const afterDiscount = subtotal - discount;
    const shipCost = calcShipping(provinceVal || saved.province || '', afterDiscount);
    const finalTotal = afterDiscount + shipCost;

    box.innerHTML = `
      <button class="close-x" id="ckClose" style="position:absolute;top:16px;left:16px" aria-label="بستن">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <h2>تکمیل سفارش</h2>
      <p class="sub">اطلاعات ارسال را کامل وارد کنید.</p>

      ${showSaved && saved.address ? `
        <div class="saved-address">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;color:var(--lime);font-weight:700;margin-bottom:6px">📍 آدرس ذخیره‌شده</div>
              <div style="font-size:12.5px;color:var(--text);line-height:1.6">${esc(saved.province || '')} — ${esc(saved.city || '')}<br>${esc(saved.address || '')}</div>
            </div>
            <button class="chip" id="useSaved" style="padding:8px 14px;font-size:11px;flex-shrink:0">استفاده</button>
          </div>
        </div>
      ` : ''}

      <div class="field"><label>نام و نام خانوادگی *</label><input type="text" id="ckName" placeholder="مثلاً علی محمدی" value="${esc(saved.name||'')}" autocomplete="name"></div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>شماره موبایل *</label><input type="tel" id="ckPhone" placeholder="۰۹۱۲۱۲۳۴۵۶۷" value="${esc(saved.phone||'')}" inputmode="tel" autocomplete="tel"></div>
        <div class="field"><label>ایمیل (اختیاری)</label><input type="email" id="ckEmail" placeholder="name@mail.com" value="${esc(saved.email||'')}" autocomplete="email"></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field">
          <label>استان *</label>
          <select id="ckProvince" autocomplete="address-level1">
            <option value="">انتخاب کنید...</option>
            ${IRAN_PROVINCES.map(p => `<option value="${esc(p)}" ${p === (saved.province||'') ? 'selected' : ''}>${esc(p)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>شهر *</label><input type="text" id="ckCity" placeholder="مثلاً تهران" value="${esc(saved.city||'')}" autocomplete="address-level2"></div>
      </div>

      <div class="field"><label>کد پستی (۱۰ رقم) *</label><input type="text" id="ckPostal" placeholder="۱۲۳۴۵۶۷۸۹۰" value="${esc(saved.postal||'')}" inputmode="numeric" maxlength="10" autocomplete="postal-code"></div>

      <div class="field"><label>آدرس کامل *</label><textarea id="ckAddress" placeholder="خیابان، کوچه، پلاک، واحد..." autocomplete="street-address">${esc(saved.address||'')}</textarea></div>

      <div class="field"><label>یادداشت (اختیاری)</label><input type="text" id="ckNote" placeholder="مثلاً بسته‌بندی کادویی"></div>

      <label class="save-info-toggle">
        <input type="checkbox" id="ckSave" ${saved.name ? 'checked' : ''}>
        <span>ذخیره اطلاعات برای خریدهای بعدی</span>
      </label>

      <input type="text" id="ckWebsite" style="display:none" tabindex="-1" autocomplete="off">

      <div class="ctotals" style="margin-top:20px">
        <div class="ctotals__row"><span>جمع کالاها</span><span>${fmt(subtotal)}</span></div>
        ${discount > 0 ? `<div class="ctotals__row green"><span>تخفیف ${esc(coupon?.code || '')}</span><span>− ${fmt(discount)}</span></div>` : ''}
        <div class="ctotals__row"><span>هزینه ارسال</span><span style="color:${shipCost === 0 ? 'var(--green)' : 'var(--text)'}">${shipCost === 0 ? 'رایگان ✓' : fmt(shipCost)}</span></div>
        <div class="ctotals__row big"><span>مبلغ نهایی</span><span>${fmt(finalTotal)}</span></div>
      </div>

      <div class="err" id="ckErr"></div>
      <button class="checkout-btn" id="ckSubmit" style="margin-top:12px">ثبت سفارش</button>
    `;

    $('#ckClose').onclick = () => modal.classList.remove('on');
    modal.onclick = e => { if (e.target === modal) modal.classList.remove('on'); };

    $('#ckProvince').onchange = (e) => render(e.target.value, false);

    if ($('#useSaved')) {
      $('#useSaved').onclick = () => {
        $('#ckName').value = saved.name || '';
        $('#ckPhone').value = saved.phone || '';
        $('#ckEmail').value = saved.email || '';
        $('#ckProvince').value = saved.province || '';
        $('#ckCity').value = saved.city || '';
        $('#ckPostal').value = saved.postal || '';
        $('#ckAddress').value = saved.address || '';
        render(saved.province || '', false);
        toast('اطلاعات ذخیره‌شده پر شد ✓');
      };
    }

    $('#ckSubmit').onclick = async () => {
      const name = $('#ckName').value.trim();
      const phone = $('#ckPhone').value.trim();
      const email = $('#ckEmail').value.trim();
      const province = $('#ckProvince').value;
      const city = $('#ckCity').value.trim();
      const postal = $('#ckPostal').value.trim();
      const address = $('#ckAddress').value.trim();
      const note = $('#ckNote').value.trim();
      const website = $('#ckWebsite').value;
      const shouldSave = $('#ckSave').checked;
      const err = $('#ckErr');
      err.classList.remove('on');

      const showErr = (msg) => { err.textContent = msg; err.classList.add('on'); err.scrollIntoView({block:'center',behavior:'smooth'}); };

      if (!name || name.length < 3) return showErr('نام و نام خانوادگی را کامل وارد کنید');
      const pd = phone.replace(/\D/g, '');
      if (!/^09\d{9}$/.test(pd)) return showErr('شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr('ایمیل نامعتبر است');
      if (!province) return showErr('استان را انتخاب کنید');
      if (!city || city.length < 2) return showErr('نام شهر را وارد کنید');
      const pcd = postal.replace(/\D/g, '');
      if (!/^\d{10}$/.test(pcd)) return showErr('کد پستی باید ۱۰ رقم باشد');
      if (!address || address.length < 10) return showErr('آدرس کامل را وارد کنید (حداقل ۱۰ کاراکتر)');

      const btn = $('#ckSubmit');
      btn.disabled = true;
      btn.textContent = 'در حال ثبت...';

      try {
        const items = state.cart.map(i => ({ productId: i.id, name: i.name, color: i.color, size: i.size, qty: i.qty }));
        const r = await api('/api/orders', {
          method: 'POST',
          body: JSON.stringify({
            name, phone: pd, email, province, city,
            postal_code: pcd, address, note, website, items,
            couponCode: coupon?.code || null
          }),
        });

        if (shouldSave) {
          saveUserInfo({ name, phone: pd, email, province, city, postal: pcd, address });
        }

        addMyOrder({ orderNo: r.orderNo, total: r.total, items: r.items || state.cart });

        showSuccess(r, { name, phone: pd, province, city, postal: pcd, address, total: r.total, discount, coupon });
      } catch (e) {
        showErr(e.message);
        btn.disabled = false;
        btn.textContent = 'ثبت سفارش';
      }
    };
  }

  render(saved.province || '', true);
  modal.classList.add('on');
}

function showSuccess(order, info) {
  const box = $('#modalBox');
  const itemsText = state.cart.map(i => `• ${i.name} | ${i.color} | ${i.size} | ×${i.qty} | ${fmt(i.price * i.qty)}`).join('\n');
  const msg = `🛒 سفارش جدید G_SHOP\n\n🆔 ${order.orderNo}\n👤 ${info.name}\n📱 ${info.phone}\n📍 ${info.province} - ${info.city}\n📮 ${info.postal}\n🏠 ${info.address}\n\n${itemsText}\n\n💰 جمع: ${fmt(order.subtotal)}\n${order.discount ? `🎟 تخفیف: − ${fmt(order.discount)}\n` : ''}${order.shipping ? `🚚 ارسال: ${fmt(order.shipping)}\n` : '🚚 ارسال: رایگان\n'}✅ نهایی: ${fmt(order.total)}`;

  box.innerHTML = `
    <div class="success">
      <div class="success__icon">✓</div>
      <h2>سفارش ثبت شد!</h2>
      <p style="color:var(--dim);font-size:13.5px;margin-bottom:10px">شماره سفارش شما</p>
      <div class="success__num mono">${order.orderNo}</div>
      <div class="success__details">
        <div class="row"><span>نام</span><b>${esc(info.name)}</b></div>
        <div class="row"><span>موبایل</span><b class="mono">${esc(info.phone)}</b></div>
        <div class="row"><span>مقصد</span><b>${esc(info.province)} - ${esc(info.city)}</b></div>
        <div class="row"><span>تعداد</span><b>${fmtNum(state.cart.reduce((s,i)=>s+i.qty,0))} عدد</b></div>
        ${order.discount > 0 ? `<div class="row"><span>تخفیف</span><b style="color:var(--green)">− ${fmt(order.discount)}</b></div>` : ''}
        <div class="row"><span>ارسال</span><b style="color:${order.shipping ? 'var(--text)' : 'var(--green)'}">${order.shipping ? fmt(order.shipping) : 'رایگان'}</b></div>
        <div class="row total"><span>مبلغ نهایی</span><b>${fmt(order.total)}</b></div>
      </div>
      <p style="color:var(--dim);font-size:12.5px;margin-bottom:18px">برای نهایی‌سازی، سفارش را به پشتیبانی ارسال کنید.</p>
      <div style="display:flex;flex-direction:column;gap:10px">
        <a class="checkout-btn" style="text-align:center;display:block;text-decoration:none" href="https://t.me/${SUPPORT_TG}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">ارسال به تلگرام پشتیبانی</a>
        <button class="checkout-btn" id="copyMsg" style="background:var(--ink-3);color:var(--text)">کپی متن سفارش</button>
        <button class="checkout-btn" id="closeSuccess" style="background:transparent;border:1px solid var(--line-2);color:var(--text)">بستن</button>
      </div>
    </div>
  `;

  $('#copyMsg').onclick = async () => {
    try { await navigator.clipboard.writeText(msg); toast('متن کپی شد ✓'); }
    catch { toast('کپی نشد', 'err'); }
  };
  $('#closeSuccess').onclick = () => { $('#modal').classList.remove('on'); };

  state.cart = [];
  saveCart();
  sessionStorage.removeItem('gshop_coupon');
  loadProducts();
  setTimeout(closeCartDrawer, 100);
}

/* ==========================================================
   ORDER TRACKING
   ========================================================== */
async function trackOrder() {
  const orderNo = $('#trackNo').value.trim();
  const phone = $('#trackPhone').value.trim();
  const res = $('#trackResult');
  res.innerHTML = '<p style="color:var(--dim)">در حال بررسی...</p>';
  try {
    const { order } = await api('/api/orders/track', {
      method: 'POST',
      body: JSON.stringify({ orderNo, phone }),
    });
    const statuses = {
      pending:   { label: 'در انتظار بررسی', color: 'var(--gold)' },
      confirmed: { label: 'تایید شده',        color: 'var(--purple)' },
      shipped:   { label: 'ارسال شده',        color: 'var(--green)' },
      delivered: { label: 'تحویل شده',        color: 'var(--lime)' },
      cancelled: { label: 'لغو شده',          color: 'var(--red)' },
    };
    const st = statuses[order.status] || statuses.pending;
    res.innerHTML = `
      <div style="background:var(--ink-1);border:1px solid var(--line);border-radius:var(--r-lg);padding:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
          <span class="mono" style="color:var(--lime);font-weight:700">${esc(order.orderNo)}</span>
          <span style="color:${st.color};font-weight:700;font-size:13px">● ${st.label}</span>
        </div>
        <div style="font-size:13px;color:var(--dim);margin-bottom:12px">ثبت: ${esc(order.created_at)}</div>
        <div style="border-top:1px solid var(--line);padding-top:14px">
          ${order.items.map(i => `
            <div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0">
              <span>${esc(i.name)} — ${esc(i.color)} · ${esc(i.size)} ×${fmtNum(i.qty)}</span>
              <span style="font-family:'Space Grotesk',sans-serif">${fmt(i.price * i.qty)}</span>
            </div>
          `).join('')}
        </div>
        <div style="border-top:1px solid var(--line);margin-top:12px;padding-top:12px;display:flex;justify-content:space-between;font-weight:700">
          <span>مبلغ نهایی</span><span style="color:var(--lime)">${fmt(order.total)}</span>
        </div>
        ${order.tracking_no ? `<div style="margin-top:14px;padding:12px;background:var(--ink-2);border-radius:var(--r-sm);font-size:13px">📦 کد رهگیری پستی: <b class="mono">${esc(order.tracking_no)}</b></div>` : ''}
      </div>
    `;
  } catch (e) {
    res.innerHTML = `<div style="padding:16px;background:color-mix(in srgb,var(--red) 10%,transparent);border:1px solid color-mix(in srgb,var(--red) 30%,transparent);border-radius:var(--r-md);color:var(--red);font-size:13.5px">${esc(e.message)}</div>`;
  }
}

/* ==========================================================
   COUNTDOWN
   ========================================================== */
function initCountdown() {
  const target = new Date();
  target.setDate(target.getDate() + 3);
  target.setHours(23, 59, 59, 0);
  const stored = localStorage.getItem('gshop_countdown_target');
  const finalTarget = stored ? new Date(Number(stored)) : target;
  if (!stored || finalTarget < new Date()) {
    localStorage.setItem('gshop_countdown_target', String(target.getTime()));
  }
  const t = stored && finalTarget > new Date() ? finalTarget : target;

  function tick() {
    const diff = t - new Date();
    if (diff <= 0) {
      ['cdD','cdH','cdM','cdS'].forEach(id => { const el = $('#'+id); if (el) el.textContent = '۰۰'; });
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const set = (id, v) => { const el = $('#'+id); if (el) el.textContent = nf(String(v).padStart(2, '0')); };
    set('cdD', d); set('cdH', h); set('cdM', m); set('cdS', s);
  }
  tick();
  setInterval(tick, 1000);
}

/* ==========================================================
   FAQ
   ========================================================== */
function initFAQ() {
  $$('.faq__item').forEach(item => {
    const q = item.querySelector('.faq__q');
    if (!q) return;
    q.onclick = () => {
      const isOpen = item.classList.contains('on');
      $$('.faq__item').forEach(x => x.classList.remove('on'));
      if (!isOpen) item.classList.add('on');
    };
  });
}

/* ==========================================================
   MOBILE MENU
   ========================================================== */
function openMobileMenu() {
  $('#mobileMenu').classList.add('on');
  document.body.classList.add('no-scroll');
}
function closeMobileMenu() {
  $('#mobileMenu').classList.remove('on');
  if (!$('#drawer').classList.contains('on') && !$('#wishDrawer').classList.contains('on') && !$('#ordersDrawer').classList.contains('on')) {
    document.body.classList.remove('no-scroll');
  }
}

/* ==========================================================
   REVEAL / OFFLINE / SCROLL
   ========================================================== */
let revealObserver;
function observeReveals() {
  if (revealObserver) revealObserver.disconnect();
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        revealObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('.reveal:not(.in)').forEach(el => revealObserver.observe(el));
}

function initOffline() {
  const check = () => { const el = $('#offlineBanner'); if (el) el.classList.toggle('on', !navigator.onLine); };
  window.addEventListener('online', check);
  window.addEventListener('offline', check);
  check();
}

function initScrollUI() {
  const bar = $('#scrollBar');
  const nav = $('#nav');
  const backTop = $('#backTop');

  const update = rafThrottle(() => {
    const st = window.scrollY;
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const pct = h > 0 ? (st / h) * 100 : 0;
    if (bar) bar.style.width = pct + '%';
    if (nav) nav.classList.toggle('scrolled', st > 30);
    if (backTop) backTop.classList.toggle('on', st > 400);
  });

  window.addEventListener('scroll', update, { passive: true });
  update();

  if (backTop) backTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ==========================================================
   GLOBAL BINDINGS
   ========================================================== */
function bindGlobal() {
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const target = el.dataset.nav;
      const map = { home: 'top', products: '#products', lookbook: '#lookbook', story: '#story', contact: '#contact', track: '#track', faq: '#faq', testimonials: '#testimonials', instagram: '#instagram' };
      const sel = map[target];
      closeMobileMenu();
      if (sel === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
      else if (sel) setTimeout(() => document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
  });

  const themeToggle = $('#themeToggle');
  if (themeToggle) themeToggle.onclick = toggleTheme;

  const openCart = $('#openCart');
  const closeCart = $('#closeCart');
  if (openCart) openCart.onclick = openCartDrawer;
  if (closeCart) closeCart.onclick = closeCartDrawer;

  const openWish = $('#openWish');
  const closeWish = $('#closeWish');
  if (openWish) openWish.onclick = openWishDrawer;
  if (closeWish) closeWish.onclick = closeWishDrawer;

  const closeOrders = $('#closeOrders');
  if (closeOrders) closeOrders.onclick = closeOrdersDrawer;

  const openMobile = $('#openMobile');
  const closeMobile = $('#closeMobile');
  if (openMobile) openMobile.onclick = openMobileMenu;
  if (closeMobile) closeMobile.onclick = () => closeMobileMenu();

  const scrim = $('#scrim');
  if (scrim) scrim.onclick = () => { closeCartDrawer(); closeWishDrawer(); closeOrdersDrawer(); };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeCartDrawer(); closeWishDrawer(); closeMobileMenu(); closeOrdersDrawer();
      $('#modal')?.classList.remove('on');
      $('#confirmOverlay')?.classList.remove('on');
    }
  });

  const searchInput = $('#searchInput');
  if (searchInput) {
    const debouncedSearch = debounce((v) => { state.search = v; renderGrid(); }, 180);
    searchInput.oninput = (e) => debouncedSearch(e.target.value);
  }

  const categorySelect = $('#categorySelect');
  if (categorySelect) categorySelect.onchange = (e) => { state.category = e.target.value; renderGrid(); };

  const sortSelect = $('#sortSelect');
  if (sortSelect) sortSelect.onchange = (e) => { state.sort = e.target.value; renderGrid(); };

  document.querySelectorAll('.toolbar .chip').forEach(c => {
    c.onclick = () => {
      document.querySelectorAll('.toolbar .chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      state.filter = c.dataset.filter;
      renderGrid();
    };
  });

  const trackBtn = $('#trackBtn');
  if (trackBtn) trackBtn.onclick = trackOrder;

  const compareBtn = $('#compareBtn');
  if (compareBtn) compareBtn.onclick = openCompareModal;
  const compareClear = $('#compareClear');
  if (compareClear) compareClear.onclick = () => {
    state.compare = [];
    saveCompare();
    renderGrid();
    renderRecent();
  };

  const newsletterBtn = $('#newsletterBtn');
  if (newsletterBtn) newsletterBtn.onclick = async () => {
    const email = $('#newsletterEmail').value.trim();
    if (!email) return toast('ایمیل را وارد کنید', 'err');
    try {
      await api('/api/subscribe', { method: 'POST', body: JSON.stringify({ email }) });
      toast('عضویت شما ثبت شد ✓');
      $('#newsletterEmail').value = '';
    } catch (e) { toast(e.message, 'err'); }
  };

  // دکمه سفارش‌های من در فوتر (اگه هست)
  const myOrdersBtn = $('#myOrdersBtn');
  if (myOrdersBtn) myOrdersBtn.onclick = openOrdersDrawer;
}

/* ==========================================================
   INIT
   ========================================================== */
(async function init() {
  initTheme();
  loadLocal();
  renderBadges();
  renderCompareBar();
  bindGlobal();
  observeReveals();
  initOffline();
  initScrollUI();
  initCountdown();
  initFAQ();
  await loadSettings();
  await loadProducts();

  const params = new URLSearchParams(location.search);
  const pid = params.get('id');
  if (pid && state.products.some(p => p.id === Number(pid))) {
    setTimeout(() => openProduct(Number(pid)), 400);
  }
})();

window.closeCartDrawer = closeCartDrawer;
window.closeWishDrawer = closeWishDrawer;
window.closeOrdersDrawer = closeOrdersDrawer;