# Ticket flags, filters, warranty order, client cleanup

## 1. Within the Day covers two days
A Within the Day ticket stays in the Within the Day filter on the day it was created **and the next day**. It moves to Normal, and the "not repaired within the day" notice goes out, only after that second day ends (Manila time).

## 2. Warranty options in order
Warranty choices are listed shortest to longest: 30 Days / 1 Month, 45 Days, 3 Months, 6 Months, 1 Year. The 1 Year option is new. This order is used everywhere warranty is picked.

## 3. New filter cards
- **Invoice**: tickets with Requesting Invoice on (Service Tracker and Service Tracking).
- **Device Out**: tickets with the new "Device Out with Client" flag on (Service Update and Service Tracking, plus Service Tracker to match).

## 4. New flag: "Device Out with Client"
- It only records where the device is. It does not pause or change anything.
- On Manage Client and Service Update it sits below Pre-Order.
- On the staff intake form and the queue intake form it sits beside Pre-Order, with the flags laid out in a tidy 2x2 grid.
- A "Device Out" chip shows on tracker cards and tables.

## 5. Only management can switch Ordered on or off
Admins and technicians can see the Ordered switch, but they can't change it.

## 6. Device annotation on the ticket
Manage Client and Service Update get a collapsible "Device Annotation" section, closed by default. It shows the marked-up device image and its notes. Admins and technicians can edit the notes (and redraw if needed) and save. The new version replaces the old one.

## 7. Hide finished tickets from flag cards
These cards leave out Completed, Cancelled, On Hold and all RTO tickets: Backjob, Ordered, Pre-Order, Pre-Approved, Within the Day, Rush, Interim, Device Out.

## 8. Overdue rule, confirmed
- A ticket that is past its target date for no outside reason (it wasn't held up by Waiting for Parts, Ordered, Pre-Order or Waiting to Proceed) keeps its **Overdue** tag. It does not get the "change target date" pop-up.
- The pop-up and the resume notice are only for tickets that ran late because of one of those holds. Once the hold is lifted, those tickets go back to being counted as overdue normally.
- I will check each overdue count and tag against this rule and fix any place that hides a ticket that is really overdue.

## 9. Merge near-duplicate customers
- I'll look for customers whose names are nearly the same, for example the same name with different capitals, spacing or small typos, or the same name with the same real phone number.
- **You'll see the list of proposed merges before any change is made.** After you approve, each group is combined under one customer ID. Its tickets move to that ID and the leftover records are deleted, the same way we merged Belekoy.

## 10. Brand suggestions show brands only
The Brand dropdown only suggests plain brand names like Apple or Samsung. Entries such as "Apple iPhone" and "Apple MacBook" are removed from brand suggestions, and the model part is kept as a model suggestion.

## Technical notes
- `isTodayService` becomes a created-date-within-(today, yesterday) check. `within-day-stale-alerts` demotes only when the Manila creation day is before yesterday. Redeploy.
- Put the warranty options in one ordered constant in `constants.ts` and use it in every warranty select.
- Migration: `services.device_out_with_client boolean not null default false`. Add it to `public_service_snapshot` only if the track page needs it (not needed). Map it in `serviceRecordShape`/`useServices`. Add it to the `create_service_atomic` payload and the queue `form_payload`.
- In `TicketFlagsPanel`, gate the Ordered switch on `userRole === 'management'`.
- Annotation: load the `device_annotation_path` image and `device_annotation_notes` with the existing `DeviceAnnotationCanvas`. On save, upload a new annotation file and update the path and notes.
- Card filters: wrap the flag cards with `!isClosedStatus(status)` (Completed, Cancelled, On Hold, RTO*).
- Overdue: audit `isOverdueEligible` so the hold exclusion applies only while a hold is active. Keep `target_review_pending` as the only thing that triggers the modal.
- Clients: read-only query to group by normalized name and phone. Show the groups, then run SQL updates on `services.client_id` and delete the duplicate rows after approval.
- Device catalog: SQL to delete `kind='brand'` rows that contain more than one word matching a known brand plus a model word. Re-insert the model part as `kind='model'`. Guard `rememberDeviceValue('brand')` to store only the first known-brand token.
