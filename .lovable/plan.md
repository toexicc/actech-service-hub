# Waiting for Parts, Report Timing Rules, Holidays, and Release Queue

## 1. Report average-time rules

Update the working-hours math and per-service timing so averages reflect real productive time:

- Skip Sundays entirely (in addition to existing closed dates).
- Pause the clock while a ticket sits in a non-productive state:
  - Waiting to Proceed
  - Done Repair - Advise Client
  - On Hold
  - Cancelled
  - RTO
  - any period where the new "Waiting for Parts" toggle is on
- Stage-by-stage hours still record time in those statuses (so you can see how long tickets stall), but they no longer count toward total turnaround or averages.

Waiting-for-Parts pauses are derived from the activity log (toggle on/off events), so historical tickets stay accurate.

## 2. Waiting for Parts toggle

New ticket flag `waiting_for_parts` plus timestamped log entries.

- `/manage-client`: toggle directly below the "Client pre-approved the diagnosis" toggle.
- `/service-update`: toggle in the same placement as the pre-approval toggle.
- Turning it on/off writes an activity log entry ("Waiting for Parts turned on/off" with the staff name) so the pause windows are auditable.
- `/track`: when on, an amber chip appears below the status line — "Waiting for Parts — sourcing the required parts/supplies for your repair" — so clients understand the pause.

## 3. Attendance: holidays

- New "Declare Holiday" control on Attendance Overview (date, label/description, optional note).
- On declaring, the system auto-creates Holiday attendance records for all active staff for that date.
- Staff can still time in/out on a holiday via `/attendance`; a real log overrides the auto record and is tagged "Holiday" (worked-on-holiday).
- Holiday rows are visually tagged in the overview table and filterable, and are excluded from "missing log" reminders/reconciliation.

## 4. Queue: Intake + Release

Queue entries gain a `kind` field (`intake` or `release`).

**Queue console (`/queueing`)**
- Tabs become: Queue (live board), Intake, Release.
- Intake tab keeps its current tracker; Release tab is the equivalent tracker for release submissions.

**Public `/release` page (new)**
- Search by Service ID only.
- On match, shows a brief summary: client name/contact, device (type · brand · model), service, status, and balance-free summary details.
- A single Confirm button creates a Release queue entry (Waiting), then shows the queue number + QR to the public board, same as intake.
- No status changes or other side effects — queue entry only.

**Public board `/queue`**
- Two labelled containers: Intake and Release, each with Waiting and Proceed to Front — 4 columns total.
- Old-TV friendly rendering: no backdrop blur or modern-only CSS effects, large high-contrast type, fixed grid that degrades to stacked columns, no dependence on container queries or `dvh`.

## Technical notes

- Migration: `services.waiting_for_parts boolean not null default false`; `queue_entries.kind text not null default 'intake'` with a check constraint; anon insert policy for release entries mirrors the existing intake policy.
- `src/lib/reportMetrics.ts`: add Sunday skip in `workingHoursBetween`; add a paused-status set and Waiting-for-Parts interval subtraction in `buildTimings`.
- `public_service_snapshot` RPC extended with `waiting_for_parts` for the `/track` chip; a new read-only RPC returns the trimmed release summary for anonymous `/release` lookups.
- New files: `src/pages/PublicRelease.tsx`, `src/components/ReleaseQueuePanel.tsx`; routes added in `App.tsx`; `QueueDisplay.tsx` and `QueueAdmin.tsx` updated for the intake/release split.
