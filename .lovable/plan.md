# Required-service lock drives the Proceed Repair advance

## What happens today (verified in code)

- On /manage-client each Service Breakdown line has a lock toggle that sets `required` on the line, and locking it also forces the line ticked.
- The approval edge function currently treats **any** unapproved line as "partial": it keeps the ticket on Waiting to Proceed and sets `approval_locked`, so a client who approves the required repair but skips an optional add-on still blocks the ticket.
- Nothing forces the shop to lock a line, so a quotation can be published with zero required services.

## Change 1 — advance on required lines only

New rule for a client approval on /track:

- If the breakdown has required (locked) lines: the ticket moves to **Proceed Repair** as soon as every required line is approved (and each required line with options has an option chosen), even when optional lines are left unticked.
- Unapproved optional lines still get recorded as pending, appear in the Approval Remark ("Pending Approval on …") and stay available if the shop re-opens the approval later. They no longer put the ticket on hold.
- If a required line is *not* approved: the ticket stays on Waiting to Proceed and goes on hold (`approval_locked`) exactly as today, so the shop discusses it and re-opens.
- If the breakdown has no required lines at all (older tickets), behaviour is unchanged: any pending line keeps it on Waiting to Proceed.
- Costs keep working the same way — the quoted total is recomputed from the approved lines only.

## Change 2 — /manage-client must lock at least one service

- Update is blocked when the Service Breakdown has lines but none is locked, with a clear message ("Lock at least one required service — the client's approval of the required service(s) is what moves the ticket to Proceed Repair") and the lock column highlighted.
- The same check runs before generating the Service Quotation Form, so a quotation is never published without a required service.
- Existing amount rules stay: every ticked line (or its chosen option) must be greater than 0.

## Change 3 — clearer required vs optional on /track

- Required lines show a small "Required" tag and stay ticked and non-removable (already the case), optional lines show "Optional" so the client understands what is needed to proceed.
- Approve stays enabled only when all required lines are satisfied; the hint text names the required line that needs an option chosen.

## Technical notes

- `src/lib/serviceApproval.ts`: `validateQuotedLines` gains a `requireLock` option (adds a form-level "lock at least one" problem); add a `requiredLinesSatisfied(lines)` helper used by /track and mirrored server-side.
- `src/pages/ManageClient.tsx`: pass `requireLock: true` in the update and quotation-generation guards; surface the message via the existing toast + `quotedProblems` highlighting.
- `supabase/functions/submit-client-approval/index.ts`: after building `relined`, compute `hasRequired` and `requiredPending`; set `approval_locked` / stay on Waiting to Proceed only when `requiredPending.length > 0` (or when there are no required lines and something is pending), otherwise set `status = "Proceed Repair"` while still writing `pending_services`.
- `src/pages/ServiceTracking.tsx`: required/optional badges and the required-satisfied gate on the Approve button.
