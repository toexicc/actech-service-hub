# Clean, trustworthy payout math on Completed Services

Goal: strip out every hidden department formula so nothing is computed behind your back, make the Commission Rate field genuinely a percentage of profit, and let you enter the real parts cost per ticket inside the expanded breakdown.

## 1. Remove all internal auto-computation

On the Completed Services page, delete the built-in department rules:

- No more +10% parts markup for Laptop (Daily Repairs)
- No more automatic 30% for Laptop (Daily Repairs)
- No more automatic 50% for Mobile (Logic Board)
- No more special "Mobile (Logic Board) only" half-the-profit summary logic
- No more per-row editable "screen commission" box for Laptop (Screens)

Result: with the rate left at 0 and no parts cost entered, every Commission cell and the Commission / Final Profit cards read ₱0.00 — nothing is invented.

## 2. Commission Rate (%) = percentage of profit

The rate field at the top applies uniformly to every ticket currently shown by the filters (technician, department, date range):

```text
Profit     = Quoted Price - Discount - Parts Cost
Commission = Profit x Rate%     (never below 0)
```

The label becomes "Commission Rate (% of profit)" with a short hint so it is unambiguous. Summary cards recompute from the same numbers as the rows, so the table and the cards always agree.

## 3. Parts Cost input inside the expanded breakdown

In the row that opens when you click a ticket (the panel above "Total Service Cost"), add a Parts Cost field:

- Saved to the ticket, so it persists after reload and updates the Parts Cost column and all totals
- The panel header shows the live math: Total Service Cost, minus Parts Cost, = Gross Profit, then Commission Pool at the current rate
- Allocation lines are now allocated out of the Commission Pool (not the full service cost). The panel shows Allocated vs Pool and flags when allocations exceed the pool

Allocations remain the source of truth for what a technician is actually paid: when a ticket has saved allocation lines, the Commission column shows the allocated total for that ticket instead of the formula result.

## Technical notes

- `src/pages/CompletedTransactions.tsx`: remove department branches and `screenCommissions` state from both `financialSummary` and the row renderer; single shared `computeRow(service)` helper used by cards and rows.
- `src/components/ServiceBreakdownPanel.tsx`: new `partsCost` prop plus a numeric input; writes `parts_cost` on `services` via a small mutation, invalidating `doneServices` on success; header shows pool math from a new `commissionRate` prop.
- No schema change needed — `services.parts_cost` already exists and is already read by `useDoneServices`.
