## 1. Client ID + Client Name on /track

In `src/pages/ServiceTracking.tsx`, in the ticket details grid (just above the "Device" block, around line 792), add two fields:

- **Client ID** — `serviceData.clientId`
- **Client Name** — `serviceData.clientName`

Same styling as the existing Device/Serial fields (small uppercase label + value), placed as the first row of the grid so it renders above Device.

## 2. Mask staff names in generated PDFs

Add a shared helper (e.g. `maskStaffName` in `src/lib/utils.ts`) that turns each name into first-letter + asterisks per word:

```text
"Khaya Naranja"  -> "K**** N******"
"Ana Dela Cruz"  -> "A** D*** C***"
```

Handles comma-separated lists (multiple technicians/admins) by masking each name individually and rejoining with ", ". Empty values stay empty.

Apply it only at PDF render time in:
- `src/lib/pdfGenerator.ts` (Client Intake Form) — `Admin Representative/s`, `Handling Staff`, `Technician/s` rows
- `src/lib/quotationPdfGenerator.ts` (Service Quotation) — same three rows

## Notes

- On-screen displays (/manage-client, /service-update, /track, tracker) keep full names — masking is PDF-only.
- Asterisk count matches the remaining letters of each name so length is still hinted but the name is not readable.
