# Gshop D1 schema baseline

**Observed:** 2026-11-16  
**Database:** Cloudflare D1 `gshop-db`  
**Repository baseline:** `main` at `210ff83a3495185c1a42e20cbe1f9d591c91d062`  
**Purpose:** Record the deployed schema metadata needed before implementing the inventory-reservation lifecycle in [Issue #21](https://github.com/MRSIAVASSHIRBOT/Gshop/issues/21).

## Inspection method and safety

The schema was inspected through a read-only Cloudflare D1 query against SQLite metadata:

```sql
SELECT type, name, tbl_name, sql
FROM sqlite_master
WHERE type IN ('table', 'index', 'trigger')
ORDER BY type, name;
```

No customer, order, payment, session, or other application rows were queried. The query reported `rows_written = 0` and `changed_db = false`. Cloudflare's database metadata reported 15 application tables. The SQLite metadata listing also included the platform/system tables `_cf_KV` and `sqlite_sequence`.

This document is an observed production-schema snapshot, not a canonical schema source or an approved migration.

## Application tables observed

| Table | Relevant structure / constraints |
|---|---|
| `audit_log` | Append-style audit records; `id` primary key |
| `content` | `key` primary key |
| `coupons` | `code` primary key; active/uses/expiry fields |
| `order_items` | `order_id`, `product_id`, variant identity, `qty`, price snapshot; no declared FK |
| `order_notes` | `order_id`, note and timestamp; no declared FK |
| `orders` | `id` primary key; `order_no` unique; status and totals |
| `payments` | `track_id` primary key; `order_no`, amount and provider status; no declared FK |
| `product_images` | `product_id` and image metadata; no declared FK |
| `product_reviews` | `product_id` and review data; no declared FK |
| `products` | `id` primary key; `slug` unique |
| `sessions` | `token` primary key; username, expiry and activity timestamps |
| `settings` | `key` primary key |
| `stock_alerts` | `id` primary key; unique composite index on product/color/size/phone |
| `subscribers` | `email` primary key |
| `variants` | `id` primary key; unique composite `(product_id, color, size)`; stock and extra price |

## Explicit indexes observed

- `idx_items_order` on `order_items(order_id)`.
- `idx_orders_status` on `orders(status)`.
- `idx_stock_alerts_unique` unique on `stock_alerts(product_id, color, size, phone)`.
- `idx_variants_product` on `variants(product_id)`.

SQLite auto-indexes also exist for the primary/unique constraints listed above.

## Integrity findings

1. **No declared foreign keys were present** in the observed table definitions. In particular, `order_items.order_id`, `order_notes.order_id`, `payments.order_no`, and `variants.product_id` are not protected by declared references in this snapshot.
2. **No triggers were present** in the metadata listing.
3. **No migration-history/version table was present** in the observed application schema. The repository also has no existing versioned migration directory or checked-in schema bootstrap.
4. The database has no database-enforced reservation ledger today. The current worker still checks stock before creating a pending order and decrements it later; the documented oversell race in Issue #21 remains unresolved.
5. The existing `variants(product_id, color, size)` unique constraint is useful for identifying a reservation item, but it does not by itself provide an all-or-nothing multi-variant reservation.

## Consequences for Issue #21

Before implementing reservations:

- Establish and test a canonical migration/bootstrap convention against an isolated D1-compatible database.
- Decide how the existing production schema is baselined; do not assume a new migration runner can safely start at version 1 against an already-populated database.
- Design reservation tables and state-transition guards against the observed keys and missing foreign-key constraints.
- Verify existing orphan/reference integrity before adding any foreign keys; this snapshot did not inspect application rows.
- Ensure the multi-line reservation transaction fails as a whole when any variant cannot be reserved. A conditional update affecting zero rows must be treated as a conflict, not assumed to roll back a D1 batch.
- Keep provider calls outside D1 transactions and make commit/release/expiry transitions idempotent.
- Do not choose a reservation TTL until provider checkout-session lifetimes and the desired customer experience are verified.

## Explicitly not performed

- No D1 application rows were read or changed.
- No migration or schema mutation was run.
- No Worker code, Cron schedule, payment binding, route, DNS, or Production deployment was changed.
- No production configuration was altered.

**Status:** Evidence captured; implementation remains gated on migration strategy, provider expiry/TTL decision, and isolated concurrency/idempotency tests.
