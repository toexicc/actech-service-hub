# Quotation options indent, PDF preview hang, approval-synced quotation

## 1. Indent option lines in the Service Quotation Form

The quotation's Service Breakdown panel is built by parsing the AI diagnosis text, and every parsed row is drawn the same way — bullet dot, flush-left label, right-aligned amount. That is why `Option A - OEM` and `Option B - Original` sit at the same indent as `Screen Replacement`.

Changes:

- Mark rows that begin with `Option <letter/number> - <label>` as option rows while parsing.
- Draw option rows indented (about 6 mm from the service name), with a small dash instead of the accent bullet, slightly smaller/lighter label text, and the amount still right-aligned so the price column stays even.
- A parent service that has options and no amount of its own no longer shows a dangling amount slot; the dotted separator is only drawn between top-level services, not between a service and its options.
- When one option is already chosen (after approval), the chosen row is marked as selected and the others are shown muted.

## 2. Drop the "Loading PDF" wording in the preview modal

The image rendering already works for both the Client Intake Form and the Service Quotation Form — only the placeholder wording is wrong, since it says "Loading PDF..." while the page image is being prepared.

Changes:

- Replace the "Loading PDF..." text with a neutral spinner-only placeholder (no "PDF" wording) while the first page image is being prepared.
- Replace the "Rendering remaining pages..." footer text with the same quiet spinner, so nothing in the modal talks about loading a PDF.
- Keep the failure fallback (Open in new tab / Download) unchanged.

## 3. Quotation form auto-reflects the client's approval

Today the quotation PDF is a snapshot from the moment staff generated it. When the client approves only some services, or picks OEM vs Original, the stored PDF still shows the original list, so staff and the client see stale pricing.

Changes:

- After a client submits an approval, the quotation is regenerated from the finalized lines: approved services listed with their chosen option (e.g. `Battery Replacement (OEM)`), unapproved lines shown as `Not approved` and excluded from the total, and the total/discount/final cost taken from the approved lines only.
- The regenerated file replaces the stored quotation, so `/manage-client`, `/service-update` and the client's `/track` view all open the same up-to-date form with the same filename convention.
- The panel gets a "Client-approved quotation" stamp with the approval date and the client name, so the document is clearly the post-approval version.
- Regeneration is triggered whenever a staff page loads a ticket whose approval is newer than the stored quotation (and after each re-open / re-approval round), with a small "Quotation updated with approved services" toast. Nothing regenerates for tickets with no client approval yet.

## Technical notes

- `src/lib/quotationPdfGenerator.ts`: `parseBreakdownFromDiagnosis` returns `{ label, amount, isOption, muted }`; `buildBreakdownBlocks` handles indent/dash/selected styling and only rules between top-level rows. `QuotationPDFData.serviceBreakdown` gains the same optional flags plus `approvalStamp`.
- Quotation data is preferably built from `services.quoted_breakdown` (via `lineDisplayName` / `lineEffectiveCost` in `src/lib/serviceApproval.ts`) rather than re-parsing diagnosis text, falling back to the text parser when a ticket has no quoted lines.
- `src/components/PdfViewerModal.tsx`: swap the "Loading PDF..." and "Rendering remaining pages..." strings for spinner-only placeholders; no change to `src/lib/pdfViewer.ts`.
- Because quotation PDFs are produced client-side with jsPDF, regeneration stays client-side: a shared `syncApprovedQuotation(serviceId)` helper in the ManageClient/ServiceUpdate path compares `client_approved_at` with the latest `service_files` quotation row, regenerates, uploads to the `quotation-forms` bucket, and updates the `service_files` row. The `submit-client-approval` function keeps writing `quoted_breakdown` / `approved_services` only.
