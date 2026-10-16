# Unlock paid-out Service Breakdown (corrections stay in the same cut-off)

## 1. Unlock with confirmation (Completed Services → expanded ticket)
- The yellow "Paid out — locked" banner gets an **Unlock to edit** button (management only).
- Confirmation dialog explains the rule in plain words:
  - "This ticket's commission is already on [Kevin Baunsit]'s payslip for [15th Salary - October 2026]."
  - "Why it's locked: that payout already went out. Editing here changes what that cut-off SHOULD have paid."
  - "Typical case: a shared service where the second technician (e.g. Kenn) still needs their share."
  - "After you save, the correction stays in the SAME cut-off. Salary Disbursement will flag the affected staff so you can re-disburse — the existing salary transaction is updated, never posted twice."
  - Buttons: Cancel / "I understand, unlock".
- After confirming, the breakdown and parts cost become editable for that ticket. Banner reads "Unlocked for correction — re-disburse this cut-off after saving."
- Saving logs who unlocked and the old/new amounts.

## 2. Corrections land in the current cut-off
- On Salary Disbursement, staff whose paid cut-off now differs from what was paid show a **"Needs re-disburse"** chip with the difference (+/-).
- A staff member who wasn't paid yet for that cut-off (e.g. Kenn) simply shows as payable in it.
- Re-disbursing overwrites the existing record and its transaction (current one-record-per-staff-per-cut-off rule).

## 3. Voiding a disbursement unlocks everything
- Today there is no void button for salary payouts, and the lock counts every salary record. 
- Add **Void disbursement** (management, with confirmation) on a disbursed row: marks it Voided, voids its linked expense transaction (money returns to the fund), and logs it.
- The lock only counts payouts that are still Disbursed, so voiding unlocks all of that staff's tickets for that cut-off automatically. Re-disbursing locks them again.

## Technical details
- `ServiceBreakdownPanel.tsx`: `canUnlock` prop, `unlocked` state, AlertDialog, `effectiveLocked`; activity log on save.
- `CompletedTransactions.tsx`: pass `canUnlock` for management; invalidate salary queries after save.
- `useDisbursedPeriods.ts`: filter `status = 'Disbursed'`; include net/commission so the salary page can compare.
- `SalaryDisbursement.tsx`: "Needs re-disburse" comparison (recomputed commission vs saved), Void action updating `salary_disbursements.status` and the linked transaction status to Voided.
