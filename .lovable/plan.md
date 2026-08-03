## 1. Service Tracker — date range + filters vs tabs

Confirmed in `src/pages/ServiceTracker.tsx` (filter block, lines ~638–740):
- The date range only compares against **Target Date**, and when a ticket has no parseable target date the row passes the filter untouched — so the range appears to do nothing.
- Tab filters for **Within the Day** and **Walk In** only check priority/client type; they do not exclude `Completed` tickets (only cancelled/RTO/on-hold are excluded).

Changes:
- Switch the date range to the ticket's **service/received date** (`serviceDate` / `dateReceived` / `timestamp`, first parseable), inclusive of the whole end day. Tickets with no parseable received date are excluded while a range is active.
- Keep the existing presets (Today / This Week / This Month / Clear) wired to the same field, and relabel the filter as "Service Date Range".
- Add `cls === "completed"` exclusion to the `within` and `walkin` tabs so those tabs show only active tickets; the Completed tab remains the place completed work appears.
- Verify all other filters (device type, technician, department, status, due-date) compose correctly with each tab, and reset pagination when any filter or tab changes (already partly handled).

## 2. `/track` approval — "edge function returned a non-2xx status code"

Confirmed: the function is deployed and reachable. Two real defects:
- `supabase.functions.invoke` sets `data = null` on any non-2xx response, so the specific message returned by `submit-client-approval` (400 "select at least one service", 409 "no longer awaiting approval", 409 "approval is on hold") is never shown — every failure surfaces as the generic non-2xx toast. The exact failing case is therefore currently unknowable from the UI.
- The service-breakdown parser is **duplicated**: `src/lib/serviceApproval.ts` (client, matches "service breakdown" anywhere in a line) vs. the edge function's own copy (requires the line to *start* with "service breakdown"). When the two disagree, the client shows a checklist while the server parses zero items, so a single selection can't be matched and the request is rejected.

Changes:
- Read the real error body in `ServiceTracking.tsx` via `FunctionsHttpError` (`await error.context.json()`), and show the server's message in the toast.
- Make the edge function's parser identical to the client's (same heading match, same stop-words including `warranty`), so item lists always agree.
- Harden matching in the edge function: normalise case/whitespace/punctuation, and if a selection can't be matched by name, fall back to matching by position; only if the ticket has no parseable breakdown at all treat "approved" as full approval.
- Handle every case explicitly and return clear messages: no items parsed, one item total (approve all, no checklist), all items selected (full approval → `Proceed Repair`), subset selected (partial → stays in `Waiting to Proceed`, `approval_locked = true`), none selected, already approved / already locked, wrong status, decline with/without reason.
- Make repeat submissions idempotent-friendly: if the ticket is already locked or already moved on because of *this* client's decision, return success with the current state instead of a 409 error.
- Verify end-to-end against a live ticket with a two-item breakdown (single-item selection, then full selection).

## 3. Chief complaint not persisting

Confirmed: `/manage-client` renders an editable Chief Complaint textarea (`updateChiefComplaint`), but the field is **absent from the update payload** sent to the database, so Update reloads the original intake text. `/service-update` shows it read-only.

Changes (admin/management only, per your answer):
- Include `chief_complaint` in the `/manage-client` update payload, and mirror it to `issue_description` (intake writes both, and the PDFs/`track` read from these).
- Add it to the change log line ("Chief complaint updated") so edits are auditable.
- Leave `/service-update` read-only, but it will now display the admin-updated text after refresh.
- Confirm the regenerated Client Intake Form and Service Quotation PDFs pick up the edited complaint.

## Technical notes
- Files: `src/pages/ServiceTracker.tsx`, `src/pages/ServiceTracking.tsx`, `src/lib/serviceApproval.ts`, `supabase/functions/submit-client-approval/index.ts`, `src/pages/ManageClient.tsx`.
- No schema changes required.
