import test from "node:test";
import assert from "node:assert/strict";
import { aggregateOrderItems, generateOrderNumber, getCorsHeaders, parseDigipayAccessToken, readBoundedText } from "../worker.js";

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

test("bounds Digipay authentication response bodies", async () => {
  const response = new Response("x".repeat(64 * 1024 + 1));
  await assert.rejects(readBoundedText(response), /بیش از حد مجاز/);
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
