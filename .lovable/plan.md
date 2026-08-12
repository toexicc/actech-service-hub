# Waiting for Parts notes, Backjob & Rush flags, RTO reasons, POS tab, tracker upgrades

## 1. Waiting for Parts — update note + notifications

- Under the Waiting for Parts toggle on `/manage-client`, add a **Parts update note** box. Management can write/edit and save it; admins and technicians see it read-only on both `/manage-client` and `/service-update` (shown whenever a note exists).
- Every save is written to the ticket activity timeline (old note -> new note).
- **Toggled ON:** notify Jane Espedido and Romar Badilles (both confirmed as management accounts) — skipped for whoever flipped it. Message names the ticket, client, device, and the current parts note if any.
- **Toggled OFF:** notify the ticket's assigned admin(s) and technician(s) — "Parts are now available, please proceed with the repair."

## 2. Backjob toggle

- New ticket flag shown directly below Waiting for Parts on `/manage-client` and `/service-update`, available to admin, management and technician. Purely an indicator — no status change.
- On/off writes an activity log entry. A "Backjob" chip appears on the ticket workspace header and on the tracker card.

## 3. Rush fee (10%)

- New checkbox below the "Requesting Invoice (VAT)" control on `/manage-client`: **Rush fee (+10%)**.
- Charge order: services subtotal, minus discount, **plus 10% rush fee**, then 12% VAT if invoice is requested. Shown as its own "Rush fee (10%)" line in the charges breakdown on `/manage-client`, on `/track`, and in the Service Quotation PDF.
- When on, a "Rush" chip shows on the `/service-tracker` card and on `/track`.

## 4. Manage Client action buttons

Beside the QR button:
- **POS** (green) — opens the POS page with transaction type preset to **Full Payment** and the ticket already looked up.
- **RELEASE** (orange) — opens the queue console straight into **Manual release** with the ticket already looked up.

## 5. Service Tracker status cards

Add clickable cards alongside the existing ones: **Proceed Repair**, **Done Repair - Under Observation**, **RTO** (both RTO kinds), **Waiting for Parts**, **Backjob**, **Rush** — the last three count tickets with that flag on, regardless of status. Clicking a card filters the list as the current cards do.

## 6. Transaction Tracker becomes a POS tab

- POS page gets tabs: **Point of Sale** and **Transactions**. The transaction tracker moves in as the second tab.
- `/transaction-tracker` is removed from the sidebar/menu and redirects to the POS Transactions tab so existing links and open workbench tabs keep working.

## 7. RTO split and reason

- Two new statuses: **RTO - ACTech** and **RTO - Client**. Existing "RTO" tickets stay valid and are treated as generic RTO.
- Selecting either on `/manage-client` or `/service-update` opens a **reason modal** first; the update cannot proceed without a reason. Reason is stored on the ticket and logged.
- `/track` shows the status simply as **RTO** for both, plus the reason:
  - RTO - Client: reason only, all other detail blocks stay hidden/blank.
  - RTO - ACTech: reason plus the diagnosis field; everything else stays blank.

## 8. Client Intake Form client types

Add **Delivery - AC Tech** and **Delivery - Courier** to the Client Type options.

## 9. "In service XX days" counting

Count elapsed working days from the **service date up to today** (not counting down from the target date), **excluding Sundays**, on `/service-tracker` cards/table and on `/track`. Completed tickets count up to their completion date.

## 10. Paid-but-not-Completed alerts + payment-linked timeline

- After a POS payment fully settles a ticket that does not end up Completed, raise a visible exception: a notification to the assigned admin (and management) and a **"Paid, not completed"** card/filter on the Service Tracker so it can be fixed quickly.
- The ticket activity timeline shows POS payment events (amount, method, staff) immediately linked to the status change they caused (or the note that no status change happened), so the payment -> completion chain is auditable.

## Technical notes

- Migration: `services.waiting_parts_note text`, `services.is_backjob boolean not null default false`, `services.rush_fee boolean not null default false`, `services.rto_reason text`; two new values on the `service_status` enum (`RTO - ACTech`, `RTO - Client`); `public_service_snapshot` extended with `waiting_parts_note`, `rush_fee`, `rto_reason`, `is_backjob`.
- Cost math lives in the existing charges helpers used by `ManageClient.tsx`, `ServiceTracking.tsx` and `quotationPdfGenerator.ts` — rush fee is added there once so all three agree.
- Notifications reuse `serviceNotifications.ts` + `staff_directory()` for resolving Jane/Romar and the assigned admin/technician.
- Working-day counting reuses the Sunday-skipping logic already in `reportMetrics.ts`, extracted into a shared helper.
- POS/manual-release deep links use query params read on mount (`?serviceId=...&type=Full%20Payment`, `?manualRelease=1&serviceId=...`).
- New status values are added to the status colour/stage maps in `ServiceTracker.tsx`, `TicketOverviewRow.tsx`, `TicketWorkspaceHero.tsx`, `WhatsNextBanner.tsx`, `StatusProgressBar.tsx`, `WhereTicketsAreNow.tsx`, and treated as closed/off-path like the current RTO.
