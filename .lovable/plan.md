## 1. Logs show full name, not email

`activityLogger.ts` reads `sessionStorage.getItem("username")`, and `useAuth` stores the profile `username` there (which is the email for accounts created without a separate username). Switch all logger helpers to prefer `userFullName` (already stored by `useAuth`) and fall back to `username`. Also backfill display in `getServiceLogs`/`ActivityLogRow` so blank/email actor names resolve to the profile name.

## 2. Notifications are late / missing

Current behaviour is 30s polling only (`useNotifications`), so a status change can take up to 30s and is missed entirely while the tab is backgrounded.

- Add a Realtime subscription on `notifications` filtered by `recipient_id` inside `useNotifications` (created inside `useEffect`, channel removed on unmount) so inserts arrive instantly; keep polling as a 60s safety net.
- Enable Realtime for `notifications` via migration.
- Harden delivery in `serviceNotifications.ts`: recipient resolution currently drops anyone whose name doesn't match `findStaffByName` exactly. Add normalized/partial matching fallback and always include assigned technicians + admin reps + management when the target list resolves empty, and surface (not swallow) edge-function failures so the direct-insert fallback actually runs.

## 3. AI diagnosis Service Breakdown must not contain amounts

The `format-diagnosis` prompt already asks for `Php [Enter Amount]`, so the model is drifting. Add a deterministic post-processing step in the edge function that rewrites any numeric peso value on Service Breakdown lines to `Php {Enter Amount}`, and update the prompt to that exact placeholder text.

## 4. Confirmed Diagnosis stage flow

Reverse the current guard order in `ManageClient`:

- "Update" always saves field edits (approved AI content, service cost, discount, target date) without requiring a quotation PDF.
- Only block a **status change away from Confirmed Diagnosis** when no Service Quotation PDF exists, with a modal telling the user to generate it first.
- Ensure the quotation generator reads the just-saved service cost/discount/final cost rather than stale state.

## 5. Real payments instead of total cost (/track, /manage-client, /service-update)

Today deposit/balance come from `initial_payment` and the quote total only.

- Add a shared `useServicePayments(serviceId)` hook that sums `transactions` rows for the service (payments minus refunds), mirroring the POS model.
- Derive: Total (final cost), Total Paid (initial payment + recorded transactions), Balance = Total − Total Paid. Use these on `/track`, `/manage-client`, and `/service-update` payment summaries.
- `/track` public read needs an anon-safe path: expose payment totals through the existing `get-service-pdf`-style edge function pattern (new `get-service-payments` function using service role) so no anon grant on `transactions` is required.

## 6. /track details

- Balance label: "Balance" (drop "pay on pickup").
- Payment methods list: use the full POS MOP set (Cash, GCash, Maya, Bank Transfer, Credit Card, Others) instead of the hardcoded three.
- Service date: show the date the client approved the diagnosis (transition into Proceed Repair) instead of `N/A`; derive from activity logs / status change timestamp, falling back to `service_date`.
- Serial number: read from the intake `serial_number` field.
- Estimated Target: bind to the saved Estimated Target Date field (`target_date`), not a computed/derived date.
- "Your Quote": also render the `SUMMARY:` line parsed from the AI report.

## 7. /manage-client client type dropdown

The update form still lists only "New Client" / "Returning Client". Replace with the current option set (New Client - Walk In, New Client - Pickup, Returning Client - Walk In, Returning Client - Pickup, Backjob) from the shared constants so existing saved values display correctly; map legacy values so the current selection shows.

## 8. Service Tracker Completed tab is empty

Confirmed cause: `useServices` fetches with `.neq("status","Completed")`, so completed services never reach the tracker. Add a combined data source (active + completed) for the tracker so the Completed tab lists all completed services, while other tabs keep their existing filters.

## 9. Completed Transactions commission + allocation

- Commission column: instead of the predetermined department formula, use the **sum of the saved service breakdown allocations** for that service when breakdown rows exist; fall back to the formula only when nothing is allocated. Summary "Commission" card sums the same way.
- `ServiceBreakdownPanel`: amount field becomes a money input with a ₱ prefix and formatted/comma input handling (parsed via `parseCurrency`).
- "Save Breakdown" enabled only when the draft differs from saved rows (dirty check), disabled otherwise.

## 10. Salary Disbursement reflects allocated commission

For service-based staff, replace the `serviceCost × %` guess with the actual allocated amounts: aggregate `service_breakdowns` by technician for services completed inside the selected cutoff period, show that total as the commission base, and include it in the computed net pay (still allowing a manual override).

## Technical notes

- New migration: enable Realtime on `notifications` (`ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications`).
- New edge function `get-service-payments` (service role, public) for the anonymous `/track` page.
- Files touched: `src/lib/activityLogger.ts`, `src/hooks/useNotifications.ts`, `src/lib/serviceNotifications.ts`, `supabase/functions/format-diagnosis/index.ts`, `src/pages/ManageClient.tsx`, `src/pages/ServiceUpdate.tsx`, `src/pages/ServiceTracking.tsx`, `src/pages/ServiceTracker.tsx`, `src/pages/CompletedTransactions.tsx`, `src/pages/SalaryDisbursement.tsx`, `src/components/ServiceBreakdownPanel.tsx`, `src/hooks/useServices.ts`, plus new `src/hooks/useServicePayments.ts`.

## Item needing investigation first: browser tab switch reloads the page

No `visibilitychange` or reload handler exists in app code, so the reload is not coming from an obvious listener — the likely candidates are the PWA service worker auto-update (`vite-plugin-pwa` + the OneSignal worker override) claiming clients on refocus, or `refetchOnMount: "always"` queries showing a full-page loading skeleton that looks like a reload. This diagnosis is unconfirmed, so step one will be to reproduce and instrument the refocus path, then fix the actual trigger (disable SW auto-reload / switch the affected queries to cached-first) rather than guessing.
