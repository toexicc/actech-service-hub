# Stop overdue and "In service" counting once a repair is finished

## What changes

Right now a ticket keeps being flagged **Overdue** and keeps adding **In service** days even after the repair is finished and it is only waiting for the client to pick it up.

New rule — tracking stops as soon as a ticket reaches any of these:

- Done Repair - For Release
- Done Repair - Advise Client
- Completed
- Cancelled / On Hold / RTO (ACTech or Client)

Everything earlier in the workflow keeps counting as it does today.

## Where it applies

- **Service Tracker / Service Tracking** — the red Overdue flag, the Overdue and On Track cards, the Overdue filter, and the "In service X days" figure on both cards and table. Finished-but-unreleased tickets show "—" for In service (same as completed tickets do now) and are never red.
- **Menu dashboard cards** (Due Today, Overdue, and the overdue list) — same stop points.
- **Tech Dashboard (/tech-dashboard)** — already hides these statuses from its Due Today / Overdue lists; it will use the same shared rule so the three pages can never drift apart again.

## Backfix

No data needs changing — both numbers are calculated live from each ticket's status, target date and service date, so every existing ticket picks up the new rule the moment it loads. The separate "Duration in system" figure is unaffected.

## Technical notes

- Add one shared helper in `src/lib/serviceStatus.ts`, e.g. `isTimeTrackedStatus(status)` returning false for completed, closed (`isClosedStatus`) and the two Done Repair - For Release / Advise Client statuses (matched case-insensitively, tolerating the legacy "Done Repair - Observation" spelling only where it already is tracked).
- `ServiceTracker.tsx`: `isOverdue()` (line ~732) and `calculateInServiceDays()` (line ~674) return false / 0 when `!isTimeTrackedStatus(status)`; the card/table renderers reuse the existing `isCompleted` branch to render "—" for these statuses.
- `Menu.tsx` (~line 130-155): replace `classifyStatus(s.status) === "active"` in the due-today/overdue filters with `isTimeTrackedStatus`. The Active Services count keeps using `classifyStatus` so the workload count is unchanged.
- `OpenDashboard.tsx` (~line 46): swap the hardcoded `excludedStatuses` array for the shared helper.
