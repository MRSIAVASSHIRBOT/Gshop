import test from "node:test";
import assert from "node:assert/strict";
import worker, { aggregateOrderItems, generateOrderNumber, getCorsHeaders, getPublicImageHeaders, hashSessionToken, canTransitionOrderStatus, parseDigipayAccessToken, parseDigipayCallback, readBoundedRequestText, readBoundedText, readDigipayJsonResponse } from "../worker.js";

test("merges duplicate product variants before stock validation", () => {
  const result = aggregateOrderItems([
    { productId: 7, qty: 2, color: "مشکی", size: "L" },
    { productId: 7, qty: 3, color: "مشکی", size: "L" },
    { productId: 7, qty: 1, color: "سفید", size: "L" }
  ]);
  assert.deepEqual(result, [
    { productId: 7, qty: 5, color: "مشکی", size: "L", name: "" },
    { productId: 7, qty: 1, color: "سفید", size: "L", name: "" }
  ]);
});

test("rejects malformed lines and aggregate quantities above the per-variant cap", () => {
  assert.equal(aggregateOrderItems([{ productId: 1, qty: 0, color: "مشکی", size: "M" }]), null);
  assert.equal(aggregateOrderItems([{ productId: 1, qty: 12, color: "مشکی", size: "M" }, { productId: 1, qty: 9, color: "مشکی", size: "M" }]), null);
  assert.equal(aggregateOrderItems([{ productId: "1x", qty: 1, color: "مشکی", size: "M" }]), null);
  assert.equal(aggregateOrderItems([]), null);
});

test("blocks unconfigured cross-origin access", () => {
  const request = new Request("https://api.example.test/api/orders", { headers: { Origin: "https://attacker.example" } });
  assert.equal(getCorsHeaders(request, {})["Access-Control-Allow-Origin"], undefined);
});

test("allows same-origin access by default", () => {
  const request = new Request("https://shop.example.test/api/orders", { headers: { Origin: "https://shop.example.test" } });
  assert.equal(getCorsHeaders(request, {})["Access-Control-Allow-Origin"], "https://shop.example.test");
});

test("honors an explicit CORS allowlist", () => {
  const request = new Request("https://api.example.test/api/orders", { headers: { Origin: "https://shop.example.test" } });
  assert.equal(getCorsHeaders(request, { ALLOWED_ORIGINS: "https://shop.example.test" })["Access-Control-Allow-Origin"], "https://shop.example.test");
  assert.equal(getCorsHeaders(request, { ALLOWED_ORIGINS: "https://trusted.example" })["Access-Control-Allow-Origin"], undefined);
});

test("never treats a wildcard as a cross-origin CORS grant", () => {
  const crossOrigin = new Request("https://api.example.test/api/orders", {
    headers: { Origin: "https://attacker.example" }
  });
  assert.equal(getCorsHeaders(crossOrigin, { ALLOWED_ORIGINS: "*" })["Access-Control-Allow-Origin"], undefined);

  const sameOrigin = new Request("https://shop.example.test/api/orders", {
    headers: { Origin: "https://shop.example.test" }
  });
  assert.equal(getCorsHeaders(sameOrigin, { ALLOWED_ORIGINS: "*" })["Access-Control-Allow-Origin"], "https://shop.example.test");
});

test("parses Digipay access tokens without exposing provider error bodies", () => {
  assert.equal(parseDigipayAccessToken(JSON.stringify({ access_token: "valid-token" })), "valid-token");
  const marker = "provider-response-must-not-be-logged";
  assert.throws(() => parseDigipayAccessToken(`not-json-${marker}`), error => !error.message.includes(marker));
  assert.throws(() => parseDigipayAccessToken(JSON.stringify({ error_description: marker })), error => !error.message.includes(marker));
});


test("parses DigiPay callbacks using provider order ID, tracking code, amount, and payment type", () => {
  assert.deepEqual(parseDigipayCallback({
    providerId: "GS-ORDER-123",
    trackingCode: "19259313601650191846745",
    result: "SUCCESS",
    amount: "2500000",
    type: "0"
  }), {
    providerId: "GS-ORDER-123",
    trackingCode: "19259313601650191846745",
    result: "SUCCESS",
    amount: 2500000,
    type: 0
  });
  assert.equal(parseDigipayCallback({
    providerId: "GS-ORDER-123",
    trackingCode: "track",
    result: "success",
    amount: 2500000,
    type: 11
  }).result, "SUCCESS");
});

test("rejects incomplete or malformed DigiPay callback identifiers and amounts", () => {
  assert.equal(parseDigipayCallback({ trackingCode: "track", result: "SUCCESS", amount: 1000, type: 11 }), null);
  assert.equal(parseDigipayCallback({ providerId: "GS-1", result: "SUCCESS", amount: 1000, type: 11 }), null);
  assert.equal(parseDigipayCallback({ providerId: "GS-1", trackingCode: "track", result: "SUCCESS", amount: 0, type: 11 }), null);
  assert.equal(parseDigipayCallback({ providerId: "GS-1", trackingCode: "track", result: "SUCCESS", amount: 1000.5, type: 11 }), null);
  assert.equal(parseDigipayCallback({ providerId: "GS-1", trackingCode: "track", result: "SUCCESS", amount: 1000, type: 999 }), null);
});

test("bounds Digipay authentication response bodies", async () => {
  const response = new Response("x".repeat(64 * 1024 + 1));
  await assert.rejects(readBoundedText(response), /بیش از حد مجاز/);
});

test("sanitizes Digipay JSON API errors and bounds provider responses", async () => {
  const marker = "provider-private-error-marker";
  await assert.rejects(
    readDigipayJsonResponse(new Response(JSON.stringify({ error_description: marker }), { status: 502 })),
    error => !error.message.includes(marker)
  );
  await assert.rejects(
    readDigipayJsonResponse(new Response(`invalid-json-${marker}`)),
    error => !error.message.includes(marker)
  );
  const payload = await readDigipayJsonResponse(new Response(JSON.stringify({ result: { status: 0 } })));
  assert.deepEqual(payload, { result: { status: 0 } });
});

test("generates order references with 64 bits of random entropy", () => {
  const first = generateOrderNumber(123456789);
  assert.match(first, /^GS-23456789[A-F0-9]{16}$/);
  const generated = new Set(Array.from({ length: 100 }, () => generateOrderNumber(123456789)));
  assert.equal(generated.size, 100);
});


test("detects JPEG, PNG, GIF, and WebP by file signature", async () => {
  const { detectImageContentType } = await import("../worker.js");
  assert.equal(detectImageContentType(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(detectImageContentType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectImageContentType(new TextEncoder().encode("GIF89a")), "image/gif");
  assert.equal(detectImageContentType(new TextEncoder().encode("RIFF0000WEBP")), "image/webp");
});

test("rejects unsupported or truncated image signatures", async () => {
  const { detectImageContentType } = await import("../worker.js");
  assert.equal(detectImageContentType(new TextEncoder().encode("<html>not an image</html>")), null);
  assert.equal(detectImageContentType(Uint8Array.from([0xff, 0xd8])), null);
  assert.equal(detectImageContentType(new Uint8Array()), null);
});


function makeSessionDatabase(initialToken = null, initialExpiry = Date.now() + 60_000) {
  let storedToken = initialToken;
  let expiresAt = initialExpiry;
  return {
    prepare(sql) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async first() {
          if (sql.includes("SELECT * FROM sessions")) {
            return storedToken === values[0] && expiresAt > values[1]
              ? { token: storedToken, expires_at: expiresAt }
              : null;
          }
          return null;
        },
        async run() {
          if (sql.startsWith("INSERT INTO sessions")) {
            storedToken = values[0];
            expiresAt = values[5];
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith("UPDATE sessions SET token")) {
            if (storedToken === values[1]) {
              storedToken = values[0];
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }
          if (sql.startsWith("DELETE FROM sessions")) {
            if (storedToken === values[0] || storedToken === values[1]) {
              storedToken = null;
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }
          return { meta: { changes: 1 } };
        }
      };
    },
    getStoredToken() { return storedToken; }
  };
}

const testContext = { waitUntil(promise) { Promise.resolve(promise).catch(() => {}); } };

test("session tokens are stored as a domain-prefixed SHA-256 digest", async () => {
  assert.equal(
    await hashSessionToken("abc"),
    "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
  assert.notEqual(await hashSessionToken("abc"), "abc");
  await assert.rejects(hashSessionToken(""), TypeError);
  await assert.rejects(hashSessionToken("x".repeat(513)), TypeError);
});

test("admin login stores only a hash while raw token remains usable and logout revokes it", async () => {
  const DB = makeSessionDatabase();
  const env = { DB, ADMIN_USERNAME: "admin", ADMIN_PASSWORD: "correct-password" };
  const login = await worker.fetch(new Request("https://shop.example.test/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "correct-password" })
  }), env, testContext);
  assert.equal(login.status, 200);
  const { token } = await login.json();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(DB.getStoredToken(), await hashSessionToken(token));
  assert.notEqual(DB.getStoredToken(), token);

  const authorized = await worker.fetch(new Request("https://shop.example.test/api/admin/me", {
    headers: { "X-Admin-Token": token }
  }), env, testContext);
  assert.equal(authorized.status, 200);

  const logout = await worker.fetch(new Request("https://shop.example.test/api/admin/logout", {
    method: "POST",
    headers: { "X-Admin-Token": token }
  }), env, testContext);
  assert.equal(logout.status, 200);
  const revoked = await worker.fetch(new Request("https://shop.example.test/api/admin/me", {
    headers: { "X-Admin-Token": token }
  }), env, testContext);
  assert.equal(revoked.status, 401);
});

test("legacy plaintext admin sessions are upgraded without invalidating the token", async () => {
  const legacyToken = "a".repeat(64);
  const DB = makeSessionDatabase(legacyToken);
  const env = { DB };
  const first = await worker.fetch(new Request("https://shop.example.test/api/admin/me", {
    headers: { "X-Admin-Token": legacyToken }
  }), env, testContext);
  assert.equal(first.status, 200);
  assert.equal(DB.getStoredToken(), await hashSessionToken(legacyToken));

  const second = await worker.fetch(new Request("https://shop.example.test/api/admin/me", {
    headers: { "X-Admin-Token": legacyToken }
  }), env, testContext);
  assert.equal(second.status, 200);
});

test("JSON request bodies are bounded and malformed JSON is rejected", async () => {
  const valid = new Request("https://shop.example.test/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true })
  });
  assert.equal(await readBoundedRequestText(valid, 64), '{"ok":true}');

  const oversized = new Request("https://shop.example.test/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "x".repeat(128)
  });
  await assert.rejects(readBoundedRequestText(oversized, 32), error => error.status === 413);

  const malformed = await worker.fetch(new Request("https://shop.example.test/api/health", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{invalid"
  }), {}, testContext);
  assert.equal(malformed.status, 400);
});

test("multipart upload request bodies are not consumed by the global JSON parser", async () => {
  const form = new FormData();
  form.append("file", new Blob(["not-an-image"], { type: "image/png" }), "test.png");
  const request = new Request("https://shop.example.test/api/admin/upload", {
    method: "POST",
    headers: { "X-Admin-Token": "invalid-token" },
    body: form
  });
  const response = await worker.fetch(request, {
    DB: { prepare() { return { bind() { return this; }, async first() { return null; } }; } }
  }, testContext);
  assert.equal(response.status, 401);
  assert.equal(request.bodyUsed, false);
});

test("parses product details defensively when stored JSON is malformed", async () => {
  const { parseJsonObject } = await import("../worker.js");
  assert.deepEqual(parseJsonObject('{"material":"cotton"}'), { material: "cotton" });
  assert.deepEqual(parseJsonObject("{broken"), {});
  assert.deepEqual(parseJsonObject("[]"), {});
  assert.deepEqual(parseJsonObject(null), {});
});

test("public catalogue queries exclude inactive product variants and images", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(source, /INNER JOIN products p ON p\.id = v\.product_id WHERE p\.active = 1/);
  assert.match(source, /INNER JOIN products p ON p\.id = i\.product_id WHERE p\.active = 1/);
  assert.match(source, /Promise\.all\(\[\s*env\.DB\.prepare\("SELECT v\.product_id/);
});

test("order status transitions allow metadata-only updates but reject invalid jumps", async () => {
  assert.equal(canTransitionOrderStatus("shipped", "shipped"), true);
  assert.equal(canTransitionOrderStatus("confirmed", "confirmed"), true);
  assert.equal(canTransitionOrderStatus("pending", "confirmed"), true);
  assert.equal(canTransitionOrderStatus("pending", "delivered"), false);
  assert.equal(canTransitionOrderStatus("delivered", "cancelled"), false);
  assert.equal(canTransitionOrderStatus("cancelled", "pending"), false);
});

test("tracking numbers can be updated without an order status transition", async () => {
  const token = "b".repeat(64);
  const tokenHash = await hashSessionToken(token);
  let batchedSql = [];
  const preparedSql = [];
  const DB = {
    prepare(sql) {
      preparedSql.push(sql);
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async first() {
          if (sql.includes("SELECT * FROM sessions")) return { token: tokenHash, expires_at: Date.now() + 60_000 };
          if (sql.includes("SELECT id, status FROM orders")) return { id: 7, status: "shipped" };
          return null;
        },
        async all() { return { results: [] }; }
      };
    },
    async batch(statements) {
      batchedSql = preparedSql.slice(-statements.length);
      return statements.map(() => ({ meta: { changes: 1 } }));
    }
  };
  const response = await worker.fetch(new Request("https://shop.example.test/api/admin/orders/GS-TEST", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Token": token },
    body: JSON.stringify({ status: "shipped", tracking_no: "1234567890" })
  }), { DB }, testContext);
  assert.equal(response.status, 200);
  assert.equal(batchedSql.length, 1);
  assert.match(batchedSql[0], /^UPDATE orders SET status/);
});

test("admin order CSV reads only items belonging to the exported latest orders", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(source, /FROM order_items oi INNER JOIN orders o ON o\.id = oi\.order_id WHERE o\.id IN \(SELECT id FROM orders ORDER BY id DESC LIMIT 5000\)/);
});


test("public image responses permit cross-origin embedding without relaxing API defaults", () => {
  const headers = getPublicImageHeaders("image/jpeg", 12345);
  assert.equal(headers["Cross-Origin-Resource-Policy"], "cross-origin");
  assert.equal(headers["Access-Control-Allow-Origin"], "*");
  assert.equal(headers["Content-Type"], "image/jpeg");
  assert.equal(headers["Content-Length"], "12345");
  assert.equal(headers["Cache-Control"], "public, max-age=31536000, immutable");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");

  const apiRequest = new Request("https://api.example.test/api/orders");
  assert.equal(getCorsHeaders(apiRequest, {})["Access-Control-Allow-Origin"], undefined);
});
