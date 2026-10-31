# Plan: Card padding, multiple interim reports, Delivery role, RTO cards, On Hold toggle

## 1. Cards missing top padding (all pages)
Cause: the shared card body removes its top padding (it expects a title above it). Cards with no title, like the POS fund/sales cards, end up with text touching the border.
Fix: the card body keeps its top padding when it is the first thing in the card. This one change fixes every page. Then remove the one-off padding patches added earlier on Inventory, and spot-check POS, Reports, Menu, Inventory and Salary.

## 2. Multiple interim reports
- Staff can add **another interim report** after one has been approved or declined, using the same formatter.
- Each round is saved separately. Earlier rounds stay visible as read-only history: round number, date, decision.
- "Send to approval" works for each new round. On /track, the client sees the latest pending round, with earlier rounds listed under it.
- Approving a round adds its lines to the breakdown, same as now.

## 3. New "Delivery" role
- New special-access role: **Delivery**. Staff Management can assign it.
- Delivery users only get a simple page: a month calendar plus a list of the selected day's items (Pickup / Delivery, client, address/city, ticket ID, time, notes). They can mark an item **Done** or **Reschedule** it (pick a new date and give a reason). No other menus.
- New page **Pickup Schedule** in the Admin Portal, right under Client Intake Form, for Admin and Management. Here they can create, edit and cancel schedule entries: date, type, client, ticket (optional), city, address, contact, time window, notes. The page always shows the reference note:
  - MWF: North side (Quezon City, Caloocan, Valenzuela, Malabon, Navotas, Mandaluyong, San Juan, Pasig, Marikina, Antipolo)
  - TTHS: South side (Manila, Makati, Pasay, Parañaque, Las Piñas, Muntinlupa, Taguig, Pateros)
  - If the chosen city doesn't match that day's side, a soft warning appears.
- Anything saved here shows up on the Delivery page.

## 4. Split RTO cards
On /service-tracker and the staff Service Tracking page, the single RTO card becomes two cards, **RTO - AC Tech** and **RTO - Client**. Each has its own count and filter.

## 5. On Hold becomes a toggle
- Add an **On Hold** toggle above "Client pre-approve diagnosis" in Manage Client and Service Update. It pauses the ticket but keeps its real status.
- While it's on: /track covers the details and shows "On Hold", same as today. The On Hold card and filter count toggled tickets. Overdue tracking pauses.
- When it's turned off, the ticket simply carries on in its existing status.
- Remove On Hold from the status dropdowns. Data cleanup: the one ticket currently On Hold gets the toggle turned on and goes back to its previous status, taken from its activity history.
- Everything that used to set On Hold now turns the toggle on instead, including the decline-with-nothing-approved flow.

## 6. Declined interim report turns On Hold on
When a client declines an interim round, the On Hold toggle turns on (alongside the existing move to Done Repair - Under Observation).

## Technical details
- `CardContent`: `first:pt-4 sm:first:pt-6`.
- New table `interim_reports` (service_id, round, diagnosis, ai_report, warranty, summary, breakdown_text, photos round tag, status pending/approved/declined, timestamps). Backfill round 1 from the existing `services.interim_*` columns, and keep mirroring the latest round there for compatibility. Update the PIN-verified public snapshot function to return the rounds.
- `services.is_on_hold boolean default false`, plus `on_hold_reason`. The `On Hold` enum value stays for history but can't be picked. Update `serviceStatus.ts` tracking rules, tracker cards, /track gating and notifications.
- `app_role` gets `delivery`. New table `pickup_schedules`, with RLS: admin/management full access; delivery can select and update status/reschedule fields. `manage-staff` function supports the role. Login redirects delivery users to `/delivery`.
- Add tests for on-hold eligibility, the city/day-side helper, and interim round eligibility.
