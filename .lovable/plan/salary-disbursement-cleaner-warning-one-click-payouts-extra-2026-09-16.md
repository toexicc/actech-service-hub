# Salary Disbursement: cleaner warning, one-click payouts, extra deductions, fixed-staff payslips

## 1. "Not ready for payout" only counts service-based work

The warning currently counts every completed ticket in the cut-off, which is why it says 179 / 258 and looks alarming. It will only count tickets that actually pay a service-based employee — tickets whose assigned technician is a service-based (commission) staff member. Fixed-salary staff tickets are ignored, and the parts-cost note only appears for those same tickets. If nothing is outstanding, the banner disappears.

## 2. Disburse now records the payout straight into Transactions

Today Disburse only writes the payout record, and money only appears in Transactions after clicking "Submit Transaction" — which was never happening, so no salary expense exists in Transactions at all.

New behaviour:
- Clicking Disburse saves the payout record **and** creates the expense entry in Transactions in the same action, deducted from the selected fund.
- The button becomes disabled and shows "Disbursed" immediately, and stays disabled after a page refresh because the page reads existing payouts for that cut-off from the database (not just this session). So one payout per staff per cut-off, once.
- The batch button becomes "Review Salary Disbursement", which opens a summary modal listing everyone already disbursed for this cut-off and everyone still pending, with totals. It posts nothing, so money can never go out twice.
- Fund balance no longer blocks anything — Disburse always goes through.

## 3. Backfix for past payouts

Past payout records that have no matching entry in Transactions get one expense entry per staff payout, dated to that cut-off, described as the staff name and period, so fund balances and reports finally include salaries already paid. Existing entries are left alone (matched by staff + period, so re-running is safe).

## 4. Additional deductions

- **Fixed Salary Employees:** a new "Addtl. Ded." column beside Deductions showing the running total, with a button that opens a modal to add lines of *description + amount*. The total is subtracted from Net Pay.
- **Service Based Employees:** the same column right after Allocated Commission, subtracted from Final Amount.
- The lines are saved with the payout record when disbursed, and are listed on the payslip under a "Deductions" section.

## 5. Payslip for fixed-salary employees

A Payslip column on each fixed-salary row (print + download), same AC Tech letterhead, employee/cut-off header, signature line and layout as the service-based payslip, but instead of the ticket breakdown it shows:

- Attendance: days present out of workdays in the cut-off, hours worked, daily rate, gross pay
- Deductions: Pag-IBIG, SSS, PhilHealth, other deductions, and each additional-deduction line
- Net pay total

A "Print All / Download All" pair is added to the Fixed Salary section header too.

## Technical notes

- `src/pages/SalaryDisbursement.tsx`
  - `readiness`: filter `periodServices` to tickets where any technician name matches a `serviceBasedStaff` name (reuse `isAssignedTo`) before counting missing allocations/parts cost.
  - New `useQuery(["salaryDisbursements", periodRange])` reading `salary_disbursements` for the active cut-off (`period_start`/`period_end` or `period_label`); `isDone` becomes `disbursedList || existing row for staff+period`.
  - `handleDisburse`: after a successful `disburseSalary`, chain the `addTransaction` call (type `Salary Disbursement`, category `Expenses`, `fundSource`, description `<staff> — <periodLabel>`) and invalidate `fundTransactions` / `transactions` / `salaryDisbursements`. No balance guard.
  - `handleSubmitBatch` removed; button becomes "Review Salary Disbursement" opening a Dialog with disbursed vs pending staff for the cut-off.
  - New state `addlDeductions: Record<string, {description,amount}[]>` + a small modal component; folded into `computeCalculator` (`totalDeductions`) and into `computeServiceFinal` for service-based rows.
- Migration: add `additional_deductions jsonb not null default '[]'` to `public.salary_disbursements`; edge function `disburseSalary` accepts an `additionalDeductions` JSON string and persists it.
- Backfix: one-off SQL inserting `transactions` rows (`type = 'Salary Disbursement'`, `category = 'Expenses'`, `amount = net_pay`, `transaction_date = period_end`, `fund_name = 'Money In Bank'`) for every `salary_disbursements` row lacking a matching transaction.
- New `src/lib/salaryPayslipPdf.ts` for the fixed-salary variant, reusing the header/footer/table primitives of `commissionPayslipPdf.ts` (extract the shared drawing helpers rather than duplicating them); `PayslipData` gains an optional `deductionLines` list used by both variants.
