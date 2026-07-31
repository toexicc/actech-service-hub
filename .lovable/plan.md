## What I found (verified)

- **Dashboard numbers are wrong for everyone, worse for technicians.** In `src/pages/Menu.tsx` the technician filter is `s.technician === userFullName`, but `technician` is a comma-joined list of all assigned techs, so any multi-tech ticket is dropped. The due/overdue parser only accepts `MM/DD/YYYY`, while `target_date` comes back as ISO `YYYY-MM-DD`, so "Due Today"/"Overdue" mis-count. "Completed" is always 0 because the dashboard only reads `useServices()`, which explicitly excludes completed tickets.
- **Service Update shows an error but still saves.** In `src/pages/ServiceUpdate.tsx` the Supabase write happens first, then a fire-and-forget Google Sheets POST runs regardless. When the Supabase write is rejected the error toast fires, but the Sheets sync (and the visible refresh) still proceeds — and the toast body reads from `result`, which is always `null`, so the real reason is never shown.
- **Technician access is name-string based.** The `services` read/update policies match `profiles.name` against the `technicians` text array (case/space-insensitive). Any rename, trailing initials, or nickname difference silently removes a technician's access — reads return nothing, updates affect 0 rows.
- **Email is over-validated.** `src/pages/ServiceForm.tsx` (used by both `/service-form` and `/intake`) renders the email field as `<input type="email">`, so the browser blocks submission on anything without `@domain.tld`.
- **Almost nothing is realtime.** Only notifications and the queue subscribe to live changes; services, inventory, part requests, transactions and clients all rely on cache timers, so staff must reload to see each other's edits.
- **Self-reloading pages.** Several hooks use `refetchOnMount: "always"` and pages render full-page loading states while refetching, which reads as a spontaneous reload every time a workbench tab is re-shown.

## Plan

### 1. Technician access and workflow
- Surface the real failure: capture `sbUpdateError.message` in the toast, and stop the "success path" side effects (Sheets sync, refresh, notifications) when the Supabase write fails, so an error never looks like a save.
- Detect the silent "0 rows updated" case (policy match miss) and report it as a permissions error instead of success.
- Harden the technician policies so access is not tied to spelling: match assignment by comparing the trimmed/case-folded technician name to both `profiles.name` and `profiles.username`, via a security-definer helper (`is_assigned_technician(service_id)`), and use it in both the technician SELECT and UPDATE policies. Add an explicit `WITH CHECK` on the technician UPDATE so a tech can save a ticket without accidentally being locked out mid-update.
- Audit the technician workflow pages (`ServiceUpdate`, `ServiceTracker`, `Menu`, `RequestForParts`) for reads that assume admin-wide visibility and make them tolerate the technician-scoped result set.

### 2. Technician dashboard numbers
- Replace the exact-string technician filter with a token match over the comma-separated technician list (case/space tolerant), reused from a single helper.
- Fix the target-date parser to accept ISO `YYYY-MM-DD` as well as `MM/DD/YYYY` (reuse the existing helper in `src/lib/timezone.ts` instead of the local copy).
- Include completed tickets in the dashboard dataset so the "Completed" card is real, while keeping active-only lists for Due Today / Overdue.
- Apply the same technician scoping to `DueDateCalendar` and the "Where tickets are now" grouping so every card on the page agrees.

### 3. Email field
- Change the email inputs on the client intake and service form to plain text inputs and drop any `.email()` refinement on that field, keeping only a max-length guard. Blank stays allowed.

### 4. Realtime updates
- Add a small shared `useRealtimeInvalidate` hook that subscribes to Postgres changes and invalidates the matching React Query keys.
- Wire it for `services`, `queue_entries`, `part_requests`, `inventory_parts` / `fast_moving_parts`, `transactions`, `expenses` and `client_inquiries`, with subscriptions created once at the app shell level and torn down on unmount (no per-render channels).
- Enable the realtime publication for any of those tables not already published.

### 5. Stop the self-reloading feel
- Remove `refetchOnMount: "always"` where realtime now covers freshness, so re-showing a workbench tab uses cached data.
- Make refetches non-blocking: keep previous data on screen and show a subtle inline indicator instead of the full-page loader, so background refresh never looks like a reload.

## Technical notes

- Policy changes go in one migration adding `public.is_assigned_technician(_service_id uuid)` (security definer, `search_path = public`) plus replacement technician SELECT/UPDATE policies on `services`; existing admin/management policies stay untouched.
- Realtime requires `ALTER PUBLICATION supabase_realtime ADD TABLE ...` for the tables not yet published; RLS still filters what each subscriber receives, so technicians only get events for their own tickets.
- No schema/column changes are needed for the dashboard or email fixes — those are frontend only.
