## 1. Login redirect race
After a successful sign-in the app briefly bounces back to `/` before landing on `/menu`. `useAuth` never toggles `loading` back to `true` around the `SIGNED_IN` event, so `ProtectedRoute` momentarily sees `user=null, loading=false` and redirects.

- In `src/hooks/useAuth.tsx`: on `onAuthStateChange`, when a session arrives, set `loading=true` before firing `loadProfileAndRoles`, then clear it in a `finally`. Also, when the event is `SIGNED_OUT`, clear state synchronously.
- In `src/pages/Login.tsx`: rely on the `useEffect` (`!loading && user → /menu`); drop the manual `getSession` polling loop in `handleSubmit` so we don't double-navigate.
- Keep `ProtectedRoute`'s stored-token guard as-is.

## 2. Global search actually searches
`CommandPalette` queries Supabase but only when `debounced.length >= 2` — that's fine, but currently `pageResults` are always shown and remote results silently fail when tables lack expected columns.

- In `src/components/CommandPalette.tsx`:
  - Wrap each of the four Supabase queries in its own try/catch so one failing table doesn't blank all results.
  - Broaden service search to also match `device_type` and to fall back to `client_phone` when present.
  - Show a "Searching…" state while `debounced` is set but results haven't returned.
  - Fix the `staff` query: use the `profiles` + `user_roles` join via `fetchStaffList()` instead of a non-existent `staff` table (that's why staff never appears).
  - For parts: query `parts_inventory` and also `fast_moving_parts` (see `useFastMovingParts`).
  - For customers: fall back to the `services` table's distinct `client_name` when there is no `clients` row.
  - Add a top-level keyboard shortcut hint and make the palette also open on `/` when not focused in an input (already opens on ⌘K).

## 3. Desktop & tablet preview at 80% width
Currently `DashboardLayout` uses full-width containers.

- In `src/components/DashboardLayout.tsx`: constrain the main content wrapper to `max-w-[80%] mx-auto` on `md:` and up; keep `w-full` on mobile. Apply to the outer content region so every page inherits it (dashboard, tracker, workspace, staff management, etc.).

## 4. Replace "Where tickets are now" with a due-date calendar
The user dislikes the stage-grouped grid on the dashboard and wants a calendar with a side panel listing services due on the selected day.

- Delete usage of `WhereTicketsAreNow` on `src/pages/Menu.tsx` (leave the component file for now).
- Add a new `src/components/DueDateCalendar.tsx`:
  - Left: month calendar using shadcn `Calendar` (react-day-picker). Days with services due get a dot indicator (via `modifiers` + `modifiersClassNames`).
  - Right: sidebar list of services whose `target_date` (or fallback `estimated_target_date`) matches the selected day. Each row shows service ID, client name, device, and status pill. Clicking a row opens the ticket in the workbench (same `openTab` behavior as elsewhere).
  - Data source: reuse `useServices()`; parse `target_date` with the existing timezone helper.
  - Empty state: "No services due on this day."
- Wire the new component into `Menu.tsx` in the slot previously occupied by `WhereTicketsAreNow`.

## 5. Quick Actions: top, compact, single row
- In `src/pages/Menu.tsx`: move the Quick Actions panel above the hero/stats block. Render as a horizontal row of small buttons (`h-9`, icon + short label) inside a single glass strip, wrapping only on mobile (`flex-wrap md:flex-nowrap`, `overflow-x-auto` fallback).

## 6. Staff Management cleanup
- `src/pages/StaffManagement.tsx`:
  - Remove the Username input from the Add/Edit staff dialog.
  - Remove the Username column from the staff table.
  - Replace the current "email" column content (which shows `username@actech.local` placeholders) with the real auth email fetched via `manage-staff` (list action) or joined from `profiles.email` if present.
- `src/lib/userCredentials.ts` + `supabase/functions/manage-staff/index.ts`:
  - On create, generate `email` as `${staffId or random}@actech.local` internally (kept because Supabase Auth requires an email) OR accept the admin-provided email directly if one is added later — but for now auto-generate silently and never show `username` field.
  - Have the `list` action include `auth.users.email` per profile so the UI displays the real email address.
- `src/hooks/useStaff.ts`: surface `email` on each staff row.

## Technical notes
- No schema changes required.
- `Calendar` component: `src/components/ui/calendar.tsx` already exists (shadcn). No new deps.
- Preserve all existing functionality (routing, permissions, workbench tabs, notifications).

```text
Menu layout (new):
┌───────────────────────────────────────────────┐
│ Quick Actions (single row, compact)           │
├───────────────────────────────────────────────┤
│ Hero + Today's numbers                        │
├───────────────────┬───────────────────────────┤
│ Calendar          │ Services due on <date>    │
│ (month view)      │ - AC240726008 Joyce ...   │
│                   │ - AC230726229 Josiah ...  │
└───────────────────┴───────────────────────────┘
```
