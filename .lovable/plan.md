# Fix client approval on /track + service options (OEM / Original)

## 1. "Please select at least one service" even after ticking

What the code does today: each checklist row on /track is a `<label>` element that wraps the checkbox, and the client's choice is tracked by **service name text** only.

Two concrete defects come out of that:

- Wrapping a button-based checkbox inside a `<label>` makes the label re-dispatch the click to the control, so on many mobile browsers one tap toggles the box twice — it visually ticks then instantly unticks, and Approve then complains nothing was selected.
- Because selection is keyed by the service name, two lines with the same name (e.g. two "Battery Replacement" lines) collide, and if a name is edited on /manage-client between page load and submit, the server can't match the client's pick.

Fix:

- Rebuild each row so the tick target is a single control (no label wrapper, no double toggle), with the whole row still clickable once.
- Track selection by **line index/id**, not by name. Send both the indices and the names to the server so matching cannot drift.
- Server side: match by index first, fall back to name matching, and only reject when the client truly sent nothing.
- Disable Approve (instead of firing an error toast) while nothing is ticked, so the failure state is visible before the tap.

## 2. Re-opening approval when some lines stay pending

There is already a "Re-open approval" button on /manage-client that clears the hold, but /track still hides the approval panel once any approval remark exists, so the client never sees the choices again. That is why the re-open appears to do nothing today.

Fix:

- /track shows the checklist again whenever the ticket is on Waiting to Proceed, is not on hold, and still has pending lines — even if an earlier remark exists. Previously approved lines are shown as already approved and locked; only pending lines are tickable.
- On /manage-client and /service-update the pending lines are listed in the Approval Remark block with a "Resend approval link" action (re-open + copy/share the tracking link) next to "Re-open approval".
- Each new client response appends a fresh remark line so the history of what was approved and when is preserved.

## 3. Options per service line (OEM vs Original)

AI diagnosis format supported in the Service Breakdown block:

```text
Service Breakdown
- Battery Replacement
  Option A - OEM: PHP {Amount}
  Option B - Original: PHP {Amount}
- Screen Replacement (Original): PHP {Amount}
```

- Approve on the AI Diagnosis parses these into breakdown lines where a line can carry a list of options (label + amount) instead of a single amount.
- /manage-client Service Breakdown table gains per-line options: add/remove option rows, each with a label and an amount, plus which option is pre-selected. A line with options takes its cost from the selected option.
- /track renders options as a single-choice group under the service name. Choosing an option updates that line's amount and the live total immediately.
- The chosen option is recorded, so the Approval Remark reads e.g. `Juan approved services : Battery Replacement (OEM), Screen Replacement on <date>` on both /manage-client and /service-update, and Service/s + the quotation cost fields use the chosen option's amount.
- If a line has options but none is chosen, Approve is blocked with an inline "choose an option" hint on that line.

## 4. Amount validation

- /manage-client: Update is blocked when any ticked breakdown line (or its chosen option) has an amount of 0 or blank, with the offending rows highlighted. Unticked lines may stay at 0.
- /track: Approve requires at least one ticked line, and every ticked line must have an amount greater than 0; Decline still requires only a reason. The same rules are re-checked server side so the client and server totals cannot disagree.

## 5. Reports: average time counted in working hours only

Today the Reports page measures turnaround as raw wall-clock hours, so nights, weekends and breaks inflate every average.

Change all duration metrics (average turnaround, per-stage time, turnaround distribution buckets) to count **working time only**:

- Shift window: 10:00 AM to 7:00 PM Manila time (9 hours per day).
- Deduct 1 hour 30 minutes of break per day worked, giving 7.5 productive hours per working day.
- Time outside the shift window is not counted; a ticket that sits overnight only accrues time again from 10:00 AM.
- Days marked as closed in the shop's closed-dates list are skipped entirely.
- The turnaround distribution buckets are relabelled in working terms (for example "< 4h", "4h–1 shift", "1–3 shifts") and durations display as e.g. `2 shifts 3h` instead of calendar days, with a note on the page stating the shift window and break deduction.

## 6. Attendance vs technician assignment, and attendance reminders

What the current data shows:

- Only one day has any attendance at all (Aug 3), with 11 entries — and every single one of those has a time-in but **no time-out**.
- Six active staff have no attendance row for that day at all.
- One name assigned as technician on tickets, "Exi Baclayon", has no staff profile, so that person can never be logged or counted; every other assigned technician does have a profile.

So attendance and technician assignment do not line up today: time-outs are effectively never recorded, several staff never get logged, and at least one technician exists only as free text on tickets.

Planned changes:

- **Assignment / attendance reconciliation panel** on the Attendance Overview: for a chosen date, list each active staff member with their attendance state (In only, In + Out, missing) alongside how many tickets they are assigned that day. Rows flag three problems: assigned work but no attendance, attendance without a time-out, and technician names on tickets that match no staff profile (so "Exi Baclayon" surfaces for cleanup or registration). Management can jump from a row into Staff Management or the ticket list.
- **9:45 AM time-in reminder**: every management account gets a notification (in-app + push) reminding them to log attendance IN for the day, sent only when the day is not a closed date and time-in entries are still incomplete.
- **7:00 PM time-out reminder**: same targeting, reminding management to log attendance OUT, listing the staff who are still missing a time-out.
- **Missing-log follow-ups**: a daily 8:00 PM check notifies management about that day's gaps (no time-in, or time-in without time-out), and the Attendance Overview shows a persistent banner listing dates in the last 14 days with incomplete logs so nothing is silently skipped.
- Reminders are deduplicated per day and per type, so re-opening the app does not spam the same alert.

## Technical notes


- `services.quoted_breakdown` line shape extends to `{ name, cost, selected, required, options?: [{ label, cost }], selectedOption?: string }`. Existing rows without `options` keep working unchanged — no schema migration needed (the column is already jsonb).
- `src/lib/serviceApproval.ts`: extend `parseQuotedBreakdown` / `normalizeQuotedBreakdown` for option lines, add `lineEffectiveCost()`, `lineDisplayName()` (name + chosen option) and a `validateQuotedLines()` helper used by both pages.
- `src/pages/ServiceTracking.tsx`: index-keyed selection state, option radio groups, re-openable checklist with previously approved lines locked, Approve disabled until valid.
- `supabase/functions/submit-client-approval/index.ts`: accept `selectedIndices` and `selectedOptions`, resolve by index first, validate amount > 0 on approved lines, write chosen options back into `quoted_breakdown`, and build the remark from display names.
- `src/components/workspace/ApprovalRemarkBlock.tsx`: show pending lines plus the re-open / resend actions (staff-only).
- `format-diagnosis` prompt/post-processing updated so multi-option repairs emit the `Option A - <label>: PHP {Enter Amount}` form and keep the placeholder rule.
- `src/lib/reportMetrics.ts`: add a `workingHoursBetween(start, end, closedDates)` helper (10:00–19:00 Manila, minus 1.5h break pro-rated over the counted shift portion, closed dates skipped) and use it inside `buildTimings` for both stage hours and total turnaround; `formatHours` gains a shift-aware display mode. Reports page passes the existing closed-dates list in.

