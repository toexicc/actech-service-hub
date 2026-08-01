## What I found (verified against the code and live database)

1. **"Shows in the popup but not in the panel"** — confirmed. The notifications table currently holds two categories: `service_update` (72 rows) and `service` (10 rows). The `service` rows are written by the public client-approval function (`submit-client-approval` inserts `category: "service"`), but the panel's three tabs only match `service_update` / `new_inquiry`, `message`, and `others` / `part_request`. So those approval alerts land in the bell's toast preview (which shows the newest unread of *any* type) and then vanish — they belong to no tab.

2. **"Sometimes it's not really notifying"** — chat messages never create a notification row at all. `useMessaging` / `MessagingPanel` only insert into `messages`; nothing calls `createNotification` with type `message`. That is why the Messages tab is permanently empty and DMs never alert the recipient.

3. **The mobile error** — `useNotifications` calls `new window.Notification(title, ...)`. On Android Chrome (and mobile Chromium generally) that constructor throws `TypeError: Failed to construct 'Notification': Illegal constructor. Use ServiceWorkerRegistration.showNotification() instead.` It is unguarded, so it surfaces through the global error handler as a "notification" error.

4. **Secondary reliability gaps** — permission is requested on mount without a user gesture (silently denied on iOS/Safari, so nothing ever appears); the toast preview fires on any increase in unread count rather than on a genuinely new notification; and OneSignal push is skipped entirely on non-production hostnames (expected, but worth stating so preview behaviour isn't mistaken for a bug).

## Fix plan

**A. Make every notification land in a tab**
- Normalize categories at read time in `src/lib/notifications.ts`: map unknown/legacy values (`service`, `status`, empty) onto the supported set, so old rows immediately appear under Services.
- Change `submit-client-approval` to insert `category: "service_update"` and backfill the 10 existing `service` rows to `service_update`.
- Add a catch-all in `NotificationDropdown`: anything not matching Messages or Others falls into Services, so no future category can ever be invisible.

**B. Notify on chat messages**
- After a DM or group message is sent successfully, create `message`-type notification rows for the other thread members (using the thread membership already available), and route the push through the existing edge function so offline recipients get it too.
- Clicking such a notification opens the messaging panel on that conversation (pass the thread id through `onOpenMessaging`).

**C. Fix native notification display on mobile**
- Replace the direct `new Notification(...)` call with a helper that prefers `serviceWorkerRegistration.showNotification()` when a registration exists, falls back to the constructor only when it's actually supported, and swallows failures in a `try/catch` so it can never bubble to the global error handler.
- Request permission on a user gesture (opening the bell / first interaction) instead of on mount, so iOS/Safari can actually grant it.

**D. Panel/preview correctness**
- Trigger the toast preview off a genuinely new notification id (not off the unread count), so marking-as-read or a refetch can't spawn phantom popups.
- Keep the badge count from the same normalized list the tabs render, so the badge can never disagree with what's visible.

## Technical notes
- Realtime is already enabled for `notifications` with full replica identity and RLS allows recipients to read their own rows — no policy change needed.
- Files touched: `src/lib/notifications.ts`, `src/hooks/useNotifications.ts`, `src/components/NotificationDropdown.tsx`, `src/hooks/useMessaging.ts`, `supabase/functions/submit-client-approval/index.ts`, plus one small data-backfill migration.

## Verification
- Confirm the 10 previously invisible approval notifications appear under Services.
- Send a DM between two accounts and confirm a Messages-tab entry plus alert on the recipient side.
- Load the app on mobile viewport and confirm no notification-related runtime error is recorded.
