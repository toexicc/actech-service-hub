## What I verified first

- `src/pages/Menu.tsx` really does render **two identical "Ongoing Services" cards** (the non-technician card list repeats the same entry twice).
- The dashboard cards link to `/service-tracker?status=Ongoing Service`, `?status=Completed`, `?statusFilter=overdue`. In `ServiceTracker.tsx` the tab defaults to **"Ongoing"**, and the tab filter is applied *in addition to* the status filter. So `status=Completed` lands on the Ongoing tab → empty list; `statusFilter=overdue` sets the due-date filter but the tab still hides completed/closed rows. That is why dashboard clicks "load nothing" for every role.
- The Menu counts are whole-database counts ("ongoing" = every non-completed, non-cancelled ticket, "completed" = all completed ever), not "today's numbers", and they don't correspond to any tracker tab.
- The **Within the Day** and **Walk In** tabs filter only by priority/client type, so Cancelled/RTO/On Hold tickets wrongly show up there today. This gets fixed.
- Realtime is enabled on `services` and `useRealtimeInvalidate` is mounted in `DashboardLayout`, but `ServiceForm` submits an insert without invalidating the services caches, and Menu/tracker queries use long `staleTime` with `refetchOnMount: false`, so a fresh intake often doesn't appear until reload.
- `services` has a DELETE policy for **admin only** — management currently cannot delete.
- `/attendance-overview` is already management-only in the workbench route table, so a Reports page can follow the same pattern.

## Plan

### 1. Dashboard numbers that make sense
- Remove the duplicate Ongoing card.
- Redefine the cards so each one matches exactly what the tracker will show, and label them honestly:
  - **Active tickets** (all non-completed, non-cancelled/RTO/On Hold)
  - **Due today**
  - **Overdue**
  - **Completed today** (and technician equivalents scoped to their assignments)
- Compute all four from the same helper used by the tracker's tab logic, so counts and lists can't drift.

### 2. Dashboard → Service Tracker deep links
- Extend the tracker's URL handling to accept a `tab` param and to auto-select the correct tab when a `status`/`statusFilter` implies one (Completed → Completed tab, cancelled statuses → Closed tab, overdue/due-today → All tab).
- Dashboard cards, the due-date calendar, and the "View all" link will pass the tab explicitly, so a click always lands on a non-empty, correct list.
- Apply incoming filters before the first render pass so the list doesn't flash empty.

### 3. Real-time visibility of new/updated tickets
- Invalidate the services/clients caches right after intake submit, ticket update, and delete, so the tracker and dashboard update without reload.
- Add the missing realtime table→query mappings (`queue_entries`, `activity_logs`) and make sure invalidation covers the completed-services and tracker keys.
- Lower `staleTime` for the services queries and refetch when a hidden workbench tab becomes active again, so switching back to a kept-alive tab shows current data.

### 4. Cancelled / RTO / On Hold: strictly two tabs, zero leaks
- Add one shared classifier (`active` / `completed` / `closed`) and apply it to **every** tab, not just Ongoing.
- A Cancelled, RTO or On Hold ticket will **never** appear in **Within the Day**, **Walk In**, **Ongoing** or **Completed** — only in **All** and **Cancelled / RTO / On Hold**.
- Tab counts and the header count use the same filtered set as the visible rows, so the numbers reflect the tab being shown.

### 5. Delete a service (management only)
- Add a DELETE policy allowing management (keeping admin), plus cleanup of dependent rows (service files/breakdowns references) so deletion doesn't fail.
- In the tracker row actions and on the ticket workspace, show a **Delete service** action for management only, behind a confirmation dialog that requires confirming the Service ID.
- Write an activity log entry (actor, service ID, client name) before removal, and refresh caches after.

### 6. Edited ticket details must flow into the PDFs
- After the details editor saves, re-read the ticket from the database (not cached/stale state) so the workspace shows the new values immediately.
- Make **Update Form** (client intake form) and **Generate/Update Form** (service quotation form) build their payloads from that freshly read row — client name, contact, socials, device, storage/color, conditions, staff, costs, discount — and overwrite the stored PDF for the same service so `/track`, `/manage-client`, and `/service-update` all serve the regenerated file.
- Live on-screen display stays as-is (no PDF generated on every edit); PDFs regenerate only when the user clicks the form buttons.

### 7. New Reports page (management only)
Route `/reports`, sidebar entry directly under **Attendance Overview**, guarded to the management role, with a date-range selector (default: last 30 days) and CSV export.

Sections:
- **Throughput & speed** — tickets received, completed, cancelled; average and median turnaround (intake → completion) derived from ticket timestamps and status-change activity logs; average time per stage; on-time vs overdue completion rate.
- **Completion rate** — completed ÷ received for the period, with a weekly trend line.
- **Revenue** — gross service revenue, parts cost, discounts, expenses, and net revenue from completed services plus transactions/expenses; revenue per ticket.
- **Top technicians** — completed count, average turnaround, revenue contribution, backjob count.
- **Top devices** — most-serviced device types, brands and models, with average cost and turnaround.
- **Ticket mix** — status distribution, client type (walk-in vs pickup vs returning), priority mix, source (intake/queue/staff).
- **Parts** — most-consumed parts and low-stock signal count.

### Technical notes
- Files touched: `src/pages/Menu.tsx`, `src/pages/ServiceTracker.tsx`, `src/components/DueDateCalendar.tsx`, `src/hooks/useServices.ts`, `src/hooks/useRealtimeInvalidate.ts`, `src/pages/ServiceForm.tsx`, `src/pages/ManageClient.tsx`, `src/components/workspace/ServiceDetailsEditor.tsx`, `src/components/workbench/workbenchRoutes.tsx`, `src/App.tsx`, `src/components/DashboardLayout.tsx`, plus new `src/pages/Reports.tsx`, `src/hooks/useReports.ts`, and a shared `src/lib/serviceStatus.ts` classifier.
- One migration: DELETE policy for management on `services` (+ dependent-row cleanup); no schema changes otherwise.
- Reports read existing tables only (`services`, `activity_logs`, `transactions`, `expenses`, `inventory_parts`); no new tables.
