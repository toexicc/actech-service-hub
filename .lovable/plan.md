# Why the three money pages don't tally — and how to make them agree

I ran the real Aug 16–31 and Sep 1–15 numbers. Nothing is "wrong" in the sense of broken math: the three pages answer three different questions, over three different date anchors. Here is the proof, then the fix.

## 1. What each page actually measures (Aug 16–31, real data)

```text
Completed Services   264 tickets closed in the window (by completion date)
                     Quoted 2,277,120  Discounts 68,875  Parts 314,715
                     Net Profit 1,893,530

Transaction Tracker  Money that moved in the window (by payment date)
                     Sales    2,350,265  (Full 2,246,865 + Partial 89,150 + Down 14,250)
                     Expenses   542,153  (Parts Inventory 331,279 + Misc 210,874)
                     Profit   1,808,112

Reports              Tickets RECEIVED in the window (by intake date)
                     254 completed, final cost 2,007,221, parts 224,825
                     Gross revenue uses payments (2,350,265), not the ticket values
```

Three differences stack up:

1. **Different date anchor.** Completed Services uses the completion date. Transaction Tracker uses the payment date. Reports uses the date the ticket was received. A ticket taken in on Aug 12, completed Aug 20 and paid Aug 21 lands in a different window on each page.
2. **Different money.** Completed Services totals the *quoted* price of the work. Transaction Tracker totals *cash actually collected*. Reports totals *final cost*. Down payments, partials, and unpaid balances make these three permanently different.
3. **Different costs.** Completed Services deducts the parts cost recorded on each ticket (314,715 = parts *consumed*). Transaction Tracker deducts Parts Inventory purchases (331,279 = parts *bought*, including stock still on the shelf) plus 210,874 of miscellaneous expenses that Completed Services never sees.

Sep 1–15 shows the same pattern: 312 tickets completed, quoted 2,529,320, parts 223,801; while payments collected were 2,711,426 and expenses 867,158.

Two real bugs on top of that:

- **Transaction Tracker "Total Parts Cost" always reads ₱0.00** — it sums a field that doesn't exist on transactions. It should read the parts cost of tickets, or Parts Inventory spend.
- **Reports "Gross revenue" silently switches meaning**: it uses payments when any exist in the window, otherwise ticket values. So the same card means two different things depending on the period.

## 2. How to make them tally

Keep the three pages, but state plainly what each one is and give each a fixed, labelled bridge:

- **Label the basis on every page.** "Completed Services — by completion date, quoted value", "Transaction Tracker — by payment date, cash collected", "Reports — by intake date".
- **Add one shared reconciliation panel** (same cut-off selector as Salary Disbursement) showing the walk from one to the other:

```text
Quoted value of tickets completed in window      2,277,120
 - discounts                                       -68,875
 = billable                                      2,208,245
 - unpaid balance on those tickets                    -...
 + payments received for tickets from earlier         +...
 = cash collected in window                      2,350,265
 - parts consumed on those tickets                -314,715
 - other expenses in window                      -210,874
 = operating profit                                    ...
```

- **Fix the two bugs**: real Total Parts Cost on Transaction Tracker, and split Reports' one card into two clearly named cards ("Cash collected" and "Value of completed work") so the meaning never flips.
- **One date-anchor toggle** on Completed Services and Reports: "by completion date" / "by intake date", so you can force both to the same basis and see identical ticket counts.

## 3. The daily rate is inflated — confirmed

Right now:

```text
Daily rate = monthly salary / workdays in the SELECTED HALF (Sundays excluded)
Sep 1-15  ->  13 workdays
22,100 / 13 = 1,700.00      35,000 / 13 = 2,692.31      33,000 / 13 = 2,538.46
```

Those are exactly the figures in your screenshot. The problem: the salary is a **monthly** figure, but it is being divided by half a month of workdays. September has 26 workdays in total, so the true daily rate is:

```text
22,100 / 26 = 850.00        35,000 / 26 = 1,346.15
```

The current rate is roughly double. And because gross pay = days present x daily rate, a person present all 13 days of the first half earns 13 x 1,700 = 22,100 — a full month's salary for half a month. Over two cut-offs that pays double salary.

Recommended fix: divide by the workdays of the **whole month**, so each cut-off pays about half the monthly salary and perfect attendance across both cut-offs equals exactly one month's salary. The per-row Daily Rate override stays available for exceptions.

An alternative, if you prefer a rate that never moves month to month, is a fixed 26-workday divisor (monthly / 26) regardless of the actual month length.

## Technical notes

- `src/pages/CompletedTransactions.tsx` — `financialSummary`/`computeRow` are quoted-value based, filtered on `date_completed` (via `useDoneServices`). Add basis label + date-anchor toggle.
- `src/pages/TransactionTracker.tsx` — `totalPartsCost` reduces `t.partsCost`, which does not exist on the transactions row, hence ₱0.00. Source it from completed tickets' `parts_cost` (or relabel as Parts Inventory spend).
- `src/pages/Reports.tsx` — `grossRevenue = txRevenue || serviceRevenue` and `netRevenue = grossRevenue - totalExpenses - (txRevenue ? 0 : partsCost)`: split into two explicit metrics; scope selector for `dateReceived` vs `dateCompleted`.
- New shared `src/lib/moneyReconciliation.ts` computing the walk above from `services` + `transactions` for a given cut-off; rendered as one panel reused by the three pages.
- `src/pages/SalaryDisbursement.tsx` — `computeCalculator`: `autoDaily = monthly / workdaysInPeriod` becomes `monthly / workdaysInMonth` (Sundays excluded, Manila month of `selectedMonth`); the "attd: x/13" hint keeps the half-period workdays.
- No schema changes.
