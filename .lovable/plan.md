## Goal
Turn `/reports` from plain stat cards into a comprehensive management analytics dashboard: real charts, log-derived turnaround in hours, and a month filter (default) plus custom date range.

## Filters (top bar)
- **Month picker (default)** — defaults to the current month; dropdown of the last 12 months.
- **Custom date range** — date-range calendar popover (react-day-picker, already installed).
- **Quick presets** — Last 7 / 30 / 90 days, This year, All time.
- Selected period drives every metric; each headline card also shows a **vs. previous period** delta (% up/down).

## Turnaround: hours, from activity logs
`activity_logs` already records parseable transitions like `Service updated: Status: Pending Diagnosis → Confirmed Diagnosis` keyed on `entity_id` = Service ID, plus `New service created ...`.
- Build a log-based timeline per service and compute **turnaround in hours** (first log/`date_received` → the log that moved it to Completed).
- Show as `Xh` / `Xh Ym`, and `Xd Yh` only when over 24h — never bare "days".
- Also derive **average hours per stage** (Pending Diagnosis → Confirmed → Proceed → Ongoing → Done → Completed) to expose bottlenecks.
- Fallback to `date_received` → `date_completed` only when a service has no logs, and label the coverage (e.g. "based on 42 of 47 tickets with logs").

## New layout
1. **Headline KPI row (6 cards, with sparkline + delta)** — Tickets in range, Completion rate, Avg. turnaround (hours), On-time delivery, Net revenue, Avg. ticket value.
2. **Volume & revenue trend** — combined chart: bars for tickets received vs completed, line for revenue, bucketed daily (short ranges) or weekly/monthly (long ranges).
3. **Turnaround analysis** — bar chart of average hours per workflow stage + distribution histogram (<4h, 4–24h, 1–3d, 3–7d, 7d+).
4. **Financial breakdown** — stacked bars of gross revenue / parts cost / expenses / discounts over time, plus a net-profit line and the existing summary tiles.
5. **Technician performance** — horizontal bar chart of completed tickets per tech, alongside the existing leaderboard table extended with avg. hours, on-time %, and revenue share.
6. **Device & brand mix** — donut chart for device types, bar chart for top brands.
7. **Status funnel / "Where tickets are now"** — funnel-style horizontal bars across the workflow statuses.
8. **Operational insights** — priority mix, walk-in vs intake vs queue source, cancelled/RTO reasons count, busiest intake day/hour heat strip.

All charts use `recharts` with existing semantic design tokens (no hardcoded colors), inside the current glass-panel card styling; each chart is responsive and collapses to a single column on mobile.

## Technical notes
- Extract metric computation into `src/lib/reportMetrics.ts` (pure functions: bucketing, stage timings, deltas) so `Reports.tsx` stays presentational.
- New hook `src/hooks/useServiceStatusLogs.ts` — fetches `activity_logs` rows for `entity_type = 'service'` in the selected window and parses status transitions.
- Reports.tsx keeps using `useServices` / `useCompletedServices`; transactions and expenses queries are widened to include category/type fields needed for the financial breakdown.
- Management-only access stays unchanged.
- No database or schema changes required.
