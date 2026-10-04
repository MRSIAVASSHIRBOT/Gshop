/* ==========================================================
   G_SHOP — keys.js
   منبع حقیقت واحد برای همه‌ی کلیدهای localStorage
   ========================================================== */
(function () {
  'use strict';
  const K = Object.freeze({
    CART:             'gshop_cart_v12',
    WISH:             'gshop_wish_v12',
    RECENT:           'gshop_recent_v12',
    COMPARE:          'gshop_compare_v12',
    USER:             'gshop_user_v12',
    ORDERS:           'gshop_orders_v12',
    LATER:            'gshop_later_v12',
    THEME:            'gshop_theme',
    THEME_MANUAL:     'gshop_theme_manual',
    ADMIN_TOKEN:      'gshop_admin_token',
    ERR_LOG:          'gshop_err_log',
    SEARCH_HISTORY:   'gshop_search_history',
    POPUP_SEEN:       'gshop_popup_seen',
    SETTINGS_CACHE:   'gshop_settings_cache_v7',
    CONTENT_CACHE:    'gshop_content_cache_v7',
    COUNTDOWN_TARGET: 'gshop_countdown_target',
    COUPON_SESSION:   'gshop_coupon_session',
    SCHEMA_VERSION:   'gshop_schema_version',
  });

  // نگاشت کلیدهای قدیمی → جدید (migration یک‌بار)
  const LEGACY_MAP = {
    'gshop_cart_v11':            K.CART,
    'gshop_wish_v11':            K.WISH,
    'gshop_recent_v11':          K.RECENT,
    'gshop_compare_v11':         K.COMPARE,
    'gshop_user_v11':            K.USER,
    'gshop_orders_v11':          K.ORDERS,
    'gshop_later_v11':           K.LATER,
    'gshop_settings_cache':      K.SETTINGS_CACHE,
    'gshop_settings_cache_v6':   K.SETTINGS_CACHE,
    'gshop_content_cache':       K.CONTENT_CACHE,
    'undefined':                 null,   // پاک‌سازی زباله‌ی باگ قدیمی
  };

  // اجرای migration
  try {
    const current = localStorage.getItem(K.SCHEMA_VERSION);
    if (current !== '12') {
      Object.entries(LEGACY_MAP).forEach(([oldKey, newKey]) => {
        const v = localStorage.getItem(oldKey);
        if (v == null) return;
        if (newKey === null) {
          localStorage.removeItem(oldKey);
        } else if (localStorage.getItem(newKey) == null) {
          localStorage.setItem(newKey, v);
          localStorage.removeItem(oldKey);
        } else {
          localStorage.removeItem(oldKey);
        }
      });
      localStorage.setItem(K.SCHEMA_VERSION, '12');
    }
  } catch (e) { /* silent */ }

  window.GSHOP_KEYS = K;
})();
