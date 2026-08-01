## 1. Staff deletion failing ("Edge Function returned a non-2xx status code")

Diagnosis is not yet confirmed — the delete path can fail at three different points and the current code turns all of them into an opaque 500. There are no foreign keys pointing at profiles/auth users in the database, so the likely culprit is the auth-user deletion itself or the profile delete being blocked by access rules (profile deletion is admin-only, and the AC Tech Admin account is now on the management role).

Fix plan (`supabase/functions/manage-staff/index.ts` + `src/lib/userCredentials.ts` + `src/pages/StaffManagement.tsx`):

1. Make the delete action report the real cause: wrap each step (roles removal, profile removal, auth-user removal) and return a specific message instead of a generic 500.
2. Graceful fallback: if the account can't be hard-deleted, deactivate it (status `inactive`, roles removed) and return success with a `soft: true` flag; the UI then shows "Staff deactivated (account could not be fully removed)". No more non-2xx for a recoverable case.
3. Pass the stable user UUID from the staff list instead of the username when deleting, so the lookup can't miss.
4. Surface the returned error text in the toast so any remaining failure is self-describing.
5. Verify by deleting a test staff member end to end and reading the function logs.

## 2. "Client already approved" option at intake

Goal: some tickets are pre-approved at intake, so they should never sit in **Waiting to Proceed** — after Confirmed Diagnosis they go straight to **Proceed Repair**.

**Database**: add `auto_approve_diagnosis` (boolean, default false) to `services`.

**Intake forms** (`src/pages/ServiceForm.tsx`, which also powers the queue "Complete Intake" modal):
- New checkbox in the Client Acknowledgement block: "Client pre-approves the diagnosis and authorizes the service to proceed without a separate approval step." Saved to the new column on submit.
- Shown for staff intake and the queue modal; hidden on the public `/intake` form (client-side self intake).

**Ticket pages** (`src/pages/ManageClient.tsx`, `src/pages/ServiceUpdate.tsx`):
- When the flag is set, remove **Waiting to Proceed** from the status dropdown entirely, and make the suggested next status after Confirmed Diagnosis be **Proceed Repair** (unblocked for these tickets).
- Show a small badge on the ticket ("Pre-approved at intake") so staff know why the step is gone.
- Keep the existing rule that a Service Quotation PDF must exist before leaving Confirmed Diagnosis.
- Add a read-only/toggle display so admins can still see (and, for admins only, correct) the flag on the ticket.

**Public tracking page** (`src/pages/ServiceTracking.tsx`, `StatusProgressBar`, stage groupings):
- Hide the Approve/Decline actions and drop the "Waiting" step from the progress track for pre-approved tickets.

**Notifications**: skip the "waiting for client approval" alert for these tickets; the Confirmed Diagnosis → Proceed Repair transition notifies as usual.

## Technical notes
- Status list stays unchanged in `src/lib/constants.ts`; filtering happens per-ticket at render time.
- Existing tickets default to `false`, so current behavior is untouched.
