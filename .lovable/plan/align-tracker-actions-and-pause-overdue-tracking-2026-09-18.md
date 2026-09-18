# Align tracker actions and pause overdue tracking

## What will change

### Service Tracker cards
- Keep **Service date**, **Target**, and **In service** in one footer row.
- Place **Notify**, **Forward**, and management-only **Delete** in that same row, aligned at the right edge.
- Preserve card-click navigation and keep each icon action independent.

### Shared overdue rule
- Add one shared overdue-eligibility rule used by the **Service Tracker**, **Service Tracking**, and **Tech Dashboard** pages.
- A ticket will not be counted or styled as overdue while:
  - status is **Waiting to Proceed**;
  - **Pre-Order** is enabled; or
  - **Waiting for Parts** is enabled.
- Existing stop rules for completed, closed, For Release, and Advise Client tickets remain unchanged.
- This changes overdue counts, filters, sorting, lists, and red overdue styling only; it will not redefine the separate “In service” or working-duration calculations.
- The public Service Tracking page currently has no overdue counter; its ticket data will remain compatible with the shared flags, with no unrelated UI added.

### Target-date reminder notification
- When a ticket with a past target date resumes, notify its assigned admin(s) to review and adjust the target date.
- Trigger the reminder when:
  - **Waiting to Proceed** changes to **Proceed Repair**, including client approval on the public tracking page;
  - **Pre-Order** is switched off; or
  - **Waiting for Parts** is switched off.
- Send one clear in-app/push notification per resumption event, include the service ID, and retain the existing recipient fallback when no assigned admin resolves.
- Keep the existing normal status and parts-available notifications; avoid duplicate target-date reminders from the same action.

### Dashboard polish
- Give the “11 due” label safe right-side breathing room and correct the calendar/sidebar sizing so it cannot sit against the border.
- Keep **Quick actions** on one row on desktop; preserve the current compact mobile grid. If a narrower desktop cannot fit every action, the row will scroll horizontally instead of wrapping.

## Technical notes
- Centralize overdue qualification in `serviceStatus` and pass status plus `waitingForParts`/`hasPreOrder` everywhere overdue is derived.
- Reuse the existing notification delivery and staff-resolution helpers for staff-side changes; add the same overdue-resume reminder to the client-approval function for automatic **Proceed Repair** transitions.
- Verify role-scoped counts and lists, card action click behavior, notification conditions, and layouts at phone and desktop widths.
