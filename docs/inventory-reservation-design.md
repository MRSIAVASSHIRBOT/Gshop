# G_SHOP — Atomic Inventory Reservation Design

**Status:** Proposed design; not implemented or approved for production  
**Date:** 2026-11-13  
**Tracking:** [Issue #21 — reserve variant stock atomically](https://github.com/MRSIAVASSHIRBOT/Gshop/issues/21)  
**Baseline:** `main` at `16780cad982c3ce90a38030fa9561e268258e439`

## 1. Problem confirmed in current main

The checkout handler reads `variants.stock` and checks availability before inserting a pending order. It does not reserve stock at that point. Stock is decremented later when a payment callback confirms the order (or when a zero-total order is immediately confirmed).

The current decrement helper uses `MAX(0, stock - ?)`. That avoids negative values but hides an oversell: two pending orders can both pass the initial read against the final unit, then both become confirmed while the later decrement is clamped to zero.

The same inventory invariant is spread across several paths:

- Checkout and zero-total order confirmation.
- Zibal and DigiPay verification callbacks.
- Admin `pending → confirmed` and cancellation transitions.
- Admin order deletion, which currently restores stock for confirmed, shipped, and delivered orders.
- Manual stock adjustment. PR #22 has already hardened this endpoint with strict numeric validation and conditional decrements; that improvement is on main and must be preserved.

The current DigiPay path also correctly avoids treating an unverified negative callback as proof of a terminal provider failure. That behavior must remain intact.

## 2. Design goals and invariants

1. **Available stock is authoritative.** A successful reservation reduces sellable stock exactly once. A pending payment must never leave the same unit available to another checkout.
2. **All-or-nothing order reservation.** Every variant in a multi-variant order is reserved, or none is.
3. **One-way state transitions.** A reservation may move from `reserved` to exactly one terminal state: `committed`, `released`, or `expired`. Terminal states never transition back to `reserved`.
4. **Idempotent callbacks.** Duplicate, reordered, and late provider callbacks cannot double-decrement or double-release inventory.
5. **Payment is not inventory.** Provider verification happens outside the D1 transaction. The verified result is then reconciled with the reservation state inside a short D1 transaction.
6. **Admin paths use the same ledger.** Admin confirmation, cancellation, deletion, and manual stock changes must not bypass reservation state.
7. **No silent clamping.** Insufficient stock is an explicit conflict, not a successful update to zero.
8. **Auditable history.** Reservation, release, commit, restock, and manual adjustment records remain available for reconciliation.

## 3. Proposed data model

The following is a logical proposal, not a migration script. Exact names and foreign keys must be reconciled with the live schema before implementation.

### `inventory_reservations`

- `id` — opaque reservation identifier.
- `order_id` — foreign key to the existing order.
- `state` — `reserved | committed | released | expired | restocked`.
- `expires_at` — UTC expiry time.
- `created_at`, `updated_at`.
- Optional transition metadata: `committed_at`, `released_at`, `expired_at`, `restocked_at`, and a bounded reason code.

Enforce one reservation header per order. Do not store provider secrets or raw callback payloads here.

### `inventory_reservation_items`

- `reservation_id` — foreign key to the reservation header.
- `variant_id` — foreign key to the existing variant row.
- `qty` — positive integer.
- Unique `(reservation_id, variant_id)`.

Keep the original order item and price snapshot. Reservation rows represent inventory ownership, not a replacement for order history.

### Optional inventory event ledger

A separate append-only ledger can record `reserved`, `committed`, `released`, `expired`, `restocked`, and `manual_adjustment` events with a unique idempotency key, order/reservation reference, variant, quantity, actor type, reason code, and timestamp. Do not record customer contact details or payment credentials in this ledger.

## 4. Reservation lifecycle

```text
checkout
  └─ atomic reserve all variants
       ├─ insufficient/missing variant → no reservation; return 409
       └─ reserved
            ├─ provider verified success before expiry → committed
            ├─ provider-confirmed terminal failure → released
            ├─ customer cancellation before commit → released
            └─ expiry worker → expired

late verified success after release/expiry
  └─ payment_review (never auto-confirm or silently re-reserve)
```

### Reserve

1. Validate and aggregate duplicate cart lines before touching stock.
2. Re-read authoritative product and variant prices and validate the full order.
3. Create the order, reservation header, and reservation items using a single D1 transaction.
4. Decrement each variant's available stock as part of the reservation-item insert.
5. If any variant is missing or insufficient, abort the whole transaction and return a conflict. Do not leave an order with only some variants reserved.

**Important D1 detail:** Cloudflare documents that `D1Database.batch()` executes statements sequentially inside one SQL transaction and rolls back the batch when a statement errors. A conditional `UPDATE` that affects zero rows is not itself a SQL error. Therefore, a batch of independent `UPDATE ... WHERE stock >= ?` statements is not sufficient by itself: the implementation must use a database-enforced guard (for example, a validated trigger using `RAISE(ABORT, ...)`, or an equivalent single-statement all-lines precondition) so one insufficient line aborts the entire reservation. Do not rely on `MAX(0, ...)` or assume a zero-row update rolls back a batch.

### Payment request and verification

- Create the provider session only after the reservation commits.
- Keep provider HTTP calls outside D1 transactions.
- If provider-session creation fails, release the reservation through the same conditional state transition used by cancellation.
- A negative callback that has not been verified with the provider must not release stock or mark the payment terminal. Preserve the current DigiPay protection.
- After provider-side success and amount/order validation, atomically mark the payment verified, transition the still-valid reservation to `committed`, and confirm the order.
- If the reservation is already `released` or `expired`, do not fulfill the order. Record a `payment_review` state for an explicit refund/manual-review path. Never automatically take stock from a later customer to satisfy a late payment.

### Release and expiry

- Release only with a compare-and-set transition from `reserved`.
- Restore stock only when that transition actually occurs. A database trigger tied to the old/new reservation state is one option because duplicate updates cannot satisfy `OLD.state = 'reserved'` twice.
- Expiry must be a real, observable process. The current `gahop` Worker has no Cron schedule in the inspected configuration; adding a schedule is a separate infrastructure change and requires approval.
- The reservation TTL must be chosen after confirming the payment providers' checkout-session lifetime and the desired customer experience. Do not hard-code an arbitrary expiry during implementation.

### Zero-total orders

Zero-total orders use the same reserve-all operation and then commit the reservation in the same transaction. They must not use a separate decrement path.

## 5. Admin and manual inventory rules

- Admin `pending → confirmed` must require a valid reservation; it must not decrement stock independently.
- Cancelling a still-reserved pending order releases that reservation once.
- A committed order must not be restocked merely because its status changes. Restock requires an explicit, auditable transition after confirming that the goods are physically available.
- Cancelling a shipped or delivered order must not automatically increase stock. A return/inspection workflow is needed before restock.
- Hard-deleting an order with payment or reservation history must be rejected. Use an archive/soft-delete approach so the financial and inventory ledger remains reconcilable.
- Preserve PR #22's strict input validation and conditional manual decrement. Add an audit event for every manual adjustment, including actor, reason, variant, and delta.

## 6. D1 transaction boundaries

Use short D1 batches for database-only state transitions. Never hold a transaction open across a payment-provider HTTP request.

Expected atomic groups:

1. **Checkout:** order + order items + reservation header/items + all stock decrements.
2. **Payment success:** payment verification state + reservation commit + order confirmation, guarded by the same order/reservation identifiers.
3. **Payment failure/cancellation:** terminal payment state (only after provider confirmation where required) + reservation release + stock restoration.
4. **Expiry:** reservation expiry + stock restoration + order/payment reconciliation.
5. **Admin action:** reservation transition + order transition + audit event.

All state-changing statements must use explicit prior-state predicates. A batch result with zero affected rows is a conflict/idempotent no-op that must be interpreted deliberately; it is not proof that the full business transition succeeded.

## 7. Required acceptance tests

Use a D1-compatible integration harness, not only a mock that records SQL strings.

- Two concurrent checkouts competing for the final unit: exactly one reservation succeeds.
- Multi-variant checkout with one unavailable variant: the entire reservation rolls back and all other variant stock remains unchanged.
- Duplicate payment-success callback: one commit, one confirmation, no second stock decrement.
- Duplicate failure, cancellation, and expiry: one release and one stock restoration.
- Payment-session creation failure: release once.
- Late provider success after expiry: order enters `payment_review`; no fulfillment and no automatic re-reservation.
- Zero-total order: reserve and commit with the same invariant.
- Admin confirmation cannot bypass a reservation or decrement stock twice.
- Cancellation of a committed but unshipped order follows an explicit restock decision; shipped/delivered cancellation never silently restocks.
- Order deletion cannot erase reservation/payment history or restore stock twice.
- Manual adjustment rejects malformed values, missing variants, and insufficient stock; successful changes produce an audit record.

## 8. Implementation sequence and gates

1. Confirm the existing D1 schema, foreign keys, unique constraints, and deployment/migration convention. The current repository tree has no dedicated migration directory or visible schema deployment harness; establish the canonical approach before adding schema files.
2. Add versioned schema changes and a D1-compatible test harness. Validate rollback, triggers/guards, foreign keys, and concurrent reservations in an isolated database.
3. Implement the reservation service and checkout path.
4. Integrate Zibal and DigiPay callbacks, including duplicate and late-callback handling.
5. Reconcile admin status transitions, deletion/archive behavior, manual stock adjustments, and the admin UI.
6. Add an expiry handler and observability. Review the proposed Cron cadence and D1 usage before any Worker configuration change.
7. Run exact-head CI and a production-like Preview acceptance suite. Production D1 migration and Worker deployment remain separate, explicit approval gates.

## 9. Scope and non-goals

This document changes no Worker code, D1 schema/data, payment configuration, Cron schedule, Cloudflare route, or production deployment. It does not choose a reservation TTL, payment refund policy, or production rollout time. Those decisions require verified provider constraints and owner review.

## References

- [Cloudflare D1 database API — batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Cloudflare D1 — finding expensive queries and batching](https://developers.cloudflare.com/d1/observability/find-expensive-queries/)
- [Gshop Issue #21](https://github.com/MRSIAVASSHIRBOT/Gshop/issues/21)
