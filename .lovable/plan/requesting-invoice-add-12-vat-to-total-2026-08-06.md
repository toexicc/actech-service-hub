# Requesting Invoice (add 12% VAT to total)

## What changes

### /manage-client
- New checkbox below the Discount field: **Requesting Invoice (Add VAT to Total Cost)**.
- When ticked, a line right under the checkbox shows the computed VAT: `VAT (12%): Php X.XX`.
- Final Cost becomes `(Service Cost - Discount) x 1.12`. Unticked keeps today's `Service Cost - Discount`.
- The checkbox state is saved with the ticket on Update, so it persists and is visible to anyone reopening the ticket.
- The Charges panel on the ticket shows a `VAT (12%)` row between Discount and Final Cost whenever VAT is requested.

### Service Quotation Form (PDF)
- Adds a `VAT (12%):` money row after `Discount:` and before `Total Cost:` when the ticket requests an invoice; the green Total Cost stays the VAT-inclusive final amount. Nothing is added when the box is unticked.

### /track (client-facing)
- The charges/summary shown to the client gains the same `VAT (12%)` row so the total is transparent.
- The approval checklist totals also reflect VAT: when the client approves lines, the recalculated total shown and stored is VAT-inclusive if the ticket requests an invoice.

## Technical notes

- New column `vat_requested boolean not null default false` on `public.services` (migration).
- Rounding: VAT computed as `round((serviceCost - discount) * 0.12, 2)`; final cost = `net + vat`. One shared helper (in `src/lib/serviceApproval.ts`) used by /manage-client, the quotation PDF payload, /track and the `submit-client-approval` edge function so client and server totals cannot drift.
- `submit-client-approval` recost path (`final_cost = total - discount`) updated to add VAT when `vat_requested` is true.
- `serviceRecordShape.ts` / `useServices.ts` map the new field so it flows into the PDF generators and the tracker.
- POS balance math already derives from `final_cost`, so payments/balance pick up VAT with no extra change.
