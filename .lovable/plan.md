# Cut database + network usage, and simplify AI errors

## What's driving the cost (verified)

- The `services` table is ~4.8 MB across 832 rows (~5.8 KB per row). Every ticket view calls one shared query that does `select *` with `limit 5000` — so each refresh downloads the **entire** table, including long text fields (AI diagnosis, reports, notes, annotations).
- That query is marked stale after 5 seconds, and any realtime change to `services` invalidates 4 query keys at once (`services`, `doneServices`, `techServices`, `allServiceBreakdowns`). One ticket edit by one staff member triggers a full table download in **every** open browser session.
- Several timers poll on top of realtime: messages + group chats every 15s, client inquiries every 30s, queue entries every 15–30s, notifications every 60s, open dashboard every 60s, typing indicators every 2s, read receipts every 10s.
- `activity_logs` is the largest table on disk (14 MB, 1389 rows) and grows with every action.

## The plan

### 1. Stop downloading the whole services table
- Replace `select *` with an explicit column list, and split it into two tiers:
  - **List tier** (tracker, dashboards, cards): only the columns those views render — no AI diagnosis, technician report, notes, breakdown text, or annotation fields.
  - **Detail tier**: a single-ticket query that loads the heavy text fields only when a workspace page (`/manage-client`, `/service-update`, `/track`) is actually open.
- Cap the list query to recent/active tickets rather than 5000 rows: active tickets always, plus completed tickets within the selected date window (the CSV export and Reports keep their own scoped queries).

### 2. Make refreshes cheap instead of frequent
- Raise the services `staleTime` from 5s to ~60s and let realtime do the invalidating.
- Debounce realtime invalidation (coalesce bursts inside ~2s into one refetch) so a batch of edits causes one refresh, not one per row.
- Only invalidate the keys a table actually feeds — stop `services` changes from also refetching breakdowns.
- Pause all polling and realtime refetches while the browser tab is hidden, and do one refresh on return.

### 3. Trim the polling timers
- Messaging: rely on the existing realtime subscription; drop the 15s poll to a 2-minute safety net, and only run typing/read-receipt polls while a conversation is open.
- Client inquiries: 30s → realtime + 2-minute safety net.
- Queue: keep the fast poll only on the public display; staff console uses realtime + 60s safety net.
- Notifications: keep realtime, move the safety poll to 3 minutes.

### 4. Keep the logs from growing forever
- Trim `changes` payloads to short summaries instead of full before/after text.
- Add a scheduled cleanup that deletes activity logs older than 90 days.

### 5. One AI error message
- Every AI-related failure (gateway errors, missing credits, rate limits, timeouts, unauthorized, empty responses) in diagnosis formatting, report formatting, and complaint formatting will surface exactly:
  `AI Network Error - Contact Administrator`
- Applies to the toast/inline message the user sees on `/service-update`, `/manage-client`, and the intake form. Real details stay in the edge function logs only.

## Technical notes

- Files: `src/hooks/useServices.ts` (column tiers + staleTime), `src/hooks/useRealtimeInvalidate.ts` (debounce + narrower key map), `src/hooks/useMessaging.ts`, `src/components/MessagingPanel.tsx`, `src/hooks/useClientInquiriesData.ts`, `src/hooks/useQueueEntries.ts`, `src/hooks/useNotifications.ts`, `src/pages/OpenDashboard.tsx`, `src/pages/ServiceTracker.tsx`, `src/lib/activityLogger.ts`, `src/lib/aiFormatters.ts` plus the three `format-*` edge functions.
- No schema changes except a retention cleanup for `activity_logs`.
- Existing behaviour is preserved: views still show the same data, just fetched with fewer columns and fewer round trips.

## Expected effect

Per-refresh payload for ticket lists drops by roughly 70–80% (heavy text columns removed), and refresh count per session drops several-fold once polls are consolidated and hidden tabs go quiet.
