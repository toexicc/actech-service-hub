# Lower running credits without slowing the app

## Where the credits went (last 14 days, recorded)

| Item | Credits | Notes |
|---|---|---|
| Database server (Small, then Micro since Sep 23) | ~30.6 | Micro now costs ~2.5/day, always on |
| Network (data downloaded) | ~19.4 | ~42 GB, about 3 GB/day |
| Realtime (live updates) | ~5.4 | ~431,000 messages |
| AI (Gemini formatters) | ~4.1 | Fine, small |
| Storage, functions | ~2.6 | Small |
| Project Monitoring | ~8.9 | Optional feature, still on |

Building/planning messages (~137) are separate from running costs.

## What I'll change (same screens, same speed)

### 1. Stop broadcasting every activity log to every device (realtime)
Every signed-in session listens to 11 tables, including the activity log. Each saved action — and now every "Opened ticket" and "Screen error" line — is pushed to every open phone and PC, then makes them re-download log data. Activity logs will only be live on the ticket timeline that is open. Other tables are subscribed only by roles/pages that show them (e.g. POS transactions/expenses only for POS, Reports, Transaction Tracker; inventory only for parts pages; queue only for queue pages).

### 2. Remember data between reloads (network)
Staff reopen the app many times a shift and each reopen downloads the full ticket list again. Save the recent lists on the device for a short time so reopening shows them instantly and only fetches what changed.

### 3. TV queue display
It polls every 10 seconds all day. Switch it to live updates plus a 60-second safety check, and pause outside opening hours (10 AM–8 PM Manila) and when the screen is hidden. Display still updates within a second of a change.

### 4. Remaining wide downloads
Narrow the few remaining "download every column" reads (single-ticket payments, live ticket watcher, queue entry details) to the fields actually shown.

### 5. Your decisions (no code)
- Project Monitoring: about 9 credits in this window. Turning it off saves that, but you lose automatic error reports.
- Database size: Micro is the right size for current traffic. A smaller size (~0.6/day cheaper) risks slow pages at peak — I don't recommend it.

## Expected effect
Estimated, not measured: realtime down by about half or more, network down roughly 30–50%. I'll compare the usage numbers a few days after publishing to confirm.

## Technical details
- `src/hooks/useRealtimeInvalidate.ts`: remove `activity_logs`; accept a role/route-scoped table set; `ActivityTimeline` keeps its own per-ticket channel.
- `src/App.tsx`: add `@tanstack/react-query-persist-client` + localStorage persister, maxAge ~12h, only for list keys (services, clients, staff, inventory), buster tied to build version.
- `src/pages/QueueDisplay.tsx`: realtime on `queue_entries` + 60s poll, visibility + business-hours gating.
- `useServicePayments.ts`, `useServiceLiveWatch.ts`, `useQueueEntries.ts`: explicit column lists.
- No schema or permission changes.
