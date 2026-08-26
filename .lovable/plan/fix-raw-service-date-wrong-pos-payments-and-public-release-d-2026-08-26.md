# Fix raw service date, wrong POS payments, and public release duplicate queue

## 1. Service Date shows a raw timestamp on /service-update

Service Update formats the date with its own parser and, when that parser can't read the value, prints the raw stored text (`2026-07-31T06:50:24.932045+00:00`). Manage Client uses the shared date helper, which always formats correctly.

Fix: make Service Update use the same shared display helper and format as Manage Client (`MMM dd, yyyy, hh:mm a`), with a blank value instead of a raw string when there's no date.

## 2. "Previous Payments Php 18,085.00" when only one payment exists

Verified for ticket AC220826051 — the ledger holds exactly two rows:

- Parts Inventory purchase, Php 4,500.00 (a shop expense, not a client payment)
- Full Payment, Php 13,585.00 (the payment just recorded)

The POS "Previous Payments" figure comes from a backend helper that sums **every** transaction attached to the ticket, only skipping refunds. So it added the Php 4,500 parts purchase to the Php 13,585 payment already recorded = Php 18,085.

Fix: restrict that total to actual client payment types (payment / deposit / down payment / balance / installment), subtract refunds, and ignore voided rows — the same rule the ticket Charges panel already uses. Parts purchases and other expense rows will no longer count as client money received.

Effect after the fix: on this ticket POS shows Previous Payments Php 13,585.00 (the recorded payment) and Remaining Balance Php 0.00; before that payment existed it would have shown Php 0.00.

## 3. Public release duplicate key on AC240826017

Verified AC240826017 already has an active release queue entry:

- `Q-0940`, release queue, status `waiting`, created Aug 26, 2026
- It also has its older intake queue entry `Q-0829`, already completed

The database has a unique guard that allows only one active release queue row per Service ID. That is correct, but the public release page currently always tries to create a new row when the customer confirms. If the same ticket was already added to the release queue, the insert hits the unique guard and the customer sees a duplicate-key error.

Fix: make the public release flow idempotent. Before creating a release queue row, it should reuse the existing active release row for the same Service ID and show the existing queue number. If a duplicate happens because two submits race at the same time, catch it and show the existing queue number instead of an error.

Because older active queue rows may be blocked from anonymous reads by the public queue read policy, the safer implementation is a small backend function/RPC that performs "find existing active release queue entry, otherwise create one" as one server-side action.

## Technical notes

- `src/pages/ServiceUpdate.tsx` (~line 1429): replace the inline `parseServiceTimestamp` + raw fallback with `displayDate(serviceData.timestamp, "MMM dd, yyyy, hh:mm a")`.
- `supabase/functions/sheets-bridge/index.ts` `getServicePayments`: replace `type !== "Refund"` sum with the payment/refund type predicates from `src/hooks/useServicePayments.ts`, and exclude rows whose status is voided/cancelled.
- Add a database RPC for public release queue submission that returns `{ id, display_code, status }`, reusing active `waiting` / `proceed` rows and inserting only when none exists.
- Update `src/pages/PublicRelease.tsx` to call that RPC instead of directly inserting into `queue_entries`.
- No data cleanup is needed for AC240826017; it already has the active release queue number `Q-0940`.
