# Fix the "Target date has passed" modal

## Problems to fix

1. **Empty space below the buttons** — the dialog renders a large blank area under the footer.
2. **Two modals open at the same time** — the target-date dialog can stack on top of another auto-opening dialog.
3. **Wrong trigger scope** — it currently opens for every overdue ticket. It should only open for tickets that became overdue *not through staff fault*: tickets that were paused on Waiting to Proceed, Waiting for Parts, or Pre-Order and have since resumed. Normal overdue tickets (late turnaround) must never show it.

## What will change

### 1. Trigger the modal only for "resumed from pause" tickets

- Add a `target_review_pending` flag on the service (new column, default off).
- The flag is set to **on** exactly when a paused ticket resumes while its target date is already past:
  - Waiting for Parts toggled off (shared flags panel, Manage Client and Service Update).
  - Pre-Order toggled off (same panel).
  - Status changed from Waiting to Proceed to Proceed Repair (Manage Client, Service Update).
  - Client approval automatically moving the ticket to Proceed Repair (approval endpoint) — same place the admin reminder notification is already sent.
- The Manage Client modal opens only when: user is admin/management, the ticket's flag is on, and the target date is still past. It shows once per ticket per resume, not on every page load of any overdue ticket.
- Saving a new date or clicking Keep current date both clear the flag, so it never reappears for the same resume.
- Overdue tickets that were never paused stay untouched — no modal, no flag.

### 2. Fix the dialog layout

- Remove the blank area under the buttons (tighten the dialog content spacing so it hugs the header, date field, and footer).
- Keep the calendar popover picker and both buttons as they are.

### 3. Prevent stacked modals

- When the target-date review opens, suppress/close other auto-opening dialogs on Manage Client (e.g. the Waiting for Parts prompt), and only show one prompt at a time.

## Technical details

- Migration: `ALTER TABLE public.services ADD COLUMN target_review_pending boolean NOT NULL DEFAULT false;`
- Set flag in `src/components/workspace/TicketFlagsPanel.tsx` (toggle-off paths), `src/pages/ManageClient.tsx` and `src/pages/ServiceUpdate.tsx` (Waiting to Proceed → Proceed Repair), and `supabase/functions/submit-client-approval/index.ts` (auto proceed) — only when the parsed target date is before Manila today (reuses the existing past-target check).
- `src/pages/ManageClient.tsx`: gate the modal on `target_review_pending`, clear the flag on save/keep (single update with the new target date or alone), coordinate with `partsModalOpen` so only one dialog is open.
- Redeploy the approval edge function after editing.
- Typecheck, then verify at desktop and mobile widths on a real paused-then-resumed ticket.
