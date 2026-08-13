# Queue entry linked to the wrong ticket

## What I found (verified in the database)

The service ID is not missing — it landed on the wrong queue row.

- Queue **Q-0399** = Elizabeth vidanes, 09178351212, "Not charging", submitted 08/13 11:50 AM.
- It is stamped with ticket **AC130826012** — but that ticket belongs to **Jonah Agas** (Sony PlayStation 5, created 1:17 PM by Khaye Naranja).
- Jonah's own queue entry **Q-0406** was cancelled at 1:26 PM with no ticket attached.
- Elizabeth vidanes has **no ticket at all** in the system.

So when Jonah's PS5 intake was completed, the form was linked to Elizabeth's queue entry: the queue row got closed and stamped with Jonah's ticket, and Elizabeth's request silently disappeared from the board.

Why it can happen today:
- The Complete Intake modal only shows the queue code in the title bar; once the form scrolls, there is no visible reminder of whose entry is being completed.
- On submit, the ticket is linked to whatever queue entry was opened — nothing checks that the client name/phone on the form still matches that entry.
- The form is not reset per queue entry, so state can carry over between entries opened back to back.

## Fix

1. **Linked-entry banner** — a sticky strip at the top of the Complete Intake form showing the queue code, client name and phone from the entry being completed, so the wrong row is obvious immediately.
2. **Mismatch guard on submit** — if the form's client name or phone no longer matches the linked queue entry, show a confirmation with two clear choices:
   - "Link to Q-0399 anyway" (name was corrected at the counter), or
   - "Create as a walk-in ticket and leave Q-0399 in the queue".
3. **Clean slate per entry** — the intake form fully resets when a different queue entry is opened, so nothing bleeds between entries.
4. **Data repair for today's mix-up** — detach AC130826012 from Q-0399 and put Elizabeth vidanes back on the intake board as waiting; attach AC130826012 to Jonah's Q-0406 and mark it completed so the records match reality.

## Technical notes

- `src/components/CompleteIntakeModal.tsx`: key `ServiceForm` by `queueId` (forces a fresh mount per entry).
- `src/pages/ServiceForm.tsx`: keep the fetched queue entry in state (currently discarded after prefill), render it as a sticky banner in embedded mode, and compare `clientName`/`phone` against it inside `onSubmit` before calling `create_service_atomic`. On "create as walk-in", call the RPC with `_queue_id: undefined`.
- Comparison is normalised (trim, case-insensitive, digits-only for phone) so harmless formatting edits do not trigger the prompt.
- Data repair is a one-off data change on `queue_entries` only; `services` rows are untouched.
