# Premium Service Quotation Form + Image Rendering

Yes — the attached layout is doable with the current PDF engine (jsPDF). Everything in the mockup is boxes, rules, icon badges, tinted panels and typography, all of which jsPDF draws natively. The one thing that needs care is that the diagnosis text is variable length, so panels must auto-size instead of being fixed-height.

## Step 1: Preview before committing

Before touching the app, generate a sample quotation PDF with the new layout using representative data, convert each page to an image, and deliver it as a downloadable preview artifact for review. No app code changes until the look is approved.

## Step 2: The premium layout

Matching the mockup, top to bottom:

- Centered logo, address line, hours line, then a large navy "SERVICE QUOTATION FORM" title.
- Meta card: rounded panel with calendar/clipboard icon badges — Date and Time, Admin Representative/s, Handling Staff, Technician/s on the left; Service ID on the right. Values in accent blue.
- Two side-by-side rounded cards: CLIENT INFORMATION and DEVICE INFORMATION, each with an icon badge, a navy heading with underline rule, and two-column label/value rows.
- Two side-by-side panels with solid navy header bars: TECHNICIAN DIAGNOSIS (left) and SERVICE SUMMARY (right).
  - Diagnosis: icon-badged sections (Findings, Cause of Issue, Suggested Solution, Recommendations) separated by dotted rules, then IMPORTANT NOTE bullets and SUMMARY.
  - Summary: summary text, divider, Service Cost, Discount, then a green-tinted Total Cost row in larger bold type.
  - Both panels share one equalized height, as in the mockup.
- Boxed footer disclaimer, then a navy footer bar with phone, email and website separated by dividers.

Existing behavior kept: "UPDATED VERSION" badge, staff name masking, standardized timestamp format, and the Terms and Conditions pages appended at the end.

### Overflow handling

If the diagnosis is longer than one page, the diagnosis/summary panels continue onto a second page with the same header bar styling, so nothing is silently truncated. Footer bar renders on the last content page.

## Step 3: PDF → image so it always opens

- After generating (and re-generating/updating) the quotation, render every page of the merged PDF to a PNG using the already-installed pdfjs renderer, and upload those page images to storage next to the PDF, indexed as a new file kind so they can be looked up per service.
- The in-app viewer modal prefers the page images when present and falls back to the existing inline PDF path. This applies to `/manage-client`, `/service-update` and the public `/track` page — the public lookup function gets the same image-first resolution so unauthenticated visitors also get instant rendering.
- Regenerating a quotation replaces the stored images, so the "updated" version is always the one shown.

## Technical notes

- `src/lib/quotationPdfGenerator.ts`: rewritten drawing layer with small helpers (`card`, `panelHeader`, `iconBadge`, `labelValue`, `dottedRule`) and a navy/accent/green token set; measure-then-draw so panel heights fit content.
- New `src/lib/pdfToImages.ts`: pdfjs-based page-to-PNG rasterizer (2x scale for crisp text).
- `src/lib/servicePdfStorage.ts`: add image upload + `getServicePdfImageUrls(serviceId, kind)`; new bucket/kind for page images with matching RLS and storage policies.
- `src/components/PdfViewerModal.tsx`: image-first render path with scroll for multi-page, PDF fallback.
- `supabase/functions/get-service-pdf`: also return page-image signed URLs for `/track`.
- Callers in `src/pages/ManageClient.tsx` and `src/pages/ServiceForm.tsx` stay on the same generator API.
