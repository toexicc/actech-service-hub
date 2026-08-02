## 1. Record attendance — include everyone

The bulk entry modal currently only lists technicians and admins. Change it to list **every active staff member** (technician, admin, management, and anyone with no role set), grouped by role with a search box inside the modal so long lists stay usable. Rows already checked keep their Time In / Time Out values.

## 2. Editable and deletable entries

**Daily Logs table** gets an actions column per row:
- **Edit** — modal to change the date, Time In, Time Out, and the Late / Overtime tags (tags auto-recompute from the times but stay manually overridable), plus a note field.
- **Convert to leave** — inside the edit modal, an option that removes the attendance row and creates a leave record for that person on that date (type picker + notes).
- **Delete** — confirm dialog, then removes the row.

**Leave Tracker table** gets **Edit** (staff, type, date range, status, notes) alongside the existing delete, with a confirm step on delete.

## 3. Leave type labels

Store values stay lowercase for compatibility with the availability query; every display surface (picker, table, badges) shows **Sick / Vacation / Emergency** properly capitalized.

## 4. Filters

Replace the two loose From/To buttons with a filter bar:
- **Date range picker** (single popover, range mode) that also accepts a single day.
- **Month picker** — quick "this month / pick a month" that sets the range to that month.
- **Role** filter — All / Management / Admin / Technician.
- **Technician department** filter — populated from staff departments (disabled unless role is All or Technician).
- **Staff name** filter — dropdown of staff, kept alongside the free-text search.
- **Clear filters** resets everything.

Role and department come from the staff list joined onto each attendance row by staff id. Day-based pagination stays as-is (a day's records never split across pages).

## 5. Availability

- Keep the rule: available = has a Time In for the day **and** no approved leave covering it.
- Add the missing **"Show unavailable staff"** toggle next to the technician selectors on the intake form, service form, queue intake modal, `/service-update`, and `/manage-client`, so admin/management can override. Unavailable names, when shown, get an "absent" / "on leave" hint.
- Availability cache is invalidated whenever attendance or leave is saved, edited, or deleted, so dropdowns react without a reload.
- Special Cases → John Paul Espedido remains always visible.

## Technical notes

- `src/pages/AttendanceOverview.tsx`: new filter bar, row actions, edit/delete modals, all-roles bulk modal.
- `src/hooks/useStaffAvailability.ts`: expose `isOnLeave` reasons and switch fetch to react-query keys that the attendance page can invalidate.
- Attendance edit/delete and leave edit/delete run through existing RLS on `attendance_logs` and `staff_leaves`; a check confirms management/admin policies cover update and delete before wiring the UI, and a migration is added only if they don't.
- No schema changes expected other than a possible `notes` usage on `attendance_logs` (column already exists).
