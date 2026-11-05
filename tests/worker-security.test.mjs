import test from "node:test";
import assert from "node:assert/strict";
import { aggregateOrderItems, getCorsHeaders } from "../worker.js";

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
