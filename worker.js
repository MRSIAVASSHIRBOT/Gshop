/* ==========================================================
   G_SHOP - Cloudflare Worker
   Production Build v18.1 (Complete, Clean, Readable)
   ========================================================== */

// ==========================================
// 1. Constants & Configurations
// ==========================================
const DEFAULT_SETTINGS = {
  brand_name: "G_SHOP",
  brand_tagline: "پوشاک اسپرت",
  phone: "09120507960",
  telegram: "Alisdt98",
  instagram: "g__shop11",
  free_shipping_threshold: "1000000",
  shipping_tehran: "35000",
  shipping_middle: "45000",
  shipping_other: "55000",
  ticker_items: '["ارسال رایگان بالای ۱ میلیون تومان","کالکشن جدید ۲۰۲۶"]'
};

const ORDER_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
const ORDER_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: []
};

export function canTransitionOrderStatus(current, next) {
  return current === next || Boolean(ORDER_TRANSITIONS[current]?.includes(next));
}

const PROVINCES = [
  "آذربایجان شرقی","آذربایجان غربی","اردبیل","اصفهان","البرز","ایلام","بوشهر",
  "تهران","چهارمحال و بختیاری","خراسان جنوبی","خراسان رضوی","خراسان شمالی",
  "خوزستان","زنجان","سمنان","سیستان و بلوچستان","فارس","قزوین","قم","کردستان",
  "کرمان","کرمانشاه","کهگیلویه و بویراحمد","گلستان","گیلان","لرستان","مازندران",
  "مرکزی","هرمزگان","همدان","یزد"
];

const URL_ZIBAL_REQ = "https://gateway.zibal.ir/v1/request";
const URL_ZIBAL_VERIFY = "https://gateway.zibal.ir/v1/verify";
const URL_ZIBAL_START = "https://gateway.zibal.ir/start/";
const URL_DIGIPAY_AUTH = "https://api.mydigipay.com/digipay/api/oauth/token";
const URL_DIGIPAY_TICKET = "https://api.mydigipay.com/digipay/api/tickets/business?type=11";
const URL_DIGIPAY_VERIFY = "https://api.mydigipay.com/digipay/api/purchases/verify";

const DIGIPAY_PAYMENT_TYPES = new Set([0, 5, 11, 13, 24]);

/** Normalize and validate the provider callback before any database lookup. */
export function parseDigipayCallback(payload) {
  if (!payload || typeof payload !== "object") return null;
  const providerId = String(payload.providerId ?? "").trim();
  const trackingCode = String(payload.trackingCode ?? "").trim();
  const result = String(payload.result ?? "").trim().toUpperCase();
  const amount = Number(payload.amount);
  const type = Number(payload.type);
  if (!providerId || !trackingCode || !result || !Number.isSafeInteger(amount) || amount <= 0 || !DIGIPAY_PAYMENT_TYPES.has(type)) return null;
  return { providerId, trackingCode, result, amount, type };
}

// ==========================================
// 2. Security & Helper Functions
// ==========================================
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Cross-Origin-Resource-Policy": "same-origin"
};

export function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const configuredOrigins = typeof env.ALLOWED_ORIGINS === "string"
    ? env.ALLOWED_ORIGINS.split(",").map(value => value.trim()).filter(value => value && value !== "*")
    : [];
  const sameOrigin = origin && origin === new URL(request.url).origin;
  // A wildcard is never a valid CORS grant; if no exact origins remain, same-origin is the only fallback.
  const allowed = configuredOrigins.includes(origin) || (!configuredOrigins.length && sameOrigin);
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
  if (allowed) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function jsonResponse(data, status = 200, env = {}, request = null, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...securityHeaders,
      ...(request ? getCorsHeaders(request, env) : {}),
      ...extraHeaders
    }
  });
}

function sanitize(str, maxLength = 500) {
  if (!str) return "";
  return String(str).trim().slice(0, maxLength).replace(/[\u0000-\u001F\u007F]/g, "");
}

export function parseJsonObject(value) {
  if (typeof value !== "string" || !value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function formatMoney(num) {
  return new Intl.NumberFormat("fa-IR").format(Number(num) || 0);
}

/**
 * Normalize order lines and merge duplicate product variants.
 * This prevents duplicate lines from bypassing the per-variant quantity cap.
 */
export function aggregateOrderItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 50) return null;
  const merged = new Map();
  for (const item of items) {
    if (!item || typeof item !== "object") return null;
    const productId = Number(item.productId);
    const qty = Number(item.qty);
    const color = sanitize(item.color, 40);
    const size = sanitize(item.size, 20);
    if (!Number.isSafeInteger(productId) || productId <= 0 || !Number.isSafeInteger(qty) || qty < 1 || qty > 20 || !color || !size) return null;
    const key = JSON.stringify([productId, color, size]);
    const current = merged.get(key);
    const totalQty = (current?.qty || 0) + qty;
    if (totalQty > 20) return null;
    merged.set(key, { productId, qty: totalQty, color, size, name: sanitize(item.name, 60) });
  }
  return [...merged.values()];
}

function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Detect supported raster image formats from their file signature.
 * Do not trust upstream Content-Type headers for downloaded Telegram files.
 */
export function detectImageContentType(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 6) {
    const signature = String.fromCharCode(...bytes.subarray(0, 6));
    if (signature === "GIF87a" || signature === "GIF89a") return "image/gif";
  }
  if (bytes.length >= 12 &&
      String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "image/webp";
  return null;
}

const rateLimitCache = new Map();
function checkRateLimit(key, maxAttempts, windowMs) {
  const now = Date.now();
  let record = rateLimitCache.get(key);
  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + windowMs };
    rateLimitCache.set(key, record);
  }
  record.count++;
  if (rateLimitCache.size > 1000) {
    for (const [k, v] of rateLimitCache.entries()) {
      if (now > v.resetAt) rateLimitCache.delete(k);
    }
    // Keep the isolate-local fallback strictly bounded under high-cardinality traffic.
    while (rateLimitCache.size > 1000) {
      const oldestKey = rateLimitCache.keys().next().value;
      if (oldestKey === undefined) break;
      rateLimitCache.delete(oldestKey);
    }
  }
  return record.count <= maxAttempts;
}

function generateRandomHex(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function hashSessionToken(token) {
  if (typeof token !== "string" || !token || token.length > 512) {
    throw new TypeError("Session token must be a non-empty bounded string");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}

/** Create a customer-facing reference with 64 bits of cryptographic randomness. */
export function generateOrderNumber(timestamp = Date.now()) {
  return `GS-${String(timestamp).slice(-8)}${generateRandomHex(8).toUpperCase()}`;
}

// ==========================================
// 3. Telegram Integration
// ==========================================
async function sendTelegramMessage(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return false;
  const chatIds = String(env.TELEGRAM_CHAT_ID).split(/[,،\s]+/).filter(Boolean);
  
  const results = await Promise.all(chatIds.map(async (chatId) => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "HTML",
          disable_web_page_preview: true
        })
      });
      return res.ok;
    } catch {
      return false;
    }
  }));
  
  return results.some(ok => ok);
}

function generateTelegramOrderMessage(order, items) {
  const itemsList = items.map(i => 
    `• <b>${escapeHtml(i.name)}</b>\n   ${escapeHtml(i.color)} · ${escapeHtml(i.size)} · ×${i.qty}\n   ${formatMoney(i.price * i.qty)} تومان`
  ).join("\n\n");

  const discount = order.discount > 0 
    ? `\n🎟 تخفیف${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ""}: −${formatMoney(order.discount)} تومان` 
    : "";
  
  const shipping = order.shipping > 0 
    ? `\n🚚 ارسال: ${formatMoney(order.shipping)} تومان` 
    : `\n🚚 ارسال: <b>رایگان</b>`;

  return `🛒 <b>سفارش جدید G_SHOP</b>\n\n` +
         `🆔 <code>${order.orderNo}</code>\n` +
         `👤 ${escapeHtml(order.name)}\n` +
         `📱 <code>${escapeHtml(order.phone)}</code>\n` +
         `📍 ${escapeHtml(order.province)} - ${escapeHtml(order.city)}\n` +
         `📮 کدپستی: <code>${escapeHtml(order.postal || "-")}</code>\n` +
         `🏠 ${escapeHtml(order.address || "-")}\n\n` +
         `━━━━━━━━━━━━━━━━\n\n` +
         `${itemsList}\n\n` +
         `━━━━━━━━━━━━━━━━\n\n` +
         `📦 تعداد: ${order.totalQty} عدد\n` +
         `💰 جمع: ${formatMoney(order.subtotal)} تومان${discount}${shipping}\n` +
         `✅ <b>مبلغ نهایی: ${formatMoney(order.total)} تومان</b>\n\n` +
         `🕐 ${escapeHtml(order.date)}`;
}

// ==========================================
// 4. Database & Auth Helpers
// ==========================================
let settingsCache = { value: null, expiresAt: 0 };

async function getSettings(env) {
  const now = Date.now();
  if (settingsCache.value && settingsCache.expiresAt > now) return { ...settingsCache.value };
  try {
    const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
    const settings = { ...DEFAULT_SETTINGS };
    for (const row of results) {
      if (typeof row.key === "string") {
        settings[row.key] = String(row.value ?? "");
      }
    }
    settingsCache = { value: settings, expiresAt: now + 15_000 };
    return { ...settings };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function verifyAdminSession(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const token = request.headers.get("X-Admin-Token") || authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token || token.length > 512) throw new Error("Unauthorized");

  const findSession = candidate => env.DB.prepare(
    "SELECT * FROM sessions WHERE token = ? AND expires_at > ?"
  ).bind(candidate, Date.now()).first();

  const tokenHash = await hashSessionToken(token);
  let session = await findSession(tokenHash);
  if (!session) {
    // Upgrade legacy plaintext sessions on first successful use without logging out active admins.
    const legacySession = await findSession(token);
    if (legacySession) {
      try {
        await env.DB.prepare("UPDATE sessions SET token = ? WHERE token = ?")
          .bind(tokenHash, token).run();
      } catch {
        // Keep the legacy session usable until expiry if a concurrent migration fails.
      }
      session = await findSession(tokenHash) || legacySession || null;
    }
  }

  if (!session) throw new Error("Unauthorized");
  return session;
}

async function logAudit(env, action, target, payload, request, ctx) {
  try {
    const ip = request?.headers.get("CF-Connecting-IP") || "";
    ctx.waitUntil(
      env.DB.prepare(
        "INSERT INTO audit_log (action, target, payload, ip) VALUES (?, ?, ?, ?)"
      ).bind(action, String(target || ""), JSON.stringify(payload || {}).slice(0, 1000), ip).run()
      .catch(() => {})
    );
  } catch {}
}

// ==========================================
// 5. Digipay Integration (With Token Caching)
// ==========================================
let digipayTokenCache = { token: null, expiresAt: 0 };

export async function readBoundedRequestText(request, maxBytes = 1024 * 1024) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("Request byte limit must be a positive safe integer");
  }
  const declaredLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await request.body?.cancel();
    const error = new Error("Request body is too large");
    error.status = 413;
    throw error;
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        const error = new Error("Request body is too large");
        error.status = 413;
        throw error;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Request body is not valid UTF-8");
  }
}

export async function readBoundedText(response, maxBytes = 64 * 1024) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("Response byte limit must be a positive safe integer");
  }
  const declaredLength = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel();
    throw new Error("پاسخ دیجی‌پی بیش از حد مجاز است");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error("پاسخ دیجی‌پی بیش از حد مجاز است");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("پاسخ دیجی‌پی نامعتبر است");
  }
}

function parseDigipayJsonPayload(responseText) {
  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error("پاسخ دیجی‌پی نامعتبر است");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("پاسخ دیجی‌پی نامعتبر است");
  }
  return data;
}

function requireDigipayAccessToken(data) {
  if (
    typeof data.access_token !== "string" ||
    !data.access_token.trim() ||
    data.access_token.length > 8192
  ) {
    throw new Error("احراز هویت دیجی‌پی ناموفق بود");
  }
  return data.access_token.trim();
}

export function parseDigipayAccessToken(responseText) {
  return requireDigipayAccessToken(parseDigipayJsonPayload(responseText));
}

export async function readDigipayJsonResponse(response) {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("سرویس دیجی‌پی در دسترس نیست");
  }
  return parseDigipayJsonPayload(await readBoundedText(response));
}

async function getDigipayAccessToken(env) {
  const now = Date.now();
  if (digipayTokenCache.token && digipayTokenCache.expiresAt > now) {
    return digipayTokenCache.token;
  }

  const clientId = env.DIGIPAY_CLIENT_ID || env.SNAPP_CLIENT_ID;
  const clientSecret = env.DIGIPAY_CLIENT_SECRET || env.SNAPP_CLIENT_SECRET;

  if (!clientId || !clientSecret) throw new Error("تنظیمات دیجی‌پی ناقص است");

  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const params = new URLSearchParams();
  params.append("username", env.DIGIPAY_USERNAME || "");
  params.append("password", env.DIGIPAY_PASSWORD || "");
  params.append("grant_type", "password");

  const res = await fetch(URL_DIGIPAY_AUTH, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });
  const accessToken = requireDigipayAccessToken(await readDigipayJsonResponse(res));
  digipayTokenCache = {
    token: accessToken,
    expiresAt: now + (50 * 60 * 1000)
  };

  return accessToken;
}

// ==========================================
// 6. Stock Management Helpers
// ==========================================
function getVariantStockMap(variants) {
  const map = {};
  for (const v of variants) {
    if (!map[v.color]) map[v.color] = {};
    map[v.color][v.size] = Number(v.stock) || 0;
  }
  return map;
}

async function applyStockChange(env, orderId, direction) {
  const { results: items } = await env.DB.prepare(
    "SELECT product_id, color, size, qty FROM order_items WHERE order_id = ?"
  ).bind(orderId).all();

  if (!items.length) return;

  const statements = items.map(item => {
    if (direction === "decrement") {
      return env.DB.prepare(
        "UPDATE variants SET stock = MAX(0, stock - ?) WHERE product_id = ? AND color = ? AND size = ?"
      ).bind(item.qty, item.product_id, item.color, item.size);
    } else {
      return env.DB.prepare(
        "UPDATE variants SET stock = stock + ? WHERE product_id = ? AND color = ? AND size = ?"
      ).bind(item.qty, item.product_id, item.color, item.size);
    }
  });

  await env.DB.batch(statements);
}

// ==========================================
// 7. Main Fetch Handler
// ==========================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
    const siteUrl = env.SITE_URL || "https://gshop11.ir";

    if (method === "OPTIONS") {
      return new Response(null, { 
        headers: { ...getCorsHeaders(request, env), ...securityHeaders } 
      });
    }

    let body = {};
    if (method === "POST" || method === "PATCH") {
      const contentType = request.headers.get("Content-Type") || "";
      if (/^application\/json(?:;|$)/i.test(contentType)) {
        try {
          const rawBody = await readBoundedRequestText(request, 1024 * 1024);
          body = rawBody ? JSON.parse(rawBody) : {};
          if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("بدنه درخواست نامعتبر است");
        } catch (error) {
          const tooLarge = error?.status === 413;
          return jsonResponse({ error: tooLarge ? "حجم درخواست بیش از حد مجاز است" : "بدنه JSON نامعتبر است" }, tooLarge ? 413 : 400, env, request);
        }
      } else if (/^application\/x-www-form-urlencoded(?:;|$)/i.test(contentType)) {
        try {
          const rawBody = await readBoundedRequestText(request, 64 * 1024);
          body = Object.fromEntries(new URLSearchParams(rawBody));
        } catch (error) {
          const tooLarge = error?.status === 413;
          return jsonResponse({ error: tooLarge ? "حجم درخواست بیش از حد مجاز است" : "بدنه فرم نامعتبر است" }, tooLarge ? 413 : 400, env, request);
        }
      }
      // Leave multipart bodies untouched: the authenticated upload route consumes them once.
    }

    try {
      if (path.startsWith("/api/img/") && method === "GET") {
        if (!checkRateLimit(`img:${clientIp}`, 300, 60000)) return new Response("Too Many Requests", { status: 429, headers: securityHeaders });
        let fileId;
        try { fileId = decodeURIComponent(path.slice(9)); } catch { return new Response("Invalid Request", { status: 400, headers: securityHeaders }); }
        if (!fileId || fileId.length > 300 || fileId.includes("..")) return new Response("Invalid Request", { status: 400, headers: securityHeaders });
        if (!env.TELEGRAM_BOT_TOKEN) return new Response("Image service is not configured", { status: 503, headers: securityHeaders });

        const tgFileReq = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
        if (!tgFileReq.ok) return new Response("Image provider unavailable", { status: 502, headers: securityHeaders });
        let tgFileData;
        try { tgFileData = await tgFileReq.json(); } catch { return new Response("Invalid image provider response", { status: 502, headers: securityHeaders }); }
        const filePath = tgFileData?.result?.file_path;
        if (!tgFileData?.ok || typeof filePath !== "string" || !filePath || filePath.startsWith("/") || filePath.split("/").includes("..")) {
          return new Response("Image not found", { status: 404, headers: securityHeaders });
        }

        const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath.split("/").map(encodeURIComponent).join("/")}`;
        const fileRes = await fetch(fileUrl);
        if (!fileRes.ok) return new Response("Image provider download failed", { status: 502, headers: securityHeaders });

        const declaredLength = Number(fileRes.headers.get("Content-Length"));
        const maxImageBytes = 20 * 1024 * 1024;
        if (Number.isFinite(declaredLength) && declaredLength > maxImageBytes) {
          return new Response("Image is too large", { status: 413, headers: securityHeaders });
        }

        const imageBytes = new Uint8Array(await fileRes.arrayBuffer());
        if (!imageBytes.length) return new Response("Empty image", { status: 502, headers: securityHeaders });
        if (imageBytes.byteLength > maxImageBytes) return new Response("Image is too large", { status: 413, headers: securityHeaders });

        const contentType = detectImageContentType(imageBytes);
        if (!contentType) return new Response("Unsupported or invalid image content", { status: 415, headers: securityHeaders });

        return new Response(imageBytes, {
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(imageBytes.byteLength),
            "Cache-Control": "public, max-age=31536000, immutable",
            "Access-Control-Allow-Origin": "*",
            ...securityHeaders
          }
        });
      }

      if (path === "/api/health" && method === "GET") return jsonResponse({ ok: true, version: "18.1" }, 200, env, request);
      if (path === "/api/settings" && method === "GET") return jsonResponse({ settings: await getSettings(env) }, 200, env, request, { "Cache-Control": "public, max-age=60" });

      if (path === "/api/content" && method === "GET") {
        try {
          const { results } = await env.DB.prepare("SELECT key, value FROM content").all();
          const content = {};
          for (const row of results) if (/^[a-z0-9_]+$/i.test(row.key)) content[row.key] = row.value;
          return jsonResponse({ content }, 200, env, request, { "Cache-Control": "public, max-age=60" });
        } catch { return jsonResponse({ content: {} }, 200, env, request); }
      }

      if (path === "/api/products" && method === "GET") {
        if (!checkRateLimit(`products:${clientIp}`, 120, 60000)) return jsonResponse({ error: "تعداد درخواست زیاد است" }, 429, env, request);
        const { results: products } = await env.DB.prepare("SELECT id, name, slug, price, compare_price, image, description, details, tag, category, sort_order, rating_avg, rating_count, active, created_at FROM products WHERE active = 1 ORDER BY sort_order ASC, id DESC").all();
        const [variantResult, imageResult] = await Promise.all([
          env.DB.prepare("SELECT v.product_id, v.color, v.size, v.stock, v.extra_price FROM variants v INNER JOIN products p ON p.id = v.product_id WHERE p.active = 1").all(),
          env.DB.prepare("SELECT i.id, i.product_id, i.url, i.sort_order FROM product_images i INNER JOIN products p ON p.id = i.product_id WHERE p.active = 1 ORDER BY i.sort_order ASC").all()
        ]);
        const variantMap = {}, imageMap = {};
        for (const v of variantResult.results) { if (!variantMap[v.product_id]) variantMap[v.product_id] = []; variantMap[v.product_id].push(v); }
        for (const img of imageResult.results) { if (!imageMap[img.product_id]) imageMap[img.product_id] = []; imageMap[img.product_id].push(img); }
        const formattedProducts = products.map(p => ({ ...p, details: parseJsonObject(p.details), variants: variantMap[p.id] || [], gallery: imageMap[p.id] || [] }));
        return jsonResponse({ products: formattedProducts }, 200, env, request, { "Cache-Control": "public, max-age=60" });
      }

      if (/^\/api\/products\/\d+$/.test(path) && method === "GET") {
        const productId = Number(path.split("/").pop());
        const product = await env.DB.prepare("SELECT * FROM products WHERE id = ? AND active = 1").bind(productId).first();
        if (!product) return jsonResponse({ error: "محصول یافت نشد" }, 404, env, request);
        const { results: variants } = await env.DB.prepare("SELECT color, size, stock, extra_price FROM variants WHERE product_id = ?").bind(productId).all();
        const { results: gallery } = await env.DB.prepare("SELECT id, url, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order ASC").bind(productId).all();
        return jsonResponse({ product: { ...product, details: parseJsonObject(product.details), variants, gallery } }, 200, env, request);
      }

      if (/^\/api\/products\/\d+\/reviews$/.test(path) && method === "GET") {
        const productId = Number(path.split("/")[3]);
        const { results: reviews } = await env.DB.prepare("SELECT id, name, rating, comment, created_at FROM product_reviews WHERE product_id = ? AND approved = 1 ORDER BY id DESC LIMIT 50").bind(productId).all();
        return jsonResponse({ reviews }, 200, env, request);
      }

      if (/^\/api\/products\/\d+\/reviews$/.test(path) && method === "POST") {
        if (!checkRateLimit(`review:${clientIp}`, 5, 3600000)) return jsonResponse({ error: "تعداد نظرات زیاد است" }, 429, env, request);
        const productId = Number(path.split("/")[3]), name = sanitize(body.name, 60), comment = sanitize(body.comment, 800), rating = Math.max(1, Math.min(5, parseInt(body.rating) || 5));
        if (!name || !comment) return jsonResponse({ error: "نام و متن نظر الزامی است" }, 400, env, request);
        const productExists = await env.DB.prepare("SELECT id FROM products WHERE id = ? AND active = 1").bind(productId).first();
        if (!productExists) return jsonResponse({ error: "محصول یافت نشد" }, 404, env, request);
        await env.DB.prepare("INSERT INTO product_reviews (product_id, name, rating, comment) VALUES (?, ?, ?, ?)").bind(productId, name, rating, comment).run();
        return jsonResponse({ ok: true, message: "نظر ثبت شد" }, 200, env, request);
      }

      if (path === "/api/coupons/validate" && method === "POST") {
        if (!checkRateLimit(`coupon:${clientIp}`, 20, 60000)) return jsonResponse({ error: "لطفاً کمی صبر کنید" }, 429, env, request);
        const code = String(body.code || "").toUpperCase().trim().replace(/[^A-Z0-9]/g, "").slice(0, 30), subtotal = Number(body.subtotal);
        if (!code || !Number.isFinite(subtotal)) return jsonResponse({ valid: false, error: "اطلاعات نامعتبر است" }, 400, env, request);
        const coupon = await env.DB.prepare("SELECT * FROM coupons WHERE code = ? AND active = 1").bind(code).first();
        if (!coupon) return jsonResponse({ valid: false, error: "کد تخفیف نامعتبر است" }, 400, env, request);
        if (coupon.max_uses && coupon.uses >= coupon.max_uses) return jsonResponse({ valid: false, error: "ظرفیت این کد تکمیل شده است" }, 400, env, request);
        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return jsonResponse({ valid: false, error: "این کد منقضی شده است" }, 400, env, request);
        if (coupon.min_total && subtotal < coupon.min_total) return jsonResponse({ valid: false, error: `حداقل خرید ${formatMoney(coupon.min_total)} تومان است` }, 400, env, request);
        return jsonResponse({ valid: true, coupon: { code: coupon.code, type: coupon.type, value: coupon.value, label: coupon.label, min_total: coupon.min_total } }, 200, env, request);
      }

      if (path === "/api/orders" && method === "POST") {
        if (!checkRateLimit(`order:${clientIp}`, 5, 600000)) return jsonResponse({ error: "تعداد سفارشات زیاد است" }, 429, env, request);
        if (body.website) return jsonResponse({ ok: true, orderNo: "GS-00000000" }, 200, env, request); 
        const name = sanitize(body.name, 80), phone = sanitize(body.phone, 20), email = sanitize(body.email || "", 100), province = sanitize(body.province || "", 40), city = sanitize(body.city || "", 60), postalCode = sanitize(body.postal_code || "", 20), address = sanitize(body.address || "", 400), note = sanitize(body.note || "", 500), couponCode = sanitize(body.couponCode || "", 30).toUpperCase(), items = body.items;
        if (!name || name.length < 3) return jsonResponse({ error: "نام را کامل وارد کنید" }, 400, env, request);
        if (!/^09\d{9}$/.test(phone)) return jsonResponse({ error: "شماره موبایل نامعتبر است" }, 400, env, request);
        if (!province || !PROVINCES.includes(province)) return jsonResponse({ error: "استان نامعتبر است" }, 400, env, request);
        if (!city || city.length < 2) return jsonResponse({ error: "نام شهر نامعتبر است" }, 400, env, request);
        if (!/^\d{10}$/.test(postalCode)) return jsonResponse({ error: "کد پستی باید ۱۰ رقم باشد" }, 400, env, request);
        if (!address || address.length < 10) return jsonResponse({ error: "آدرس کامل را وارد کنید" }, 400, env, request);
        const normalizedItems = aggregateOrderItems(items);
        if (!normalizedItems) return jsonResponse({ error: "اقلام سبد خرید نامعتبر است یا تعداد یک تنوع بیش از حد مجاز است" }, 400, env, request);
        let subtotal = 0; const verifiedItems = [];
        for (const item of normalizedItems) {
          const { productId, qty, color, size } = item;
          const variant = await env.DB.prepare("SELECT stock, extra_price FROM variants WHERE product_id = ? AND color = ? AND size = ?").bind(productId, color, size).first();
          if (!variant || variant.stock < qty) return jsonResponse({ error: `موجودی محصول «${item.name || "انتخاب‌شده"}» کافی نیست` }, 400, env, request);
          const product = await env.DB.prepare("SELECT name, price FROM products WHERE id = ? AND active = 1").bind(productId).first();
          if (!product) return jsonResponse({ error: "یکی از محصولات نامعتبر است" }, 400, env, request);
          const realPrice = product.price + (variant.extra_price || 0);
          subtotal += realPrice * qty;
          verifiedItems.push({ productId, name: product.name, color, size, qty, price: realPrice });
        }
        let discount = 0, appliedCoupon = null;
        if (couponCode) {
          const coupon = await env.DB.prepare("SELECT * FROM coupons WHERE code = ? AND active = 1").bind(couponCode).first();
          if (coupon && (!coupon.expires_at || new Date(coupon.expires_at) >= new Date()) && (!coupon.min_total || subtotal >= coupon.min_total)) {
            const updateResult = await env.DB.prepare("UPDATE coupons SET uses = uses + 1 WHERE code = ? AND active = 1 AND (max_uses IS NULL OR uses < max_uses)").bind(couponCode).run();
            if (updateResult.meta.changes > 0) {
              appliedCoupon = coupon.code;
              discount = coupon.type === "percent" ? Math.min(Math.round(subtotal * coupon.value / 100), subtotal) : Math.min(coupon.value, subtotal);
            } else { return jsonResponse({ error: "ظرفیت کد تخفیف تکمیل شده است" }, 400, env, request); }
          }
        }
        const settings = await getSettings(env), afterDiscount = Math.max(0, subtotal - discount);
        let shippingCost = 0; const freeThreshold = parseInt(settings.free_shipping_threshold) || 1000000;
        if (afterDiscount < freeThreshold) {
          if (["تهران", "البرز", "قم"].includes(province)) shippingCost = parseInt(settings.shipping_tehran) || 35000;
          else if (["اصفهان", "مرکزی", "قزوین", "سمنان", "مازندران", "گلستان", "گیلان", "زنجان", "همدان"].includes(province)) shippingCost = parseInt(settings.shipping_middle) || 45000;
          else shippingCost = parseInt(settings.shipping_other) || 55000;
        }
        const total = afterDiscount + shippingCost, orderNo = generateOrderNumber(), orderDate = new Date().toLocaleString("fa-IR");
        const orderInsert = await env.DB.prepare(`INSERT INTO orders (order_no, name, phone, email, address, city, postal_code, note, subtotal, discount, shipping, coupon_code, total, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`).bind(orderNo, name, phone, email, `${province} - ${city} - ${address}`, city, postalCode, note, subtotal, discount, shippingCost, appliedCoupon, total).run();
        const orderId = orderInsert.meta.last_row_id;
        const itemStatements = verifiedItems.map(item => env.DB.prepare("INSERT INTO order_items (order_id, product_id, name, color, size, qty, price) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(orderId, item.productId, item.name, item.color, item.size, item.qty, item.price));
        await env.DB.batch(itemStatements);
        ctx.waitUntil(sendTelegramMessage(env, generateTelegramOrderMessage({ orderNo, name, phone, province, city, postal: postalCode, address, subtotal, discount, couponCode: appliedCoupon, shipping: shippingCost, total, totalQty: verifiedItems.reduce((sum, i) => sum + i.qty, 0), date: orderDate }, verifiedItems)).catch(() => {}));
        if (total === 0) { await env.DB.prepare("UPDATE orders SET status = 'confirmed' WHERE order_no = ?").bind(orderNo).run(); await applyStockChange(env, orderId, "decrement"); }
        return jsonResponse({ ok: true, orderNo, subtotal, discount, shipping: shippingCost, total, items: verifiedItems, paymentEnabled: total > 0 && (!!env.ZIBAL_MERCHANT || !!env.DIGIPAY_CLIENT_ID) }, 200, env, request);
      }

      if (path === "/api/orders/track" && method === "POST") {
        if (!checkRateLimit(`track:${clientIp}`, 20, 60000)) return jsonResponse({ error: "لطفاً کمی صبر کنید" }, 429, env, request);
        const orderNo = sanitize(body.orderNo, 30).toUpperCase(), phone = sanitize(body.phone, 20);
        if (!orderNo || !phone) return jsonResponse({ error: "اطلاعات ناقص است" }, 400, env, request);
        const order = await env.DB.prepare("SELECT * FROM orders WHERE order_no = ?").bind(orderNo).first();
        if (!order) return jsonResponse({ error: "سفارش یافت نشد" }, 404, env, request);
        if (!safeCompare(String(order.phone).replace(/\D/g, ""), String(phone).replace(/\D/g, ""))) return jsonResponse({ error: "شماره موبایل مطابقت ندارد" }, 403, env, request);
        const { results: items } = await env.DB.prepare("SELECT name, color, size, qty, price FROM order_items WHERE order_id = ?").bind(order.id).all();
        const payment = await env.DB.prepare("SELECT status, ref_number FROM payments WHERE order_no = ? ORDER BY created_at DESC LIMIT 1").bind(orderNo).first();
        return jsonResponse({ order: { orderNo: order.order_no, name: order.name, status: order.status, total: order.total, subtotal: order.subtotal, discount: order.discount, shipping: order.shipping, tracking_no: order.tracking_no, created_at: order.created_at, updated_at: order.updated_at, items, payment: payment || null } }, 200, env, request);
      }

      if (path === "/api/payment/request" && method === "POST") {
        if (!checkRateLimit(`pay:${clientIp}`, 10, 60000)) return jsonResponse({ error: "کمی صبر کنید" }, 429, env, request);
        if (!env.ZIBAL_MERCHANT) return jsonResponse({ error: "درگاه زیبال غیرفعال است" }, 503, env, request);
        const orderNo = sanitize(body.orderNo, 30).toUpperCase();
        const order = await env.DB.prepare("SELECT * FROM orders WHERE order_no = ?").bind(orderNo).first();
        if (!order || order.status !== "pending") return jsonResponse({ error: "سفارش نامعتبر است" }, 400, env, request);
        const zibalReq = await fetch(URL_ZIBAL_REQ, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ merchant: env.ZIBAL_MERCHANT, amount: Math.round(order.total * 10), callbackUrl: `${url.origin}/api/payment/verify`, description: `سفارش ${orderNo}`, orderId: orderNo, mobile: order.phone }) });
        const zibalRes = await zibalReq.json();
        if (zibalRes.result !== 100) return jsonResponse({ error: `خطا: ${zibalRes.message || zibalRes.result}` }, 500, env, request);
        const trackId = String(zibalRes.trackId);
        await env.DB.prepare("INSERT OR REPLACE INTO payments (track_id, order_no, amount, status, created_at) VALUES (?, ?, ?, 'pending', datetime('now'))").bind(trackId, orderNo, order.total).run();
        return jsonResponse({ ok: true, paymentUrl: URL_ZIBAL_START + trackId }, 200, env, request);
      }

      if (path === "/api/payment/verify" && method === "GET") {
        const trackId = url.searchParams.get("trackId"), success = url.searchParams.get("success");
        if (!trackId) return Response.redirect(`${siteUrl}/?payment=invalid`, 302);
        const payment = await env.DB.prepare("SELECT * FROM payments WHERE track_id = ?").bind(trackId).first();
        if (!payment) return Response.redirect(`${siteUrl}/?payment=invalid`, 302);
        if (success !== "1") { await env.DB.prepare("UPDATE payments SET status='failed' WHERE track_id = ? AND status='pending'").bind(trackId).run(); return Response.redirect(`${siteUrl}/?payment=failed&order=${payment.order_no}`, 302); }
        const verifyReq = await fetch(URL_ZIBAL_VERIFY, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ merchant: env.ZIBAL_MERCHANT, trackId: parseInt(trackId) }) });
        const verifyRes = await verifyReq.json();
        if (verifyRes.result !== 100 || Number(verifyRes.amount) !== Math.round(payment.amount * 10)) { await env.DB.prepare("UPDATE payments SET status='failed' WHERE track_id = ? AND status='pending'").bind(trackId).run(); return Response.redirect(`${siteUrl}/?payment=failed&order=${payment.order_no}`, 302); }
        const updatePayment = await env.DB.prepare("UPDATE payments SET status='verified', ref_number = ?, card_number = ?, verified_at = datetime('now') WHERE track_id = ? AND status='pending'").bind(String(verifyRes.refNumber || ""), String(verifyRes.cardNumber || ""), trackId).run();
        if (updatePayment.meta.changes > 0) {
          const updateOrder = await env.DB.prepare("UPDATE orders SET status='confirmed', updated_at = datetime('now') WHERE order_no = ? AND status='pending'").bind(payment.order_no).run();
          if (updateOrder.meta.changes > 0) {
            const orderInfo = await env.DB.prepare("SELECT id FROM orders WHERE order_no = ?").bind(payment.order_no).first();
            if (orderInfo) await applyStockChange(env, orderInfo.id, "decrement");
            const fullOrder = await env.DB.prepare("SELECT * FROM orders WHERE order_no = ?").bind(payment.order_no).first();
            if (fullOrder) ctx.waitUntil(sendTelegramMessage(env, `✅ <b>پرداخت موفق زیبال</b>\n\n🆔 <code>${escapeHtml(fullOrder.order_no)}</code>\n👤 ${escapeHtml(fullOrder.name)}\n💳 مبلغ: <b>${formatMoney(fullOrder.total)} تومان</b>\n🔢 پیگیری: <code>${escapeHtml(verifyRes.refNumber || "-")}</code>`).catch(() => {}));
          }
        }
        return Response.redirect(`${siteUrl}/?payment=success&order=${payment.order_no}`, 302);
      }

      if ((path === "/api/payment/digipay/request" || path === "/api/payment/snapp/request") && method === "POST") {
        if (!checkRateLimit(`digipay:${clientIp}`, 10, 60000)) return jsonResponse({ error: "کمی صبر کنید" }, 429, env, request);
        const orderNo = sanitize(body.orderNo, 30).toUpperCase();
        const order = await env.DB.prepare("SELECT * FROM orders WHERE order_no = ?").bind(orderNo).first();
        if (!order || order.status !== "pending") return jsonResponse({ error: "سفارش نامعتبر است" }, 400, env, request);
        try {
          const accessToken = await getDigipayAccessToken(env);
          const ticketReq = await fetch(URL_DIGIPAY_TICKET, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}`, "Agent": "WEB", "Digipay-Version": "2022-02-02" }, body: JSON.stringify({ amount: Math.round(order.total * 10), cellNumber: order.phone, providerId: orderNo, callbackUrl: `${url.origin}/api/payment/digipay/verify` }) });
          const ticketRes = await readDigipayJsonResponse(ticketReq);
          if (!ticketRes.result || ticketRes.result.status !== 0) throw new Error("خطا در ایجاد تیکت دیجی‌پی");
          const trackId = ticketRes.ticket || ticketRes.trackingCode;
          if (!trackId) throw new Error("کد رهگیری از دیجی‌پی دریافت نشد");
          await env.DB.prepare("INSERT OR REPLACE INTO payments (track_id, order_no, amount, status, created_at) VALUES (?, ?, ?, 'pending', datetime('now'))").bind(trackId, orderNo, order.total).run();
          return jsonResponse({ ok: true, paymentUrl: ticketRes.redirectUrl }, 200, env, request);
        } catch { return jsonResponse({ error: "خطا در ایجاد تیکت دیجی‌پی" }, 500, env, request); }
      }

      if (path === "/api/payment/digipay/verify" && (method === "POST" || method === "GET")) {
        const callbackPayload = method === "POST" ? body : Object.fromEntries(url.searchParams.entries());
        const callback = parseDigipayCallback(callbackPayload);
        if (!callback) return Response.redirect(siteUrl + "/?payment=invalid", 302);

        const { providerId, trackingCode, result, amount, type } = callback;
        const payment = await env.DB.prepare("SELECT * FROM payments WHERE order_no = ? ORDER BY created_at DESC LIMIT 1").bind(providerId).first();
        if (!payment || String(payment.order_no) !== providerId) return Response.redirect(siteUrl + "/?payment=invalid", 302);
        if (payment.status === "verified") return Response.redirect(siteUrl + "/?payment=success&order=" + encodeURIComponent(providerId), 302);
        if (payment.status !== "pending") return Response.redirect(siteUrl + "/?payment=failed&order=" + encodeURIComponent(providerId), 302);

        if (result !== "SUCCESS") {
          await env.DB.prepare("UPDATE payments SET status='failed' WHERE track_id = ? AND status='pending'").bind(payment.track_id).run();
          return Response.redirect(siteUrl + "/?payment=failed&order=" + encodeURIComponent(providerId), 302);
        }

        try {
          const expectedAmount = Math.round(Number(payment.amount) * 10);
          if (!Number.isSafeInteger(expectedAmount) || amount !== expectedAmount) throw new Error("مبلغ کال‌بک با سفارش مطابقت ندارد");

          const accessToken = await getDigipayAccessToken(env);
          const verifyUrl = URL_DIGIPAY_VERIFY + "?type=" + encodeURIComponent(type);
          const verifyReq = await fetch(verifyUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + accessToken,
              "Agent": "WEB",
              "Digipay-Version": "2022-02-02"
            },
            body: JSON.stringify({ trackingCode, providerId })
          });
          const verifyRes = await readDigipayJsonResponse(verifyReq);
          if (!verifyRes.result || verifyRes.result.status !== 0) throw new Error("تأیید نهایی دیجی‌پی ناموفق بود");
          if (String(verifyRes.providerId ?? "") !== providerId) throw new Error("شناسه سفارش در پاسخ تأیید دیجی‌پی مطابقت ندارد");
          if (!Number.isFinite(Number(verifyRes.amount)) || Number(verifyRes.amount) !== expectedAmount) throw new Error("مبلغ تأییدشده با سفارش مطابقت ندارد");

          const updatePayment = await env.DB.prepare(
            "UPDATE payments SET status='verified', ref_number = ?, verified_at = datetime('now') WHERE track_id = ? AND status='pending'"
          ).bind(String(verifyRes.rrn || trackingCode), payment.track_id).run();

          if (updatePayment.meta.changes === 0) {
            const latest = await env.DB.prepare("SELECT status FROM payments WHERE track_id = ?").bind(payment.track_id).first();
            if (latest?.status === "verified") return Response.redirect(siteUrl + "/?payment=success&order=" + encodeURIComponent(providerId), 302);
            throw new Error("وضعیت پرداخت هم‌زمان تغییر کرده است");
          }

          const updateOrder = await env.DB.prepare(
            "UPDATE orders SET status='confirmed', updated_at = datetime('now') WHERE order_no = ? AND status='pending'"
          ).bind(providerId).run();

          if (updateOrder.meta.changes > 0) {
            const orderInfo = await env.DB.prepare("SELECT id FROM orders WHERE order_no = ?").bind(providerId).first();
            if (orderInfo) await applyStockChange(env, orderInfo.id, "decrement");

            const fullOrder = await env.DB.prepare("SELECT * FROM orders WHERE order_no = ?").bind(providerId).first();
            if (fullOrder) {
              const telegramText =
                "✅ <b>پرداخت موفق دیجی‌پی</b>\n\n" +
                "🆔 <code>" + escapeHtml(fullOrder.order_no) + "</code>\n" +
                "👤 " + escapeHtml(fullOrder.name) + "\n" +
                "💳 مبلغ: <b>" + formatMoney(fullOrder.total) + " تومان</b>\n" +
                "🔢 پیگیری: <code>" + escapeHtml(verifyRes.rrn || trackingCode) + "</code>";
              const notification = sendTelegramMessage(env, telegramText).then(sent => {
                if (!sent) console.error("Digipay payment verified, but Telegram notification was not delivered", { orderNo: providerId });
              }).catch(error => {
                console.error("Digipay Telegram notification failed", { orderNo: providerId, error: String(error?.message || error).slice(0, 160) });
              });
              ctx.waitUntil(notification);
            }
          }

          return Response.redirect(siteUrl + "/?payment=success&order=" + encodeURIComponent(providerId), 302);
        } catch {
          ctx.waitUntil(logAudit(env, "digipay_verify_error", providerId, { reason_code: "digipay_verify_failed" }, request, ctx));
          return Response.redirect(siteUrl + "/?payment=failed&order=" + encodeURIComponent(providerId), 302);
        }
      }

      if (path === "/api/admin/login" && method === "POST") {
        if (!checkRateLimit(`login:${clientIp}`, 5, 600000)) return jsonResponse({ error: "تلاش بیش از حد. ۱۰ دقیقه صبر کنید." }, 429, env, request);
        const username = sanitize(body.username || "", 40), password = String(body.password || ""), expectedUser = env.ADMIN_USERNAME, expectedPass = env.ADMIN_PASSWORD;
        if (!expectedUser || !expectedPass) return jsonResponse({ error: "تنظیمات ادمین ناقص است" }, 500, env, request);
        const userOk = safeCompare(username, expectedUser), passOk = safeCompare(password, expectedPass);
        if (!userOk || !passOk) { ctx.waitUntil(logAudit(env, "login_failed", username, { ip: clientIp }, request, ctx)); return jsonResponse({ error: "نام کاربری یا رمز عبور اشتباه است" }, 401, env, request); }
        const token = generateRandomHex(32), expiresAt = Date.now() + (parseInt(env.SESSION_HOURS || "12") * 3600000);
        const tokenHash = await hashSessionToken(token);
        await env.DB.prepare("INSERT INTO sessions (token, username, ip, user_agent, created_at, expires_at, last_used) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(tokenHash, username, clientIp, (request.headers.get("User-Agent") || "").slice(0, 200), Date.now(), expiresAt, Date.now()).run();
        ctx.waitUntil(logAudit(env, "login_success", username, {}, request, ctx));
        return jsonResponse({ token, expiresAt }, 200, env, request);
      }

      if (path === "/api/admin/logout" && method === "POST") {
        const authorization = request.headers.get("Authorization") || "";
        const token = request.headers.get("X-Admin-Token") || authorization.replace(/^Bearer\s+/i, "").trim();
        if (token && token.length <= 512) {
          const tokenHash = await hashSessionToken(token);
          await env.DB.prepare("DELETE FROM sessions WHERE token = ? OR token = ?").bind(tokenHash, token).run();
        }
        return jsonResponse({ ok: true }, 200, env, request);
      }

      if (path.startsWith("/api/admin/")) {
        try { await verifyAdminSession(request, env); } catch { return jsonResponse({ error: "دسترسی غیرمجاز" }, 401, env, request); }

        if (path === "/api/admin/me" && method === "GET") return jsonResponse({ ok: true }, 200, env, request);

        if (path === "/api/admin/upload" && method === "POST") {
          if (!checkRateLimit(`upload:${clientIp}`, 30, 3600000)) return jsonResponse({ error: "محدودیت آپلود" }, 429, env, request);
          const declaredLength = Number(request.headers.get("Content-Length"));
          if (Number.isFinite(declaredLength) && declaredLength > 5 * 1024 * 1024 + 64 * 1024) return jsonResponse({ error: "حجم درخواست آپلود بیش از حد مجاز است" }, 413, env, request);
          const formData = await request.formData(), file = formData.get("file");
          if (!file || typeof file === "string" || file.size > 5242880 || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) return jsonResponse({ error: "فایل نامعتبر یا بیش از ۵ مگابایت" }, 400, env, request);
          const tgFormData = new FormData();
          tgFormData.append("chat_id", String(env.TELEGRAM_CHAT_ID).split(/[,،\s]+/)[0].trim());
          tgFormData.append("document", file, file.name.replace(/[^\w.\-]/g, "_").slice(0, 100) || "image.jpg");
          const tgRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, { method: "POST", body: tgFormData });
          const tgData = await tgRes.json();
          if (!tgData.ok) return jsonResponse({ error: "خطا در آپلود به تلگرام" }, 500, env, request);
          return jsonResponse({ ok: true, url: `${url.origin}/api/img/${tgData.result.document.file_id}` }, 200, env, request);
        }

        if (path === "/api/admin/settings" && method === "GET") return jsonResponse({ settings: await getSettings(env) }, 200, env, request);

        if (path === "/api/admin/settings" && method === "POST") {
          const allowedKeys = Object.keys(DEFAULT_SETTINGS), statements = [];
          for (const key of allowedKeys) if (body[key] !== undefined) statements.push(env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')").bind(key, String(body[key]).slice(0, 5000)));
          if (statements.length) {
            await env.DB.batch(statements);
            settingsCache = { value: null, expiresAt: 0 };
          }
          ctx.waitUntil(logAudit(env, "settings_update", "all", { keys: Object.keys(body) }, request, ctx));
          return jsonResponse({ ok: true }, 200, env, request);
        }

        if (path === "/api/admin/content" && method === "GET") {
          const { results } = await env.DB.prepare("SELECT key, value FROM content").all(), content = {};
          for (const row of results) if (/^[a-z0-9_]+$/i.test(row.key)) content[row.key] = row.value;
          return jsonResponse({ content }, 200, env, request);
        }

        if (path === "/api/admin/content" && method === "POST") {
          const statements = [], saved = {};
          for (const [k, v] of Object.entries(body).slice(0, 100)) {
            if (typeof k !== "string" || k.length > 60) continue;
            const val = String(v ?? "").slice(0, 2000);
            statements.push(env.DB.prepare("INSERT INTO content (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')").bind(k, val));
            saved[k] = val;
          }
          if (statements.length) await env.DB.batch(statements);
          return jsonResponse({ ok: true, content: saved }, 200, env, request);
        }

        if (path === "/api/admin/products" && method === "GET") {
          const { results: products } = await env.DB.prepare("SELECT * FROM products ORDER BY id DESC").all(), { results: variants } = await env.DB.prepare("SELECT * FROM variants").all(), { results: images } = await env.DB.prepare("SELECT * FROM product_images ORDER BY sort_order").all();
          const variantMap = {}, imageMap = {};
          for (const v of variants) { if (!variantMap[v.product_id]) variantMap[v.product_id] = []; variantMap[v.product_id].push(v); }
          for (const img of images) { if (!imageMap[img.product_id]) imageMap[img.product_id] = []; imageMap[img.product_id].push(img); }
          const result = products.map(p => ({ ...p, details: parseJsonObject(p.details), variants: variantMap[p.id] || [], gallery: imageMap[p.id] || [] }));
          return jsonResponse({ products: result }, 200, env, request);
        }

        if (path === "/api/admin/products" && method === "POST") {
          const name = sanitize(body.name, 120), price = Math.max(0, parseInt(body.price) || 0), cp = Number.isFinite(Number(body.compare_price)) && Number(body.compare_price) > 0 ? Number(body.compare_price) : null, description = sanitize(body.description || "", 1000), tag = sanitize(body.tag || "", 20), category = sanitize(body.category || "tshirt", 30), images = Array.isArray(body.images) ? body.images.map(x => sanitize(x, 500)).filter(Boolean).slice(0, 5) : [], mainImage = images[0] || sanitize(body.image || "", 500);
          if (!name || !price || !mainImage) return jsonResponse({ error: "نام، قیمت و تصویر الزامی است" }, 400, env, request);
          const maxSo = await env.DB.prepare("SELECT MAX(sort_order) as m FROM products").first(), sortOrder = parseInt(body.sort_order) || (maxSo.m || 0) + 1, details = body.details && typeof body.details === "object" ? JSON.stringify(body.details).slice(0, 2000) : null;
          const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^\w\-آ-ی۰-۹]/g, "").slice(0, 50) + "-" + generateRandomHex(2);
          const result = await env.DB.prepare("INSERT INTO products (name, slug, price, compare_price, image, description, details, tag, category, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(name, slug, price, cp, mainImage, description, details, tag || null, category, sortOrder).run();
          const pid = result.meta.last_row_id, statements = [];
          for (let i = 1; i < images.length; i++) statements.push(env.DB.prepare("INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)").bind(pid, images[i], i));
          if (Array.isArray(body.variants)) for (const v of body.variants) { const col = sanitize(v.color, 40), sz = sanitize(v.size, 20), st = Math.max(0, parseInt(v.stock) || 0); if (col && sz) statements.push(env.DB.prepare("INSERT INTO variants (product_id, color, size, stock) VALUES (?, ?, ?, ?)").bind(pid, col, sz, st)); }
          if (statements.length) await env.DB.batch(statements);
          return jsonResponse({ ok: true, id: pid }, 200, env, request);
        }

        if (/^\/api\/admin\/products\/\d+$/.test(path) && method === "PATCH") {
          const pid = Number(path.split("/").pop()), u = [], bd = [], statements = [];
          if (body.name !== undefined) { u.push("name = ?"); bd.push(sanitize(body.name, 120)); }
          if (body.price !== undefined) { u.push("price = ?"); bd.push(Math.max(0, parseInt(body.price) || 0)); }
          if (body.compare_price !== undefined) { const cp = Number(body.compare_price); u.push("compare_price = ?"); bd.push(Number.isFinite(cp) && cp > 0 ? cp : null); }
          if (body.description !== undefined) { u.push("description = ?"); bd.push(sanitize(body.description, 1000)); }
          if (body.tag !== undefined) { u.push("tag = ?"); bd.push(sanitize(body.tag, 20) || null); }
          if (body.category !== undefined) { u.push("category = ?"); bd.push(sanitize(body.category, 30)); }
          if (body.image !== undefined) { u.push("image = ?"); bd.push(sanitize(body.image, 500)); }
          if (body.active !== undefined) { u.push("active = ?"); bd.push(body.active ? 1 : 0); }
          if (body.sort_order !== undefined) { u.push("sort_order = ?"); bd.push(parseInt(body.sort_order) || 0); }
          if (body.details !== undefined) { u.push("details = ?"); bd.push(body.details && typeof body.details === "object" ? JSON.stringify(body.details).slice(0, 2000) : null); }
          if (u.length) { bd.push(pid); statements.push(env.DB.prepare(`UPDATE products SET ${u.join(", ")} WHERE id = ?`).bind(...bd)); }
          if (Array.isArray(body.variants)) {
            const { results: existing } = await env.DB.prepare("SELECT id, color, size FROM variants WHERE product_id = ?").bind(pid).all(), existingMap = new Map();
            for (const v of existing) existingMap.set(`${v.color}|${v.size}`, v);
            const incomingKeys = new Set();
            for (const v of body.variants) {
              const col = sanitize(v.color, 40), sz = sanitize(v.size, 20), st = Math.max(0, parseInt(v.stock) || 0);
              if (!col || !sz) continue;
              const key = `${col}|${sz}`; incomingKeys.add(key);
              const ex = existingMap.get(key);
              if (ex) statements.push(env.DB.prepare("UPDATE variants SET stock = ? WHERE id = ?").bind(st, ex.id));
              else statements.push(env.DB.prepare("INSERT INTO variants (product_id, color, size, stock) VALUES (?, ?, ?, ?)").bind(pid, col, sz, st));
            }
            for (const [key, ex] of existingMap) if (!incomingKeys.has(key)) statements.push(env.DB.prepare("DELETE FROM variants WHERE id = ?").bind(ex.id));
          }
          if (statements.length) await env.DB.batch(statements);
          return jsonResponse({ ok: true }, 200, env, request);
        }

        if (/^\/api\/admin\/products\/\d+$/.test(path) && method === "DELETE") {
          const pid = Number(path.split("/").pop());
          await env.DB.batch([env.DB.prepare("DELETE FROM variants WHERE product_id = ?").bind(pid), env.DB.prepare("DELETE FROM product_images WHERE product_id = ?").bind(pid), env.DB.prepare("DELETE FROM product_reviews WHERE product_id = ?").bind(pid), env.DB.prepare("DELETE FROM stock_alerts WHERE product_id = ?").bind(pid), env.DB.prepare("DELETE FROM products WHERE id = ?").bind(pid)]);
          return jsonResponse({ ok: true }, 200, env, request);
        }

        if (/^\/api\/admin\/products\/\d+\/gallery$/.test(path) && method === "POST") {
          const pid = Number(path.split("/")[4]), iu = body.url;
          if (!iu) return jsonResponse({ error: "ناقص" }, 400, env, request);
          const m2 = await env.DB.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM product_images WHERE product_id = ?").bind(pid).first();
          await env.DB.prepare("INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)").bind(pid, sanitize(iu, 500), m2.m + 1).run();
          return jsonResponse({ ok: true }, 200, env, request);
        }

        if (/^\/api\/admin\/gallery\/\d+$/.test(path) && method === "DELETE") {
          await env.DB.prepare("DELETE FROM product_images WHERE id = ?").bind(Number(path.split("/").pop())).run();
          return jsonResponse({ ok: true }, 200, env, request);
        }

        if (path === "/api/admin/stats" && method === "GET") {
          const to = (await env.DB.prepare("SELECT COUNT(*) AS c FROM orders").first()).c, rv = (await env.DB.prepare("SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE status != 'cancelled'").first()).s, pd = (await env.DB.prepare("SELECT COUNT(*) AS c FROM orders WHERE status = 'pending'").first()).c, oldP = (await env.DB.prepare("SELECT COUNT(*) AS c FROM orders WHERE status = 'pending' AND created_at < datetime('now', '-1 hour')").first()).c, st = (await env.DB.prepare("SELECT COALESCE(SUM(stock),0) AS s FROM variants").first()).s, ls = (await env.DB.prepare("SELECT COUNT(*) AS c FROM variants WHERE stock <= 3").first()).c;
          const { results: sc } = await env.DB.prepare("SELECT date(created_at) AS d, COALESCE(SUM(total),0) AS total FROM orders WHERE created_at >= datetime('now', '-7 days') AND status != 'cancelled' GROUP BY d ORDER BY d").all();
          const ro = (await env.DB.prepare("SELECT order_no, name, total, status, created_at FROM orders ORDER BY id DESC LIMIT 5").all()).results;
          return jsonResponse({ totalOrders: to, revenue: rv, pending: pd, oldPending: oldP, stock: st, lowStock: ls, salesChart: sc, recentOrders: ro }, 200, env, request);
        }

        if (path === "/api/admin/orders" && method === "GET") {
          const s = url.searchParams.get("status"), q = sanitize(url.searchParams.get("q") || "", 50);
          let qy = `SELECT * FROM orders`, bd = [], wh = [];
          if (s && ORDER_STATUSES.includes(s)) { wh.push(`status = ?`); bd.push(s); }
          if (q) { wh.push(`(order_no LIKE ? OR name LIKE ? OR phone LIKE ?)`); bd.push(`%${q}%`, `%${q}%`, `%${q}%`); }
          if (wh.length) qy += ` WHERE ` + wh.join(" AND ");
          qy += ` ORDER BY id DESC LIMIT 200`;
          const { results: os } = await env.DB.prepare(qy).bind(...bd).all(), orderIds = os.map(o => o.id), orderNos = os.map(o => o.order_no);
          const its = orderIds.length ? (await env.DB.prepare(`SELECT * FROM order_items WHERE order_id IN (${orderIds.map(() => "?").join(",")})`).bind(...orderIds).all()).results : [], nts = orderIds.length ? (await env.DB.prepare(`SELECT * FROM order_notes WHERE order_id IN (${orderIds.map(() => "?").join(",")}) ORDER BY id DESC`).bind(...orderIds).all()).results : [], pys = orderNos.length ? (await env.DB.prepare(`SELECT * FROM payments WHERE order_no IN (${orderNos.map(() => "?").join(",")})`).bind(...orderNos).all()).results : [];
          const im = {}, nm = {}, pm = {};
          for (const i of its) (im[i.order_id] ||= []).push(i);
          for (const n of nts) (nm[n.order_id] ||= []).push(n);
          for (const x of pys) pm[x.order_no] = x;
          return jsonResponse({ orders: os.map(o => ({ ...o, items: im[o.id] || [], notes: nm[o.id] || [], payment: pm[o.order_no] || null })) }, 200, env, request);
        }

        if (path === "/api/admin/orders.csv" && method === "GET") {
          const { results: os } = await env.DB.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 5000").all(), es = s => { let str = String(s ?? ""); if (/^[=+\-@\t\r]/.test(str)) str = "'" + str; return `"${str.replace(/"/g, '""')}"`; }, ln = ["Order No,Name,Phone,City,Address,Status,Subtotal,Discount,Shipping,Total,Created At,Items"], { results: allItems } = await env.DB.prepare("SELECT order_id, name, color, size, qty FROM order_items").all(), im = {};
          for (const i of allItems) (im[i.order_id] ||= []).push(i);
          for (const o of os) { const its = im[o.id] || [], it = its.map(i => `${i.name}/${i.color}/${i.size} x${i.qty}`).join(" | "); ln.push([es(o.order_no), es(o.name), es(o.phone), es(o.city || ""), es(o.address || ""), es(o.status), o.subtotal, o.discount, o.shipping || 0, o.total, es(o.created_at), es(it)].join(",")); }
          return new Response("\uFEFF" + ln.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="orders-${Date.now()}.csv"`, ...securityHeaders, ...getCorsHeaders(request, env) } });
        }

        if (/^\/api\/admin\/orders\/[^/]+\/resend-tg$/.test(path) && method === "POST") {
          const on = decodeURIComponent(path.split("/")[4]), o = await env.DB.prepare("SELECT * FROM orders WHERE order_no = ?").bind(on).first();
          if (!o) return jsonResponse({ error: "یافت نشد" }, 404, env, request);
          const { results: its } = await env.DB.prepare("SELECT * FROM order_items WHERE order_id = ?").bind(o.id).all(), r = await sendTelegramMessage(env, generateTelegramOrderMessage({ ...o, orderNo: o.order_no, totalQty: its.reduce((s, i) => s + i.qty, 0), date: o.created_at }, its));
          return jsonResponse({ ok: r }, 200, env, request);
        }

        if (/^\/api\/admin\/orders\/[^/]+$/.test(path) && method === "PATCH") {
          const on = decodeURIComponent(path.split("/").pop()), { status, tracking_no } = body;
          const old = await env.DB.prepare("SELECT id, status FROM orders WHERE order_no = ?").bind(on).first();
          if (!old) return jsonResponse({ error: "یافت نشد" }, 404, env, request);
          const nextStatus = status === undefined ? old.status : status;
          if (!ORDER_STATUSES.includes(nextStatus)) return jsonResponse({ error: "نامعتبر" }, 400, env, request);
          if (!canTransitionOrderStatus(old.status, nextStatus)) {
            return jsonResponse({ error: `تغییر ${old.status} به ${nextStatus} مجاز نیست` }, 400, env, request);
          }
          if (tracking_no === undefined && nextStatus === old.status) {
            return jsonResponse({ error: "تغییری برای ذخیره وجود ندارد" }, 400, env, request);
          }

          const statements = [];
          const statusChanged = nextStatus !== old.status;
          if (statusChanged && ((old.status === "pending" && nextStatus === "confirmed") ||
              (nextStatus === "cancelled" && ["confirmed", "shipped", "delivered"].includes(old.status)))) {
            const { results: items } = await env.DB.prepare(
              "SELECT product_id, color, size, qty FROM order_items WHERE order_id = ?"
            ).bind(old.id).all();
            for (const item of items) {
              const stockSql = nextStatus === "confirmed"
                ? "UPDATE variants SET stock = MAX(0, stock - ?) WHERE product_id = ? AND color = ? AND size = ? AND EXISTS (SELECT 1 FROM orders WHERE order_no = ? AND status = ?)"
                : "UPDATE variants SET stock = stock + ? WHERE product_id = ? AND color = ? AND size = ? AND EXISTS (SELECT 1 FROM orders WHERE order_no = ? AND status = ?)";
              statements.push(env.DB.prepare(stockSql).bind(item.qty, item.product_id, item.color, item.size, on, old.status));
            }
          }
          statements.push(env.DB.prepare(
            "UPDATE orders SET status = ?, tracking_no = COALESCE(?, tracking_no), updated_at = datetime('now') WHERE order_no = ? AND status = ?"
          ).bind(nextStatus, tracking_no ? sanitize(tracking_no, 50) : null, on, old.status));

          const results = await env.DB.batch(statements);
          if (results[results.length - 1]?.meta?.changes === 0) {
            return jsonResponse({ error: "وضعیت سفارش هم‌زمان تغییر کرده است؛ فهرست را تازه‌سازی کنید" }, 409, env, request);
          }
          return jsonResponse({ ok: true }, 200, env, request);
        }

        if (/^\/api\/admin\/orders\/[^/]+\/notes$/.test(path) && method === "POST") {
          const on = decodeURIComponent(path.split("/")[4]), cl = sanitize(body.note, 500);
          if (!cl) return jsonResponse({ error: "ناقص" }, 400, env, request);
          const o = await env.DB.prepare("SELECT id FROM orders WHERE order_no = ?").bind(on).first();
          if (!o) return jsonResponse({ error: "یافت نشد" }, 404, env, request);
          await env.DB.prepare("INSERT INTO order_notes (order_id, note) VALUES (?, ?)").bind(o.id, cl).run();
          return jsonResponse({ ok: true }, 200, env, request);
        }

        if (/^\/api\/admin\/orders\/[^/]+$/.test(path) && method === "DELETE") {
          const on = decodeURIComponent(path.split("/").pop()), o = await env.DB.prepare("SELECT id, status FROM orders WHERE order_no = ?").bind(on).first();
          if (o) { if (["confirmed", "shipped", "delivered"].includes(o.status)) await applyStockChange(env, o.id, "increment"); await env.DB.batch([env.DB.prepare("DELETE FROM order_items WHERE order_id = ?").bind(o.id), env.DB.prepare("DELETE FROM order_notes WHERE order_id = ?").bind(o.id), env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(o.id), env.DB.prepare("DELETE FROM payments WHERE order_no = ?").bind(on)]); }
          return jsonResponse({ ok: true }, 200, env, request);
        }

        if (path === "/api/admin/stock" && method === "PATCH") {
          const delta = Number(body.delta);
          if (!Number.isFinite(delta) || Math.abs(delta) > 10000) return jsonResponse({ error: "نامعتبر" }, 400, env, request);
          await env.DB.prepare("UPDATE variants SET stock = MAX(0, stock + ?) WHERE product_id = ? AND color = ? AND size = ?").bind(delta, body.productId, body.color, body.size).run();
          return jsonResponse({ ok: true }, 200, env, request);
        }

        if (path === "/api/admin/low-stock" && method === "GET") {
          const { results } = await env.DB.prepare("SELECT v.*, p.name AS product_name FROM variants v JOIN products p ON p.id = v.product_id WHERE v.stock <= 3 ORDER BY v.stock ASC").all();
          return jsonResponse({ items: results }, 200, env, request);
        }

        if (path === "/api/admin/coupons" && method === "GET") {
          const { results } = await env.DB.prepare("SELECT * FROM coupons ORDER BY created_at DESC").all();
          return jsonResponse({ coupons: results }, 200, env, request);
        }

        if (path === "/api/admin/coupons" && method === "POST") {
          const c = sanitize(body.code, 30).toUpperCase().replace(/[^A-Z0-9]/g, ""), t = body.type === "fixed" ? "fixed" : "percent";
          let v = Math.max(1, parseInt(body.value) || 0);
          if (t === "percent") v = Math.min(100, v);
          const l = sanitize(body.label || "", 120), mu = body.max_uses ? Math.max(1, parseInt(body.max_uses)) : null, mt = body.min_total ? Math.max(0, parseInt(body.min_total)) : 0, ex = body.expires_at ? sanitize(body.expires_at, 30) : null;
          if (!c || !v) return jsonResponse({ error: "ناقص" }, 400, env, request);
          try { await env.DB.prepare("INSERT INTO coupons (code, type, value, label, max_uses, min_total, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(c, t, v, l, mu, mt, ex).run(); } 
          catch { return jsonResponse({ error: "تکراری" }, 400, env, request); }
          return jsonResponse({ ok: true }, 200, env, request);
        }

        if (/^\/api\/admin\/coupons\/[A-Z0-9]+$/.test(path) && method === "DELETE") {
          await env.DB.prepare("DELETE FROM coupons WHERE code = ?").bind(path.split("/").pop()).run();
          return jsonResponse({ ok: true }, 200, env, request);
        }

        if (/^\/api\/admin\/coupons\/[A-Z0-9]+$/.test(path) && method === "PATCH") {
          await env.DB.prepare("UPDATE coupons SET active = ? WHERE code = ?").bind(body.active ? 1 : 0, path.split("/").pop()).run();
          return jsonResponse({ ok: true }, 200, env, request);
        }

        if (path === "/api/admin/reviews" && method === "GET") {
          const { results } = await env.DB.prepare("SELECT r.*, p.name AS product_name FROM product_reviews r JOIN products p ON p.id = r.product_id ORDER BY r.id DESC LIMIT 200").all();
          return jsonResponse({ reviews: results }, 200, env, request);
        }

        if (/^\/api\/admin\/reviews\/\d+$/.test(path) && method === "PATCH") {
          const rid = Number(path.split("/").pop());
          await env.DB.prepare("UPDATE product_reviews SET approved = ? WHERE id = ?").bind(body.approved ? 1 : 0, rid).run();
          const rv = await env.DB.prepare("SELECT product_id FROM product_reviews WHERE id = ?").bind(rid).first();
          if (rv) await env.DB.prepare("UPDATE products SET rating_avg = (SELECT COALESCE(AVG(rating), 0) FROM product_reviews WHERE product_id = ? AND approved = 1), rating_count = (SELECT COUNT(*) FROM product_reviews WHERE product_id = ? AND approved = 1) WHERE id = ?").bind(rv.product_id, rv.product_id, rv.product_id).run();
          return jsonResponse({ ok: true }, 200, env, request);
        }

        if (/^\/api\/admin\/reviews\/\d+$/.test(path) && method === "DELETE") {
          await env.DB.prepare("DELETE FROM product_reviews WHERE id = ?").bind(Number(path.split("/").pop())).run();
          return jsonResponse({ ok: true }, 200, env, request);
        }

        if (path === "/api/admin/payments" && method === "GET") {
          const { results } = await env.DB.prepare("SELECT * FROM payments ORDER BY created_at DESC LIMIT 200").all();
          return jsonResponse({ payments: results }, 200, env, request);
        }

        if (path === "/api/admin/audit" && method === "GET") {
          const { results } = await env.DB.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT 100").all();
          return jsonResponse({ logs: results }, 200, env, request);
        }

        if (path === "/api/admin/telegram-test" && method === "POST") {
          const r = await sendTelegramMessage(env, "🧪 <b>تست</b>\n🕐 " + new Date().toLocaleString("fa-IR"));
          return jsonResponse({ ok: r }, 200, env, request);
        }
      }

      return jsonResponse({ error: "مسیر یافت نشد" }, 404, env, request);
    } catch (error) {
      console.error(error);
      if (error instanceof Response) return error;
      return jsonResponse({ error: "خطای داخلی سرور" }, 500, env, request);
    }
  }
};
