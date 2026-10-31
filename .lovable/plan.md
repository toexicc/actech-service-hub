# Delivery and Pickup Schedule updates

## 1. Delivery page (rider view)
- Remove the MWF / TTHS city-list note from the Delivery page. It stays on the admin Pickup Schedule page as a reference.
- Make each pickup card smaller:
  - Top line: type badge, client name, status, and time.
  - Second line: address and tap-to-call number, with smaller text and icons.
  - Show the cost when there is one.
  - Smaller Done and Reschedule buttons in one row, with less padding inside the card.
- Fix the calendar on desktop. Right now it sits small in the corner of a wide box. On wide screens the calendar will sit next to the day's list, each at a sensible size. On phones they stay stacked.

## 2. Cost on Add Schedule
- Add a "Cost (₱)" field (optional) to the Add/Edit Schedule form on Pickup Schedule.
- It is read with the same number cleaning used elsewhere (16,500.00 becomes 16500), so commas are fine.
- The cost shows on the admin list and on the rider's cards.

## 3. Activity log for pickups and riders
Add a **Logs** tab on Pickup Schedule, next to the Schedule view, for admin and management. It shows:
- **Rider viewed schedule**: when a Delivery user opens the page or picks a date. Repeat opens are counted at most once every 5 minutes per rider per date, so the log stays readable.
- Schedule created, edited, or cancelled (who did it and what changed, including cost).
- Marked Done, or Rescheduled with the reason and the old and new dates.

Log table columns: When (MM/dd/yyyy - HH:MM:SS, Manila time), Who, Action, Client / Date, Details.
Filters: date range, rider or staff member, and action type, plus search. 10 rows per page.

I'll also add a small "Last viewed by rider" line on each day in the admin calendar list, so staff can see at a glance if the rider has checked.

## Technical details
- Migration: `ALTER TABLE pickup_schedules ADD COLUMN cost numeric` (nullable). No new table: logs go into the existing `activity_logs` with `entity_type = 'pickup'` and actions `pickup_viewed`, `pickup_created`, `pickup_updated`, `pickup_cancelled`, `pickup_done`, `pickup_rescheduled`. The details go in `changes`.
- Check that Delivery-role users can insert into `activity_logs` under the current policy, and add a narrow insert policy if they can't. Reading the logs stays limited to admin and management.
- The view throttle lives in a small tested helper (5-minute window per rider and date).
- Files: `src/pages/Delivery.tsx`, `src/pages/PickupSchedule.tsx`, `src/hooks/usePickupSchedules.ts`, a new `src/components/pickup/PickupLogs.tsx`, and `PickupCalendar.tsx` for the sizing.
- Check with Playwright: the rider view at desktop and phone widths, and the admin Logs tab after a rider views the page.
