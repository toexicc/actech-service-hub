# Make client declines work going forward, and log everything in Activity

## Confirmed findings
- `AC010826356`, `AC060826006`, and `AC010826579` each contain a saved `Declined by ...` approval remark, proving `/track` received the response.
- For all three, `client_approved_at` is still empty and `approval_locked` is false. This matches the older decline behavior that saved only the remark and did not apply the On Hold state.
- Staff later moved all three from `Waiting to Proceed` to `RTO` manually; those changes are present in Activity.
- The current `submit-client-approval` source already contains the intended On Hold update, but it is not the version running live, and it writes no Activity entry at all.

## Scope
No historical data is touched. All three tickets stay exactly as they are (`RTO`). The work only ensures correct behavior from now on.

## Changes

### 1. Client decline reliably lands On Hold (forward only)
- Deploy the corrected approval function so the published `/track` page stops running the older behavior.
- On decline: set status to `On Hold`, stamp the client response time, lock the completed response, and keep the decline remark.
- Make the state change the authoritative step: if it fails, the client sees a real error instead of a false success.
- Retries and double taps stay idempotent — no duplicate remarks, notifications, or Activity rows.
- Verify with a controlled test ticket: response, stored status, lock, timestamp, notification, and Activity row must all agree.

### 2. Activity logs everything, including automatic/system events
Every ticket event lands on the one shared timeline shown on both `/manage-client` and `/service-update`, with actor, role, timestamp, and expandable before → after detail.

Client and system events to start logging:
- Client approved (full), client partially approved, client declined — with client name, chosen services and options, pending services, reason, and the resulting status.
- Automatic status transitions: advance to `Proceed Repair` on approval, `On Hold` on decline, approval lock applied, approval re-opened by staff, auto-complete when balance reaches zero.
- Automatic recosting: service cost and final cost changes driven by the client's selection, plus VAT and discount effects.
- Quotation form auto-regenerated after an approval changes the priced lines.
- Notifications sent for a ticket (who was alerted and why), and notification/push failures.
- Payments recorded against a ticket and the resulting balance.
- Inventory parts consumed or returned by a ticket update.
- Photo, signature, annotation, and document uploads or replacements.

Automatic events are attributed to a clear system actor (for example `System` / `Client Approval`) so a human action is never mistaken for an automated one, and vice versa.

### 3. Verification
- Confirm each event type above produces exactly one readable Activity entry, visible on both staff pages.
- Confirm no event is silently dropped when a downstream step (notification, push, PDF) fails.

## Technical details
- `supabase/functions/submit-client-approval/index.ts`: write the service update first with explicit error handling, then insert the `activity_logs` audit row via the backend service client; keep notification fan-out non-blocking; deploy the function.
- `src/lib/activityLogger.ts`: add a system-actor logging helper so automatic events are attributable without a signed-in user.
- Add logging calls at the existing automatic paths: `src/lib/approvedQuotationSync.ts`, `src/lib/autoCompleteService.ts`, `src/lib/serviceNotifications.ts`, `src/lib/inventoryDelta.ts`, `src/hooks/useServicePayments.ts`, and the approval re-open handler in `src/pages/ManageClient.tsx`.
- `src/components/workspace/ActivityTimeline.tsx`: no structural change needed; it already renders actor, role, and field-level detail for the new entries.
