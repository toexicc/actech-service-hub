## 1. `/track` — Estimated Target shows the time frame

The "Estimated Target" field on the public tracking page currently prints the target date. Change it to display the **Estimated Time Frame** text (e.g. "3-5 days", "Within the day") from the ticket, falling back to "N/A" when blank. Label becomes "Estimated Time Frame".

## 2. Approval Remark visible to staff

Show the same approval remark block that `/track` renders on both `/manage-client` and `/service-update`, placed directly below the "Client pre-approves diagnosis" toggle (and in the equivalent spot on the technician page).

Format: `Approved by {Name} on {Date}` plus the approved/pending service lists (see below), or `Declined by {Name} on {Date} — {reason}`. Read-only for both roles. Extract the current remark parser into a shared helper so `/track`, `/manage-client` and `/service-update` all render identically.

## 3. Checklist-based approval on `/track`

Parse the **Service Breakdown** items out of the AI diagnosis (item names only; amounts are placeholders/edited values).

- **One item:** current single "Approve" flow, unchanged.
- **More than one item:** show a checklist of the detected items. Client must select at least one (validation prompt otherwise).
  - **All items selected →** status moves to `Proceed Repair` as today.
  - **Some items selected →** status stays `Waiting to Proceed`. The assigned admin(s) and technician(s) get a notification that the client only approved part of the quotation and manual confirmation is needed. Admin then moves the ticket to `Proceed Repair` manually.
  - After a partial approval, the client's approve action is locked. Admin/management get a **"Re-open client approval"** action on `/manage-client` which clears the lock so the client can approve again from `/track`.

Approval Remark text stored on the ticket:

```text
one item / all approved:
{Name} approved services : {Item A, Item B} on {Date}

partial:
{Name} approved services : {Item A} on {Date}. Pending Approval on {Item B, Item C}
```

## 4. Attendance page overhaul

Rename **Attendance Overview → Attendance** (page title, sidebar, quick actions; route path unchanged).

**Tabs:**
- **Daily Logs** — existing table, plus pagination that always keeps a full day's records together on one page (page boundaries fall on date changes, never mid-day).
- **Leave Tracker** — management can plot staff leave (staff, type: Sick / Vacation / Emergency, date range, notes), with list + edit/delete.

**Manual bulk entry (management only):** a modal listing every active staff member with a checkbox and Time In / Time Out inputs, defaulting to today (date pickable), that writes/updates all selected rows in one submit. Unchecked staff are left untouched.

**Technician availability:** a technician is "available" for a given day when they have a Time In for that day and no approved leave covering it. Technician dropdowns on the intake form, queue intake modal, service form, `/service-update` and `/manage-client` list only available technicians by default, with a **"Show unavailable staff"** toggle for admin/management to override. Special Cases → John Paul Espedido stays always visible.

## Technical notes

- New table `staff_leaves` (staff_id, staff_name, leave_type, start_date, end_date, notes, status) with grants + RLS: management/admin manage, all authenticated read.
- New columns on `services`: `approved_services text[]`, `pending_services text[]`, `approval_locked boolean` — used for the remark, partial-approval state and the re-open action.
- `submit-client-approval` edge function extended to accept a `selectedServices` array, compute all/partial, write the remark + arrays, set the lock and notify assigned staff on partial approvals.
- New shared helpers: service-breakdown item parser (client + edge function), approval-remark formatter/parser, and an availability hook (`useStaffAvailability`) used by every technician selector.
