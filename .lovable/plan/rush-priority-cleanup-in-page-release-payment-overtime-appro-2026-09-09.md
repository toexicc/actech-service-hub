# Rush priority cleanup, in-page release/payment, overtime approval

## 1. Remove the Rush priority (and back-fix old tickets)

- Drop "Rush (with 10% Rush Fee)" from the priority list, so intake and update forms only offer Within The Day, Loyalty, Normal.
- One-time data fix for every existing ticket whose priority is the Rush option: set priority to "Normal" and switch the Rush flag on, so the Rush chip still shows everywhere.
- The back-fix does not touch any pricing: the 10% rush charge on the final cost stays exactly as it is today for those tickets, and the rush fee tick box is not auto-ticked by the fix.
- Going forward the existing rule stays: turning the Rush toggle on by hand still ticks the 10% rush fee on the cost. The old "choosing Rush priority turns the toggle on" behaviour is removed with the option.

## 2. Release, POS and manual release open in place

- Manage Client: the RELEASE button and the Released toggle (when the ticket is not yet released) open the confirm-release dialog right on the page instead of jumping to the Queueing console. Turning the toggle off keeps working as it does now. After a successful release the page refreshes the ticket, the Released flag turns on and the chip appears.
- Manage Client: the POS button opens a payment dialog on the page — payment type, amount, method, fund, remarks, with the ticket's cost, previous payments and remaining balance shown, and the same rules as the POS page (any amount allowed, even before a final cost). After saving, the ticket's payments and balance refresh in place.
- Queueing console: the manual release action already uses the same dialog and stays as it is; the release dialog is reused, not duplicated.

## 3. Overtime becomes approval-based

- Attendance records keep a new overtime state: pending, approved, or rejected. Existing rows flagged as overtime start as pending; rows without overtime stay as none.
- Attendance Overview shows the overtime tag with its state, and management users get Approve / Reject buttons on those rows. Admin and technician users see the state but cannot change it.
- Worked time: hours count the 10:00 AM – 7:00 PM shift (8 hours, lunch excluded) unless the overtime is approved, in which case the extra time counts. Rejected or pending overtime is not counted.
- Salary Disbursement uses the same rule, so days present and hours never include unapproved overtime.

## Technical notes

- `src/lib/constants.ts`: remove the Rush entry from `PRIORITY_OPTIONS`; remove the priority→rush effect in `src/pages/ManageClient.tsx` (around line 603).
- Data fix via SQL update on `services` where `priority ILIKE '%rush%'`: `priority = 'Normal'`, `rush_fee = true`; leave `service_cost`, `final_cost`, `total_cost`, `discount` untouched.
- New shared component `src/components/TicketPaymentModal.tsx` wrapping the existing `addTransaction` bridge call plus `getServicePayments` for previous payments; used by Manage Client. `src/pages/PointOfSales.tsx` is left unchanged.
- Manage Client renders `ConfirmReleaseModal` in `manual` mode with `prefillServiceId`, wired to `onReleased` → reload ticket + invalidate services.
- Migration: add `overtime_status text not null default 'none'` to `attendance_logs` (values none/pending/approved/rejected) plus `overtime_reviewed_by`, `overtime_reviewed_at`; backfill `pending` where `is_overtime`. RLS: management-only update of these columns via the existing `is_admin_or_management` helper.
- `src/lib/attendanceHours.ts`: cap worked minutes at the standard shift unless overtime is approved; `AttendanceOverview.tsx` and `SalaryDisbursement.tsx` pass the new state through.
