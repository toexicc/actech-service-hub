# Fixes & Updates: Discount Rule, Queue Resend, Today Card, Rush Fast-Track

## 1. Bundle discount is waived when optional services are dropped

Rule: a discount only survives when **every** quoted line (locked and optional) is approved. If the client approves only some lines — or leaves an optional line unticked — the discount drops to 0 and the final cost is recomputed.

Where it applies:
- Client approval on `/track` (server-side, authoritative): when re-costing the ticket from the client's selection, if any line is left unselected, set the ticket's discount to 0 before computing net, rush fee and VAT.
- Live totals preview on `/track` so the client sees the waived discount before submitting, not after.
- Warning text under the service breakdown on `/track` whenever the ticket has a discount and more than one quoted line:
  "A discount is applied because of the bundled services. If you proceed with one option only, the discount is waived. You may message us on this page if you have any questions."
- The same note appears in the quotation builder on `/manage-client` so staff know the discount is conditional.

## 2. Resend a cancelled queue entry back to the queue

On the Intake Records tracker, cancelled entries get a **Resend to Queue** action (management/admin only). It puts the same submission back on the board as `waiting` with a fresh queue number and display code, keeping the original client and device details so returning walk-ins never re-type the form. A toast confirms the new queue number, and the action is logged to the activity trail.

## 3. "Today" card, first in the row

A new first card on the Service Tracker card row: **Today** — counts every ticket created today (service date / date received in Manila time), regardless of status or flag. Clicking it filters the list to today's intakes; clicking again clears it. It respects the other active filters (device type, technician, department, tab) like the existing cards do.

## 4. Rush tickets get the same fast-track as Within The Day

On `/service-update`, tickets flagged **Rush (10% Rush Fee)** behave like "Within The Day": the AI Diagnosis, Technician Report / Interim Report and photo uploads stay visible and editable at every status, without needing a status change first. The stage hint reads that the ticket is a Rush job with the diagnosis and report tools kept open.

## Technical notes

- `supabase/functions/submit-client-approval/index.ts`: in the re-cost block, compute `allSelected` over `relined`; when false, `update.discount = 0` and use 0 as the discount for `net`/VAT/final cost. Log the waived discount in the activity details.
- `src/lib/serviceApproval.ts`: add a small helper (e.g. `effectiveDiscount(lines, discount)`) so the page, `/manage-client` and the function share one rule.
- `src/pages/ServiceTracking.tsx`: use the helper for the displayed totals and render the warning block under the breakdown.
- `src/components/IntakeQueuePanel.tsx` + `src/hooks/useQueueEntries.ts`: add a `requeueEntry(id)` helper that inserts a new `queue_entries` row (kind `intake`, status `waiting`) from the cancelled row's `form_payload`, plus the row action and pagination-safe refresh.
- `src/pages/ServiceTracker.tsx`: add `today` as the first count card with a `parseServiceDate`-based match, wire it into the existing `flagFilter` state/filter pipeline.
- `src/pages/ServiceUpdate.tsx`: add `isRush = !!serviceData?.rushFee` and include it alongside `isWithinTheDay` in `diagnosisEditable`, `reportStageReached`, `reportEditable`, `showDiagnosisStage`, `showReportStage`, `showReportEditors`, and the stage hint.
