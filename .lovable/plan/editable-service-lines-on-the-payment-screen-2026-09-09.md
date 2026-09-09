# Editable service lines on the payment screen

Before recording a payment, staff see the ticket's service lines with their prices and can correct them on the spot. Corrections are saved onto the ticket itself, the total and balance update immediately, and the warranty options follow the corrected list.

## What staff will see

On the sales page and in the payment window on Manage Client, a "Service lines" block appears once a ticket is loaded:

- One row per quoted line: a tick (included / not included), the service name, and an editable amount. Lines with options show the chosen option's name and its amount.
- Buttons to add a line (name + amount) and to remove a line.
- Live totals under the list: services subtotal, discount, rush fee, VAT when requested, Final Cost, already paid, and remaining balance — all refreshing as prices change.
- A short note that changes are saved to the ticket when the payment is recorded.
- Available to both admin and management.

## How it carries over

- On saving the payment, the corrected lines replace the ticket's service lines, and the ticket's service cost and final cost are recalculated (discount, 10% rush fee when the rush toggle is on, 12% VAT when an invoice is requested). The bundle rule stays: if any line is left out, the discount is waived.
- The service summary text on the ticket is refreshed from the included line names.
- Every change is written to the ticket's activity log (line added, removed, renamed, price changed, old and new final cost) with the staff member's name.
- The receipt is generated from these same corrected lines, so it always matches.
- The warranty block on the same screen rebuilds its rows from the edited list: a newly added line immediately gets a warranty term row, a removed line disappears, and a renamed line carries its term across. Terms already saved on the ticket are kept.

## Guardrails

- A ticket the client has already approved shows a small warning that editing changes what was approved; the edit is still allowed since staff asked for it.
- Blank names are rejected; amounts below zero are rejected; at least one included line is required before a payment is recorded.
- Manual (no ticket) payments and non-service transaction types do not show the block.

## Technical notes

- New `src/components/ServiceLinesEditor.tsx`: controlled editor over `QuotedLine[]` from `serviceApproval.ts`, using `lineEffectiveCost`, `lineDisplayName`, `effectiveDiscount`, `rushAmount`, `vatAmount`, `computeFinalCost` for the live totals. Option lines edit the chosen option's cost, leaving other variants untouched.
- New helper in `src/lib/posDocuments.ts` (or a small `posServiceLines.ts`): `saveTicketServiceLines({ serviceId, lines, actorName })` — normalizes lines, writes `quoted_breakdown`, `service_cost`, `final_cost`, `service`, plus `approved_services`/`pending_services` re-derivation, and logs via `logActivityAsync`. Called before the transaction insert so balance gating and `completeServiceIfFullyPaid` see the new final cost.
- `TicketPaymentModal.tsx`: hold `lines` state seeded from the ticket's `quoted_breakdown` (extend `fetchTicketDocumentContext` to return the raw lines), render the editor above the amount field, derive `approvedLines` for `WarrantyCardFields` from that state instead of the fetched snapshot, and recompute `fullyPaidAfter` from the edited final cost.
- `PointOfSales.tsx`: same wiring for the ticket-backed payment types; keep `serviceData.finalCost` in sync with the editor so the existing balance display and credit handling stay correct.
- Warranty term keys are line display names; on rename, move the stored term to the new key so `regenerateTicketDocuments` reproduces the same card.
- `regenerateTicketDocuments` needs no change — it re-reads the ticket after the save, so receipt and warranty card pick up the corrections.
