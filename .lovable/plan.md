# Fix cross-ticket AI diagnosis, stuck RTO status, and rigid activity logs

## 1. Wrong diagnosis output (AC040826006 showing AC030826003 content)

What the data shows: AC040826006 currently holds a correct diagnosis for itself, while AC030826003's diagnosis was overwritten at 03:43 today with a near-empty stub ("No repair details available"). That is consistent with a write landing on the wrong ticket rather than the AI generating the wrong text.

Confirmed cause in code: both `/manage-client` and `/service-update` keep two separate ids — the search-box value (`serviceId` state) and the actually loaded ticket (`serviceData.serviceId`). The Supabase save uses `.eq("service_id", serviceId)` (the search box), and the AI formatter is called with `serviceId` from the box but the diagnosis text/client fields from `serviceData`. If the box is retyped, restored from a persisted workbench tab, or a search partially fails, the two diverge and content from one ticket is written or headed with another ticket's ID.

Fix:
- Introduce a single canonical `activeServiceId = serviceData.serviceId` and use it for every write, AI call, PDF generation, notification and log on both pages.
- Refuse to save or format when the search box id differs from the loaded ticket, with a clear "Load the ticket first" message.
- Reset all form state (diagnosis, report, costs, quoted lines, notes, parts) whenever the loaded ticket id changes so no field can carry over between tickets.
- Data note: AC030826003's previous diagnosis text was overwritten and is not recoverable from the table; it will need to be re-generated from the technician notes still stored on that ticket.

## 2. Waiting to Proceed → RTO does not save

Cause: the save handler runs the quoted-service-breakdown validation (`validateQuotedLines` with require-one-selected and require-a-locked-line) on every save. A ticket sitting in Waiting to Proceed has quoted lines the client has not approved yet, so the validation fails and the save is aborted with "Service Breakdown needs attention" / "select at least one service" — the status never changes.

Fix:
- Skip approval-related guards (require-one, require-lock, and the "Service Quotation Form required" gate) when the target status is off-path: RTO, Cancelled, On Hold, or a move back to Pending Diagnosis.
- Still write the status change and log it, and surface a confirmation prompt for RTO/Cancelled so it is deliberate.
- Apply the same exemption in `/service-update` for the statuses technicians can set.

## 3. Rigid, complete activity logs

Goal: every meaningful action on a ticket appears in one timeline, visible on `/manage-client`, including everything technicians do on `/service-update`.

- Log clicks of both **Format with AI** buttons (diagnosis and report) on `/manage-client` and `/service-update`, recording who clicked, which formatter, and the length/preview of the generated text.
- Log manual edits of AI diagnosis / AI report (edit opened, saved, and a short old→new preview).
- Log field-level changes on save as `field: old → new` entries instead of a bare field-name list (status, technician, admin rep, costs, discount, VAT, time frames, notes, services, target date).
- Log PDF generate/regenerate, approvals and reopen-approval, parts selection, concerns raised, and status transitions with both the old and new status.
- Every log carries the actor's full name and role, and is attached to the canonical ticket id (so technician actions on `/service-update` land on the same ticket and show up in `/manage-client`).
- Upgrade the Activity panel: higher limit (with load-more), role shown next to the actor, expandable detail for change entries, and newest-first ordering. Remove the dead data-bridge log fetch in `/service-update` and read the same Supabase timeline there.

## Technical notes

- Files: `src/pages/ManageClient.tsx`, `src/pages/ServiceUpdate.tsx`, `src/lib/activityLogger.ts`, `src/components/workspace/ActivityTimeline.tsx`, `src/lib/serviceApproval.ts` (guard helper only).
- Logs use the existing `activity_logs` table (`entity_type = 'service'`, `entity_id = service_id`, plus a `changes` JSON payload for field diffs) — no schema change needed.
- No changes to AI prompts or the edge functions; the bug is client-side ticket identity, not generation.
