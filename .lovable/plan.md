# Fix the three POS problems

## 1. Weird payment lines on /track

Checked ticket AC220826011 (Total ₱14,500, Discount ₱2,000). Its payment ledger really does hold five rows:

- Full Payment ₱0
- Full Payment ₱0
- Full Payment ₱14,500 (the real one)
- Void - Full Payment ₱0 (void of the 2nd row)
- Void - Full Payment ₱0 (void of the 1st row)

The customer page lists every row it finds, so the mistakes and their void entries are shown to the client.

Fix: the customer page only lists real money received — payment rows with an amount above zero, never void entries and never zero-amount rows. Total Paid and Balance keep using the same rule, so the numbers and the list always agree.

## 2. Voiding should remove the transaction

Today "Void" adds a second, reversing row and keeps the original, so one mistake becomes two lines everywhere.

New behaviour: confirming a void deletes that transaction from the ledger, and writes the full detail (transaction ID, type, amount, mode of payment, ticket, who voided it, and the reason) to the activity log. The void dialog wording changes to say the entry is removed and only the log keeps a record. Reason stays required, management-only as it is now.

Existing mess gets cleaned up once: the 12 old "Void - ..." rows and the original rows they cancel are removed from the ledger, so no ticket shows void lines any more. Nothing else is touched.

Note: this changes the tracker's dashboard figures slightly — voided money is no longer counted as sales-and-a-negative, it is simply gone. That is the intent of "void means delete".

## 3. Transaction tracker showing blank rows until reload

Cause found: the Salary Disbursement page reads the same cached list name ("transactions") as the Transaction Tracker, but requests only three fields (amount, type, fund). When Salary Disbursement loads, or its cached copy wins, the tracker table renders those stripped-down rows — that's exactly the screenshot: amounts present, but TXN ID blank and Timestamp/Service ID/Name/Attendant/Remarks showing N/A and dashes. A reload fixes it because the tracker fetches its own full list again.

Fix: give the Salary Disbursement fund lookup its own cache name so the two pages can never overwrite each other. The tracker also refreshes its own list right after any add, edit or void, so the table never sits stale.

## Technical notes

- `src/hooks/useServicePayments.ts`: add a void/zero filter (`isVoidType`, amount > 0) used by both the authenticated and public summaries; apply the same filter in `supabase/functions/get-service-payments/index.ts` and in `getServicePayments` inside `supabase/functions/sheets-bridge/index.ts`.
- `src/pages/ServiceTracking.tsx` (~line 1634): list comes from the filtered summary; no separate rule.
- `src/pages/TransactionTracker.tsx` `handleVoid`: call the bridge `deleteTransaction` action instead of `addTransaction`, log via `logActivityAsync`, then invalidate `["transactions"]`; update the dialog copy. Remove the now-dead "Void - ..." exclusions where they are only there for reversing rows (keep type-tab guards harmless).
- `src/pages/SalaryDisbursement.tsx` line 239: change `queryKey: ["transactions"]` to `["fundTransactions"]` and add the same key to `useRealtimeInvalidate` for the `transactions` table.
- One-off data cleanup via SQL: delete rows whose `type` starts with `Void - ` plus the originals referenced in their `description` ("Void of TXN...").
