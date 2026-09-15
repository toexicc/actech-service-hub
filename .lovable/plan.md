# Make Transaction Tracker, Completed Services and Salary Disbursement tally

First: the reconciliation walk I added to the Reports page gets removed — Reports goes back to its KPI cards and charts. The tallying between the three pages comes from shared figures instead of an extra panel.

Then the three pages get one shared window and matching figures, so the same cut-off gives the same numbers on all three.

## Why they disagree today

Each page currently answers a different question over a different date:

| Page | Counts | Dated by |
|---|---|---|
| Completed Services | Quoted price of completed tickets | Completion date |
| Transaction Tracker | Cash actually received | Payment date |
| Salary Disbursement | Commission allocated per technician | Completion date |

So a ticket completed on Aug 30 and paid on Sep 2 lands in a different half-month on two of the three pages, and quoted value never equals cash received on the same list. Neither page is wrong — they were just never labelled or aligned.

## 1. Same window on all three pages

Transaction Tracker and Completed Services keep their free From/To dates, and both gain **1-15** and **16-End** quick buttons plus a month picker, exactly matching the Salary Disbursement cut-off. Clicking a cut-off on any page gives the identical window the salary page uses.

The chosen cut-off is remembered, so moving between the three pages keeps the same period instead of resetting.

## 2. Same two money figures everywhere

Every page shows the same pair for the selected cut-off, using the same ticket list (tickets completed in the window):

```text
Billable value  = Quoted price - Discount        (what the work was worth)
Collected       = payments received on those tickets
```

- **Completed Services**: adds a Collected column per ticket and a Collected summary card next to Gross Sales, plus Unpaid = Billable - Collected.
- **Transaction Tracker**: keeps its cash-in-the-drawer view (that is its job) and adds a second line under Total Sales — "of which on tickets completed this cut-off" — so it can be matched against Completed Services' Collected figure. Amounts collected on older tickets are shown separately rather than mixed in.
- **Salary Disbursement**: the ticket count and commission total already come from the completed tickets in the cut-off; it gains the Billable and Collected totals for that same list, so the payslip base is visibly the same set of tickets Completed Services shows.

## 3. Commission agrees by construction

Commission stays what it already is: only the allocations saved in Completed Services. Salary Disbursement reads those same allocations for the same window, so the two commission totals cannot drift. Where a completed ticket has no allocation yet, both pages flag it in the same readiness warning instead of one page quietly showing a smaller total.

## 4. A single "does it tally" line

At the bottom of each of the three pages, one short line for the selected cut-off:

```text
Billable 2,208,245  -  Collected 2,237,615  =  Unpaid -29,370
Commission allocated 46,168 (matches Salary Disbursement)
```

Same numbers, same wording, same window on all three. If a figure ever differs, the line makes it visible instead of leaving you to compare cards by eye.

## Technical notes

- `src/pages/Reports.tsx`: remove the `MoneyReconciliationPanel` render and import (the reconciliation walk you saw) — page returns to its previous layout, keeping the Cash collected / Value of completed work card split and the intake/completion date toggle.
- `src/pages/TransactionTracker.tsx`: add cut-off preset buttons + month select driving `dashStartDate` / `dashEndDate`; add the "on tickets completed this cut-off" split using the existing completed-ticket ID set already loaded for the parts card.
- `src/lib/moneyReconciliation.ts`: keep as the single shared calculator; add `commissionAllocated` (sum of `service_breakdowns.cost` for the window's service IDs) so all three pages read one function.
- Shared cut-off: new `src/lib/cutoffPeriod.ts` exporting `cutoffRange(month, half)` and cut-off preset UI helper, persisted via `useFilterPersistence` under one key read by all three pages; `SalaryDisbursement.tsx` reuses it instead of its local `periodRange` math.
- `src/pages/CompletedTransactions.tsx`: per-row Collected from a `useServicePaymentsBulk`-style query keyed by the filtered service IDs (one `in` query, not per row); Collected + Unpaid summary cards; shared tally footer component.
- `src/pages/SalaryDisbursement.tsx`: render the same tally footer for the active cut-off.
- New `src/components/TallyFooter.tsx` used by all three pages so the wording and math have one source.
- No schema changes.
