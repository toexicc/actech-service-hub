# Real output leaderboard from activity logs

Today the Admin output chart and Admin leaderboard count tickets where a person's name appears in the *assigned* admin / receiving staff fields. That measures assignment, not work. The activity log already records every status move with the person who made it, so we can measure who actually pushes tickets forward.

Verified in the logs (last 60 days): status-move entries exist per person, e.g. Romar Badilles 346 moves, Jefferson Espedido 170, Mark Bamboa 162 — so the data is there. Role is only stored on ~40% of log rows, so role will be resolved from the staff directory by name instead.

## What we will measure

For every status transition log in the selected report period (`Status: A → B` by actor):

- **Moves** — total status changes the person made (the raw activity signal).
- **Tickets touched** — distinct service IDs they moved.
- **Diagnosed** — moves into Confirmed Diagnosis.
- **Pushed to repair** — moves into Proceed Repair / Ongoing Service.
- **Released / Completed** — moves into Done Repair - For Release and into Completed.
- **Driven end-to-end** — tickets where the person made the move into Completed *and* at least one earlier move on the same ticket (the "moved it from Pending Diagnosis to Completed" metric requested).
- **Assigned but untouched** — tickets assigned to them where they made zero status moves (idle-assignment check).

## New UI on /reports

Replace the two assignment-based admin panels with output-based ones, and add the same for technicians:

1. **Output leaderboard** (table, sortable-by-metric select: Completed / Driven end-to-end / Moves)
   Columns: Staff · Role · Moves · Tickets touched · Diagnosed · To repair · Released · Completed · Driven end-to-end · Assigned untouched.
2. **Who moves tickets** (horizontal stacked bar, top 8): Diagnosed / To repair / Released / Completed per person.
3. **Stage handoff matrix** (compact table): rows = staff, columns = the key transitions, values = counts. Shows whether a person only does intake or actually carries tickets through.
4. Keep the existing assignment-based numbers, but relabel that panel **Assignment load** so the distinction is explicit.

Filters follow the existing period selector. A small role filter (All / Admin / Management / Technician) sits on the leaderboard header.

## Technical notes

- `src/lib/reportMetrics.ts`: add `actor` (and `role`) to `StatusLogEntry`, keep the existing `parseStatusLog` regex, and add a pure `buildActorOutput(logs, services, period, staff)` that returns the per-person metrics above.
- `src/hooks/useServiceStatusLogs.ts`: also select `actor_name` and `changes` so the actor is available; keep the same query key/staleTime.
- Roles come from the existing `staff_directory` RPC via `fetchStaffList`, matched case-insensitively on name/username (same approach as `technicianMatch`), so log rows without a stored role still get one.
- `src/pages/Reports.tsx`: new memo for actor output, three new panels, existing `admins` memo kept and renamed in the UI to Assignment load.
- No schema changes, no new backend work — everything is derived from `activity_logs` already being written.
