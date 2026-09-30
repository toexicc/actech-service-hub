# Attendance hours start at 10:00 AM, plus Overtime and Bonus/Allowance on payroll

## 1. Attendance: ignore time before 10:00 AM
- If someone taps in before 10:00 AM (Manila), their hours are counted from 10:00 AM. Late arrivals still count from their actual Time In.
- Normal shift counts 10:00 AM to 7:00 PM, minus the 12–1 PM lunch (8 hours max).
- Time after 7:00 PM counts only as overtime, and only when the overtime is approved (same approval rule as today).
- Applies everywhere hours show: Attendance page and Salary Disbursement. Saved Time In/Out records are not changed, only how hours are counted.

## 2. Salary Disbursement (Fixed Salary table)
- **Overtime** column beside Daily Rate:
  - Shows the amount: approved overtime hours x (daily rate / 8).
  - Small text below it: approved hours for the cut-off (for example "3.5 hrs approved").
  - Overtime no longer makes a day count as more than 1 day, so it isn't paid twice.
- **Bonus/Allowance** column beside Overtime: a plain number box, no computation.
- Net Pay = days x daily rate + Overtime + Bonus/Allowance − deductions.
- Both values are saved with the payout and shown on the fixed-salary payslip (Overtime with its hours, Bonus/Allowance as its own line). The Transactions expense uses the new Net Pay.

## Technical notes
- `src/lib/attendanceHours.ts`: clamp start to 10:00 Manila in `workedMinutes`; add `regularHours` (10:00–19:00 minus lunch, cap 8) and `overtimeHours` (approved only, time beyond regular). `payableHours` = regular + approved OT.
- `SalaryDisbursement.tsx`: days-present from regular hours; new `overtimeHoursByStaffId`; `computeCalculator` adds `otHours`, `otPay = otHours * daily/8`, `bonus` (new `bonusAllowance` state); columns + skeleton/colSpan updates; include in disburse params and edit flow.
- Migration: `overtime_hours`, `overtime_pay`, `bonus_allowance` numeric default 0 on `salary_disbursements`; `disburseSalary` edge path persists them.
- `salaryPayslipPdf.ts`: Overtime and Bonus/Allowance lines in the earnings section.
