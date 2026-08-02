## Plan: /track page updates

### 1. Add social & contact links below the map
In `src/pages/ServiceTracking.tsx`, inside the right-column "Visit Us" card (below the map and directions button), add:

- **Social icon row**: clickable icons/links for Facebook, Instagram, TikTok, Website, Viber.
  - Facebook: `https://www.facebook.com/actechrepairph`
  - Instagram: `https://www.instagram.com/actechrepairph/`
  - TikTok: `https://www.tiktok.com/@actechrepairph`
  - Website: `https://actechrepairph.com/`
  - Viber: placeholder — `https://viber.com/` (marked for later edit)
- **Contact action buttons** below the icons:
  - "Message us on FB" → Facebook link
  - "Email us" → `mailto:actechrepairph@gmail.com`
  - "Contact us" → `tel:` placeholder (marked for later edit)

All URLs will be stored as constants near the top of the file so they are easy to update later. Links open in a new tab where applicable; email/phone use native handlers.

### 2. Make Terms & Conditions the first document
In the right-column "Documents" card, add a "Terms and Conditions" entry as the first item in the list. It will open the existing `AC_Tech_Terms_and_Condition.pdf` (already bundled for PDF merging) in the same `PdfViewerModal` used by the other PDFs. The existing Client Intake Form and Service Quotation items will remain below it.

### Files to modify
- `src/pages/ServiceTracking.tsx`

### Out of scope
- No backend or data-model changes.
- No changes to the PDF generation logic itself.