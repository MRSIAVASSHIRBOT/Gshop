/* ============================================================
   G_SHOP · Cloudflare Worker API v3
   D1 + Telegram Storage + Sessions + Rate Limit + Audit + Settings
   ============================================================ */

const CORS_HEADERS = (env) => {
  const origin = env.ALLOWED_ORIGINS || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

const json = (data, status = 200, env = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...SECURITY_HEADERS,
      ...CORS_HEADERS(env),
    },
  });

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const LOW_STOCK_THRESHOLD = 3;

const IRAN_PROVINCES = [
  'آذربایجان شرقی','آذربایجان غربی','اردبیل','اصفهان','البرز','ایلام','بوشهر',
  'تهران','چهارمحال و بختیاری','خراسان جنوبی','خراسان رضوی','خراسان شمالی',
  'خوزستان','زنجان','سمنان','سیستان و بلوچستان','فارس','قزوین','قم','کردستان',
  'کرمان','کرمانشاه','کهگیلویه و بویراحمد','گلستان','گیلان','لرستان','مازندران',
  'مرکزی','هرمزگان','همدان','یزد'
];

const SETTINGS_DEFAULTS = {
  brand_name: 'G_SHOP',
  brand_tagline: 'پوشاک اسپرت',
  hero_tag: '● کالکشن ۲۰۲۶',
  hero_line1: 'G_',
  hero_line2: 'SHOP',
  hero_lead: 'پوشاک <strong>اسپرت</strong> با <strong>طراحی مدرن</strong> و <strong>کیفیت بالا</strong>.',
  footer_desc: 'فروشگاه آنلاین پوشاک اسپرت — طراحی مدرن، کیفیت بالا، قیمت منطقی.',
  phone: '09120507960',
  telegram: 'Alisdt98',
  instagram: 'g__shop11',
  email: '',
  address: '',
  free_shipping_threshold: '1000000',
  shipping_tehran: '35000',
  shipping_middle: '45000',
  shipping_other: '55000',
  countdown_end: '',
  countdown_label: '🔥 <b>پیشنهاد ویژه</b> تا پایان:',
  ticker_items: '["ارسال رایگان بالای ۱ میلیون تومان","کالکشن جدید ۲۰۲۶ منتشر شد","پرداخت در محل موجود است"]',
};

/* ============================================================
   UTILS
   ============================================================ */
const enc = new TextEncoder();

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function randomToken(len = 32) {
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return bytesToHex(b);
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const faNum = (n) => new Intl.NumberFormat('fa-IR').format(n);

const sanitize = (s, max = 500) =>
  String(s ?? '').trim().slice(0, max).replace(/[\u0000-\u001F\u007F]/g, '');

const isValidPhone = (p) => /^09\d{9}$/.test(String(p).replace(/\D/g, ''));
const isValidPostal = (p) => /^\d{10}$/.test(String(p).replace(/\D/g, ''));
const isValidEmail = (e) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/* ============================================================
   RATE LIMIT
   ============================================================ */
const rateBuckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.reset) {
    bucket = { count: 0, reset: now + windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count++;
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) if (now > v.reset) rateBuckets.delete(k);
  }
  return { ok: bucket.count <= max };
}

/* ============================================================
   SESSION
   ============================================================ */
async function createSession(env, username, request) {
  const token = randomToken(32);
  const hours = parseInt(env.SESSION_HOURS || '12', 10);
  const now = Date.now();
  const expires = now + hours * 3600 * 1000;
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const ua = (request.headers.get('User-Agent') || '').slice(0, 200);

  await env.DB.prepare(
    `INSERT INTO sessions (token, username, ip, user_agent, created_at, expires_at, last_used)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(token, username, ip, ua, now, expires, now).run();

  await env.DB.prepare(`DELETE FROM sessions WHERE expires_at < ?`).bind(now).run();
  return { token, expiresAt: expires };
}

async function checkSession(env, token) {
  if (!token) return null;
  const s = await env.DB.prepare(
    `SELECT * FROM sessions WHERE token = ? AND expires_at > ?`
  ).bind(token, Date.now()).first();
  if (!s) return null;
  env.DB.prepare(`UPDATE sessions SET last_used = ? WHERE token = ?`)
    .bind(Date.now(), token).run().catch(() => {});
  return s;
}

async function requireAdmin(request, env) {
  const token = request.headers.get('X-Admin-Token') ||
                (request.headers.get('Authorization') || '').replace('Bearer ', '');
  const session = await checkSession(env, token);
  if (!session) {
    throw new Response(JSON.stringify({ error: 'دسترسی ندارید یا منقضی شده' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS(env) },
    });
  }
  return session;
}

/* ============================================================
   AUDIT
   ============================================================ */
async function audit(env, action, target, payload, request) {
  try {
    const ip = request?.headers.get('CF-Connecting-IP') || '';
    await env.DB.prepare(
      `INSERT INTO audit_log (action, target, payload, ip) VALUES (?, ?, ?, ?)`
    ).bind(action, String(target || ''), JSON.stringify(payload || {}).slice(0, 1000), ip).run();
  } catch (e) { /* silent */ }
}

/* ============================================================
   TELEGRAM (MULTI CHAT ID)
   ============================================================ */
async function tg(env, txt) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID)
    return { ok: false, error: 'not_configured' };
  const ids = String(env.TELEGRAM_CHAT_ID).split(/[,،\s]+/).map(s => s.trim()).filter(Boolean);
  const results = await Promise.all(ids.map(async (id) => {
    try {
      const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: id,
          text: txt,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        return { ok: false, id, error: t };
      }
      return { ok: true, id };
    } catch (e) {
      return { ok: false, id, error: e.message };
    }
  }));
  return { ok: results.some(r => r.ok), results };
}

function buildTelegramMessage(order, items) {
  const itemsText = items.map(i =>
    `• <b>${escHtml(i.name)}</b>\n` +
    `   ${escHtml(i.color)} · ${escHtml(i.size)} · ×${i.qty}\n` +
    `   ${faNum(i.price * i.qty)} تومان`
  ).join('\n\n');

  const discountLine = order.discount > 0
    ? `\n🎟 تخفیف${order.couponCode ? ` (${escHtml(order.couponCode)})` : ''}: −${faNum(order.discount)} تومان`
    : '';
  const shipLine = order.shipping > 0
    ? `\n🚚 ارسال: ${faNum(order.shipping)} تومان`
    : `\n🚚 ارسال: <b>رایگان</b>`;

  return `🛒 <b>سفارش جدید G_SHOP</b>

🆔 <code>${order.orderNo}</code>
👤 ${escHtml(order.name)}
📱 <code>${escHtml(order.phone)}</code>
📍 ${escHtml(order.province || '')} - ${escHtml(order.city || '')}
📮 کدپستی: <code>${escHtml(order.postal || '-')}</code>
🏠 ${escHtml(order.address || '-')}

━━━━━━━━━━━━━━━━

${itemsText}

━━━━━━━━━━━━━━━━

📦 تعداد: ${order.totalQty} عدد
💰 جمع: ${faNum(order.subtotal)} تومان${discountLine}${shipLine}
✅ <b>مبلغ نهایی: ${faNum(order.total)} تومان</b>

🕐 ${escHtml(order.date)}`;
}

/* ============================================================
   SETTINGS HELPERS
   ============================================================ */
async function getSettings(env) {
  try {
    const { results } = await env.DB.prepare(`SELECT key, value FROM settings`).all();
    const obj = { ...SETTINGS_DEFAULTS };
    for (const r of results) obj[r.key] = r.value;
    return obj;
  } catch {
    return { ...SETTINGS_DEFAULTS };
  }
}

async function saveSetting(env, key, value) {
  await env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).bind(key, String(value ?? '')).run();
}

/* ============================================================
   SHIPPING CALC
   ============================================================ */
function calcShipping(settings, province, afterDiscount) {
  const free = parseInt(settings.free_shipping_threshold) || 1000000;
  if (afterDiscount >= free) return 0;
  if (['تهران', 'البرز', 'قم'].includes(province))
    return parseInt(settings.shipping_tehran) || 35000;
  if (['اصفهان','مرکزی','قزوین','سمنان','مازندران','گلستان','گیلان','زنجان','همدان'].includes(province))
    return parseInt(settings.shipping_middle) || 45000;
  return parseInt(settings.shipping_other) || 55000;
}

/* ============================================================
   MAIN
   ============================================================ */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    if (method === 'OPTIONS') {
      return new Response(null, { headers: { ...CORS_HEADERS(env), ...SECURITY_HEADERS } });
    }

    try {
      /* ==================== IMAGE PROXY (Telegram) ==================== */
      if (path.startsWith('/api/img/') && method === 'GET') {
        if (!rateLimit(`img:${ip}`, 300, 60000).ok)
          return new Response('Too many requests', { status: 429 });

        const fileId = decodeURIComponent(path.slice('/api/img/'.length));
        if (!fileId || fileId.length > 300 || fileId.includes('..'))
          return new Response('Bad request', { status: 400 });

        try {
          const tgResp = await fetch(
            `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`
          );
          const tgData = await tgResp.json();
          if (!tgData.ok) return new Response('Not found', { status: 404, headers: SECURITY_HEADERS });

          const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${tgData.result.file_path}`;
          const imgRes = await fetch(fileUrl);
          if (!imgRes.ok) return new Response('Upstream error', { status: 502 });

          return new Response(imgRes.body, {
            headers: {
              'Content-Type': imgRes.headers.get('Content-Type') || 'image/jpeg',
              'Cache-Control': 'public, max-age=31536000, immutable',
              'Access-Control-Allow-Origin': '*',
              ...SECURITY_HEADERS,
            },
          });
        } catch {
          return new Response('Server error', { status: 500 });
        }
      }

      /* ==================== HEALTH ==================== */
      if (path === '/api/health' && method === 'GET') {
        return json({ ok: true, time: new Date().toISOString() }, 200, env);
      }

      /* ==================== PUBLIC SETTINGS ==================== */
      if (path === '/api/settings' && method === 'GET') {
        const settings = await getSettings(env);
        return json({ settings }, 200, env);
      }

      /* ==================== PRODUCTS ==================== */
      if (path === '/api/products' && method === 'GET') {
        if (!rateLimit(`products:${ip}`, 120, 60000).ok)
          return json({ error: 'تعداد درخواست زیاد' }, 429, env);

        const { results: products } = await env.DB.prepare(
          `SELECT id, name, slug, price, compare_price, image, description, details,
                  tag, category, sort_order, rating_avg, rating_count, active, created_at
           FROM products WHERE active = 1 ORDER BY sort_order, id`
        ).all();

        const { results: variants } = await env.DB.prepare(
          `SELECT product_id, color, size, stock, extra_price FROM variants`
        ).all();

        const { results: images } = await env.DB.prepare(
          `SELECT id, product_id, url, sort_order FROM product_images ORDER BY sort_order`
        ).all();

        const vMap = {}, iMap = {};
        for (const v of variants) (vMap[v.product_id] ||= []).push(v);
        for (const i of images) (iMap[i.product_id] ||= []).push(i);

        return json({
          products: products.map(p => ({
            ...p,
            details: p.details ? JSON.parse(p.details) : {},
            variants: vMap[p.id] || [],
            gallery: iMap[p.id] || [],
          })),
        }, 200, env);
      }

      if (/^\/api\/products\/\d+$/.test(path) && method === 'GET') {
        const id = Number(path.split('/').pop());
        const product = await env.DB.prepare(
          `SELECT * FROM products WHERE id = ? AND active = 1`
        ).bind(id).first();
        if (!product) return json({ error: 'محصول پیدا نشد' }, 404, env);

        const { results: variants } = await env.DB.prepare(
          `SELECT color, size, stock, extra_price FROM variants WHERE product_id = ?`
        ).bind(id).all();
        const { results: images } = await env.DB.prepare(
          `SELECT id, url, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order`
        ).bind(id).all();

        return json({
          product: {
            ...product,
            details: product.details ? JSON.parse(product.details) : {},
            variants,
            gallery: images,
          },
        }, 200, env);
      }

      /* ==================== REVIEWS ==================== */
      if (/^\/api\/products\/\d+\/reviews$/.test(path) && method === 'GET') {
        const id = Number(path.split('/')[3]);
        const { results } = await env.DB.prepare(
          `SELECT id, name, rating, comment, created_at FROM product_reviews
           WHERE product_id = ? AND approved = 1 ORDER BY id DESC LIMIT 50`
        ).bind(id).all();
        return json({ reviews: results }, 200, env);
      }

      if (/^\/api\/products\/\d+\/reviews$/.test(path) && method === 'POST') {
        if (!rateLimit(`review:${ip}`, 5, 3600000).ok)
          return json({ error: 'تعداد نظرات زیاد است' }, 429, env);

        const id = Number(path.split('/')[3]);
        const body = await request.json();
        const name = sanitize(body.name, 60);
        const comment = sanitize(body.comment, 800);
        const rating = Math.max(1, Math.min(5, parseInt(body.rating) || 5));

        if (!name || !comment)
          return json({ error: 'نام و متن نظر الزامی است' }, 400, env);

        await env.DB.prepare(
          `INSERT INTO product_reviews (product_id, name, rating, comment) VALUES (?, ?, ?, ?)`
        ).bind(id, name, rating, comment).run();

        return json({ ok: true, message: 'نظر ثبت شد' }, 200, env);
      }

      /* ==================== COUPON VALIDATE ==================== */
      if (path === '/api/coupons/validate' && method === 'POST') {
        if (!rateLimit(`coupon:${ip}`, 20, 60000).ok)
          return json({ error: 'کمی صبر کنید' }, 429, env);

        const { code, subtotal } = await request.json();
        const clean = String(code || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '').slice(0, 30);
        if (!clean) return json({ valid: false, error: 'کد وارد نشده' }, 400, env);

        const c = await env.DB.prepare(
          `SELECT * FROM coupons WHERE code = ? AND active = 1`
        ).bind(clean).first();

        if (!c) return json({ valid: false, error: 'کد تخفیف نامعتبر است' }, 400, env);
        if (c.max_uses && c.uses >= c.max_uses)
          return json({ valid: false, error: 'ظرفیت این کد تکمیل شده' }, 400, env);
        if (c.expires_at && new Date(c.expires_at) < new Date())
          return json({ valid: false, error: 'این کد منقضی شده' }, 400, env);
        if (c.min_total && Number(subtotal || 0) < c.min_total)
          return json({ valid: false, error: `حداقل خرید ${faNum(c.min_total)} تومان است` }, 400, env);

        return json({
          valid: true,
          coupon: { code: c.code, type: c.type, value: c.value, label: c.label, min_total: c.min_total },
        }, 200, env);
      }

      /* ==================== CREATE ORDER ==================== */
      if (path === '/api/orders' && method === 'POST') {
        if (!rateLimit(`order:${ip}`, 5, 600000).ok)
          return json({ error: 'تعداد سفارشات زیاد. کمی بعد تلاش کنید.' }, 429, env);

        const body = await request.json();

        // honeypot
        if (body.website) return json({ ok: true, orderNo: 'GS-00000000' }, 200, env);

        const name = sanitize(body.name, 80);
        const phone = sanitize(body.phone, 20);
        const email = sanitize(body.email || '', 100);
        const province = sanitize(body.province || '', 40);
        const city = sanitize(body.city || '', 60);
        const postal = sanitize(body.postal_code || '', 20);
        const address = sanitize(body.address || '', 400);
        const note = sanitize(body.note || '', 500);
        const couponCode = sanitize(body.couponCode || '', 30).toUpperCase();
        const items = body.items;

        // Validation
        if (!name || name.length < 3)
          return json({ error: 'نام و نام خانوادگی را کامل وارد کنید' }, 400, env);
        if (!phone || !isValidPhone(phone))
          return json({ error: 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد' }, 400, env);
        if (email && !isValidEmail(email))
          return json({ error: 'ایمیل نامعتبر است' }, 400, env);
        if (!province || !IRAN_PROVINCES.includes(province))
          return json({ error: 'استان را انتخاب کنید' }, 400, env);
        if (!city || city.length < 2)
          return json({ error: 'نام شهر معتبر نیست' }, 400, env);
        if (!postal || !isValidPostal(postal))
          return json({ error: 'کد پستی باید ۱۰ رقم باشد' }, 400, env);
        if (!address || address.length < 10)
          return json({ error: 'آدرس کامل را وارد کنید (حداقل ۱۰ کاراکتر)' }, 400, env);
        if (!Array.isArray(items) || !items.length)
          return json({ error: 'سبد خرید خالی است' }, 400, env);
        if (items.length > 50)
          return json({ error: 'تعداد اقلام سفارش بیش از حد مجاز' }, 400, env);

        let subtotal = 0;
        const preparedItems = [];

        for (const it of items) {
          const pid = parseInt(it.productId);
          const qty = Math.max(1, Math.min(20, parseInt(it.qty) || 1));
          const color = sanitize(it.color, 40);
          const size = sanitize(it.size, 20);

          if (!pid || !color || !size)
            return json({ error: 'اطلاعات قلم سفارش نامعتبر' }, 400, env);

          const v = await env.DB.prepare(
            `SELECT stock FROM variants WHERE product_id = ? AND color = ? AND size = ?`
          ).bind(pid, color, size).first();

          if (!v || v.stock < qty)
            return json({ error: `موجودی «${sanitize(it.name, 60)}» کافی نیست` }, 400, env);

          const p = await env.DB.prepare(
            `SELECT name, price FROM products WHERE id = ? AND active = 1`
          ).bind(pid).first();
          if (!p) return json({ error: 'محصول نامعتبر در سبد' }, 400, env);

          subtotal += p.price * qty;
          preparedItems.push({ productId: pid, name: p.name, color, size, qty, price: p.price });
        }

        // Discount
        let discount = 0, appliedCode = null;
        if (couponCode) {
          const c = await env.DB.prepare(
            `SELECT * FROM coupons WHERE code = ? AND active = 1`
          ).bind(couponCode).first();
          if (c && (!c.max_uses || c.uses < c.max_uses) &&
              (!c.expires_at || new Date(c.expires_at) >= new Date()) &&
              (!c.min_total || subtotal >= c.min_total)) {
            appliedCode = c.code;
            discount = c.type === 'percent'
              ? Math.round(subtotal * c.value / 100)
              : Math.min(c.value, subtotal);
          }
        }

        // Shipping
        const settings = await getSettings(env);
        const afterDiscount = subtotal - discount;
        const shipping = calcShipping(settings, province, afterDiscount);
        const total = afterDiscount + shipping;

        const orderNo = 'GS-' + Date.now().toString().slice(-8) +
                        Math.random().toString(36).slice(2, 4).toUpperCase();
        const date = new Date().toLocaleString('fa-IR');

        const ins = await env.DB.prepare(
          `INSERT INTO orders (order_no, name, phone, email, address, city, postal_code, note,
                               subtotal, discount, shipping, coupon_code, total, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`
        ).bind(
          orderNo, name, phone, email,
          `${province} - ${city} - ${address}`,
          city, postal, note,
          subtotal, discount, shipping, appliedCode, total
        ).run();

        const orderId = ins.meta.last_row_id;

        for (const it of preparedItems) {
          await env.DB.prepare(
            `INSERT INTO order_items (order_id, product_id, name, color, size, qty, price)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(orderId, it.productId, it.name, it.color, it.size, it.qty, it.price).run();

          await env.DB.prepare(
            `UPDATE variants SET stock = MAX(0, stock - ?)
             WHERE product_id = ? AND color = ? AND size = ?`
          ).bind(it.qty, it.productId, it.color, it.size).run();
        }

        if (appliedCode) {
          await env.DB.prepare(
            `UPDATE coupons SET uses = uses + 1 WHERE code = ?`
          ).bind(appliedCode).run();
        }

        const order = {
          orderNo, name, phone, province, city, postal, address,
          subtotal, discount, couponCode: appliedCode, shipping, total,
          totalQty: preparedItems.reduce((s, i) => s + i.qty, 0),
          date,
        };

        await tg(env, buildTelegramMessage(order, preparedItems));

        return json({
          ok: true, orderNo,
          subtotal, discount, shipping, total,
          items: preparedItems,
        }, 200, env);
      }

      /* ==================== TRACK ORDER ==================== */
      if (path === '/api/orders/track' && method === 'POST') {
        if (!rateLimit(`track:${ip}`, 20, 60000).ok)
          return json({ error: 'کمی صبر کنید' }, 429, env);

        const { orderNo, phone } = await request.json();
        const cleanNo = sanitize(orderNo, 30).toUpperCase();
        const cleanPhone = sanitize(phone, 20);

        if (!cleanNo || !cleanPhone)
          return json({ error: 'اطلاعات ناقص' }, 400, env);

        const o = await env.DB.prepare(
          `SELECT * FROM orders WHERE order_no = ?`
        ).bind(cleanNo).first();

        if (!o) return json({ error: 'سفارش یافت نشد' }, 404, env);

        const digitsA = String(o.phone).replace(/\D/g, '');
        const digitsB = String(cleanPhone).replace(/\D/g, '');
        if (!safeEqual(digitsA, digitsB))
          return json({ error: 'موبایل مطابقت ندارد' }, 403, env);

        const { results: items } = await env.DB.prepare(
          `SELECT name, color, size, qty, price FROM order_items WHERE order_id = ?`
        ).bind(o.id).all();

        return json({
          order: {
            orderNo: o.order_no, name: o.name, status: o.status,
            total: o.total, subtotal: o.subtotal, discount: o.discount,
            shipping: o.shipping, tracking_no: o.tracking_no,
            created_at: o.created_at, updated_at: o.updated_at,
            items,
          },
        }, 200, env);
      }

      /* ==================== STOCK ALERT ==================== */
      if (path === '/api/stock-alert' && method === 'POST') {
        if (!rateLimit(`alert:${ip}`, 10, 3600000).ok)
          return json({ error: 'تعداد درخواست زیاد' }, 429, env);

        const { productId, color, size, phone } = await request.json();
        const cleanPhone = sanitize(phone, 20);
        if (!isValidPhone(cleanPhone))
          return json({ error: 'شماره موبایل نامعتبر' }, 400, env);

        await env.DB.prepare(
          `INSERT INTO stock_alerts (product_id, color, size, phone) VALUES (?, ?, ?, ?)`
        ).bind(parseInt(productId), sanitize(color, 40), sanitize(size, 20), cleanPhone).run();

        return json({ ok: true, message: 'ثبت شد' }, 200, env);
      }

      /* ==================== NEWSLETTER ==================== */
      if (path === '/api/subscribe' && method === 'POST') {
        if (!rateLimit(`sub:${ip}`, 5, 3600000).ok)
          return json({ error: 'کمی صبر کنید' }, 429, env);

        const { email } = await request.json();
        const clean = sanitize(email, 120).toLowerCase();
        if (!isValidEmail(clean))
          return json({ error: 'ایمیل نامعتبر' }, 400, env);

        await env.DB.prepare(
          `INSERT OR IGNORE INTO subscribers (email) VALUES (?)`
        ).bind(clean).run();

        return json({ ok: true, message: 'عضویت ثبت شد' }, 200, env);
      }

      /* ==================== ADMIN: LOGIN / LOGOUT ==================== */
      if (path === '/api/admin/login' && method === 'POST') {
        const rl = rateLimit(`login:${ip}`, 5, 600000);
        if (!rl.ok)
          return json({ error: 'تلاش بیش از حد. ۱۰ دقیقه صبر کنید.' }, 429, env);

        const { username, password } = await request.json();
        const u = sanitize(username || '', 40);
        const p = String(password || '');

        const expectedUser = env.ADMIN_USERNAME || 'admin';
        const expectedPass = env.ADMIN_PASSWORD;

        if (!expectedPass)
          return json({ error: 'ADMIN_PASSWORD تنظیم نشده' }, 500, env);

        if (!safeEqual(u, expectedUser) || !safeEqual(p, expectedPass)) {
          await audit(env, 'login.failed', u, { ip }, request);
          return json({ error: 'نام کاربری یا رمز اشتباه' }, 401, env);
        }

        const session = await createSession(env, u, request);
        await audit(env, 'login.success', u, {}, request);
        return json({ token: session.token, expiresAt: session.expiresAt }, 200, env);
      }

      if (path === '/api/admin/logout' && method === 'POST') {
        const token = request.headers.get('X-Admin-Token');
        if (token) await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
        return json({ ok: true }, 200, env);
      }

      /* ==================== ADMIN (PROTECTED) ==================== */
      if (path.startsWith('/api/admin/')) {
        await requireAdmin(request, env);

        /* ---- UPLOAD IMAGE (Telegram) ---- */
        if (path === '/api/admin/upload' && method === 'POST') {
          const rl = rateLimit(`upload:${ip}`, 30, 3600000);
          if (!rl.ok) return json({ error: 'محدودیت آپلود' }, 429, env);

          let form;
          try { form = await request.formData(); }
          catch { return json({ error: 'فرمت درخواست نامعتبر' }, 400, env); }

          const file = form.get('file');
          if (!file || typeof file === 'string')
            return json({ error: 'فایلی ارسال نشد' }, 400, env);

          const MAX_SIZE = 5 * 1024 * 1024;
          if (file.size > MAX_SIZE)
            return json({ error: 'حجم فایل بیش از ۵ مگابایت' }, 400, env);

          const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
          if (!allowed.includes(file.type))
            return json({ error: 'فرمت پشتیبانی نمی‌شود' }, 400, env);

          const tgForm = new FormData();
          tgForm.append('chat_id', String(env.TELEGRAM_CHAT_ID).split(/[,،\s]+/)[0].trim());
          tgForm.append('document', file, file.name || 'image.jpg');

          const tgRes = await fetch(
            `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`,
            { method: 'POST', body: tgForm }
          );
          const tgData = await tgRes.json();
          if (!tgData.ok) {
            return json({ error: 'خطا در آپلود: ' + (tgData.description || '') }, 500, env);
          }

          const fileId = tgData.result.document.file_id;
          const publicUrl = `${url.origin}/api/img/${fileId}`;

          await audit(env, 'upload', fileId, { size: file.size, type: file.type }, request);
          return json({ ok: true, url: publicUrl, fileId }, 200, env);
        }

        /* ---- SETTINGS GET (admin) ---- */
        if (path === '/api/admin/settings' && method === 'GET') {
          const settings = await getSettings(env);
          return json({ settings }, 200, env);
        }

        /* ---- SETTINGS SAVE ---- */
        if (path === '/api/admin/settings' && method === 'POST') {
          const body = await request.json();
          const allowed = Object.keys(SETTINGS_DEFAULTS);
          const saved = {};
          for (const key of allowed) {
            if (body[key] !== undefined) {
              const v = String(body[key] ?? '').slice(0, 5000);
              await saveSetting(env, key, v);
              saved[key] = v;
            }
          }
          await audit(env, 'settings.save', 'all', { keys: Object.keys(saved) }, request);
          return json({ ok: true, settings: saved }, 200, env);
        }

        /* ---- CREATE PRODUCT ---- */
        if (path === '/api/admin/products' && method === 'POST') {
          const body = await request.json();
          const name = sanitize(body.name, 120);
          const price = Math.max(0, parseInt(body.price) || 0);
          const compare_price = body.compare_price ? Math.max(0, parseInt(body.compare_price)) : null;
          const description = sanitize(body.description || '', 1000);
          const tag = sanitize(body.tag || '', 20);
          const category = sanitize(body.category || 'tshirt', 30);
          const image = sanitize(body.image || '', 500);
          const sort_order = parseInt(body.sort_order) || 0;
          const details = body.details && typeof body.details === 'object'
            ? JSON.stringify(body.details).slice(0, 2000) : null;

          if (!name || !price || !image)
            return json({ error: 'نام، قیمت و تصویر الزامی است' }, 400, env);

          const slug = name.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-آ-ی]/g, '')
            .slice(0, 60) || 'product-' + Date.now();

          const r = await env.DB.prepare(
            `INSERT INTO products (name, slug, price, compare_price, image, description, details, tag, category, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(name, slug, price, compare_price, image, description, details, tag || null, category, sort_order).run();

          const pid = r.meta.last_row_id;

          const variants = Array.isArray(body.variants) ? body.variants : [];
          for (const v of variants) {
            const color = sanitize(v.color, 40);
            const size = sanitize(v.size, 20);
            const stock = Math.max(0, parseInt(v.stock) || 0);
            if (color && size) {
              await env.DB.prepare(
                `INSERT INTO variants (product_id, color, size, stock) VALUES (?, ?, ?, ?)`
              ).bind(pid, color, size, stock).run();
            }
          }

          await audit(env, 'product.create', pid, { name, price }, request);
          return json({ ok: true, id: pid }, 200, env);
        }

        /* ---- UPDATE PRODUCT ---- */
        if (/^\/api\/admin\/products\/\d+$/.test(path) && method === 'PATCH') {
          const pid = Number(path.split('/').pop());
          const body = await request.json();
          const updates = [];
          const binds = [];

          if (body.name !== undefined) { updates.push('name = ?'); binds.push(sanitize(body.name, 120)); }
          if (body.price !== undefined) { updates.push('price = ?'); binds.push(Math.max(0, parseInt(body.price) || 0)); }
          if (body.compare_price !== undefined) { updates.push('compare_price = ?'); binds.push(body.compare_price ? Math.max(0, parseInt(body.compare_price)) : null); }
          if (body.description !== undefined) { updates.push('description = ?'); binds.push(sanitize(body.description, 1000)); }
          if (body.tag !== undefined) { updates.push('tag = ?'); binds.push(sanitize(body.tag, 20) || null); }
          if (body.category !== undefined) { updates.push('category = ?'); binds.push(sanitize(body.category, 30)); }
          if (body.image !== undefined) { updates.push('image = ?'); binds.push(sanitize(body.image, 500)); }
          if (body.active !== undefined) { updates.push('active = ?'); binds.push(body.active ? 1 : 0); }
          if (body.sort_order !== undefined) { updates.push('sort_order = ?'); binds.push(parseInt(body.sort_order) || 0); }
          if (body.details !== undefined) {
            const d = body.details && typeof body.details === 'object' ? JSON.stringify(body.details).slice(0, 2000) : null;
            updates.push('details = ?'); binds.push(d);
          }

          if (!updates.length) return json({ error: 'چیزی برای به‌روزرسانی نیست' }, 400, env);

          binds.push(pid);
          await env.DB.prepare(
            `UPDATE products SET ${updates.join(', ')} WHERE id = ?`
          ).bind(...binds).run();

          await audit(env, 'product.update', pid, body, request);
          return json({ ok: true }, 200, env);
        }

        /* ---- DELETE PRODUCT ---- */
        if (/^\/api\/admin\/products\/\d+$/.test(path) && method === 'DELETE') {
          const pid = Number(path.split('/').pop());
          await env.DB.prepare(`DELETE FROM variants WHERE product_id = ?`).bind(pid).run();
          await env.DB.prepare(`DELETE FROM product_images WHERE product_id = ?`).bind(pid).run();
          await env.DB.prepare(`DELETE FROM product_reviews WHERE product_id = ?`).bind(pid).run();
          await env.DB.prepare(`DELETE FROM products WHERE id = ?`).bind(pid).run();
          await audit(env, 'product.delete', pid, {}, request);
          return json({ ok: true }, 200, env);
        }

        /* ---- PRODUCT IMAGE PATCH ---- */
        if (path === '/api/admin/products/image' && method === 'PATCH') {
          const { productId, imageUrl } = await request.json();
          if (!productId || !imageUrl) return json({ error: 'ناقص' }, 400, env);
          await env.DB.prepare(`UPDATE products SET image = ? WHERE id = ?`)
            .bind(sanitize(imageUrl, 500), productId).run();
          return json({ ok: true }, 200, env);
        }

        /* ---- ADD GALLERY IMAGE ---- */
        if (/^\/api\/admin\/products\/\d+\/gallery$/.test(path) && method === 'POST') {
          const pid = Number(path.split('/')[4]);
          const { url: imgUrl } = await request.json();
          if (!imgUrl) return json({ error: 'URL الزامی' }, 400, env);
          const max = await env.DB.prepare(
            `SELECT COALESCE(MAX(sort_order), -1) AS m FROM product_images WHERE product_id = ?`
          ).bind(pid).first();
          await env.DB.prepare(
            `INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)`
          ).bind(pid, sanitize(imgUrl, 500), max.m + 1).run();
          return json({ ok: true }, 200, env);
        }

        /* ---- DELETE GALLERY IMAGE ---- */
        if (/^\/api\/admin\/gallery\/\d+$/.test(path) && method === 'DELETE') {
          const imgId = Number(path.split('/').pop());
          await env.DB.prepare(`DELETE FROM product_images WHERE id = ?`).bind(imgId).run();
          return json({ ok: true }, 200, env);
        }

        /* ---- STATS ---- */
        if (path === '/api/admin/stats' && method === 'GET') {
          const totalOrders = (await env.DB.prepare(`SELECT COUNT(*) AS c FROM orders`).first()).c;
          const revenue = (await env.DB.prepare(
            `SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE status != 'cancelled'`).first()).s;
          const pending = (await env.DB.prepare(
            `SELECT COUNT(*) AS c FROM orders WHERE status = 'pending'`).first()).c;
          const stock = (await env.DB.prepare(
            `SELECT COALESCE(SUM(stock),0) AS s FROM variants`).first()).s;
          const lowStock = (await env.DB.prepare(
            `SELECT COUNT(*) AS c FROM variants WHERE stock > 0 AND stock <= ?`
          ).bind(LOW_STOCK_THRESHOLD).first()).c;

          const { results: salesChart } = await env.DB.prepare(
            `SELECT date(created_at) AS d, COALESCE(SUM(total),0) AS total, COUNT(*) AS cnt
             FROM orders WHERE created_at >= datetime('now', '-7 days') AND status != 'cancelled'
             GROUP BY d ORDER BY d`
          ).all();

          const recentOrders = (await env.DB.prepare(
            `SELECT order_no, name, total, status, created_at FROM orders ORDER BY id DESC LIMIT 5`
          ).all()).results;

          return json({
            totalOrders, revenue, pending, stock, lowStock,
            salesChart, recentOrders,
          }, 200, env);
        }

        /* ---- ORDERS LIST ---- */
        if (path === '/api/admin/orders' && method === 'GET') {
          const status = url.searchParams.get('status');
          const q = sanitize(url.searchParams.get('q') || '', 50);

          let query = `SELECT * FROM orders`;
          const binds = [];
          const where = [];
          if (status && STATUSES.includes(status)) { where.push(`status = ?`); binds.push(status); }
          if (q) {
            where.push(`(order_no LIKE ? OR name LIKE ? OR phone LIKE ?)`);
            binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
          }
          if (where.length) query += ` WHERE ` + where.join(' AND ');
          query += ` ORDER BY id DESC LIMIT 500`;

          const { results: orders } = await env.DB.prepare(query).bind(...binds).all();

          const { results: items } = await env.DB.prepare(`SELECT * FROM order_items`).all();
          const { results: notes } = await env.DB.prepare(`SELECT * FROM order_notes ORDER BY id DESC`).all();

          const iMap = {}, nMap = {};
          for (const i of items) (iMap[i.order_id] ||= []).push(i);
          for (const n of notes) (nMap[n.order_id] ||= []).push(n);

          return json({
            orders: orders.map(o => ({
              ...o,
              items: iMap[o.id] || [],
              notes: nMap[o.id] || [],
            })),
          }, 200, env);
        }

        /* ---- CSV EXPORT ---- */
        if (path === '/api/admin/orders.csv' && method === 'GET') {
          const { results: orders } = await env.DB.prepare(
            `SELECT * FROM orders ORDER BY id DESC`
          ).all();

          const escape = (s) => {
            let str = String(s ?? '');
            if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
            return `"${str.replace(/"/g, '""')}"`;
          };
          const lines = ['Order No,Name,Phone,City,Address,Status,Subtotal,Discount,Shipping,Total,Created At,Items'];

          for (const o of orders) {
            const { results: items } = await env.DB.prepare(
              `SELECT name, color, size, qty FROM order_items WHERE order_id = ?`
            ).bind(o.id).all();
            const itemsText = items.map(i => `${i.name}/${i.color}/${i.size} x${i.qty}`).join(' | ');
            lines.push([
              escape(o.order_no), escape(o.name), escape(o.phone),
              escape(o.city || ''), escape(o.address || ''), escape(o.status),
              o.subtotal, o.discount, o.shipping || 0, o.total,
              escape(o.created_at), escape(itemsText),
            ].join(','));
          }
          const csv = '\uFEFF' + lines.join('\n');
          return new Response(csv, {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': `attachment; filename="gshop-orders-${Date.now()}.csv"`,
              ...SECURITY_HEADERS,
              ...CORS_HEADERS(env),
            },
          });
        }

        /* ---- UPDATE ORDER STATUS / TRACKING ---- */
        if (/^\/api\/admin\/orders\/[^/]+$/.test(path) && method === 'PATCH') {
          const orderNo = decodeURIComponent(path.split('/').pop());
          const { status, tracking_no } = await request.json();
          if (!STATUSES.includes(status))
            return json({ error: 'وضعیت نامعتبر' }, 400, env);

          const old = await env.DB.prepare(
            `SELECT id, status FROM orders WHERE order_no = ?`
          ).bind(orderNo).first();
          if (!old) return json({ error: 'سفارش یافت نشد' }, 404, env);

          // Restore stock on cancellation
          if (status === 'cancelled' && old.status !== 'cancelled') {
            const { results: items } = await env.DB.prepare(
              `SELECT product_id, color, size, qty FROM order_items WHERE order_id = ?`
            ).bind(old.id).all();
            for (const it of items) {
              await env.DB.prepare(
                `UPDATE variants SET stock = stock + ? WHERE product_id = ? AND color = ? AND size = ?`
              ).bind(it.qty, it.product_id, it.color, it.size).run();
            }
          }

          await env.DB.prepare(
            `UPDATE orders SET status = ?, tracking_no = COALESCE(?, tracking_no),
                                updated_at = datetime('now') WHERE order_no = ?`
          ).bind(status, tracking_no ? sanitize(tracking_no, 50) : null, orderNo).run();

          await audit(env, 'order.status', orderNo, { status, tracking_no }, request);
          return json({ ok: true }, 200, env);
        }

        /* ---- ORDER NOTES ---- */
        if (/^\/api\/admin\/orders\/[^/]+\/notes$/.test(path) && method === 'POST') {
          const orderNo = decodeURIComponent(path.split('/')[4]);
          const { note } = await request.json();
          const clean = sanitize(note, 500);
          if (!clean) return json({ error: 'متن الزامی' }, 400, env);

          const o = await env.DB.prepare(
            `SELECT id FROM orders WHERE order_no = ?`
          ).bind(orderNo).first();
          if (!o) return json({ error: 'سفارش یافت نشد' }, 404, env);

          await env.DB.prepare(
            `INSERT INTO order_notes (order_id, note) VALUES (?, ?)`
          ).bind(o.id, clean).run();
          return json({ ok: true }, 200, env);
        }

        /* ---- DELETE ORDER ---- */
        if (/^\/api\/admin\/orders\/[^/]+$/.test(path) && method === 'DELETE') {
          const orderNo = decodeURIComponent(path.split('/').pop());
          const o = await env.DB.prepare(
            `SELECT id FROM orders WHERE order_no = ?`
          ).bind(orderNo).first();
          if (o) {
            await env.DB.prepare(`DELETE FROM order_items WHERE order_id = ?`).bind(o.id).run();
            await env.DB.prepare(`DELETE FROM order_notes WHERE order_id = ?`).bind(o.id).run();
            await env.DB.prepare(`DELETE FROM orders WHERE id = ?`).bind(o.id).run();
          }
          await audit(env, 'order.delete', orderNo, {}, request);
          return json({ ok: true }, 200, env);
        }

        /* ---- STOCK UPDATE ---- */
        if (path === '/api/admin/stock' && method === 'PATCH') {
          const { productId, color, size, delta } = await request.json();
          if (typeof delta !== 'number' || Math.abs(delta) > 10000)
            return json({ error: 'delta نامعتبر' }, 400, env);

          await env.DB.prepare(
            `UPDATE variants SET stock = MAX(0, stock + ?)
             WHERE product_id = ? AND color = ? AND size = ?`
          ).bind(delta, productId, color, size).run();
          return json({ ok: true }, 200, env);
        }

        /* ---- LOW STOCK ---- */
        if (path === '/api/admin/low-stock' && method === 'GET') {
          const { results } = await env.DB.prepare(
            `SELECT v.*, p.name AS product_name
             FROM variants v JOIN products p ON p.id = v.product_id
             WHERE v.stock <= ? ORDER BY v.stock ASC`
          ).bind(LOW_STOCK_THRESHOLD).all();
          return json({ items: results }, 200, env);
        }

        /* ---- COUPONS ---- */
        if (path === '/api/admin/coupons' && method === 'GET') {
          const { results } = await env.DB.prepare(
            `SELECT * FROM coupons ORDER BY created_at DESC`
          ).all();
          return json({ coupons: results }, 200, env);
        }

        if (path === '/api/admin/coupons' && method === 'POST') {
          const body = await request.json();
          const code = sanitize(body.code, 30).toUpperCase().replace(/[^A-Z0-9]/g, '');
          const type = body.type === 'fixed' ? 'fixed' : 'percent';
          const value = Math.max(1, parseInt(body.value) || 0);
          const label = sanitize(body.label || '', 120);
          const maxUses = body.max_uses ? Math.max(1, parseInt(body.max_uses)) : null;
          const minTotal = body.min_total ? Math.max(0, parseInt(body.min_total)) : 0;
          const expiresAt = body.expires_at ? sanitize(body.expires_at, 30) : null;

          if (!code || !value) return json({ error: 'کد و مقدار الزامی' }, 400, env);

          try {
            await env.DB.prepare(
              `INSERT INTO coupons (code, type, value, label, max_uses, min_total, expires_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(code, type, value, label, maxUses, minTotal, expiresAt).run();
          } catch {
            return json({ error: 'این کد وجود دارد' }, 400, env);
          }

          await audit(env, 'coupon.create', code, { type, value }, request);
          return json({ ok: true }, 200, env);
        }

        if (/^\/api\/admin\/coupons\/[A-Z0-9]+$/.test(path) && method === 'DELETE') {
          const code = path.split('/').pop();
          await env.DB.prepare(`DELETE FROM coupons WHERE code = ?`).bind(code).run();
          await audit(env, 'coupon.delete', code, {}, request);
          return json({ ok: true }, 200, env);
        }

        if (/^\/api\/admin\/coupons\/[A-Z0-9]+$/.test(path) && method === 'PATCH') {
          const code = path.split('/').pop();
          const { active } = await request.json();
          await env.DB.prepare(`UPDATE coupons SET active = ? WHERE code = ?`)
            .bind(active ? 1 : 0, code).run();
          return json({ ok: true }, 200, env);
        }

        /* ---- REVIEWS ---- */
        if (path === '/api/admin/reviews' && method === 'GET') {
          const { results } = await env.DB.prepare(
            `SELECT r.*, p.name AS product_name FROM product_reviews r
             JOIN products p ON p.id = r.product_id ORDER BY r.id DESC LIMIT 200`
          ).all();
          return json({ reviews: results }, 200, env);
        }

        if (/^\/api\/admin\/reviews\/\d+$/.test(path) && method === 'PATCH') {
          const rid = Number(path.split('/').pop());
          const { approved } = await request.json();
          await env.DB.prepare(`UPDATE product_reviews SET approved = ? WHERE id = ?`)
            .bind(approved ? 1 : 0, rid).run();

          const review = await env.DB.prepare(
            `SELECT product_id FROM product_reviews WHERE id = ?`
          ).bind(rid).first();
          if (review) {
            await env.DB.prepare(
              `UPDATE products SET
                 rating_avg = COALESCE((SELECT AVG(rating) FROM product_reviews WHERE product_id = ? AND approved = 1), 0),
                 rating_count = (SELECT COUNT(*) FROM product_reviews WHERE product_id = ? AND approved = 1)
               WHERE id = ?`
            ).bind(review.product_id, review.product_id, review.product_id).run();
          }
          return json({ ok: true }, 200, env);
        }

        if (/^\/api\/admin\/reviews\/\d+$/.test(path) && method === 'DELETE') {
          const rid = Number(path.split('/').pop());
          await env.DB.prepare(`DELETE FROM product_reviews WHERE id = ?`).bind(rid).run();
          return json({ ok: true }, 200, env);
        }

        /* ---- AUDIT LOG ---- */
        if (path === '/api/admin/audit' && method === 'GET') {
          const { results } = await env.DB.prepare(
            `SELECT * FROM audit_log ORDER BY id DESC LIMIT 100`
          ).all();
          return json({ logs: results }, 200, env);
        }

        /* ---- TELEGRAM TEST ---- */
        if (path === '/api/admin/telegram-test' && method === 'POST') {
          const r = await tg(env,
            '🧪 <b>تست G_SHOP</b>\n\nربات وصل شد ✓\n\n🕐 ' +
            new Date().toLocaleString('fa-IR')
          );
          if (r.ok) {
            const count = r.results?.filter(x => x.ok).length || 0;
            return json({ ok: true, sent: count, total: r.results?.length || 0 }, 200, env);
          }
          return json({ error: 'ارسال ناموفق: ' + (r.results?.[0]?.error || 'unknown') }, 500, env);
        }
      }

      return json({ error: 'یافت نشد' }, 404, env);
    } catch (e) {
      if (e instanceof Response) return e;
      console.error('Worker error:', e);
      return json({ error: 'خطای سرور: ' + e.message }, 500, env);
    }
  },
};