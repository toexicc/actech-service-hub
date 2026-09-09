# Official Receipt + Warranty Card from POS

Two new documents, styled like the existing Client Intake Form and Service Quotation Form, generated when a payment is recorded and viewable by the client on the tracking page.

## 1. Official Receipt

Generated (and re-generated) every time a payment is recorded — from the POS page and from the payment window on Manage Client. One running receipt per ticket, always reflecting the latest state.

Contents:
- Letterhead, ticket number, and a "Scan to track" QR pointing to the public tracking link
- Received by / date, customer block (name, phone, email, address), device block (type, brand, model, colour, storage, serial)
- Products and services table: only the client-approved lines, each with its amount (chosen option shown for lines with options). Unapproved lines are not printed.
- Totals: subtotal of approved lines, discount, rush fee, VAT when requested, Final Cost
- Payments list: date, method, payment type, amount for each recorded payment (voided and zero rows excluded, refunds subtracted)
- Amount paid and BALANCE DUE
- Footer policy notes and a customer signature line

## 2. Warranty Card (A5)

A toggle in the payment window, on by default, only acts when the payment clears the balance to zero. If a balance remains, the card is skipped and staff are told why.

Contents:
- Letterhead and ticket number, client information block
- Each approved service line with its amount and a warranty term
- Warranty term is chosen per line: 1 month, 30 days, 45 days, 6 months, or free text
- Coverage notes, released date, and a signature line captioned with the staff member who processed the payment
- Regenerating replaces the previous card

Warranty terms are remembered on the ticket, so a later regeneration keeps the same terms.

## 3. Tracking page

The Documents section gains "Official Receipt" and "Warranty Card" entries, each shown only when that document actually exists for the ticket, opened in the same PDF viewer as the other forms. Downloads are named `{date} {name} - {ticket} - OR.pdf` and `- WC.pdf`.

## Technical notes

- Database: add `receipt` and `warranty` to the `service_file_kind` enum; add `services.warranty_terms jsonb default '{}'` holding a line-name to term map. New private buckets `receipts` and `warranty-cards` with the same `storage.objects` policies as `quotation-forms`.
- `src/lib/receiptPdfGenerator.ts` (Letter) and `src/lib/warrantyCardGenerator.ts` (A5) built on `pdfPremiumKit` primitives so both match the intake/quotation aesthetic. Receipt QR via a small canvas-based encoder (add `qrcode` dependency) rendered as a PNG data URL.
- Approved lines come from `normalizeQuotedBreakdown` / `lineEffectiveCost` in `serviceApproval.ts` (same source the quotation PDF uses). Totals reuse `computeFinalCost` and `vatAmount`; payments reuse `summarizePayments` / `derivePaymentTotals` so figures agree with `/track` and POS.
- `servicePdfStorage.ts`: extend `ServicePdfKind` and `BUCKETS` with the two kinds, plus `OR`/`WC` suffixes in `servicePdfDownloadName`.
- New `src/lib/posDocuments.ts` with `regenerateTicketDocuments({ serviceId, actorName, warrantyTerms, createWarranty })`: fetches the service row, builds both PDFs, uploads via `uploadServicePdf`, and logs activity. Called after a successful payment insert in `TicketPaymentModal.tsx` and `PointOfSales.tsx` (non-blocking, toast on failure only).
- `TicketPaymentModal.tsx` and the POS form get a "Create warranty card" switch plus a per-approved-line warranty term row (select with a free-text option), pre-filled from `warranty_terms`.
- Edge function `get-service-pdf`: add the two buckets to its map, and a `kinds` query mode returning which document kinds exist so `/track` renders only available rows. `ServiceTracking.tsx` widens `openPdf`'s kind union and adds the two document rows behind that availability check.
