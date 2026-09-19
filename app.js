/* ==========================================================
   G_SHOP - App.js v5.0 FINAL
   Complete, Bug-Free, Enhanced
   ========================================================== */

/* ==========================================================
   CONFIG
   ========================================================== */
const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8787'
  : 'https://gahop.mrsiavashirbot.workers.dev';

const CART_KEY = 'gshop_cart_v10';
const WISH_KEY = 'gshop_wish_v10';
const RECENT_KEY = 'gshop_recent_v10';
const COMPARE_KEY = 'gshop_compare_v10';
const USER_KEY = 'gshop_user_v10';
const ORDERS_KEY = 'gshop_orders_v10';
const LATER_KEY = 'gshop_later_v10';
const THEME_KEY = 'gshop_theme';
const THEME_MANUAL_KEY = 'gshop_theme_manual';
const ADMIN_TOKEN_KEY = 'gshop_admin_token';
const SETTINGS_CACHE_KEY = 'gshop_settings_cache_v5';
const ERR_LOG_KEY = 'gshop_err_log';
const SEARCH_HISTORY_KEY = 'gshop_search_history';
const PURCHASES_POPUP_KEY = 'gshop_popup_seen';

const SUPPORT_TG = 'Alisdt98';
const PHONE = '09120507960';
const INSTAGRAM = 'g__shop11';

const DEFAULT_SETTINGS = {
  brand_name: 'G_SHOP',
  brand_tagline: 'پوشاک اسپرت',
  phone: '09120507960',
  telegram: 'Alisdt98',
  instagram: 'g__shop11',
  free_shipping_threshold: 1000000,
  shipping_tehran: 35000,
  shipping_middle: 45000,
  shipping_other: 55000,
};

const COLOR_MAP = {
  'مشکی':'black','آبی':'blue','سفید':'white','قرمز':'قرمز','سبز':'سبز',
  'خاکی':'خاکی','طوسی':'طوسی','خاکستری':'طوسی','صورتی':'قرمز','زرد':'خاکی','نارنجی':'قرمز','بنفش':'black'
};

const CATEGORY_LABELS = {
  tshirt: 'تیشرت', hoodie: 'هودی', shirt: 'پیراهن',
  pants: 'شلوار', jacket: 'کاپشن', accessory: 'اکسسوری'
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
const $ = (sel, ctx = document) => { try { return ctx.querySelector(sel); } catch { return null; } };
const $$ = (sel, ctx = document) => { try { return [...ctx.querySelectorAll(sel)]; } catch { return []; } };
const fmt = (n) => new Intl.NumberFormat('fa-IR').format(Math.max(0, Number(n) || 0)) + ' تومان';
const fmtNum = (n) => new Intl.NumberFormat('fa-IR').format(Math.max(0, Number(n) || 0));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const nf = (n) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const debounce = (fn, ms = 250) => {
  let t;
  const w = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  w.cancel = () => clearTimeout(t);
  return w;
};
const rafThrottle = (fn) => {
  let ticking = false;
  return (...a) => { if (!ticking) { requestAnimationFrame(() => { fn(...a); ticking = false; }); ticking = true; } };
};
const safeParse = (str, fb = null) => { try { return JSON.parse(str); } catch { return fb; } };
const safeStore = (k, v) => { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch { return false; } };
const safeGet = (k, fb = null) => {
  try { const v = localStorage.getItem(k); return v === null ? fb : safeParse(v, v); } catch { return fb; }
};
const logError = (where, err) => {
  try {
    const log = safeGet(ERR_LOG_KEY, []) || [];
    log.unshift({ where, msg: String(err?.message || err), time: Date.now() });
    safeStore(ERR_LOG_KEY, log.slice(0, 20));
  } catch {}
};

/* ==========================================================
   INJECT ENHANCED STYLES
   ========================================================== */
(function injectEnhancedStyles() {
  const css = `
    /* Typography enhancements */
    body, button, input, select, textarea {
      font-feature-settings: "ss01", "ss02", "kern" 1;
      text-rendering: optimizeLegibility;
    }
    h1, h2, h3, h4 { font-feature-settings: "ss01", "ss02"; }
    .pcard__name { letter-spacing: -0.01em; }
    .hero__lead { letter-spacing: 0.01em; }

    /* Float Cart */
    .float-cart {
      position: fixed; bottom: 24px; right: 24px; z-index: 145;
      display: none; padding: 14px 22px; border-radius: 100px;
      background: var(--lime); color: var(--ink);
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700; font-size: 13px;
      box-shadow: 0 12px 30px -8px rgba(0,0,0,.6);
      align-items: center; gap: 10px;
      transform: translateY(140%); opacity: 0;
      transition: all .4s var(--ease);
    }
    .float-cart.on { transform: translateY(0); opacity: 1; }
    .float-cart svg { width: 18px; height: 18px; }
    .float-cart__count {
      background: var(--ink); color: var(--lime);
      min-width: 22px; height: 22px; border-radius: 100px;
      display: grid; place-items: center; font-size: 11px; padding: 0 6px;
    }
    @media (max-width: 700px) {
      .float-cart { display: flex; }
    }

    /* Search Suggest */
    .search-suggest {
      position: absolute; top: calc(100% + 8px); right: 0; left: 0;
      background: var(--ink-1); border: 1px solid var(--line-2);
      border-radius: var(--r-md); z-index: 30;
      max-height: 380px; overflow-y: auto;
      box-shadow: var(--shadow-lg);
      display: none;
    }
    .search-suggest.on { display: block; }
    .search-suggest__item {
      padding: 12px 18px; cursor: pointer;
      display: flex; align-items: center; gap: 12px;
      border-bottom: 1px solid var(--line);
      transition: background .15s; text-align: right;
      font-family: inherit; width: 100%;
    }
    .search-suggest__item:last-child { border-bottom: 0; }
    .search-suggest__item:hover { background: var(--ink-2); }
    .search-suggest__item img {
      width: 40px; height: 50px; border-radius: 8px;
      object-fit: cover; flex-shrink: 0;
    }
    .search-suggest__info { flex: 1; min-width: 0; }
    .search-suggest__name {
      font-size: 13.5px; font-weight: 600; color: var(--text);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .search-suggest__price {
      font-size: 11.5px; color: var(--lime);
      font-family: 'Space Grotesk', sans-serif; margin-top: 2px;
    }
    .search-suggest__head {
      padding: 10px 18px 6px; font-size: 11px;
      color: var(--dim); letter-spacing: .05em;
    }
    .search-suggest__history {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 18px; cursor: pointer;
      font-size: 13px; color: var(--dim);
      transition: background .15s;
    }
    .search-suggest__history:hover { background: var(--ink-2); color: var(--text); }
    .search-suggest__history svg { width: 14px; height: 14px; }
    .search-suggest__clear {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 18px; border-top: 1px solid var(--line);
      font-size: 11.5px; color: var(--dim);
    }
    .search-suggest__clear button { color: var(--red); font-weight: 600; }

    /* Free Shipping Progress */
    .ship-progress {
      padding: 14px 18px; background: var(--ink-2);
      border-radius: var(--r-md); margin-bottom: 14px;
      border: 1px solid var(--line);
    }
    .ship-progress.done {
      background: color-mix(in srgb, var(--green) 12%, transparent);
      border-color: color-mix(in srgb, var(--green) 40%, transparent);
    }
    .ship-progress__text {
      font-size: 12.5px; margin-bottom: 10px;
      display: flex; align-items: center; gap: 8px;
      flex-wrap: wrap;
    }
    .ship-progress__text b { color: var(--lime); font-weight: 700; }
    .ship-progress.done .ship-progress__text { color: var(--green); font-weight: 600; }
    .ship-progress__bar {
      height: 6px; background: var(--ink-3);
      border-radius: 100px; overflow: hidden;
      position: relative;
    }
    .ship-progress__fill {
      height: 100%;
      background: linear-gradient(90deg, var(--lime), var(--green));
      border-radius: 100px;
      transition: width .6s cubic-bezier(.22,1,.36,1);
      box-shadow: 0 0 12px color-mix(in srgb, var(--lime) 60%, transparent);
    }

    /* Cart Item enhancements */
    .citem__note-btn {
      font-size: 11px; color: var(--dim);
      padding: 4px 8px; border-radius: 100px;
      margin-top: 6px; transition: all .2s;
      display: inline-flex; align-items: center; gap: 4px;
    }
    .citem__note-btn:hover { background: var(--ink-3); color: var(--text); }
    .citem__note-btn.on { color: var(--gold); }
    .citem__later-btn {
      font-size: 11px; color: var(--dim);
      padding: 4px 8px; border-radius: 100px; transition: all .2s;
    }
    .citem__later-btn:hover { background: var(--ink-3); color: var(--purple); }
    .citem__note-show {
      font-size: 11px; color: var(--gold);
      margin-top: 4px; padding: 4px 8px;
      background: color-mix(in srgb, var(--gold) 10%, transparent);
      border-radius: 6px;
      display: inline-block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Product Card enhancements */
    .pcard__recent {
      position: absolute; top: 14px; left: 60px;
      padding: 4px 10px; border-radius: 100px;
      background: rgba(0,0,0,.7); backdrop-filter: blur(10px);
      color: #fff; font-size: 10px; font-weight: 600;
      z-index: 3;
      pointer-events: none;
    }
    .pcard__viewers {
      position: absolute; bottom: 14px; left: 14px;
      padding: 5px 10px; border-radius: 100px;
      background: rgba(255, 75, 62, .9); backdrop-filter: blur(10px);
      color: #fff; font-size: 10px; font-weight: 700;
      z-index: 3;
      display: flex; align-items: center; gap: 4px;
      animation: pulseViewers 2s ease-in-out infinite;
    }
    .pcard__viewers::before {
      content: '';
      width: 6px; height: 6px; border-radius: 50%;
      background: #fff;
      animation: blink 1.5s infinite;
    }
    @keyframes pulseViewers {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: .3; }
    }
    .pcard__compare { transition: all .25s var(--ease); }

    /* Trust Badges */
    .trust-badges {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin: 30px 0 0;
    }
    @media (max-width: 700px) {
      .trust-badges { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    }
    .trust-badge {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px;
      background: var(--ink-2);
      border: 1px solid var(--line);
      border-radius: var(--r-md);
      transition: all .3s var(--ease);
    }
    .trust-badge:hover {
      border-color: var(--line-2);
      transform: translateY(-3px);
    }
    .trust-badge__icon {
      width: 40px; height: 40px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--lime) 12%, transparent);
      display: grid; place-items: center;
      font-size: 20px;
      flex-shrink: 0;
    }
    .trust-badge__text b {
      display: block; font-size: 12.5px;
      color: var(--text); font-weight: 600;
      margin-bottom: 2px;
    }
    .trust-badge__text span {
      font-size: 10.5px; color: var(--dim);
    }

    /* Purchases Popup */
    .purchase-popup {
      position: fixed; bottom: 90px; right: 24px; z-index: 140;
      background: var(--ink-1);
      border: 1px solid var(--line-2);
      border-radius: var(--r-lg);
      padding: 12px 16px;
      display: flex; align-items: center; gap: 12px;
      box-shadow: var(--shadow-lg);
      max-width: calc(100vw - 40px);
      transform: translateX(120%);
      transition: transform .5s cubic-bezier(.22,1,.36,1);
      font-size: 12.5px;
    }
    .purchase-popup.on { transform: translateX(0); }
    .purchase-popup img {
      width: 40px; height: 50px;
      border-radius: 8px; object-fit: cover;
      flex-shrink: 0;
    }
    .purchase-popup__text { flex: 1; min-width: 0; }
    .purchase-popup__text b { color: var(--lime); font-weight: 700; }
    .purchase-popup__text small {
      display: block; color: var(--dim);
      font-size: 10.5px; margin-top: 2px;
    }
    @media (max-width: 700px) {
      .purchase-popup { bottom: 130px; right: 16px; left: 16px; max-width: none; }
    }

    /* Enhanced Product Grid */
    .pcard { will-change: transform; }
    .pcard__img::after {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(180deg, transparent 60%, rgba(0,0,0,.05));
      pointer-events: none;
    }

    /* Enhanced Badges */
    .pbadge {
      box-shadow: 0 4px 12px rgba(0,0,0,.15);
    }

    /* Coupon Chip */
    .coupon-chip {
      padding: 6px 12px; border: 1px dashed var(--lime);
      border-radius: 100px; font-size: 11px;
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700; color: var(--lime);
      background: color-mix(in srgb, var(--lime) 5%, transparent);
      cursor: pointer; transition: all .2s;
      margin: 4px 4px 0 0;
      display: inline-block;
    }
    .coupon-chip:hover {
      background: color-mix(in srgb, var(--lime) 15%, transparent);
      transform: translateY(-1px);
    }

    /* Quick Reorder */
    .quick-reorder-btn {
      padding: 8px 14px; border-radius: 100px;
      background: var(--lime); color: var(--ink);
      font-size: 12px; font-weight: 700;
      display: inline-flex; align-items: center; gap: 6px;
      margin-top: 8px; transition: all .25s;
    }
    .quick-reorder-btn:hover { transform: translateY(-2px); }
    .quick-reorder-btn:disabled { opacity: .5; cursor: not-allowed; }
    .quick-reorder-btn svg { width: 14px; height: 14px; }

    /* Share Sheet (without WhatsApp) */
    .share-sheet {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 320;
      background: var(--ink-1); border-top: 1px solid var(--line-2);
      border-radius: var(--r-xl) var(--r-xl) 0 0;
      padding: 24px 20px 32px;
      transform: translateY(100%);
      transition: transform .4s cubic-bezier(.22,1,.36,1);
      max-width: 500px; margin: 0 auto;
    }
    .share-sheet.on { transform: translateY(0); }
    .share-sheet__head {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 20px;
    }
    .share-sheet__head h3 { font-size: 17px; }
    .share-sheet__options {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
    }
    .share-opt {
      display: flex; flex-direction: column;
      align-items: center; gap: 8px;
      padding: 14px 8px; border-radius: var(--r-md);
      background: var(--ink-2); border: 1px solid var(--line);
      transition: all .2s;
      cursor: pointer;
      font-family: inherit;
    }
    .share-opt:hover { border-color: var(--line-2); transform: translateY(-2px); }
    .share-opt .emoji { font-size: 24px; }
    .share-opt span { font-size: 11px; color: var(--text); }
    .share-opt.tg { color: #229ED9; }
    .share-opt.copy { color: var(--lime); }

    /* Sticky search on mobile */
    @media (max-width: 700px) {
      .toolbar {
        position: sticky; top: 60px; z-index: 40;
        background: var(--ink); padding: 10px 0;
        margin: 0 -20px; padding-inline: 20px;
      }
    }

    /* Nav spy */
    .nav__links a.spy-active { color: var(--lime); }
    .nav__links a.spy-active::after { transform: scaleX(1); }

    /* Better empty states */
    .empty-state {
      grid-column: 1/-1;
      padding: 80px 30px;
      text-align: center;
      color: var(--dim);
      border: 1px dashed var(--line-2);
      border-radius: var(--r-lg);
    }

    /* Smoother toasts */
    .toast {
      animation: toastSlideIn .35s cubic-bezier(.22,1,.36,1);
    }
    @keyframes toastSlideIn {
      from { transform: translateX(120%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    /* Hero live indicator */
    .live-indicator {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px; border-radius: 100px;
      background: color-mix(in srgb, var(--red) 15%, transparent);
      color: var(--red); font-size: 10px; font-weight: 700;
      letter-spacing: .05em;
      margin-inline-start: 8px;
    }
    .live-indicator::before {
      content: '';
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--red);
      animation: blink 1.5s infinite;
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

/* ==========================================================
   API with retry
   ========================================================== */
async function api(path, opts = {}, retries = 1) {
  const token = safeGet(ADMIN_TOKEN_KEY);
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token && path.startsWith('/api/admin/')) headers['X-Admin-Token'] = token;
  try {
    const r = await fetch(API + path, { ...opts, headers });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(data.error || 'خطای شبکه');
      err.status = r.status;
      throw err;
    }
    return data;
  } catch (e) {
    if (retries > 0 && !e.status && navigator.onLine) {
      await new Promise(r => setTimeout(r, 600));
      return api(path, opts, retries - 1);
    }
    logError(path, e);
    throw e;
  }
}

/* ==========================================================
   TOAST
   ========================================================== */
const toastQueue = [];
let toastRunning = false;
function toast(msg, type = 'ok', timeout = 3200) {
  toastQueue.push({ msg, type, timeout });
  if (!toastRunning) runToastQueue();
}
async function runToastQueue() {
  toastRunning = true;
  while (toastQueue.length) {
    const { msg, type, timeout } = toastQueue.shift();
    await showToast(msg, type, timeout);
    await new Promise(r => setTimeout(r, 100));
  }
  toastRunning = false;
}
function showToast(msg, type, timeout) {
  return new Promise(resolve => {
    const toasts = $('#toasts');
    if (!toasts) return resolve();
    if (toasts.children.length >= 3) toasts.firstChild.remove();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    toasts.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'all .3s';
      el.style.transform = 'translateX(120%)';
      el.style.opacity = '0';
      setTimeout(() => { el.remove(); resolve(); }, 300);
    }, timeout);
  });
}

/* ==========================================================
   CONFIRM
   ========================================================== */
function confirmDialog(title, msg) {
  return new Promise(resolve => {
    const overlay = $('#confirmOverlay');
    if (!overlay) return resolve(false);
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
  saveLater: [],
  filter: 'all',
  sort: 'default',
  search: '',
  category: '',
  settings: { ...DEFAULT_SETTINGS },
  isAdmin: false,
  adminView: 'dashboard',
  adminOrders: [],
  modalOpen: false,
  currentProductId: null,
};

/* ==========================================================
   THEME
   ========================================================== */
function initTheme() {
  const manual = safeGet(THEME_MANUAL_KEY, false);
  let theme;
  if (manual) {
    theme = safeGet(THEME_KEY, 'dark');
  } else {
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    theme = prefersLight ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  safeStore(THEME_KEY, next);
  safeStore(THEME_MANUAL_KEY, true);
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
   SCROLL LOCK
   ========================================================== */
function updateScrollLock() {
  const anyOpen = ['#drawer', '#wishDrawer', '#ordersDrawer', '#mobileMenu', '#modal', '#shareSheet']
    .some(sel => { const el = $(sel); return el && el.classList.contains('on'); });
  document.body.classList.toggle('no-scroll', anyOpen);
}

/* ==========================================================
   STORAGE
   ========================================================== */
function loadLocal() {
  state.cart = safeGet(CART_KEY, []) || [];
  state.wishlist = safeGet(WISH_KEY, []) || [];
  state.recent = safeGet(RECENT_KEY, []) || [];
  state.compare = safeGet(COMPARE_KEY, []) || [];
  state.myOrders = safeGet(ORDERS_KEY, []) || [];
  state.saveLater = safeGet(LATER_KEY, []) || [];
  const cached = safeGet(SETTINGS_CACHE_KEY, null);
  if (cached && typeof cached === 'object') state.settings = { ...DEFAULT_SETTINGS, ...cached };
}
function saveCart() { safeStore(CART_KEY, state.cart); renderBadges(); renderFloatCart(); }
function saveWish() { safeStore(WISH_KEY, state.wishlist); renderBadges(); renderWishDrawer(); }
function saveRecent() { safeStore(RECENT_KEY, state.recent.slice(0, 12)); }
function saveCompare() { safeStore(COMPARE_KEY, state.compare); renderCompareBar(); }
function saveMyOrders() { safeStore(ORDERS_KEY, state.myOrders.slice(0, 30)); renderOrdersDrawer(); }
function saveLater() { safeStore(LATER_KEY, state.saveLater); renderCartDrawer(); }
function saveUserInfo(info) { safeStore(USER_KEY, info); }
function loadUserInfo() { return safeGet(USER_KEY, {}) || {}; }

function renderBadges() {
  const cartN = state.cart.reduce((s, i) => s + (Number(i.qty) || 0), 0);
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
   FLOAT CART
   ========================================================== */
function renderFloatCart() {
  let btn = $('#floatCart');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'floatCart';
    btn.className = 'float-cart';
    btn.setAttribute('aria-label', 'مشاهده سبد');
    document.body.appendChild(btn);
    btn.onclick = openCartDrawer;
  }
  const n = state.cart.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const isMobile = window.matchMedia('(max-width: 700px)').matches;
  const scrolled = window.scrollY > 500;
  if (n === 0 || !isMobile || !scrolled) {
    btn.classList.remove('on');
    return;
  }
  const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  btn.classList.add('on');
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
    <span>${fmt(total)}</span>
    <span class="float-cart__count">${fmtNum(n)}</span>
  `;
}

/* ==========================================================
   SHIPPING (FIXED)
   ========================================================== */
function calcShipping(province, afterDiscountTotal) {
  const free = Number(state.settings.free_shipping_threshold) || DEFAULT_SETTINGS.free_shipping_threshold;
  if (afterDiscountTotal >= free) return 0;
  if (['تهران', 'البرز', 'قم'].includes(province))
    return Number(state.settings.shipping_tehran) || DEFAULT_SETTINGS.shipping_tehran;
  if (['اصفهان','مرکزی','قزوین','سمنان','مازندران','گلستان','گیلان','زنجان','همدان'].includes(province))
    return Number(state.settings.shipping_middle) || DEFAULT_SETTINGS.shipping_middle;
  return Number(state.settings.shipping_other) || DEFAULT_SETTINGS.shipping_other;
}

function isFreeShipping(afterDiscountTotal) {
  const free = Number(state.settings.free_shipping_threshold) || DEFAULT_SETTINGS.free_shipping_threshold;
  return afterDiscountTotal >= free;
}

/* ==========================================================
   SETTINGS
   ========================================================== */
async function loadSettings() {
  try {
    const r = await api('/api/settings');
    if (r.settings && typeof r.settings === 'object') {
      state.settings = { ...DEFAULT_SETTINGS, ...r.settings };
      safeStore(SETTINGS_CACHE_KEY, state.settings);
    }
    applySettings();
  } catch (e) {
    applySettings();
  }
}

function applySettings() {
  const s = state.settings;
  if (s.brand_name) {
    ['#brandName','#brandNameMobile','#brandNameFooter','#brandNameAdmin'].forEach(sel => {
      const el = $(sel); if (el) el.textContent = s.brand_name;
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
    const u = 'https://t.me/' + s.telegram.replace('@','');
    ['#footerTelegram','#mmTelegram','#liveChat'].forEach(sel => { const el = $(sel); if (el) el.href = u; });
  }
  if (s.instagram) {
    const u = 'https://instagram.com/' + s.instagram.replace('@','');
    ['#footerInstagram','#mmInstagram','#instagramLink'].forEach(sel => { const el = $(sel); if (el) el.href = u; });
  }
  if (s.ticker_items) {
    try {
      const items = JSON.parse(s.ticker_items);
      if (Array.isArray(items) && items.length) {
        const track = $('#tickerTrack');
        if (track) track.innerHTML = items.concat(items).map(t => `<span>${esc(t)}</span>`).join('');
      }
    } catch {}
  }
  if (s.countdown_end) {
    const t = new Date(s.countdown_end).getTime();
    if (!isNaN(t)) safeStore('gshop_countdown_target', String(t));
  }
  if (s.countdown_label) {
    const el = $('#countdownLabel'); if (el) el.innerHTML = s.countdown_label;
  }
}

/* ==========================================================
   PRODUCTS
   ========================================================== */
function totalStock(p) { return (p.variants || []).reduce((s, v) => s + (Number(v.stock) || 0), 0); }
function colorStock(p, c) { return (p.variants || []).filter(v => v.color === c).reduce((s, v) => s + (Number(v.stock) || 0), 0); }
function getVariantsMap(p) {
  const m = {};
  (p.variants || []).forEach(v => { m[v.color] = m[v.color] || {}; m[v.color][v.size] = v.stock; });
  return m;
}

async function loadProducts() {
  const grid = $('#grid');
  if (!grid) return;
  grid.innerHTML = Array(8).fill(0).map(() => `<div class="skeleton skel-card"></div>`).join('');
  try {
    const { products } = await api('/api/products');
    state.products = products || [];
    state.recent = state.recent.filter(id => state.products.some(p => p.id === id));
    saveRecent();
    const removed = [];
    state.cart = state.cart.filter(item => {
      const p = state.products.find(x => x.id === item.id);
      if (!p) { removed.push(item.name); return false; }
      const v = (p.variants || []).find(x => x.color === item.color && x.size === item.size);
      if (!v || v.stock <= 0) { removed.push(item.name); return false; }
      if (item.qty > v.stock) item.qty = v.stock;
      return true;
    });
    if (removed.length) {
      saveCart();
      toast(`${removed.length} محصول ناموجود از سبد حذف شد`, 'err', 4500);
    }
    populateCategories();
    renderGrid();
    renderRecent();
    renderFloatCart();
    // شروع social proof
    startSocialProof();
  } catch (e) {
    grid.innerHTML = `<div class="empty-state">
      <p style="margin-bottom:16px">خطا در بارگذاری محصولات. اتصال اینترنت را بررسی کنید.</p>
      <button class="chip" onclick="loadProducts()">🔄 تلاش دوباره</button>
    </div>`;
  }
}
window.loadProducts = loadProducts;

function populateCategories() {
  const sel = $('#categorySelect');
  if (!sel) return;
  const cats = [...new Set(state.products.map(p => p.category).filter(Boolean))];
  sel.innerHTML = '<option value="">همه دسته‌ها</option>' +
    cats.map(c => `<option value="${esc(c)}">${esc(CATEGORY_LABELS[c] || c)}</option>`).join('');
  if (state.category) sel.value = state.category;
}

function getFiltered() {
  let list = [...state.products];
  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      String(p.id).includes(q)
    );
  }
  if (state.category) list = list.filter(p => p.category === state.category);
  if (state.filter === 'instock') list = list.filter(p => totalStock(p) > 0);
  if (state.filter === 'new') list = list.filter(p => p.tag === 'NEW');
  if (state.filter === 'sale') list = list.filter(p => p.compare_price && p.compare_price > p.price);
  if (state.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
  else if (state.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
  else if (state.sort === 'rating') list.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0));
  else if (state.sort === 'stock') list.sort((a, b) => totalStock(b) - totalStock(a));
  else if (state.sort === 'newest') list.sort((a, b) => b.id - a.id);
  return list;
}

function isBestSeller(p) {
  return (p.rating_count || 0) >= 5 && (p.rating_avg || 0) >= 4.5;
}

function productCardHTML(p, idx = 0) {
  const stock = totalStock(p);
  const colors = [...new Set((p.variants || []).map(v => v.color))];
  const isWished = state.wishlist.some(w => w.id === p.id);
  const isCompared = state.compare.includes(p.id);
  const hasDiscount = p.compare_price && p.compare_price > p.price;
  const discountPct = hasDiscount ? Math.round((1 - p.price / p.compare_price) * 100) : 0;
  const bestSeller = isBestSeller(p);

  const dots = colors.slice(0, 4).map(c => {
    const avail = colorStock(p, c) > 0;
    const cls = COLOR_MAP[c] || 'black';
    return `<span class="dot dot--${cls} ${avail ? '' : 'off'}" title="${esc(c)}"></span>`;
  }).join('') + (colors.length > 4 ? `<span style="font-size:10px;color:var(--dim);margin-inline-start:2px">+${colors.length - 4}</span>` : '');

  let badges = '';
  if (hasDiscount) badges += `<span class="pbadge" style="background:var(--red);color:#fff">٪${nf(discountPct)}-</span>`;
  if (bestSeller) badges += `<span class="pbadge" style="background:var(--gold);color:var(--ink)">⭐ پرفروش</span>`;
  if (p.tag === 'NEW') badges += `<span class="pbadge">NEW</span>`;
  else if (p.tag && p.tag !== 'NEW') badges += `<span class="pbadge">${esc(p.tag)}</span>`;
  if (stock === 0) badges += `<span class="pbadge pbadge--danger">ناموجود</span>`;
  else if (stock <= 3) badges += `<span class="pbadge pbadge--warn">آخرین موجودی</span>`;

  // urgency indicator (viewers) - shown randomly
  const viewers = (idx % 3 === 0 && stock > 0) ? Math.floor(Math.random() * 5) + 3 : 0;

  return `
    <article class="pcard reveal" data-pid="${p.id}" style="transition-delay:${Math.min(idx * 40, 200)}ms">
      <div class="pcard__img">
        <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.opacity='.3'">
        <div class="pcard__badges">${badges}</div>
        <button class="pcard__wish ${isWished ? 'on' : ''}" data-wish="${p.id}" title="علاقه‌مندی" aria-label="علاقه‌مندی">
          <svg viewBox="0 0 24 24" fill="${isWished ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
        <button class="pcard__compare ${isCompared ? 'on' : ''}" data-compare="${p.id}" title="مقایسه" aria-label="مقایسه">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
          </svg>
        </button>
        ${viewers > 0 ? `<div class="pcard__viewers">${nf(viewers)} نفر الان می‌بینند</div>` : ''}
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
    grid.innerHTML = `<div class="empty-state">
      <div style="font-size:48px;margin-bottom:16px;opacity:.5">🔍</div>
      <p>محصولی پیدا نشد.</p>
      ${state.search || state.category || state.filter !== 'all' ? `<button class="chip" onclick="resetFilters()" style="margin-top:16px">پاک کردن فیلترها</button>` : ''}
    </div>`;
    return;
  }
  grid.innerHTML = list.map((p, i) => productCardHTML(p, i)).join('');
  observeReveals();
}

window.resetFilters = function() {
  state.search = '';
  state.category = '';
  state.filter = 'all';
  const si = $('#searchInput'); if (si) si.value = '';
  const cs = $('#categorySelect'); if (cs) cs.value = '';
  document.querySelectorAll('.toolbar .chip').forEach(x => x.classList.remove('active'));
  const allChip = document.querySelector('.toolbar .chip[data-filter="all"]');
  if (allChip) allChip.classList.add('active');
  renderGrid();
};

function renderRecent() {
  const sec = $('#recentSec');
  if (!sec) return;
  if (!state.recent.length) { sec.style.display = 'none'; return; }
  const recentProducts = state.recent.map(id => state.products.find(p => p.id === id)).filter(Boolean);
  if (!recentProducts.length) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  const grid = $('#recentGrid');
  grid.innerHTML = recentProducts.map((p, i) => productCardHTML(p, i)).join('');
}

/* ==========================================================
   TRUST BADGES + SOCIAL PROOF
   ========================================================== */
function injectTrustBadges() {
  const hero = $('.hero .wrap');
  if (!hero || $('.trust-badges')) return;
  const stats = $('.hero__stats');
  if (!stats) return;
  const badges = document.createElement('div');
  badges.className = 'trust-badges';
  badges.innerHTML = `
    <div class="trust-badge"><div class="trust-badge__icon">🛡️</div><div class="trust-badge__text"><b>ضمانت اصالت</b><span>۱۰۰٪ اصل و باکیفیت</span></div></div>
    <div class="trust-badge"><div class="trust-badge__icon">🚚</div><div class="trust-badge__text"><b>ارسال سریع</b><span>۲ تا ۴ روز کاری</span></div></div>
    <div class="trust-badge"><div class="trust-badge__icon">💳</div><div class="trust-badge__text"><b>پرداخت امن</b><span>در محل یا کارت</span></div></div>
    <div class="trust-badge"><div class="trust-badge__icon">🔄</div><div class="trust-badge__text"><b>مرجوعی آسان</b><span>تا ۳ روز</span></div></div>
  `;
  stats.parentElement.insertBefore(badges, stats.nextSibling);
}

const FAKE_NAMES = ['علی','رضا','مهدی','سارا','مریم','حسین','امیر','نگار','پویا','مهسا'];
const FAKE_CITIES = ['تهران','اصفهان','مشهد','شیراز','تبریز','کرج','قم','اهواز','رشت'];

let socialProofTimers = [];
function startSocialProof() {
  if (!state.products.length) return;
  socialProofTimers.forEach(t => clearTimeout(t));
  socialProofTimers = [];
  const seen = safeGet(PURCHASES_POPUP_KEY, 0);
  const now = Date.now();
  // فقط هر ۱۰ دقیقه یک بار نشون بده
  if (now - seen < 600000) return;

  const show = () => {
    if (document.hidden) return;
    if (document.body.classList.contains('no-scroll')) return;
    const p = state.products[Math.floor(Math.random() * state.products.length)];
    if (!p) return;
    const name = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
    const city = FAKE_CITIES[Math.floor(Math.random() * FAKE_CITIES.length)];

    let popup = $('#purchasePopup');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'purchasePopup';
      popup.className = 'purchase-popup';
      document.body.appendChild(popup);
      popup.onclick = () => { popup.classList.remove('on'); };
    }
    popup.innerHTML = `
      <img src="${esc(p.image)}" alt="">
      <div class="purchase-popup__text">
        <div><b>${esc(name)}</b> از ${esc(city)}</div>
        <small>همین الان ${esc(p.name.slice(0, 22))} خرید</small>
      </div>
    `;
    popup.classList.add('on');
    safeStore(PURCHASES_POPUP_KEY, Date.now());
    setTimeout(() => popup.classList.remove('on'), 5500);
  };

  socialProofTimers.push(setTimeout(show, 12000));
}

/* ==========================================================
   SEARCH SUGGESTIONS
   ========================================================== */
function initSearchSuggest() {
  const input = $('#searchInput');
  if (!input) return;
  const wrap = input.parentElement;
  if (!wrap) return;
  wrap.style.position = 'relative';

  const suggest = document.createElement('div');
  suggest.className = 'search-suggest';
  suggest.id = 'searchSuggest';
  wrap.appendChild(suggest);

  const history = safeGet(SEARCH_HISTORY_KEY, []) || [];

  function renderSuggest(q) {
    const term = q.trim().toLowerCase();
    let items = [];
    if (term.length >= 1) {
      items = state.products.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.description || '').toLowerCase().includes(term)
      ).slice(0, 6);
    }
    const historyMatches = term
      ? history.filter(h => h.toLowerCase().includes(term) && h.toLowerCase() !== term).slice(0, 3)
      : history.slice(0, 4);

    let html = '';
    if (items.length) {
      html += `<div class="search-suggest__head">محصولات</div>`;
      html += items.map(p => `
        <button class="search-suggest__item" data-suggest-product="${p.id}">
          <img src="${esc(p.image)}" alt="">
          <div class="search-suggest__info">
            <div class="search-suggest__name">${esc(p.name)}</div>
            <div class="search-suggest__price">${fmt(p.price)}</div>
          </div>
        </button>
      `).join('');
    }
    if (historyMatches.length) {
      html += `<div class="search-suggest__head">جستجوهای اخیر</div>`;
      html += historyMatches.map(h => `
        <div class="search-suggest__history" data-suggest-history="${esc(h)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>${esc(h)}</span>
        </div>
      `).join('');
    }
    if (history.length && !term) {
      html += `<div class="search-suggest__clear"><span>${fmtNum(history.length)} جستجوی اخیر</span><button data-clear-history>پاک کردن</button></div>`;
    }
    if (!html) {
      suggest.classList.remove('on');
      return;
    }
    suggest.innerHTML = html;
    suggest.classList.add('on');
    suggest.querySelectorAll('[data-suggest-product]').forEach(b => {
      b.onclick = () => {
        suggest.classList.remove('on');
        input.blur();
        openProduct(Number(b.dataset.suggestProduct));
      };
    });
    suggest.querySelectorAll('[data-suggest-history]').forEach(b => {
      b.onclick = () => {
        input.value = b.dataset.suggestHistory;
        state.search = b.dataset.suggestHistory;
        suggest.classList.remove('on');
        renderGrid();
        saveSearchHistory(b.dataset.suggestHistory);
      };
    });
    const clr = suggest.querySelector('[data-clear-history]');
    if (clr) clr.onclick = () => { safeStore(SEARCH_HISTORY_KEY, []); renderSuggest(''); };
  }

  const debounced = debounce((v) => renderSuggest(v), 120);
  input.addEventListener('input', (e) => debounced(e.target.value));
  input.addEventListener('focus', () => renderSuggest(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      suggest.classList.remove('on');
      input.blur();
      if (input.value.trim()) saveSearchHistory(input.value.trim());
    }
  });
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) suggest.classList.remove('on');
  });
}

function saveSearchHistory(term) {
  if (!term || term.length < 2) return;
  let h = safeGet(SEARCH_HISTORY_KEY, []) || [];
  h = [term, ...h.filter(x => x !== term)].slice(0, 8);
  safeStore(SEARCH_HISTORY_KEY, h);
}

/* ==========================================================
   FREE SHIPPING PROGRESS
   ========================================================== */
function renderShippingProgress(afterDiscount) {
  const freeThreshold = Number(state.settings.free_shipping_threshold) || DEFAULT_SETTINGS.free_shipping_threshold;
  if (afterDiscount >= freeThreshold) {
    return `
      <div class="ship-progress done">
        <div class="ship-progress__text">✓ ارسال شما رایگان است!</div>
        <div class="ship-progress__bar"><div class="ship-progress__fill" style="width:100%"></div></div>
      </div>
    `;
  }
  const remaining = freeThreshold - afterDiscount;
  const pct = Math.min(100, (afterDiscount / freeThreshold) * 100);
  return `
    <div class="ship-progress">
      <div class="ship-progress__text">🚚 <b>${fmt(remaining)}</b> تا ارسال رایگان</div>
      <div class="ship-progress__bar"><div class="ship-progress__fill" style="width:${pct}%"></div></div>
    </div>
  `;
}

/* ==========================================================
   WISHLIST
   ========================================================== */
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
  body.querySelectorAll('[data-wish-rm]').forEach(b => b.onclick = () => toggleWish(Number(b.dataset.wishRm)));
  body.querySelectorAll('[data-wish-view]').forEach(b => b.onclick = () => { closeWishDrawer(); openProduct(Number(b.dataset.wishView)); });
}

/* ==========================================================
   MY ORDERS
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
  body.innerHTML = state.myOrders.map((o, idx) => {
    const st = statuses[o.status] || statuses.pending;
    const reorderable = (o.items || []).some(it => {
      const p = state.products.find(x => x.id === it.productId);
      return p && totalStock(p) > 0;
    });
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
        ${reorderable ? `
          <button class="quick-reorder-btn" data-reorder="${idx}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            سفارش مجدد
          </button>
        ` : ''}
      </div>
    `;
  }).join('');

  body.querySelectorAll('[data-reorder]').forEach(b => {
    b.onclick = () => {
      const order = state.myOrders[Number(b.dataset.reorder)];
      if (!order) return;
      let added = 0, skipped = 0;
      for (const it of (order.items || [])) {
        const p = state.products.find(x => x.id === it.productId);
        if (!p) { skipped++; continue; }
        const v = (p.variants || []).find(x => x.color === it.color && x.size === it.size);
        if (!v || v.stock < 1) { skipped++; continue; }
        const existing = state.cart.find(c => c.id === p.id && c.color === it.color && c.size === it.size);
        const already = existing?.qty || 0;
        const addQty = Math.min(it.qty || 1, v.stock - already);
        if (addQty <= 0) { skipped++; continue; }
        if (existing) existing.qty += addQty;
        else state.cart.push({ id: p.id, name: p.name, price: p.price, image: p.image, color: it.color, size: it.size, qty: addQty, note: '' });
        added++;
      }
      saveCart();
      if (added) toast(`${added} محصول به سبد اضافه شد ✓`);
      if (skipped) toast(`${skipped} محصول موجود نبود`, 'err');
      if (added) { closeOrdersDrawer(); setTimeout(openCartDrawer, 300); }
    };
  });
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
    items: (order.items || []).map(i => ({ productId: i.productId, color: i.color, size: i.size, qty: i.qty })),
  });
  saveMyOrders();
}

function openOrdersDrawer() { renderOrdersDrawer(); $('#ordersDrawer').classList.add('on'); $('#scrim').classList.add('on'); updateScrollLock(); }
function closeOrdersDrawer() { $('#ordersDrawer').classList.remove('on'); $('#scrim').classList.remove('on'); updateScrollLock(); }

/* ==========================================================
   COMPARE
   ========================================================== */
function toggleCompare(pid) {
  const idx = state.compare.indexOf(pid);
  if (idx >= 0) { state.compare.splice(idx, 1); toast('از مقایسه حذف شد'); }
  else {
    if (state.compare.length >= 4) { toast('حداکثر ۴ محصول قابل مقایسه است', 'err'); return; }
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
  if (!state.compare.length) { bar.classList.remove('on'); return; }
  bar.classList.add('on');
  const items = $('#compareItems');
  const countEl = $('#compareCount');
  items.innerHTML = state.compare.map(id => {
    const p = state.products.find(x => x.id === id);
    if (!p) return '';
    return `<div class="compare-bar__item"><img src="${esc(p.image)}" alt=""><button data-cmp-rm="${id}" aria-label="حذف">×</button></div>`;
  }).join('');
  countEl.textContent = fmtNum(state.compare.length);
  items.querySelectorAll('[data-cmp-rm]').forEach(b => b.onclick = () => toggleCompare(Number(b.dataset.cmpRm)));
  const btn = $('#compareBtn');
  btn.disabled = state.compare.length < 2;
}

function openCompareModal() {
  if (state.compare.length < 2) return;
  const products = state.compare.map(id => state.products.find(p => p.id === id)).filter(Boolean);
  const modal = $('#modal');
  const box = $('#modalBox');
  const stockOf = (p) => totalStock(p);
  const colorsOf = (p) => [...new Set((p.variants || []).map(v => v.color))].join(' · ');
  const sizesOf = (p) => [...new Set((p.variants || []).map(v => v.size))].join(' · ');

  box.classList.add('modal__box--wide');
  box.innerHTML = `
    <div class="compare-table">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h2 style="margin:0">مقایسه محصولات</h2>
        <button class="close-x" id="cmpClose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div style="overflow-x:auto">
        <table>
          <tr><th></th>${products.map(p => `<td style="text-align:center"><img src="${esc(p.image)}" alt=""><div class="cmp-name">${esc(p.name)}</div><div class="cmp-price">${fmt(p.price)}</div></td>`).join('')}</tr>
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
  const close = () => { modal.classList.remove('on'); box.classList.remove('modal__box--wide'); state.modalOpen = false; updateScrollLock(); };
  $('#cmpClose').onclick = close;
  $('#cmpClear').onclick = () => { state.compare = []; saveCompare(); renderGrid(); renderRecent(); close(); };
  modal.onclick = e => { if (e.target === modal) close(); };
  modal.classList.add('on');
  state.modalOpen = true;
  updateScrollLock();
}

/* ==========================================================
   PRODUCT DETAIL
   ========================================================== */
async function openProduct(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  state.currentProductId = id;
  state.recent = [id, ...state.recent.filter(x => x !== id)].slice(0, 12);
  saveRecent();

  let reviews = [];
  try { reviews = (await api(`/api/products/${id}/reviews`)).reviews || []; } catch (e) {}

  const variantsMap = getVariantsMap(p);
  const colors = Object.keys(variantsMap);
  const sizes = [...new Set((p.variants || []).map(v => v.size))];
  const gallery = [p.image, ...((p.gallery || []).map(g => g.url))];

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
              <div class="rhead"><b>${esc(r.name)}</b><span>${esc((r.created_at || '').split(' ')[0])}</span></div>
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
    const g = { 'S': 'کوچک', 'M': 'متوسط', 'L': 'بزرگ', 'XL': 'خیلی بزرگ', 'XXL': '۲XL', 'XXXL': '۳XL' };
    return g[s] || '';
  }

  function renderRelated() {
    const related = state.products
      .filter(x => x.id !== p.id && x.category === p.category && totalStock(x) > 0)
      .slice(0, 4);
    if (!related.length) return '';
    return `
      <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--line)">
        <div style="font-size:13px;font-weight:700;margin-bottom:14px">محصولات مشابه</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
          ${related.map(r => `
            <button class="chip" data-related="${r.id}" style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:12px;height:auto;text-align:right;justify-content:flex-start">
              <img src="${esc(r.image)}" alt="" style="width:40px;height:50px;object-fit:cover;border-radius:8px;flex-shrink:0">
              <div style="flex:1;min-width:0">
                <div style="font-size:11.5px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</div>
                <div style="font-size:10.5px;color:var(--lime);font-family:'Space Grotesk',sans-serif">${fmt(r.price)}</div>
              </div>
            </button>
          `).join('')}
        </div>
      </div>
    `;
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
                ${gallery.map((g, i) => `<div class="gallery__thumb ${i === 0 ? 'on' : ''}" data-idx="${i}"><img src="${esc(g)}" alt=""></div>`).join('')}
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
                return `<button class="chip ${sel ? 'active' : ''}" data-color="${esc(c)}" ${!avail ? 'disabled style="opacity:.35;cursor:not-allowed"' : ''}>${esc(c)}${!avail ? ' ✕' : ''}</button>`;
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
                return `<button class="size-btn ${sel ? 'on' : ''}" data-size="${esc(s)}" ${!avail ? 'disabled' : ''}>${esc(s)}${lbl ? `<small>${lbl}</small>` : ''}</button>`;
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
                ${Object.entries(details).map(([k, v]) => `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:6px 0;border-bottom:1px solid var(--line)"><span style="color:var(--dim)">${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}
              </div>
            ` : ''}

            ${renderReviews()}
            ${renderRelated()}
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
        zoomed = false; galleryMain.classList.remove('zoom');
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
    if ($('#pAdd')) $('#pAdd').onclick = () => { addToCart(p, selectedColor, selectedSize, qty, $('#pAdd')); close(); };
    if ($('#sizeGuideBtn')) $('#sizeGuideBtn').onclick = showSizeGuide;
    if ($('#shareBtn')) $('#shareBtn').onclick = () => openShareSheet(p);
    if ($('#wishBtn')) $('#wishBtn').onclick = () => { toggleWish(p.id); render(); };
    if ($('#notifyMe')) $('#notifyMe').onclick = () => showNotifyModal(p, selectedColor, selectedSize);
    if ($('#writeReview')) $('#writeReview').onclick = () => {
      showReviewModal(p.id, async () => {
        reviews = (await api(`/api/products/${p.id}/reviews`)).reviews || [];
        render();
      });
    };

    box.querySelectorAll('[data-related]').forEach(b => {
      b.onclick = () => {
        const nid = Number(b.dataset.related);
        close();
        setTimeout(() => openProduct(nid), 350);
      };
    });
  }

  function close() {
    modal.classList.remove('on');
    box.classList.remove('modal__box--wide');
    state.modalOpen = false;
    state.currentProductId = null;
    updateScrollLock();
    setTimeout(() => { modal.innerHTML = '<div class="modal__box" id="modalBox"></div>'; }, 300);
  }

  modal.onclick = e => { if (e.target === modal) close(); };
  render();
  modal.classList.add('on');
  state.modalOpen = true;
  updateScrollLock();
}

/* ==========================================================
   SHARE SHEET (NO WHATSAPP)
   ========================================================== */
function openShareSheet(p) {
  const url = `${location.origin}${location.pathname}?id=${p.id}`;
  const text = `${p.name} از G_SHOP — ${fmt(p.price)}`;

  let sheet = $('#shareSheet');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'shareSheet';
    sheet.className = 'share-sheet';
    document.body.appendChild(sheet);
  }

  sheet.innerHTML = `
    <div class="share-sheet__head">
      <h3>اشتراک‌گذاری</h3>
      <button class="close-x" id="shareClose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="share-sheet__options">
      <a class="share-opt tg" href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}" target="_blank" rel="noopener">
        <span class="emoji">✈️</span><span>تلگرام</span>
      </a>
      <a class="share-opt" href="https://instagram.com/${INSTAGRAM}" target="_blank" rel="noopener">
        <span class="emoji">📷</span><span>اینستاگرام</span>
      </a>
      <button class="share-opt copy" id="shareCopy">
        <span class="emoji">📋</span><span>کپی لینک</span>
      </button>
    </div>
  `;

  sheet.classList.add('on');
  updateScrollLock();

  $('#shareClose').onclick = () => { sheet.classList.remove('on'); updateScrollLock(); };
  $('#shareCopy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('لینک کپی شد ✓');
      sheet.classList.remove('on');
      updateScrollLock();
    } catch { toast('کپی نشد', 'err'); }
  };
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
  if (!from.width || !to.width) return;
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
    <button class="close-x" id="sgClose" style="position:absolute;top:16px;left:16px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <h2>راهنمای سایز</h2>
    <p class="sub">سایز مناسب خودت رو با این جدول پیدا کن.</p>
    <div style="overflow-x:auto;margin-top:14px">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:var(--ink-2)">
          <th style="padding:12px;text-align:right;border:1px solid var(--line)">سایز</th>
          <th style="padding:12px;text-align:right;border:1px solid var(--line)">دور سینه</th>
          <th style="padding:12px;text-align:right;border:1px solid var(--line)">قد</th>
        </tr></thead>
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
  $('#sgClose').onclick = () => { modal.classList.remove('on'); state.modalOpen = false; updateScrollLock(); };
  modal.classList.add('on');
  state.modalOpen = true;
  updateScrollLock();
}

/* ==========================================================
   NOTIFY ME
   ========================================================== */
function showNotifyModal(p, color, size) {
  const modal = $('#modal');
  const box = $('#modalBox');
  box.classList.remove('modal__box--wide');
  box.innerHTML = `
    <button class="close-x" id="nmClose" style="position:absolute;top:16px;left:16px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <h2>🔔 بهم خبر بده</h2>
    <p class="sub">وقتی «${esc(p.name)} - ${esc(color)} - ${esc(size)}» موجود شد بهت پیام می‌دیم.</p>
    <div class="field"><label>شماره موبایل</label><input type="tel" id="nmPhone" placeholder="۰۹۱۲۱۲۳۴۵۶۷" inputmode="tel"></div>
    <div class="err" id="nmErr"></div>
    <button class="checkout-btn" id="nmSubmit">ثبت درخواست</button>
  `;
  $('#nmClose').onclick = () => { modal.classList.remove('on'); state.modalOpen = false; updateScrollLock(); };
  $('#nmSubmit').onclick = async () => {
    const phone = $('#nmPhone').value.trim();
    if (!phone) { $('#nmErr').textContent = 'شماره الزامی است'; $('#nmErr').classList.add('on'); return; }
    try {
      await api('/api/stock-alert', { method: 'POST', body: JSON.stringify({ productId: p.id, color, size, phone }) });
      toast('به‌محض موجود شدن خبرت می‌کنیم ✓');
      modal.classList.remove('on');
      state.modalOpen = false;
      updateScrollLock();
    } catch (e) { $('#nmErr').textContent = e.message; $('#nmErr').classList.add('on'); }
  };
  modal.classList.add('on');
  state.modalOpen = true;
  updateScrollLock();
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
    <button class="close-x" id="rvClose" style="position:absolute;top:16px;left:16px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <h2>نوشتن نظر</h2>
    <p class="sub">نظرت رو با بقیه به اشتراک بذار.</p>
    <div class="field">
      <label>امتیاز</label>
      <div id="rvStars" style="font-size:28px;color:var(--gold);cursor:pointer;letter-spacing:4px">★★★★★</div>
    </div>
    <div class="field"><label>نام</label><input type="text" id="rvName" placeholder="اسمت چیه؟"></div>
    <div class="field"><label>نظر</label><textarea id="rvComment" placeholder="تجربه‌ات از این محصول چطور بود؟"></textarea></div>
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
  $('#rvClose').onclick = () => { modal.classList.remove('on'); state.modalOpen = false; updateScrollLock(); };
  $('#rvSubmit').onclick = async () => {
    const name = $('#rvName').value.trim();
    const comment = $('#rvComment').value.trim();
    const err = $('#rvErr');
    err.classList.remove('on');
    if (!name || !comment) { err.textContent = 'نام و متن نظر الزامی است'; err.classList.add('on'); return; }
    try {
      await api(`/api/products/${productId}/reviews`, { method: 'POST', body: JSON.stringify({ name, comment, rating }) });
      toast('نظرت ثبت شد. بعد از تایید نمایش داده می‌شه ✓');
      modal.classList.remove('on');
      state.modalOpen = false;
      updateScrollLock();
      onDone?.();
    } catch (e) { err.textContent = e.message; err.classList.add('on'); }
  };
  modal.classList.add('on');
  state.modalOpen = true;
  updateScrollLock();
}

/* ==========================================================
   CART
   ========================================================== */
function addToCart(product, color, size, qty = 1, fromEl) {
  const existing = state.cart.find(i => i.id === product.id && i.color === color && i.size === size);
  const variant = (product.variants || []).find(v => v.color === color && v.size === size);
  const stock = variant?.stock || 0;
  const already = existing?.qty || 0;
  if (stock < already + qty) {
    toast(`موجودی کافی نیست (باقی‌مانده: ${fmtNum(stock - already)})`, 'err');
    return false;
  }
  if (existing) existing.qty += qty;
  else state.cart.push({ id: product.id, name: product.name, price: product.price, image: product.image, color, size, qty, note: '' });
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
    const stock = (product.variants || []).find(v => v.color === item.color && v.size === item.size)?.stock || 0;
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

function moveToLater(idx) {
  const item = state.cart[idx];
  if (!item) return;
  state.saveLater.push({ ...item });
  state.cart.splice(idx, 1);
  saveCart();
  saveLater();
  renderCartDrawer();
  toast('به «ذخیره برای بعد» منتقل شد');
}

function moveLaterToCart(idx) {
  const item = state.saveLater[idx];
  if (!item) return;
  const p = state.products.find(x => x.id === item.id);
  if (!p) { toast('محصول حذف شده', 'err'); return; }
  const v = (p.variants || []).find(x => x.color === item.color && x.size === item.size);
  if (!v || v.stock <= 0) { toast('موجود نیست', 'err'); return; }
  state.cart.push({ ...item, qty: Math.min(item.qty, v.stock), note: '' });
  state.saveLater.splice(idx, 1);
  saveCart();
  saveLater();
  renderCartDrawer();
  toast('به سبد اضافه شد ✓');
}

function removeLater(idx) {
  state.saveLater.splice(idx, 1);
  saveLater();
  renderCartDrawer();
}

function openCartDrawer() { renderCartDrawer(); $('#drawer').classList.add('on'); $('#scrim').classList.add('on'); updateScrollLock(); }
function closeCartDrawer() { $('#drawer').classList.remove('on'); $('#scrim').classList.remove('on'); updateScrollLock(); }
function openWishDrawer() { renderWishDrawer(); $('#wishDrawer').classList.add('on'); $('#scrim').classList.add('on'); updateScrollLock(); }
function closeWishDrawer() { $('#wishDrawer').classList.remove('on'); $('#scrim').classList.remove('on'); updateScrollLock(); }

function renderCartDrawer() {
  const body = $('#cartBody');
  const foot = $('#cartFoot');
  if (!body) return;

  if (!state.cart.length && !state.saveLater.length) {
    body.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--dim)">
      <div style="font-size:48px;margin-bottom:16px">🛒</div>
      <p style="margin-bottom:20px">سبد خرید خالی است</p>
      <button class="btn btn--primary" style="font-size:13px;padding:12px 24px" onclick="closeCartDrawer();document.getElementById('products').scrollIntoView({behavior:'smooth'})">دیدن محصولات</button>
    </div>`;
    foot.innerHTML = '';
    return;
  }

  const subtotal = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const coupon = safeParse(sessionStorage.getItem('gshop_coupon'), null);
  let discount = 0;
  if (coupon) {
    discount = coupon.type === 'percent' ? Math.round(subtotal * coupon.value / 100) : Math.min(coupon.value, subtotal);
    if (coupon.min_total && subtotal < coupon.min_total) {
      sessionStorage.removeItem('gshop_coupon');
      discount = 0;
    }
  }
  const afterDiscount = subtotal - discount;
  const freeShip = isFreeShipping(afterDiscount);

  let itemsHTML = state.cart.map((i, idx) => `
    <div class="citem">
      <div class="citem__img"><img src="${esc(i.image)}" alt=""></div>
      <div class="citem__info">
        <div class="citem__name">${esc(i.name)}</div>
        <div class="citem__meta">${esc(i.color)} · ${esc(i.size)}</div>
        ${i.note ? `<div class="citem__note-show">📝 ${esc(i.note)}</div>` : ''}
        <div class="citem__row">
          <div class="qty-ctrl">
            <button data-act="inc" data-idx="${idx}">+</button>
            <span>${fmtNum(i.qty)}</span>
            <button data-act="dec" data-idx="${idx}">−</button>
          </div>
          <span class="citem__price">${fmt(i.price * i.qty)}</span>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">
          <button class="citem__rm" data-act="rm" data-idx="${idx}">حذف</button>
          <button class="citem__later-btn" data-act="later" data-idx="${idx}">💾 ذخیره برای بعد</button>
          <button class="citem__note-btn ${i.note ? 'on' : ''}" data-act="note" data-idx="${idx}">${i.note ? '📝 ویرایش' : '+ یادداشت'}</button>
        </div>
      </div>
    </div>
  `).join('');

  if (state.saveLater.length) {
    itemsHTML += `
      <div style="margin-top:20px;padding-top:16px;border-top:1px dashed var(--line-2)">
        <div style="font-size:12.5px;color:var(--dim);margin-bottom:12px;letter-spacing:.05em">💾 ذخیره‌شده برای بعد (${fmtNum(state.saveLater.length)})</div>
        ${state.saveLater.map((i, idx) => `
          <div class="citem" style="opacity:.75">
            <div class="citem__img"><img src="${esc(i.image)}" alt=""></div>
            <div class="citem__info">
              <div class="citem__name">${esc(i.name)}</div>
              <div class="citem__meta">${esc(i.color)} · ${esc(i.size)} · ${fmt(i.price)}</div>
              <div class="citem__row" style="margin-top:8px">
                <button class="citem__rm" data-later-rm="${idx}" style="color:var(--dim)">حذف</button>
                <button style="font-size:12px;color:var(--lime);font-weight:600" data-later-move="${idx}">افزودن به سبد →</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  body.innerHTML = itemsHTML;

  body.querySelectorAll('[data-act]').forEach(b => {
    b.onclick = () => {
      const idx = Number(b.dataset.idx);
      const act = b.dataset.act;
      if (act === 'inc') changeQty(idx, 1);
      else if (act === 'dec') changeQty(idx, -1);
      else if (act === 'rm') removeItem(idx);
      else if (act === 'later') moveToLater(idx);
      else if (act === 'note') {
        const item = state.cart[idx];
        const cur = item.note || '';
        const note = prompt('یادداشت برای این محصول:', cur);
        if (note === null) return;
        item.note = note.trim().slice(0, 100);
        saveCart();
        renderCartDrawer();
      }
    };
  });
  body.querySelectorAll('[data-later-rm]').forEach(b => b.onclick = () => removeLater(Number(b.dataset.laterRm)));
  body.querySelectorAll('[data-later-move]').forEach(b => b.onclick = () => moveLaterToCart(Number(b.dataset.laterMove)));

  if (!state.cart.length) {
    foot.innerHTML = `<div style="text-align:center;color:var(--dim);font-size:13px;padding:12px">فقط محصولات ذخیره‌شده برای بعد داری</div>`;
    return;
  }

  foot.innerHTML = `
    ${renderShippingProgress(afterDiscount)}
    <div class="coupon">
      <input type="text" id="couponInput" placeholder="کد تخفیف" value="${coupon?.code || ''}">
      <button id="couponBtn">${coupon ? 'حذف' : 'اعمال'}</button>
    </div>
    <div class="ctotals">
      <div class="ctotals__row"><span>جمع کالاها</span><span>${fmt(subtotal)}</span></div>
      ${discount > 0 ? `<div class="ctotals__row green"><span>تخفیف ${esc(coupon.code)}</span><span>− ${fmt(discount)}</span></div>` : ''}
      <div class="ctotals__row"><span>هزینه ارسال</span><span style="color:${freeShip ? 'var(--green)' : 'var(--dim)'};font-size:12px">${freeShip ? 'رایگان ✓' : 'در مرحله بعد'}</span></div>
      <div class="ctotals__row big"><span>مبلغ نهایی</span><span>${fmt(afterDiscount)}${freeShip ? '' : ' + ارسال'}</span></div>
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
      const r = await api('/api/coupons/validate', { method: 'POST', body: JSON.stringify({ code, subtotal }) });
      sessionStorage.setItem('gshop_coupon', JSON.stringify(r.coupon));
      toast(`کد «${r.coupon.code}» اعمال شد — ${r.coupon.label || ''}`);
      renderCartDrawer();
    } catch (e) { toast(e.message, 'err'); }
  };

  $('#checkoutBtn').onclick = () => openCheckout({ subtotal, discount, coupon });
}

/* ==========================================================
   CHECKOUT (با ارسال رایگان درست)
   ========================================================== */
function openCheckout({ subtotal, discount, coupon }) {
  const modal = $('#modal');
  const box = $('#modalBox');
  box.classList.remove('modal__box--wide');

  const saved = loadUserInfo();
  const afterDiscount = subtotal - discount;
  const initProvince = saved.province || '';
  const initShip = calcShipping(initProvince, afterDiscount);
  const initTotal = afterDiscount + initShip;

  box.innerHTML = `
    <button class="close-x" id="ckClose" style="position:absolute;top:16px;left:16px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <h2>تکمیل سفارش</h2>
    <p class="sub">اطلاعات ارسال را کامل وارد کنید.</p>

    ${saved.address ? `
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
          ${IRAN_PROVINCES.map(p => `<option value="${esc(p)}" ${p === initProvince ? 'selected' : ''}>${esc(p)}</option>`).join('')}
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
      <div class="ctotals__row"><span>هزینه ارسال</span><span id="ckShipVal" style="color:${initShip === 0 ? 'var(--green)' : 'var(--text)'}">${initShip === 0 ? 'رایگان ✓' : fmt(initShip)}</span></div>
      <div class="ctotals__row big"><span>مبلغ نهایی</span><span id="ckTotalVal">${fmt(initTotal)}</span></div>
    </div>

    <div class="err" id="ckErr"></div>
    <button class="checkout-btn" id="ckSubmit" style="margin-top:12px">ثبت سفارش</button>
  `;

  $('#ckClose').onclick = () => { modal.classList.remove('on'); state.modalOpen = false; updateScrollLock(); };

  function updateShippingOnly() {
    const prov = $('#ckProvince').value;
    const shipCost = calcShipping(prov, afterDiscount);
    const finalTotal = afterDiscount + shipCost;
    const shipEl = $('#ckShipVal');
    if (shipEl) {
      shipEl.textContent = shipCost === 0 ? 'رایگان ✓' : fmt(shipCost);
      shipEl.style.color = shipCost === 0 ? 'var(--green)' : 'var(--text)';
    }
    const totEl = $('#ckTotalVal');
    if (totEl) totEl.textContent = fmt(finalTotal);
  }

  $('#ckProvince').onchange = updateShippingOnly;

  if ($('#useSaved')) {
    $('#useSaved').onclick = () => {
      $('#ckName').value = saved.name || '';
      $('#ckPhone').value = saved.phone || '';
      $('#ckEmail').value = saved.email || '';
      $('#ckProvince').value = saved.province || '';
      $('#ckCity').value = saved.city || '';
      $('#ckPostal').value = saved.postal || '';
      $('#ckAddress').value = saved.address || '';
      updateShippingOnly();
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
      const items = state.cart.map(i => ({ productId: i.id, name: i.name, color: i.color, size: i.size, qty: i.qty, note: i.note || '' }));
      const r = await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify({ name, phone: pd, email, province, city, postal_code: pcd, address, note, website, items, couponCode: coupon?.code || null }),
      });
      if (shouldSave) saveUserInfo({ name, phone: pd, email, province, city, postal: pcd, address });
      addMyOrder({ orderNo: r.orderNo, total: r.total, items: r.items || state.cart });
      showSuccess(r, { name, phone: pd, province, city, postal: pcd, address, total: r.total, discount, coupon });
    } catch (e) {
      showErr(e.message);
      btn.disabled = false;
      btn.textContent = 'ثبت سفارش';
    }
  };

  modal.onclick = e => { if (e.target === modal) { modal.classList.remove('on'); state.modalOpen = false; updateScrollLock(); } };
  modal.classList.add('on');
  state.modalOpen = true;
  updateScrollLock();
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
        <div class="row"><span>ارسال</span><b style="color:${order.shipping ? 'var(--text)' : 'var(--green)'}">${order.shipping ? fmt(order.shipping) : 'رایگان ✓'}</b></div>
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
    try { await navigator.clipboard.writeText(msg); toast('متن کپی شد ✓'); } catch { toast('کپی نشد', 'err'); }
  };
  $('#closeSuccess').onclick = () => { $('#modal').classList.remove('on'); state.modalOpen = false; updateScrollLock(); };
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
  if (!orderNo || !phone) {
    res.innerHTML = `<div style="padding:14px;background:color-mix(in srgb,var(--gold) 10%,transparent);border:1px solid color-mix(in srgb,var(--gold) 30%,transparent);border-radius:var(--r-md);color:var(--gold);font-size:13px">شماره سفارش و موبایل را وارد کنید</div>`;
    return;
  }
  res.innerHTML = '<p style="color:var(--dim)">در حال بررسی...</p>';
  try {
    const { order } = await api('/api/orders/track', { method: 'POST', body: JSON.stringify({ orderNo, phone }) });
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
          ${order.items.map(i => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0"><span>${esc(i.name)} — ${esc(i.color)} · ${esc(i.size)} ×${fmtNum(i.qty)}</span><span style="font-family:'Space Grotesk',sans-serif">${fmt(i.price * i.qty)}</span></div>`).join('')}
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
let countdownInterval = null;
function initCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  const target = new Date();
  target.setDate(target.getDate() + 3);
  target.setHours(23, 59, 59, 0);
  const stored = safeGet('gshop_countdown_target', null);
  const finalTarget = stored ? new Date(Number(stored)) : target;
  if (!stored || finalTarget < new Date()) safeStore('gshop_countdown_target', String(target.getTime()));
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
  countdownInterval = setInterval(tick, 1000);
}

/* ==========================================================
   FAQ
   ========================================================== */
function initFAQ() {
  const list = $('#faqList');
  if (!list) return;
  list.addEventListener('click', (e) => {
    const q = e.target.closest('.faq__q');
    if (!q) return;
    const item = q.parentElement;
    const isOpen = item.classList.contains('on');
    list.querySelectorAll('.faq__item').forEach(x => x.classList.remove('on'));
    if (!isOpen) item.classList.add('on');
  });
}

/* ==========================================================
   MOBILE MENU
   ========================================================== */
function openMobileMenu() { $('#mobileMenu').classList.add('on'); updateScrollLock(); }
function closeMobileMenu() { $('#mobileMenu').classList.remove('on'); updateScrollLock(); }

/* ==========================================================
   REVEAL
   ========================================================== */
let revealObserver = null;
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
    renderFloatCart();
    // scroll spy
    const sections = ['products','lookbook','story','faq','track','contact'];
    let active = null;
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= 120 && rect.bottom > 120) active = id;
      }
    });
    document.querySelectorAll('.nav__links a').forEach(a => {
      a.classList.toggle('spy-active', a.dataset.nav === active);
    });
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

  // Product cards delegation
  document.addEventListener('click', (e) => {
    const wishBtn = e.target.closest('[data-wish]');
    if (wishBtn) { e.stopPropagation(); toggleWish(Number(wishBtn.dataset.wish)); return; }
    const compareBtn = e.target.closest('[data-compare]');
    if (compareBtn) { e.stopPropagation(); toggleCompare(Number(compareBtn.dataset.compare)); return; }
    const card = e.target.closest('.pcard');
    if (card && !e.target.closest('.pcard__wish') && !e.target.closest('.pcard__compare')) {
      const pid = Number(card.dataset.pid);
      if (pid) openProduct(pid);
    }
  });

  const themeToggle = $('#themeToggle'); if (themeToggle) themeToggle.onclick = toggleTheme;
  const openCart = $('#openCart'); if (openCart) openCart.onclick = openCartDrawer;
  const closeCart = $('#closeCart'); if (closeCart) closeCart.onclick = closeCartDrawer;
  const openWish = $('#openWish'); if (openWish) openWish.onclick = openWishDrawer;
  const closeWish = $('#closeWish'); if (closeWish) closeWish.onclick = closeWishDrawer;
  const closeOrders = $('#closeOrders'); if (closeOrders) closeOrders.onclick = closeOrdersDrawer;
  const openMobile = $('#openMobile'); if (openMobile) openMobile.onclick = openMobileMenu;
  const closeMobile = $('#closeMobile'); if (closeMobile) closeMobile.onclick = closeMobileMenu;

  const scrim = $('#scrim');
  if (scrim) scrim.onclick = () => { closeCartDrawer(); closeWishDrawer(); closeOrdersDrawer(); };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeCartDrawer(); closeWishDrawer(); closeMobileMenu(); closeOrdersDrawer();
      $('#modal')?.classList.remove('on');
      $('#confirmOverlay')?.classList.remove('on');
      const sheet = $('#shareSheet'); if (sheet) sheet.classList.remove('on');
      state.modalOpen = false;
      updateScrollLock();
    }
  });

  window.addEventListener('popstate', () => {
    if (state.modalOpen) {
      $('#modal')?.classList.remove('on');
      state.modalOpen = false;
      updateScrollLock();
      history.pushState(null, '', location.href);
    }
  });
  history.pushState(null, '', location.href);

  const searchInput = $('#searchInput');
  if (searchInput) {
    const debouncedSearch = debounce((v) => { state.search = v; renderGrid(); }, 220);
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

  const trackBtn = $('#trackBtn'); if (trackBtn) trackBtn.onclick = trackOrder;
  const trackNo = $('#trackNo'); if (trackNo) trackNo.onkeydown = (e) => { if (e.key === 'Enter') trackOrder(); };
  const trackPhone = $('#trackPhone'); if (trackPhone) trackPhone.onkeydown = (e) => { if (e.key === 'Enter') trackOrder(); };

  const compareBtn = $('#compareBtn'); if (compareBtn) compareBtn.onclick = openCompareModal;
  const compareClear = $('#compareClear');
  if (compareClear) compareClear.onclick = () => { state.compare = []; saveCompare(); renderGrid(); renderRecent(); };

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
}

/* ==========================================================
   INIT
   ========================================================== */
(async function init() {
  try {
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
    initSearchSuggest();
    injectTrustBadges();
    await loadSettings();
    await loadProducts();

    const params = new URLSearchParams(location.search);
    const pid = params.get('id');
    if (pid && state.products.some(p => p.id === Number(pid))) {
      setTimeout(() => openProduct(Number(pid)), 400);
    }
  } catch (e) {
    logError('init', e);
  }
})();

window.closeCartDrawer = closeCartDrawer;
window.closeWishDrawer = closeWishDrawer;
window.closeOrdersDrawer = closeOrdersDrawer;
