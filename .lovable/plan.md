# Make the money numbers make sense (and agree)

I checked the real Sep 1 - 15 figures in the database before writing this. Here is what is actually happening, then the small fixes.

## 1. What the completion-date switch on Reports really affects

It does **not** work the way the question assumes. Today on Reports:

- **Affected by the intake/completion switch:** ticket counts, Service revenue (completed), Parts cost, Discounts given, average ticket, turnaround and on-time rates. These all come from the ticket list, so changing the anchor changes which tickets are in the list.
- **Not affected at all:** Cash collected (Gross revenue), Expenses, and therefore Net revenue. Those three are counted by the date the payment or expense was recorded, not by any ticket date.

So money in and money out on Reports are still payment-date figures, while the ticket-value cards are completion-date figures. Nothing labels that, which is why it feels arbitrary.

**Fix:** label each card with its own basis on the card itself - "by payment date" on Cash collected, Expenses and Net revenue; "by completion date" on the ticket-value cards - and add one line under the switch saying it only re-anchors the ticket cards.

## 2. Why Total Profit (1,833,768.72) and Net Revenue (1,844,268.72) differ

Exactly one refund. Sep 1 - 15 real data:

```text
Payments in    Full 2,576,636.20 + Partial 79,550.00 + Down 55,240.00 = 2,711,426.20
Expenses out   Parts Inventory 756,971.37 + Misc 110,186.11           =   867,157.48
Refund                                                                 =    10,500.00

Transaction Tracker  2,711,426.20 - 867,157.48 - 10,500.00 = 1,833,768.72
Reports              2,711,426.20 - 867,157.48             = 1,844,268.72
                                                  difference =   10,500.00
```

The Tracker subtracts refunds, Reports forgets them. The Tracker is right.

**Fix:** Reports subtracts refunds too, and shows a Refunds figure so the deduction is visible. After this the two numbers are identical.

### Completed Services becomes paid-only

As requested, the Completed Services list shows only **fully paid** tickets. Completed tickets with any unpaid balance move out of the main list into a clearly marked **"Completed - unpaid"** tab right beside it, with the amount still owed per ticket, so staff can chase them and allocate their commission once paid. An "All" tab keeps the old combined view available.

- Summary cards follow the visible tab; the paid view's cards are the ones that tally with the other pages.
- Commission and payout logic are unchanged - allocation still happens on this page; unpaid tickets simply live on their own tab until settled.
- "Fully paid" means payments on the ticket (less refunds) reach the billable amount (quoted minus discount).

## 3. Why Gross Sales and Net/Final Profit differ across the three pages

They are three different definitions of "sales", all correct for their own purpose:

| Page | "Sales" means | Costs deducted |
|---|---|---|
| Completed Services | Quoted price of completed tickets, before discount | Discount, parts on those tickets, commission |
| Transaction Tracker | Cash actually received | All expenses paid in the window, plus refunds |
| Reports | Cash actually received | All expenses paid in the window |

Sep 1 - 15: quoted 2,529,320, discounts 134,746, parts 223,801, final cost 2,398,344 across 312 completed tickets - while cash collected was 2,711,426.20. Quoted value and cash received are permanently different because of unpaid balances, partial payments, and cash arriving for tickets completed in an earlier period. The much larger Gross Sales in the screenshot is a wider date range, not a different calculation.

**Fix:** stop calling all three "Gross Sales". Rename to what each one is, and show both figures where a comparison is wanted:

- Completed Services: "Quoted value (completed tickets)".
- Transaction Tracker: "Cash collected (payments in range)".
- Reports: "Cash collected (payments in range)" plus the existing "Value of completed work".

Net/Final Profit gets the same treatment:

- Completed Services: "Profit on completed work = quoted - discount - parts", then Final Profit after commission - a ticket-level margin, not a business bottom line.
- Transaction Tracker and Reports: "Operating profit = cash collected - refunds - expenses" - the business bottom line, identical on both pages.

The shared tally line already at the bottom of the three pages stays as the cross-check.

## Technical notes

- `src/pages/Reports.tsx`: in `buildReport`, add `refunds` from period transactions of type `refund` (non-void) and change `netRevenue = cashCollected - refunds - totalExpenses`; add a Refunds entry to the revenue summary list; per-card basis captions; clarify the copy under the `scopeBasis` toggle.
- `src/pages/TransactionTracker.tsx`: relabel the Total Sales and Total Profit cards ("Cash collected (payments in range)", "Operating profit = cash - refunds - expenses"); no math change, it is already correct.
- `src/pages/CompletedTransactions.tsx`: relabel Gross Sales to "Quoted value (completed tickets)" and Net Profit to "Profit on completed work"; short caption that this is ticket margin, not cash. Add Paid / Unpaid / All tabs: a ticket is fully paid when `useTicketPayments` totals reach `service_cost - discount`; unpaid rows keep the amount owed and stay editable for commission allocation so nothing is blocked.
- No schema changes, no change to commission or payout logic.
