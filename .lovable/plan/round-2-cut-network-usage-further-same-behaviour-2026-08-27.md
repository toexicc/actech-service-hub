# Round 2: cut network usage further, same behaviour

Network is still the top cost (10.8 vs 3.87 database in the usage panel). The first round trimmed columns on the ticket list and slowed the timers. What is left is mostly **still-unbounded row counts**, **`select *` on wide tables**, and **repeat downloads after every page reload**. None of the changes below alter what users see or how the flow works.

## 1. Bound the row counts (biggest remaining win)

Today the ticket list pulls up to 5000 rows on every cold load, and it grows every day.

- Ticket list: fetch all non-completed tickets always, plus completed tickets from the last 60 days. Anything older is already only reachable through Completed Services, the CSV export, and Reports — each of which keeps its own date-scoped query.
- Completed Services (`useDoneServices`): today `select *` with 1000 rows. Switch to the 12 columns it actually maps and scope it to the selected period instead of the last 1000 rows.
- Reports transactions/expenses: scope both to the selected report period instead of 5000 rows.

## 2. Stop `select *` on wide tables

Each of these downloads columns nothing renders:

- Single-ticket watcher (`useServiceLiveWatch`) runs three `select *` per ticket open (seed, focus check, save) — every one pulls the full ~6 KB row including AI diagnosis and reports. It only compares 16 fields, so select those 16.
- Queue entries: `select *` includes the whole `form_payload` JSON blob for every waiting entry, re-fetched on every realtime change and on the public display. Select the display columns; load `form_payload` only when a staff member opens the intake modal for one entry.
- Clients, inventory, fast-moving parts, client inquiries, attendance logs, staff profiles: replace `select *` with the columns each view maps.

## 3. Stop re-downloading everything after a reload

Right now every browser reload (and every PWA cold start) refetches the full working set. Add React Query persistence to local storage with a short max age, so a reload rehydrates from disk and only revalidates what is stale. This is the change that removes the most repeat traffic for staff who keep reopening the app during a shift.

## 4. Subscribe only to what a session needs

Every session currently subscribes to all 11 realtime tables, so a POS transaction pushes row payloads to technician tablets that never render them. Scope the subscription set by role and open page (tickets + notifications for everyone; inventory/part requests, transactions/expenses, queue only where used).

## 5. Small cleanups

- Ticket-detail loads on `/manage-client`, `/service-update`, `/track` use an explicit detail column list instead of `*`.
- Command palette searches already limit rows; also narrow their columns.

## Technical notes

Files: `src/hooks/useServices.ts`, `useDoneServices.ts`, `useServiceLiveWatch.ts`, `useQueueEntries.ts`, `useClients.ts`, `useInventory.ts`, `useFastMovingParts.ts`, `useClientInquiriesData.ts`, `useStaff.ts`, `useRealtimeInvalidate.ts`, `src/App.tsx` (query-client persistence), `src/pages/Reports.tsx`, `ServiceUpdate.tsx`, `ManageClient.tsx`, `ServiceTracking.tsx`, `AttendanceOverview.tsx`, `CommandPalette.tsx`. No schema or RLS changes.

Expected effect: cold-load payload down roughly another 60–70% as the completed backlog stops being downloaded, per-ticket-open traffic down about 80%, and reload traffic near zero for cached data.
