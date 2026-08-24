# Fixes: dashboard cleanup, within-the-day alerts, attendance grace, tracker cards

## 1. Remove the Admin Dashboard page
- Delete `src/pages/AdminDashboard.tsx`.
- Remove its route, sidebar entry, command-palette entry and Menu quick-action link so nothing links to a dead page.

## 2. Within-the-Day stale-ticket alerts (no movement for 3 hours)
- New scheduled backend function that runs every 30 minutes and finds tickets with priority "Within the Day" that are still open (not Completed / Cancelled / RTO / On Hold) and whose last update is 3+ hours old.
- Notifies the assigned technician(s) and assigned admin(s) for that ticket, and re-alerts every 3 hours while it stays idle (so 3h, 6h, 9h...). No duplicate alert inside the same 3-hour window.
- Notification lands in the in-app panel and routes to the ticket.

## 3. Attendance: 10-minute grace period
- Time In counts as late only after 10:10 AM Manila (kiosk recording + the manual/bulk entry paths in Attendance Overview use the same rule).
- One-time backfill across all attendance history: any log with Time In at or before 10:10 AM Manila is cleared of the Late flag.
- Attendance page pagination stays grouped per day; currently 3 days per page — will change to 1 day per page so each page shows exactly one day.

## 4. Service Tracker + public Track page
- Add a "Within the Day" count card placed immediately before Rush; it matches tickets whose priority is "Within the Day".
- Remove the "Within the Day" tab next to All (the card replaces it).
- Add a "Within the Day" chip on those tickets in the tracker rows and on the public tracking page, alongside the existing Rush/Backjob chips.
- Clicking a status card sets the Status filter to that status and locks the status dropdown while the card is active (clicking the card again clears it).
- Show Service Date on the ticket cards next to the Target Date.

## 5. Queueing / release
- Add "AC Tech Delivery - Harly" to the "Released from" list. When it is chosen, a second required "Released from staff" selection appears, and release is blocked until both are set. Both values are recorded on the release.

## 6. Reports — what we track today
Currently tracked from the activity log, per staff member, within the selected date range:
- Moves: every status change they performed
- Tickets touched: distinct tickets they moved
- Diagnosed: moves into Confirmed Diagnosis
- To repair: moves into Waiting to Proceed / Proceed Repair / Ongoing Service
- Released: moves into Done Repair - For Release / Advise Client
- Paid: POS payments they recorded (voided payments excluded)
- Handed over: device releases they processed
- Completed: tickets they moved to Completed
- Idle check: tickets assigned to them with no activity

Additions to build, grouped under each existing stage column:

**Diagnosed**
- AI diagnosis generated (count of tickets where they ran the AI diagnosis)
- Technician diagnosis written (manual diagnosis text saved)
- Diagnosis photos uploaded
- Time from intake to their Confirmed Diagnosis (average hours)

**To repair**
- Device report photos uploaded
- Technician report written / saved
- Quotation generated (Service Quotation PDF created)
- Parts requested and parts received on their tickets
- Waiting-for-Parts flags they raised and cleared

**Released**
- Release-ready turnaround: hours from Ongoing Service to their release move
- Observation passes (moves into Done Repair - Under Observation)
- Client advised count (moves into Done Repair - Advise Client)

**Completed**
- Revenue completed (final cost of tickets they closed)
- Backjob rate: tickets they completed that later returned as Backjob
- Rush / Within-the-Day SLA hit rate (closed within the promised window)
- Average full turnaround for tickets they closed (service date to completion, Sundays excluded)

**Cross-stage (new small columns)**
- Intake created (tickets they opened) and queue entries they processed
- Reopened/declined approvals they handled


## Technical notes
- Files touched: `src/App.tsx`, `src/components/DashboardLayout.tsx`, `src/components/CommandPalette.tsx`, `src/components/workbench/workbenchRoutes.tsx`, `src/pages/Menu.tsx`, `src/pages/ServiceTracker.tsx`, `src/pages/ServiceTracking.tsx`, `src/pages/AttendanceOverview.tsx`, `src/components/ConfirmReleaseModal.tsx`, `supabase/functions/record-attendance/index.ts`, plus a new `supabase/functions/within-day-stale-alerts` function.
- Backend work: one data update to clear late flags at or before 10:10 AM, a scheduled job for the stale-ticket alerts, and a small table (or notification-based dedupe) to remember the last alert time per ticket.
