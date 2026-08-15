# Why the department counts don't tally (29 vs 26)

## What's happening

Both pages read the same tickets, but they filter departments differently.

- Service Tracker matches a ticket if **any** assigned technician's department equals the filter.
- Completed Services joins all departments into one text string (e.g. `"Laptop (Logic Board), Laptop (Screens)"`) and then requires that whole string to **exactly equal** `"Laptop (Screens)"`. Multi-technician tickets never match.

Verified in the database for Completed tickets:

- Tickets with Laptop (Screens) among their departments: **29**
- Tickets whose joined department text is exactly "Laptop (Screens)": **26**

The 3 dropped tickets are all multi-department ones:

- AC010826096 — Laptop (Daily Repairs), Laptop (Screens)
- AC150826059 — Laptop (Screens), Laptop (Logic Board)
- AC150826072 — Laptop (Logic Board), Laptop (Screens)

The same bug affects the **Technician** filter on Completed Services: a ticket with two technicians produces `"Kevin Baunsit, Kenn Perez"`, which never equals a single name, so those tickets vanish when filtering by one technician. The technician dropdown itself is also built from these joined strings, so it lists combined pairs like "Kevin Baunsit, Kenn Perez" instead of individual staff.

## The fix

On the Completed Services page:

1. Keep the raw arrays of technicians and departments per ticket alongside the display text.
2. Department filter: match if the selected department is **in** the ticket's department list (same rule as Service Tracker).
3. Technician filter: match if the selected technician is **in** the ticket's technician list.
4. Build the Technician dropdown from individual names (flattened, de-duplicated, sorted) instead of joined strings.

No changes to totals math, commission logic, or the breakdown panel — only which rows pass the filters. After this, filtering Laptop (Screens) on Completed Services will show 29, matching Service Tracker, and every other department/technician will tally too.

## Technical notes

- `src/hooks/useDoneServices.ts`: add `technicianList: string[]` and `departmentList: string[]` to the `DoneService` shape, mapped from `r.technicians` / `r.technician_departments`; keep the existing joined `technician` / `department` strings for display.
- `src/pages/CompletedTransactions.tsx`: change the two equality checks in `filteredServices` to list membership, and rebuild `uniqueTechnicians` from `flatMap(s => s.technicianList)`.
