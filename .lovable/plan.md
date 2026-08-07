# Make client declines reliably move to On Hold and appear in Activity

## Confirmed findings
- `AC010826356`, `AC060826006`, and `AC010826579` each contain a saved `Declined by ...` approval remark, proving `/track` received the response.
- For all three, `client_approved_at` is still empty and `approval_locked` is false. This matches the older decline behavior that saved only the remark and did not apply the On Hold state.
- Staff subsequently changed all three tickets manually from `Waiting to Proceed` to `RTO`; those manual changes are present in Activity. Their current RTO status should not be rolled back.
- The current `submit-client-approval` source already contains the intended On Hold update, but the approval function does not create an Activity entry for either approvals or declines.

## Changes
1. **Make the approval update and audit trail reliable**
   - Keep the decline update authoritative: set status to `On Hold`, set the client-response timestamp, lock the completed response, and save the decline remark.
   - Insert a ticket-scoped Activity entry after a successful client response, using `System / Client Approval` as the actor identity.
   - Log the decision, previous and resulting status, client name, reason for a decline, approved selections for an approval, and pending selections when applicable.
   - Treat retries as idempotent so double taps do not duplicate remarks, notifications, or Activity entries.

2. **Deploy and verify the live approval function**
   - Deploy the corrected `submit-client-approval` function so the published `/track` page no longer executes the older behavior.
   - Test a decline against a controlled Waiting to Proceed ticket and confirm the response, database status, approval lock, timestamp, notification path, and Activity row agree.

3. **Backfill the three known missing audit events**
   - Add one historical system Activity entry for each recorded decline using the timestamp and reason already stored in its approval remark.
   - Preserve all three tickets as `RTO`; the backfill records the earlier client decline but does not undo the later staff status change.

4. **Verify both staff timelines**
   - Confirm the backfilled and future client responses appear in the shared Activity timeline on both `/manage-client` and `/service-update`.

## Technical details
- Update `supabase/functions/submit-client-approval/index.ts` to write the service update and its `activity_logs` audit record through the backend service client, with explicit error handling around the core state change.
- Keep notifications non-blocking after the state and audit writes succeed.
- Deploy the function, then use a one-time database data update for the three historical Activity rows only.