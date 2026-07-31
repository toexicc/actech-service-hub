## Verified findings

- **Parts search is dead** — the search box on "Parts Used from Inventory" has an `onChange` that filters into a local variable and throws it away (there's a `// Just update display` comment). The list below only renders already-selected parts, so typing does nothing.
- **Inventory deduction works** — on save, Service Update writes the parts list, calls `applyPartsDelta` (decrements `inventory_parts`/`fast_moving_parts`, logs to part logs), and stores the computed parts cost on the service record.
- **Parts cost never reaches Completed Transactions** — the completed-services hook hardcodes `partsCost: 0` and `discount: 0` instead of reading the stored values, so every row shows 0 parts cost and all commission/net-sales math on that page is computed off zero.
- **Stage fields follow the selected status** — the reveal logic uses the newly picked status, so on a ticket at Proceed Repair, choosing Ongoing Service immediately shows the Ongoing Service (parts) fields.

## Changes

**1. Stage fields follow the actual (saved) status**

Keep the status-first gate: nothing appears until a new status is picked. But the fields that appear belong to the ticket's *current saved* stage, not the stage being moved into. So at Proceed Repair, picking Ongoing Service shows only the fields that belong to Proceed Repair — the parts section appears on the next visit, when the ticket actually sits at Ongoing Service. Same rule for every stage (diagnosis fields while at Pending Diagnosis, report fields while at Done Repair stages, remarks-only for closing statuses).

**2. Parts search across all part fields**

Make the search box actually filter, matching typed text against every useful field: Part ID, part name, brand, device type/category, model, part type, color, and supplier. Multiple words all have to match (e.g. "iphone 13 screen" finds it regardless of field order). Each result row shows name, ID, brand/model, color and stock so the right variant is easy to pick, and the same searchable dropdown is used for the "Add Part" selector. Selected parts stay visible regardless of search text; clearing the box restores the full list.

**3. Parts cost on Completed Services**

Read the stored parts cost and discount from the service record in the completed-services hook so the Parts Cost column, net sales, and commission math use real values.

**4. Rename Completed Transactions → Completed Services**

Rename across that page: heading, subtitle, tab/breadcrumb label, sidebar entry, command-palette entry, and any toast/empty-state copy. Route path stays the same so existing links and open tabs keep working.

## Technical notes

- Service Update: replace `stageStatus = statusChanged ? updateStatus : ""` with `statusChanged ? savedStatus : ""`; visibility maps stay as-is. Required-field validation stays keyed to the fields actually shown.
- Search: `partSearch` state + a shared token-matching helper over the inventory item fields (id, name, brand, deviceType, model, partType, color, supplier); used by both the selectable list and the Add Part dropdown.
- `useDoneServices`: map `parts_cost` and `discount` instead of literal zeros.
- Rename touches `CompletedTransactions.tsx`, `DashboardLayout.tsx`, `CommandPalette.tsx` (labels only). No schema changes needed.
