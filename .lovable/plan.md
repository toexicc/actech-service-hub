# Quotation options indent, PDF preview hang, approval-synced quotation

## 1. Indent option lines in the Service Quotation Form

The quotation's Service Breakdown panel is built by parsing the AI diagnosis text, and every parsed row is drawn the same way — bullet dot, flush-left label, right-aligned amount. That is why `Option A - OEM` and `Option B - Original` sit at the same indent as `Screen Replacement`.

Changes:

- Mark rows that begin with `Option <letter/number> - <label>` as option rows while parsing.
- Draw option rows indented (about 6 mm from the service name), with a small dash instead of the accent bullet, slightly smaller/lighter label text, and the amount still right-aligned so the price column stays even.
- A parent service that has options and no amount of its own no longer shows a dangling amount slot; the dotted separator is only drawn between top-level services, not between a service and its options.
- When one option is already chosen (after approval), the chosen row is marked as selected and the others are shown muted.

## 2. "Loading PDF" that never finishes on the Client Intake Form

The viewer already renders pages as images; the stuck state means the render pipeline never resolves and never throws — so no image and no error fallback. The most likely cause is the pdf.js worker script failing to resolve, which leaves the document load pending forever. This is not yet confirmed, so the first step is to instrument it.

Changes:

- Add a hard timeout around loading bytes and loading the document. On timeout, the modal shows the existing "couldn't be loaded" fallback with Open in new tab / Download instead of spinning.
- Fall back to pdf.js's worker-less mode when the worker script can't be fetched, so rendering still completes.
- Render and show page 1 first, then continue the remaining pages in the background (intake forms carry the appended terms pages, which is the slowest part).
- Show a clearer progress label ("Rendering page 1 of N") once the page count is known, so a slow multi-page intake form no longer looks frozen.
- Verify with an actual stored intake form for a real ticket end to end before calling it fixed.

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
- `src/lib/pdfViewer.ts`: wrap `getPdfjs`/`getDocument` in a timeout, retry with `GlobalWorkerOptions.workerSrc = ""` (fake worker) when the worker URL 404s, and expose progress via the existing `onPage` callback; `PdfViewerModal` surfaces failure and per-page progress.
- Because quotation PDFs are produced client-side with jsPDF, regeneration stays client-side: a shared `syncApprovedQuotation(serviceId)` helper in the ManageClient/ServiceUpdate path compares `client_approved_at` with the latest `service_files` quotation row, regenerates, uploads to the `quotation-forms` bucket, and updates the `service_files` row. The `submit-client-approval` function keeps writing `quoted_breakdown` / `approved_services` only.
