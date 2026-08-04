# PDF viewer fix, always-on AI sections, quotation name masking

## 1. PDF viewer says "blocked by Chrome"

The viewer tries to download the PDF bytes with a plain `fetch` and show them in a
sandboxed iframe. When that download fails (CORS / expired signed link), it falls back
to putting the remote storage URL straight into the iframe — and Chrome refuses to frame
that response, which is the "blocked" page users see.

Changes:
- Load PDF bytes through the backend storage client (authenticated download) instead of a
  raw cross-origin `fetch`, so the bytes reliably arrive and the modal always renders a
  local blob.
- Never put a remote URL into the iframe. If bytes truly can't be fetched, show a clear
  in-modal message with "Open in new tab" / "Download" instead of a blocked frame.
- Relax the iframe sandbox for local blob documents so Chrome's built-in PDF viewer is
  allowed to run, keeping top-level navigation blocked.
- Also handle expired links by re-resolving a fresh signed URL before giving up.

Applies everywhere the modal is used: /manage-client, /service-update, /track,
customer management.

## 2. Always show AI Diagnosis and AI Report on /manage-client

Both blocks are currently wrapped in a `status === "Confirmed Diagnosis"` condition.
Remove that gate so the Technician Diagnosis field, AI Diagnosis (with Format with AI,
Copy, Edit, Approve) and AI Service Report are visible at any status. Empty states show
placeholder text rather than being hidden. No change to how they are saved.

## 3. Mask staff names on the Service Quotation Form

The three staff rows (Admin Representative/s, Handling Staff, Technician/s) already go
through the masking helper, so the remaining work is to catch names that appear elsewhere
on the quotation:
- Audit the generated quotation for any other place a staff name is printed (diagnosis
  body lines such as "Technician: <name>", approval remarks, prepared-by text) and run
  them through the same masking helper.
- Verify the rendered PDF visually after the change so masking (K**** N******) shows on
  every staff name, matching the client intake form.

## Technical notes

- `src/lib/pdfViewer.ts` — replace raw `fetch` with a storage-aware loader; return a
  status (`ok` / `failed`) instead of silently falling back to the remote URL.
- `src/components/PdfViewerModal.tsx` — blob-only iframe, sandbox tuned for blob PDFs,
  explicit failure state with open/download actions.
- `src/pages/ManageClient.tsx` — drop the `Confirmed Diagnosis` conditions around the
  technician diagnosis, AI diagnosis and AI report blocks.
- `src/lib/quotationPdfGenerator.ts` — extend `maskStaffName` coverage to any remaining
  staff-name output.
