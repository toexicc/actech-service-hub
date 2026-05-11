# Fix & Update Plan

## 1. Generated PDF formatting (intake & quotation)
- In `pdfGenerator.ts` and `quotationPdfGenerator.ts`: render Admin Representative/s, Handling Staff, and Technician/s each on their own line. Wrap long comma-separated lists onto continuation lines (indented), shrink font from 9pt → 8pt for these rows so document still fits a single page.
- Keep all other layout intact; verify still 1 page.

## 2. View PDF as modal viewer
- New component `src/components/PdfViewerModal.tsx`: Dialog with iframe (signed URL), Download button (anchor `download`) and Print button (`iframe.contentWindow.print()`).
- Replace existing "View PDF" handlers in `ServiceUpdate.tsx`, `ServiceTracking.tsx`, `ManageClient.tsx`, `CustomerManagement.tsx`, `ServiceForm.tsx` (intake page) to open this modal instead of `window.open`.

## 3. View PDF on /track
- In `ServiceTracking.tsx`: enable buttons whenever `getServicePdfSignedUrl(serviceId, 'intake'|'quotation')` resolves; open in `PdfViewerModal`.

## 4. /intake View PDF disabled
- After submit in `ServiceForm.tsx`, store generated PDF blob in component state and surface a "View PDF" button that opens the modal even before re-fetching.

## 5. Always show fresh data
- Add `refetchOnMount: 'always'` and `staleTime: 0` to the React Query hooks used by `ManageClient`, `ServiceUpdate`, `ServiceTracking`, `CustomerManagement` (in `useServices`, `useClients`, `useClientInquiriesData`).

## 6. /track approval flow
- Add UI block in `ServiceTracking.tsx`:
  - When `status === 'Waiting to Proceed'` AND no approval recorded: show **AI Diagnosis** card (renamed "Service Diagnosis"), then Intake Form + Quotation PDF buttons, then **Approve** and **Decline** buttons under the diagnosis.
  - Approve → write `Approved by {clientName} on {ISO ts}` into `services.remarks` (append) and create notification to all `admin_reps[]`.
  - Decline → text field + Submit → append `Declined by {clientName} on {ts}: {reason}` to `remarks`, notify all `admin_reps[]`.
  - When `status` is `Done Repair - Advise Client` or `Completed`: show **Service Report** card (renamed) above intake/quotation forms.
  - Buttons appear only on `/track`, never on `/manage-client`.

## 7. Drop "AI" prefix on /track
- In `ServiceTracking.tsx` pass `title="Service Diagnosis"` / `title="Service Report"` to `AiReportCard`.

## 8. Staff Management — show email
- `StaffManagement.tsx`: add Email column to staff list (read from `auth.users.email` via existing `manage-staff` edge function — extend it to return email per profile, or store email on `profiles.username` since username == email on signup). Display email column.

## 9. Notifications to all assigned admins/techs (not just logged-in user)
- Audit `serviceNotifications.ts`: ensure when service is **created** in `ServiceForm.tsx`, we call `notifyServiceAssignment` (new helper) iterating `admin_reps[]` + `technicians[]` + `receivingStaff` and `createNotification` for each (resolve user_id by name from `profiles`).
- Verify `notifyStatusChange` similarly loops all recipients.
- Push notifications (`sendPushNotification`) already runs server-side via OneSignal external user id, so offline users get pushes.

## 10. /intake scroll fix
- `ServiceForm.tsx`: outer wrapper currently uses `min-h-screen` with inner card constraints — change to `min-h-screen overflow-y-auto` on root and remove any `h-screen`/`overflow-hidden` on parents.

## 11. Custom helper / notification text
- In `serviceNotifications.ts` status message map:
  - `Done Repair - Advise Client` → `Send the report to client for {serviceId} ({clientName}'s {deviceType} {brand} {model}). Please monitor for feedback and update status to Completed once payment and pickup are settled.`
  - `Waiting to Proceed` → `Send the diagnosis to client for {serviceId} ({clientName}'s {deviceType} {brand} {model}). Please monitor for approval.`
- Mirror same strings in any in-app helper banner shown on `ServiceUpdate.tsx` for those statuses.

## 12. AI prompts — strict format
- Replace system prompts in `supabase/functions/format-diagnosis/index.ts` and `supabase/functions/format-report/index.ts` with the exact templates the user provided (verbatim sections, plain text, no markdown, no em dashes).

## Files to touch
- `src/lib/pdfGenerator.ts`, `src/lib/quotationPdfGenerator.ts`
- `src/components/PdfViewerModal.tsx` (new)
- `src/pages/ServiceTracking.tsx`, `ServiceUpdate.tsx`, `ManageClient.tsx`, `CustomerManagement.tsx`, `ServiceForm.tsx`, `StaffManagement.tsx`
- `src/lib/serviceNotifications.ts`
- `src/components/AiReportCard.tsx` (allow custom title — already supports)
- `src/hooks/useServices.ts`, `useClients.ts`, `useClientInquiriesData.ts`
- `supabase/functions/format-diagnosis/index.ts`, `format-report/index.ts`
- `supabase/functions/manage-staff/index.ts` (return email)

Reply **proceed** to start implementation, or specify which items to skip / change.
