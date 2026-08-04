# Repair client approval, quotation totals, PDF timestamps, and diagnosis alerts

## What will change

### 1. Restore the priced service breakdown on `/track`
- Include the saved `quoted_breakdown` when the public tracking page merges the database ticket with legacy data. It is currently omitted there, so `/track` falls back to names parsed from the AI diagnosis, which have no saved prices.
- Render every finalized line with its price, including zero-value lines, and keep the displayed selected total derived directly from the current checkbox state.
- Refresh the local ticket state with the updated breakdown, service cost, and final cost returned after approval so the page immediately reflects the saved result.

### 2. Add required/locked quotation lines
- Extend each quoted line with a `required` flag while remaining backward-compatible with existing saved lines.
- Add a lock/unlock icon control beside each line in the `/manage-client` breakdown editor. Locked means required.
- On `/track`, required lines start selected, display a lock indicator, and cannot be unchecked.
- Submit stable line selections to the approval function and enforce required lines again in the backend so a modified browser request cannot bypass them.

### 3. Enforce valid approval and add confirmation guardrails
- Require at least one selected service for every priced/checklist approval, both in the UI and in the approval function.
- Replace the current inline decline submission with a confirmation dialog, matching the existing approval confirmation flow.
- Show the Terms and Conditions inside both approval and decline confirmation dialogs, with an in-modal document viewer/action so clients can review them before confirming.
- Keep decline reason mandatory and disable confirmation while a response is submitting.

### 4. Recalculate and persist costs reliably
- Make the approval function use the saved quoted breakdown as the source of truth rather than reparsing item names from the AI diagnosis.
- Match submitted selections against saved lines, force required lines selected, calculate `service_cost` from selected prices, and calculate `final_cost = service_cost - discount`.
- Persist the resulting selected states, approved/pending service lists, costs, approval remark, and workflow status in one update.
- Return the updated costs and breakdown to `/track` for immediate display.

### 5. Simplify PDF date and time
- Add one PDF timestamp formatter that safely accepts database ISO timestamps and produces `YYYY - MM - DD, HH:MM:SS`.
- Apply it to both the Client Intake Form and Service Quotation Form so raw values such as `2026-08-04T14:07:23.111742+00:00` are never printed.
- Use the same format for newly generated and regenerated PDFs.

### 6. Fan out “AI Diagnosis Generated” notifications
- Replace the current self-only notification calls. They currently target only the user who clicked **Format with AI**, which is why other assigned staff do not receive the alert.
- Add a shared notification helper that resolves and deduplicates the ticket’s assigned admins and technicians, then sends the in-app notification and push through the existing reliable notification function.
- Use the helper from both `/manage-client` and `/service-update`, including every AI diagnosis formatting trigger, so all assigned admins and technicians receive the reminder.

## Technical details
- Update the `QuotedLine` shape to `{ name, cost, selected, required }`; no new database column is needed because `quoted_breakdown` is JSON.
- Preserve old records by defaulting missing `required` to `false`.
- Update the public tracking merge to expose `quotedBreakdown`, `serviceCost`, and `finalCost` from the database record.
- Validate approval input and required-line rules in `submit-client-approval`, not only in the browser.
- Reuse the existing Terms PDF and local PDF viewer; do not redirect clients to an external document.

## Verification
- Save a quotation with multiple priced lines, lock one, and verify `/track` shows all prices and a live-changing total.
- Verify the locked line cannot be unchecked and a request with no selected lines is rejected.
- Confirm both approval and decline require a confirmation step and expose the Terms and Conditions.
- Approve a partial selection and confirm the saved breakdown, service cost, final cost, approved/pending lists, and status are correct after refresh.
- Generate both PDF types from an ISO database timestamp and confirm the exact `YYYY - MM - DD, HH:MM:SS` display.
- Trigger AI diagnosis formatting from both staff pages and verify notifications appear for every assigned admin and technician without duplicates.