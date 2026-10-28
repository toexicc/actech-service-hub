# Fair technician rotation + phone PIN on /track

## 1. Technician auto-assignment (intake + queue intake)

Today: the pool is only technicians who have **timed in** today and aren't on leave; within it, the one with the fewest open tickets over the last 45 days wins, ties go alphabetically. Early arrivals soak up the morning tickets and "A" names win ties.

New rules:
- **Who's in the pool:** every active technician in the department, all day (10:00 AM–7:00 PM), unless on **approved leave** today. Timing in no longer matters.
- **Who gets the ticket:** whoever has received the **fewest auto-assigned tickets today** (Manila date). The 45-day backlog is no longer used.
- **Ties:** strict rotation — whoever was assigned **longest ago** wins (someone who hasn't had one yet today goes first, in a fixed roster order that rotates daily, not alphabetical). Result: 1 to Aries, 1 to Jefferson, 1 to Mark, repeat.
- Manual picks by admins are unchanged, and multi-department tickets still avoid giving both slots to the same person.
- The "Rotation pool" hint on the intake form will say "fewest tickets today" instead of "lightest live workload".

## 2. Phone PIN on public tracking (/track)

- After a client searches a Service ID, or opens a direct /track link, a centred modal asks for the **last 4 digits of the phone number** on the ticket (same rule as Release: any number stored on the ticket is accepted).
- Nothing about the ticket (status, cost, photos, reports, approval panel) loads until the PIN matches. A wrong PIN shows "Doesn't match our records"; after 5 wrong tries the modal locks for a few minutes.
- If no phone number is on file: "Please contact the front desk."
- Once verified, the ticket stays unlocked on that browser for the session, so refreshing doesn't ask again.
- The check happens on the server, so the ticket can't be read by skipping the modal.

## Technical details

- `ServiceForm.tsx` auto-assign: drop the 45-day `services` query; count today's assignments from `services` where `created_at` is on the Manila date, plus last-assigned timestamp per tech. Pool = active techs in dept minus `useStaffAvailability().isOnLeave`. Tiebreak by oldest last assignment, then a roster order offset by day-of-year. Same logic for CompleteIntakeModal (uses ServiceForm).
- New security-definer RPC `public_service_snapshot_verified(_service_id, _last4)` reusing the release digit-matching logic; `/track` calls it instead of `public_service_snapshot`. Revoke anon execute on the unverified snapshot and the public photo/report signed-URL path unless the request carries the verified PIN. Check other anon callers (release page, client service list) before revoking.
- Simple attempt throttling in the PIN modal plus server-side check; verified ticket ID stored in sessionStorage.
