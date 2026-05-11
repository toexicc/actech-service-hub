## Root cause

The notification bell loads notifications by querying `recipient_id = userId`, but the `userId` it uses is the wrong value for everyone except AC Tech Admin.

- The edge function correctly inserts each notification with `recipient_id = auth.users.id` (a UUID).
- `DashboardLayout.tsx` reads `userId` from `sessionStorage.getItem("staffId")`, which is set in `useAuth.tsx` to `profile.staff_id ?? auth.uid`.
- Only **AC Tech Admin** has `staff_id = NULL`, so it falls back to the auth UID and matches the DB.
- **Regil, John Paul, Exiquel** all have `staff_id = "ACTS..."`, so the query searches for `recipient_id = "ACTS1778438214763"` and finds nothing — even though their notification rows exist in the DB.

A secondary bug: the `notify-service-event` edge function inserts every row with `category: "service"`, but the dropdown only renders rows whose category is `service_update` or `new_inquiry`. So a chunk of notifications are invisible regardless of who is logged in.

## Fixes

1. **`src/components/DashboardLayout.tsx`** — stop using `staffId` for notification lookup. Pass the auth user's UUID instead.
   - Replace the `sessionStorage.getItem("staffId") || ...` line with the auth user id from `useAuth()` (or `supabase.auth.getUser()` / the existing `id` field on the auth profile). The notification recipient is always the auth UID.
   - Keep `staffId` available for any unrelated code that needs the human-readable staff code, but it must not feed `NotificationDropdown`.

2. **`supabase/functions/notify-service-event/index.ts`** — change the hardcoded `category: "service"` to `category: "service_update"` so the rows show up in the Services tab.

3. **Backfill existing rows** so users see their already-created notifications in the bell:
   ```sql
   update public.notifications
      set category = 'service_update'
    where category = 'service';
   ```

4. **Verify** by signing in as Regil (or running a quick read query as that user) — the bell should immediately show the 19 historical rows that already exist in the DB for `65fc3c44-…`.

## Out of scope

- OneSignal push routing (the user confirmed in-app bell only is the issue). The OneSignal `external_id` already uses the auth UUID, so push should work once a user actually subscribes from the production domain.
- Renaming or restructuring `staffId` in sessionStorage — leaving it for legacy callers, just not using it for notifications.