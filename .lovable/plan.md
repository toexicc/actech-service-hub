# Fixes & Update — Implementation Plan

## Fixes

### 1. PDF "No PDF available" on intake & quotation
- After Supabase migration, intake/quotation submissions stopped uploading the generated PDF to the `intake-forms` / `quotation-forms` storage buckets and inserting into `service_files`.
- Wire `pdfGenerator.ts` and `quotationPdfGenerator.ts` outputs to upload the PDF blob to the correct bucket on submit, and persist a `service_files` row (kind=intake/quotation, bucket, storage_path).
- Update the "View PDF" handlers in `ServiceUpdate.tsx`, `ServiceTracking.tsx`, `ManageClient.tsx`, and `CustomerManagement.tsx` to look up the latest matching `service_files` row and create a signed URL instead of relying on legacy Drive URLs.

### 2. Status-change notifications
- The new `serviceNotifications.ts` only notifies the assigned technician/admin. Restore the broader behaviour: notify every technician in `technicians[]`, every admin rep in `admin_reps[]`, plus the receiving staff, on every status change.
- Reuse `createNotification` per recipient (resolve user_id by name from `profiles`).

### 3. AI text formatting (`**` markdown showing in UI)
- The format-diagnosis / format-report edge functions and `serviceNotifications.ts` outputs include `**bold**`. Match the original `googleSheets.ts` style: plain text, sectioned with `Findings:`, `Cause:`, `Solution:`, `Recommendations:`, `Service Breakdown:` and `Performed:` / `Recommendation:` / `Cost:` for the report — no markdown.
- Strip `**` / `__` / `#` from any rendered AI text in `AiReportCard` as a defensive measure.

### 4. Page scroll
- `Login.tsx` uses `overflow-hidden` on the root → page can't scroll on short viewports. Replace with `overflow-y-auto` and remove the `h-screen` lock.
- `ServiceForm.tsx` (intake) — ensure outer container is `min-h-screen overflow-y-auto` (already partly done) and the inner card doesn't pin height. Audit other pages with the same pattern (`Install`, `Menu`).

### 5. Reflect previous functionality on the new DB
- Audit the remaining mismatches carried over from the Sheets era and not yet ported: client_inquiries fields (preOrder, partId), service.aiReport on Done-Repair, request-for-parts auto-link, salary daily-rate calculation source. Fix any field references still pointing at the legacy column names.

## Update — Per-service technician breakdown

Goal: when a service is in **Completed Transactions**, expand the row to assign a breakdown so each technician's cost contribution is recorded (for commission/salary).

### Schema
New table `service_breakdowns`:
- `id` uuid PK
- `service_id` text (FK to services.service_id)
- `service_name` text          — the line item description
- `technician_id` uuid          — FK to profiles.id
- `technician_name` text
- `cost` numeric                — that technician's portion
- `created_at`, `updated_at`, `created_by`

RLS: read for any authenticated user; write for admin/management or the assigned technician.

### UI (`CompletedTransactions.tsx`)
- Make each row clickable → expands an inline panel under the row.
- Panel shows:
  - Header: `Total Service Cost: ₱{total_cost}` (read-only)
  - Editable list of breakdown lines: `Service`, `Technician` (dropdown of staff that are technicians), `Cost`
  - Add/remove line buttons; Save persists to `service_breakdowns`.
  - Validation: sum of line costs ≤ total_cost; warn if not equal.
- When a service has multiple technicians in `technicians[]`, pre-seed one empty line per technician on first open.
- Show a small badge `Breakdown set` if rows exist for the service.

### Why this satisfies the "two technicians" note
Instead of auto-splitting equally (lossy), the admin assigns each tech's exact contribution at completion time — which is what commissions actually need.

## Files touched (technical)
- `supabase/migrations/<new>.sql` — `service_breakdowns` table + RLS
- `src/pages/CompletedTransactions.tsx` — expandable rows + form
- `src/hooks/useServiceBreakdowns.ts` — fetch/mutate
- `src/lib/pdfGenerator.ts`, `src/lib/quotationPdfGenerator.ts` — upload to storage + insert service_files
- `src/pages/ServiceForm.tsx` — call new upload after submit
- `src/pages/{ServiceUpdate,ServiceTracking,ManageClient,CustomerManagement}.tsx` — signed-URL viewer
- `src/lib/serviceNotifications.ts` — notify all techs + admin reps + receiving staff
- `supabase/functions/format-diagnosis/index.ts`, `format-report/index.ts` — strip markdown, match googleSheets format
- `src/components/AiReportCard.tsx` — defensive markdown strip
- `src/pages/Login.tsx`, `src/pages/ServiceForm.tsx` — fix scroll
