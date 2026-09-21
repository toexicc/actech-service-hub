# Parts flags, resume rules, Belekoy merge, duplicate pop-ups

## 1. Merge Belekoy into one customer record

Keep `CL1786329981509` (09178303147) as the single Belekoy record and move all
tickets onto it, then remove the leftover duplicates:

- Repoint tickets AC130826003, AC130826007, AC210926006, AC090926030 to
  `CL1786329981509` (AC100826003 is already on it).
- Keep the cleanest name ("Belekoy") and the real phone/email on the surviving record.
- Delete the three duplicate customer records once no ticket points at them.
- Ticket AC050826017 stays where it is, as decided earlier.

## 2. "Ordered" and "Waiting for Parts" act as one pause

Today Ordered switches Waiting for Parts off, but everything downstream only
looks at Waiting for Parts. Introduce one shared rule — the ticket is "parts
paused" when **either** Waiting for Parts **or** Ordered is on — and use it
everywhere:

- **Public tracking (/track):** the line "Waiting for Parts — the required
  parts/supplies are being procured for your repair" stays visible while either
  toggle is on, and only disappears when both are off.
- **Repair resume notification:** the "parts available / repair resumed" alert to
  the admin and technician fires only when the last of the two toggles goes off —
  not when Ordered is switched on while Waiting for Parts is cleared.
- **Overdue target-date prompt:** the "Target date has passed" pop-up on Manage
  Client is only armed when both toggles are off (and the ticket is overdue). If
  Ordered is still on, no prompt and no reminder.
- **Overdue counting:** a ticket stays out of overdue counts while either toggle
  is on (same rule already applied for Waiting for Parts).
- The confirmation messages on the toggles are reworded so they no longer claim
  the repair resumed when the ticket is still parts-paused.

Applies on Manage Client, Service Update, and the flags panel so all three
behave identically.

## 3. Only one pop-up when a service loads

Opening a ticket currently shows three stacked alerts because several cached
pages each announce the same load. Fix: keep a single confirmation from the page
the user is actually on, suppress the announcement from background/cached pages,
and de-duplicate identical alerts so the same message can't stack.

## Technical notes

- Add `isPartsPaused(service)` (waitingForParts || partsOrdered) to
  `src/lib/serviceStatus.ts`; use it in `isOverdueEligible`, the /track chip in
  `ServiceTracking.tsx`, and the toggle handlers.
- `TicketFlagsPanel.toggleOrdered`: drop the `notifyPartsAvailable` /
  `notifyOverdueTargetDateReview` calls on the Ordered-on path; in
  `toggleWaitingForParts(false)` and `toggleOrdered(false)` only notify when the
  other flag is also off. Same for the ManageClient/ServiceUpdate paths.
- `notifyOverdueTargetDateReview` keeps setting `target_review_pending`, but is
  only reached once both flags are off.
- Duplicate toasts: the `Service Loaded` toast in `ManageClient.tsx` (~:833) and
  `Service Found` in `PointOfSales.tsx` (~:156) fire from keep-alive mounts; gate
  on the active route and give the toast a stable `id` so repeats replace rather
  than stack.
- Data merge via SQL updates on `services.client_id` plus deletes of the three
  duplicate `clients` rows.
