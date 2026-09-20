# Interim report, ticket toggles, desktop modals and breakdown fixes

## 1. Pre-approved tickets unlock the AI tools

Today the AI Diagnosis and AI Report formatters stay open at every stage for Within-The-Day, Rush and RTO - ACTech tickets. Pre-approved tickets (the "no client approval needed" switch) will now count the same way, on both Manage Client and Service Update.

## 2. Interim report turns pre-approval off

When a technician creates an interim report and sends the ticket back to Confirmed Diagnosis, pre-approval is switched off automatically, so the client has to approve the new findings. The ticket log records it, and the admin sees the approval panel reopen.

## 3. Interim report on the public tracking page

The interim report currently only renders inside the diagnosis block, which is hidden for several statuses — that is why clients could not see it. It will render directly below the Service Diagnosis whenever an interim report exists and the ticket is not closed, together with its photos, regardless of status.

## 4. Desktop modals no longer squeezed

Cause confirmed: the shared dialog is built mobile-first with a fixed bottom sheet; on desktop it keeps a narrow `max-w-lg` even for big forms, which is why the Complete Intake form is crammed into a thin column. Fix:

- Desktop dialogs size to their content with a sensible max width and comfortable padding.
- Wide, form-heavy dialogs (Complete Intake, intake/quotation forms, payment, breakdown editors, review dialogs) get a wide desktop width with internal scrolling.
- Pass over every dialog/alert-dialog in the app and check the desktop rendering, so nothing else stays clipped.

## 5. Service breakdown sometimes appears empty

Two real causes to fix:

- The panel seeds its editable rows from the query result. While the query is still loading, rows are empty, so it falls back to a blank starter row — the saved lines look deleted until a later render.
- On Manage Client the client-facing lines are set from the merged ticket record, which can arrive before the record is complete, wiping the local lines.

Fix: never seed or overwrite lines while data is still loading, and only replace local lines when a real record has arrived. The panel shows a loading state instead of a blank row.

## 6. Service Update toggles moved and trimmed (image 2)

- The Pre-Order / Waiting for Parts / Backjob block moves into the left side column, matching Manage Client, so it no longer breaks the step flow.
- Technicians no longer see Pre-Order and Backjob (admin/management only).

## 7. Waiting for Parts: separate technician note

- Existing admin note stays as is (admin/management write, others read).
- New technician parts note: technicians can write it on Service Update; admins and management see it read-only on Manage Client and in the preview panel.

## 8. New "Ordered" toggle

- New Ordered switch beside the parts toggles, available on any ticket; turning it on switches Waiting for Parts off.
- Green "Ordered" chip on Service Tracker cards/table and in the side preview.
- New "Ordered" count card placed directly beside the Waiting for Parts card.

## 9. New "Interim" count card

New "Interim" card placed last in the row of flag cards, counting every ticket that has an interim report regardless of status, and filterable like the rest. Added on Service Tracker and the technician tracking list that shares those cards.

## 10. Payment screen shows only approved services

On the payment screen the line editor loads the whole quoted breakdown, including lines the client never approved. It will load only the approved (included) lines for approved tickets, so the receipt, totals and warranty card match what the client agreed to.

## Technical notes

- Migration: add `services.parts_ordered boolean not null default false` and `services.waiting_parts_note_tech text`; wire both through `mapServiceRow`, `serviceRecordShape` and `ServiceRecord`.
- `src/components/ui/dialog.tsx`: keep the mobile bottom sheet, fix the desktop branch (content-height, wider max width); add an opt-in wide size used by form dialogs.
- `src/lib/serviceStatus.ts` (or the existing fast-track helpers in ManageClient/ServiceUpdate): include `autoApproveDiagnosis` in the formatter-visibility condition.
- Interim "send back to Confirmed Diagnosis" path writes `auto_approve_diagnosis: false` plus an activity log entry.
- `ServiceTracking.tsx`: lift the interim block out of `showAiDiagnosis`.
- `ServiceBreakdownPanel.tsx`: gate the seeding effect on `!isLoading`; `ManageClient.tsx`: only `setQuotedLines` when the merged record is present.
- `posServiceLines.fetchTicketLinesContext`: filter to selected lines when `client_approved_at` is set.
- `ServiceTracker.tsx` `FLAG_COUNT_CARDS`: add `ordered` and `interim` entries plus chips; mirror chips in `ServicePreviewSheet`.
