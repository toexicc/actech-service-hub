# Reliable PDF preview, correct download filenames, single re-open approval

## 1. PDF modal renders pages as images (never a blank frame)

Today the modal loads the PDF bytes and hands them to an `<iframe>`, which is why previews sometimes fail (blocked/unsupported inline PDF rendering).

New behavior for the View PDF modal everywhere (`/manage-client`, `/service-update`, `/track`, `/customer-management`):

- Load the PDF bytes as today (storage download, then plain fetch fallback).
- Render the pages to images with pdfjs (already a project dependency) and show them in a scrollable, zoom-to-fit column. Page 1 renders and appears first so the preview is instant; remaining pages stream in below it.
- The Download button always downloads the real PDF bytes (unchanged file), and Print prints from the rendered pages.
- If image rendering itself fails, keep the existing "open in new tab" fallback card.

Result: the form always displays in the modal, regardless of browser PDF support.

## 2. Download filenames

Standardize to:

- Client Intake Form: `{ServiceDate YYYYMMDD} {Name} - {Service ID} - CIF.pdf`
- Service Quotation Form: `{ServiceDate YYYYMMDD} {Name} - {Service ID} - SQF.pdf`

The current code only names the storage object (`AC0408..._Name_1754...pdf`) and the modal's download link falls back to `document.pdf`, which is why the agreed naming never showed up on download. Fix by computing the display filename in one shared helper and passing it to the modal's download link on every page that opens a PDF, using the ticket's service date, client name and service ID. Storage paths stay as they are (internally unique); only the downloaded file name changes.

## 3. One re-open approval control, made foolproof

- Remove the lower "Client approval is on hold" container and its button on `/manage-client`. Only the top Approval Remark block (caution icon) keeps the re-open action.
- Make the re-open action robust for repeated back-and-forth:
  - Shown whenever there are still pending/unapproved services, whether or not approval is currently locked; the label reflects the state ("Re-open approval on tracking page" vs "Resend approval request").
  - Single in-flight guard so double clicks can't fire twice; button disables while working.
  - Re-open clears the lock and the pending-hold flag, refreshes the ticket from the backend so the button state can't go stale, and is idempotent — re-clicking when already open just re-confirms with a toast instead of erroring.
  - `/track` continues to re-show the checklist for the lines that are still pending, keeping already-approved lines locked, so a client can approve in several rounds without losing prior approvals.

## Technical notes

- `src/components/PdfViewerModal.tsx`: replace the iframe with a pdfjs canvas/image renderer; add a `filename` prop that is actually used by the download anchor.
- `src/lib/pdfViewer.ts`: add page-to-image rendering (pdfjs worker wired through a Vite `?url` import) alongside the existing byte loading.
- `src/lib/servicePdfStorage.ts`: add `servicePdfDownloadName(kind, { serviceDate, clientName, serviceId })` producing the CIF/SQF names; reuse it for direct downloads after generation.
- Pass `filename` from `ManageClient.tsx`, `ServiceUpdate.tsx`, `ServiceTracking.tsx`, `CustomerManagement.tsx`.
- `ManageClient.tsx`: delete the duplicate hold banner; harden `handleReopenApproval` (guard, refetch, idempotent).
- `ApprovalRemarkBlock.tsx`: show the re-open action based on pending services rather than lock state alone.
