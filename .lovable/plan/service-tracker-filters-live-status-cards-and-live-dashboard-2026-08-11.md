# Service Tracker filters, live status cards, and live dashboards

Applies to both `/service-tracker` and `/service-tracking` (both render the same Service Tracker screen), plus the Admin and Technician dashboards.

## 1. Refresh button actually refreshes

Today the button only marks the cache stale and shows no feedback, so it looks dead. It will:
- Trigger a real refetch and await it.
- Spin while fetching (not only on first load) and disable during the fetch.
- Show a short "Tickets refreshed" toast on completion, or an error toast on failure.

## 2. Filters combine correctly

Current problems and fixes:
- **Technician vs Department**: department is ignored whenever a technician is picked (`else if`). Both will apply together.
- **Status vs Tab**: picking a status force-switches the tab, which silently drops the tab filter (e.g. Within the Day, Walk In). Status and tab will apply independently; the tab only switches when the chosen status could not appear in the current tab (e.g. picking Completed while on Ongoing).
- **Date range**: only reads the created timestamp and hides any ticket whose date can't be parsed. It will try service date, received date, then created timestamp before excluding a row.
- **While loading**: the list currently returns empty during any background fetch state; filtering will only be suppressed on the very first load so filters keep working during refreshes.
- Every filter (search, device, technician, department, status, date range, due-date status, tab) will be verified as an AND combination.

## 3. Quick date filters

Add **Today** and **Yesterday** next to Last 7 / Last 30 / This Month, plus **This Week**. Behaviour:
- Each preset sets both From and To (Today = today→today, Yesterday = yesterday→yesterday).
- The active preset is highlighted so it's obvious which one is on.
- Clear Date Filter resets both dates and the highlight.

## 4. Status count cards (live, filter-aware)

Below the All / Overdue / On Track cards, add a compact grid of status cards:
Pending Diagnosis, Confirmed Diagnosis, Waiting to Proceed, Ongoing Service, Done Repair - For Release, Done Repair - Advise Client, Completed.

- Counts come from the currently filtered set, but ignore the Status dropdown itself so the row always shows the full breakdown of what the other filters match.
- Clicking a card sets the Status filter (clicking the active one clears it).
- Numbers update live from the existing realtime subscription on services — no reload needed.

## 5. Dashboards fetch live data

Admin and Technician dashboards will refresh their numbers without a manual reload: keep the realtime-driven cache updates, keep a light safety-net poll, and re-fetch on mount so a returning tab is never stale. Loading placeholders will not blank out already-loaded numbers during a background refresh.

## Technical notes

- `src/pages/ServiceTracker.tsx`: refresh handler (`isFetching` + await refetch), `filteredAndSortedServices` predicate rework (technician AND department, tab/status independence, multi-source date parsing, first-load-only guard), `applyDatePreset` extended with `today` / `yesterday` / `thisWeek` and an `activePreset` state, new status-count card row derived from a second memo that omits `statusFilter`.
- `src/hooks/useServices.ts`: expose `isFetching`/`refetch` usage as needed; no query-key or schema changes.
- `src/pages/AdminDashboard.tsx`, `src/pages/OpenDashboard.tsx`: use `isPending` instead of `isLoading` for skeletons and rely on realtime invalidation already wired in `DashboardLayout`.
- No database or backend changes; `services` is already published to realtime.
