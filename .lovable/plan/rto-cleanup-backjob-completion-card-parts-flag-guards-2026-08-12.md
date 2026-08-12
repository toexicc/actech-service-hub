# RTO cleanup, backjob completion card, parts-flag guards

## 1. /track for RTO tickets — truly minimal

- The diagnosis card for **RTO - ACTech** currently renders *above* the Repair Ticket card. Move it back to its normal position (below the ticket card), same slot the regular diagnosis uses.
- For closed RTO tickets, the Repair Ticket card shows only the ticket number, the "Return to Owner" status and the reason. Client ID / name, device, serial, chief complaint, service date and the time-frame blocks are hidden, so:
  - **RTO - Client:** reason only.
  - **RTO - ACTech:** reason + diagnosis (diagnosis below the ticket card).
- The "Waiting for Parts" chip is hidden on /track for any Done Repair status, Completed, On Hold, Cancelled and both RTO statuses — it only shows while a repair is genuinely in progress.

## 2. Backfill existing RTO tickets

All 45 tickets currently on the generic `RTO` status become **RTO - Client**, so they default to the empty view (reason only, no diagnosis). Reasons stay whatever they are today (blank for most).

## 3. Service Tracker — Completed backjobs

- New card **Completed - Backjob**: tickets flagged Backjob whose status is Completed. Clicking it filters the list the same way the other cards do.
- The existing **Backjob** card counts only tickets that are *not* Completed.
- The **Completed** card excludes completed backjobs, so a ticket appears in exactly one of the two.

## 4. Waiting-for-Parts confirmation on status advance

On `/manage-client` and `/service-update`, when the status is changed to **Ongoing Service** or any **Done Repair** status while the Waiting for Parts toggle is on, a confirmation modal appears before saving: moving to that status means the parts have arrived. Confirming saves the status change and turns Waiting for Parts off in the same update (logged to the ticket timeline, with the usual "parts are available, please proceed" notification to the assigned admin/technician). Cancelling leaves both the status and the flag untouched.

## Technical notes

- Data-only change for the backfill: `UPDATE public.services SET status = 'RTO - Client' WHERE status = 'RTO'` (no schema change; the enum value already exists).
- `ServiceTracking.tsx`: move the `rtoKind === "actech"` diagnosis block below the Repair Ticket card; gate the client/device detail grid on `!isClosed` (matching how the mini stats and step chips are already gated); add a status list guard around the Waiting-for-Parts chip.
- `ServiceTracker.tsx`: `FLAG_COUNT_CARDS` gets a `completedBackjob` entry and the `backjob` matcher excludes completed; the `Completed` status count and its filter exclude `isBackjob` tickets.
- `ManageClient.tsx` / `ServiceUpdate.tsx`: reuse the existing pending-save pattern used by the RTO reason modal — intercept submit, show the parts confirmation dialog, then include `waiting_for_parts: false` in the same update and call `notifyPartsAvailable`.
