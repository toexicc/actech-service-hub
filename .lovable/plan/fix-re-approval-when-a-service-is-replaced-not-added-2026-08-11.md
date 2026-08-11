# Fix re-approval when a service is replaced (not added)

## What I found on AC010826727

Confirmed from the ticket record:

- Approved services: `Software Restore`
- Saved service breakdown: `Logic Board Repair` (required, Php 7,500) — the old line is gone, replaced
- Status: `Waiting to Proceed`, approval already unlocked, no client approval timestamp

So the data is correct — the replacement happened. Two code problems stop the client from approving again:

1. On `/track`, a line counts as "nothing left to approve" if it is marked **Required**, even when the client never approved it. `Logic Board Repair` is required, so the page thinks everything is settled and hides the checklist, leaving only the old remark "approved services: Software Restore".
2. `Resend approval to client` only unlocks approval. This ticket was already unlocked, so pressing it does nothing visible, and the stale `Software Restore` entry stays in the approved list forever — even though that service no longer exists on the ticket.

## Changes

### /track (client page)
- "Still needs approval" is decided by **what the client actually approved**, not by the Required flag. Required lines that were never approved show the checklist and the Approve button again (they stay ticked, options stay selectable, as before).
- Lines the client already approved keep their lock and their "Already approved" chip.
- When the ticket's services changed after the last approval, the old approval remark is shown as superseded ("Previous approval no longer covers the current services") instead of looking like the current decision.

### /manage-client (staff)
- Saving a breakdown that **removes or replaces** an approved service now prunes that service out of the approved list (it is no longer part of the ticket), recomputes what is pending, clears the approval timestamp when nothing approved remains, unlocks approval, turns pre-approval off, and logs all of it — the same treatment adding a new line already gets.
- `Resend approval to client` becomes a real resend rather than an unlock-only action: it prunes stale approved services, recomputes pending, unlocks approval, notes it on the ticket, and logs it. It no longer reports "Approval already open" and does nothing.
- The amber resend block also appears when the services changed while nothing new was added — i.e. whenever the saved breakdown contains lines outside the client's approved list, or an approved service is no longer on the ticket. It stays below the Approval Remark and stays based on saved data only.
- After a resend, an existing approval that covers none of the current services no longer blocks the client.

## Immediate data fix for AC010826727

Remove `Software Restore` from the approved list, set pending to `Logic Board Repair`, and keep approval open, so the client sees the new quote right away.

## Technical notes

- `src/pages/ServiceTracking.tsx`: `hasPendingLines` uses `isLineApproved` instead of `isLineLocked`; add a superseded-remark condition derived from `quotedBreakdown` vs `approvedServices`.
- `src/pages/ManageClient.tsx`: extend the existing baseline/`reopenApproval` logic in the save path to also detect removed/renamed approved lines; prune `approved_services`, recompute `pending_services`, clear `client_approved_at`, set `approval_locked=false`, `auto_approve_diagnosis=false`; extend `handleReopenApproval` to do the same prune + recompute instead of just unlocking; widen the resend banner condition.
- No schema changes; existing columns (`approved_services`, `pending_services`, `approval_locked`, `client_approved_at`) cover this.
