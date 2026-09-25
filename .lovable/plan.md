# On Hold card, technician parts view, POS complete toggle, RTO rush, Within the Day rule

## 1. On Hold card
- Add an **On Hold** card to the status cards on Service Tracker and Service Tracking. It counts On Hold tickets, and clicking it shows only those tickets, the same way the other cards work.

## 2. Service Update: technicians can't switch parts toggles
- Technicians see **Waiting for Parts** and **Pre-Order** as read-only switches, so they can follow updates without changing them.
- The admin parts note stays visible (read-only). The technician parts note can still be typed and saved.

## 3. POS: "Mark as Completed" switch
- When a payment will bring the ticket's balance to exactly 0, a **Mark service as Completed** switch appears. It is **on** by default.
- On: the ticket moves to Completed after payment, as it does today. Off: the payment is saved and the status stays as it is.
- The switch is hidden for partial payments and manual entries.

## 4. No Rush on RTO tickets
- The Rush switch is hidden on RTO, RTO - ACTech and RTO - Client tickets on Manage Client and Service Update. The Rush chip stops showing on those tickets too.

## 5. Within the Day rule
- The Within the Day card and filter only include tickets created **today** (Manila time).
- Once a Within the Day ticket's creation date has passed (from the next day on) and it isn't finished (Completed, For Release, Advise Client, or closed), it is switched to **Normal** priority automatically.
- When this happens, the assigned admin(s) and technician(s) get a notice: "AC… was not repaired within the day and is now Normal priority. Please inform the client." The change is also added to the ticket's history.
- Telling the client: the public tracking page shows a short note: "Your repair couldn't be finished the same day. Our team will update you on the new timeline." No texts or emails are sent, because the app doesn't send messages to clients.

## Technical notes
- Cards: add `On Hold` to the card lists in `ServiceTracker.tsx` / `ServiceTracking.tsx`.
- ServiceUpdate: disable the parts/pre-order switches when the role is technician. The technician note editor stays as it is.
- POS: add `autoComplete` state (default true), shown when `remaining - amount <= 0` and a ticket is loaded. Only call `completeServiceIfFullyPaid` when it is true.
- Rush: gate the rush switch in `TicketFlagsPanel` (and on the Service Update equivalent) behind `!isRto(status)`.
- Within the Day: filter by `date_received` on today's Manila date. Extend the scheduled `within-day-stale-alerts` function to demote overdue-day tickets (`priority` becomes Normal, add a `within_day_missed_at` timestamp column), notify staff, and log the change. The `/track` snapshot adds a `within_day_missed` flag.
