# Make Transaction Tracker, Completed Services and Reports tally

First: the reconciliation walk I added gets removed from both the POS Transaction Tracker and the Reports page. Those pages go back to their own cards and charts. The tallying comes from shared figures on a shared window instead of an extra panel.

## Why the three disagree today

Each page answers a different question over a different date:

| Page | Counts | Dated by |
|---|---|---|
| Completed Services | Quoted price of completed tickets | Completion date |
| Transaction Tracker | Cash actually received | Payment date |
| Reports | Tickets and revenue for the period | Intake date (switchable) |

Reports moves to **completion date as its default**, so all three pages count the same tickets. Intake date stays available as a switch, for when you want to look at incoming volume instead of finished work.

So a ticket completed Aug 30 and paid Sep 2 lands in a different half-month on two of the three pages, and quoted value never equals cash received on the same list. Neither page is wrong — they were never aligned or labelled.

## 1. Same window on all three pages

All three keep their free From/To dates and gain the same **1-15** and **16-End** quick buttons plus a month picker, matching the Salary Disbursement cut-off exactly. Clicking a cut-off on any of the three gives the identical window.

The chosen cut-off is remembered, so moving between the pages keeps the period instead of resetting.

## 2. Same two money figures everywhere

For the selected window, all three show the same pair over the same ticket list (tickets completed inside the window):

```text
Billable value  = Quoted price - Discount        (what the work was worth)
Collected       = payments received on those tickets
```

- **Completed Services**: adds a Collected column per ticket, plus Collected and Unpaid summary cards beside Gross Sales.
- **Transaction Tracker**: keeps its cash-in-the-drawer view (that is its job) and adds a line under Total Sales — "of which on tickets completed this cut-off" — which equals Completed Services' Collected figure. Cash taken on older tickets is shown on its own line rather than mixed in.
- **Reports**: now counts by completion date by default, and its revenue cards use the same two definitions and labels, so its completed-work figure equals Completed Services' Billable value. The intake-date switch remains for incoming-volume views.

## 3. One "does it tally" line

At the bottom of each of the three pages, one short line for the selected window, same wording and same math everywhere:

```text
Tickets 264  ·  Billable 2,208,245  ·  Collected 2,237,615  ·  Unpaid 0
```

If a figure ever differs between pages, the line makes it obvious instead of leaving you to compare cards by eye.

## 4. Commission stays where it belongs

Commission is not part of the tally line — it stays on Completed Services and Salary Disbursement, still driven only by the allocations saved in Completed Services, so those two continue to agree as they do now. No change there.

## Technical notes

- Remove the `MoneyReconciliationPanel` render and import from `src/pages/Reports.tsx` and `src/pages/TransactionTracker.tsx`; keep the Parts Consumed card on the tracker and the Cash collected / Value of completed work split on Reports.
- `src/lib/moneyReconciliation.ts` stays as the single shared calculator behind the tally line (billable, collected, unpaid, ticket count).
- New `src/lib/cutoffPeriod.ts`: `cutoffRange(month, half)` plus a small preset-button component, persisted through `useFilterPersistence` under one shared key read by all three pages.
- New `src/components/TallyLine.tsx` rendered by all three pages so the wording and math have one source.
- `src/pages/CompletedTransactions.tsx`: per-ticket Collected from one bulk `in` query over the filtered service IDs (not per row); Collected + Unpaid cards.
- `src/pages/TransactionTracker.tsx`: split Total Sales into "on tickets completed this cut-off" and "on older tickets" using the completed-ticket ID set already loaded for the parts card.
- `src/pages/Reports.tsx`: `scopeBasis` default flips from `"received"` to `"completed"` (the toggle stays); relabel revenue cards to Billable value / Collected.
- No schema changes.
