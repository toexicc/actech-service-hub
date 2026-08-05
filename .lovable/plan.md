# Fix ticket visibility, technician step order, and quotation page overflow

## 1. Service Tracker: tickets missing / reappearing, filters misbehaving

Confirmed from the code and the database:

- The tracker builds its list from **two separate queries** (active tickets, completed tickets) that are merged in `useAllServices`. Only `data` and `isLoading` are read — **query errors are silently swallowed**, so if either request fails (dropped socket, token refresh, transient error) the page shows a partial list or "No ongoing services found", and a reload makes them come back. This matches the reported symptom exactly.
- The **Technician** and **Department** filter options are built from the joined technician string (`"A, B"`), so multi-technician tickets create bogus options and the department filter compares a department against a joined name list — it never matches, hiding tickets.
- The default tab is **Ongoing**, and a status filter carried in from a dashboard link can conflict with the active tab (e.g. status `Completed` while tab = Ongoing), producing an empty result that looks like "filters not working".
- Database check: all 113 tickets have technicians assigned, and the technician read policy scopes on the assigned-technician name match, so completed tickets are readable — the loss is on the client side.

Changes:

- Fetch services with **one query** (all statuses, single cache key), and derive active/completed/closed views from it. Keep the existing `useServices` / `useCompletedServices` exports as thin selectors so Dashboard, Menu, Reports and the calendar keep working.
- Surface `error` in the tracker: show a retry banner instead of an empty "no services" state, and never render a filtered list while a fetch has failed.
- Rebuild the Technician filter options from **individual technician names** (split on commas, de-duplicated, from the staff directory) and make the department filter match if **any** assigned technician belongs to that department.
- When a status filter arrives that belongs to another class (completed/cancelled), switch the tab to match instead of silently returning zero rows; show a small "filters active — clear" control so users can reset in one click.
- Clamp the current page when the filtered count shrinks, so the last page never renders empty.

## 2. Technician `/service-update`: AI blocks belong to Step 2

The AI Diagnosis Formatter and AI Report Formatter collapsibles currently render **above** the "Set the status first" gate, so they show up as part of Step 1.

Change: move both collapsible blocks inside the Step 2 branch, directly under the "Step 2 — <status>" banner, keeping the existing visibility rules (diagnosis stage / report stage) and keeping Diagnosis Photos under the AI Diagnosis block and Device Report Photos under the AI Report block.

## 3. Service Quotation PDF spilling to a blank second page

The right column flows Service Summary, then Service Breakdown, each able to call `addPage()`. The shrink pass measures blocks but not the panel headers/padding that the flow adds, so a breakdown with as few as two items can start below the usable limit and push a page that ends up visually empty.

Changes in `src/lib/quotationPdfGenerator.ts`:

- Measure the **combined** right-column requirement (summary + breakdown, including panel header height, inner padding and gaps) before drawing, and scale summary and breakdown together until the pair fits the page-1 right column.
- Treat the quotation body as strictly **one page**: the panel flow no longer adds pages; if content still exceeds the region at the smallest scale, it compresses line leading further rather than paginating.
- Safety net after drawing: drop any page the body created beyond the first, so the appended Terms & Conditions is always page 2.

## Verification

- Render quotation previews for a live ticket with a one-item and a two-item breakdown and confirm the body is a single page with the breakdown fully inside it.
- Load the tracker across the All / Ongoing / Completed / Within the Day / Walk In / Cancelled tabs and confirm counts stay stable across refetches, and that technician and department filters return the expected tickets.
