# Client decline → On Hold, with correct "What's next" and working alerts

## What happens today
- When a client declines on `/track`, the approval function records a "Declined by ..." note in the admin notes but **does not change the ticket status** — the ticket stays in Waiting to Proceed.
- Notifications on decline are inserted directly into the notifications table by the approval function, without the push fan-out that other service alerts use.
- The "What's next" banner is driven purely by status. For On Hold it always reads "Client is not sure yet with service ... Please monitor for feedback.", so a declined ticket would show the wrong guidance.

## What to build

### 1. Decline sets the ticket to On Hold
On a decline, the approval flow will:
- set status to `On Hold`
- stamp the client's response time so repeat submissions are recognised
- keep the existing "Declined by {client} on {date}: {reason}" entry in the notes (this is what staff views show as the approval remark)

### 2. Notifications that reliably land
Decline alerts go to every assigned admin and technician (plus the receiving staff, and management as a fallback if no assignee can be matched), delivered through the same push + in-app path used by other status alerts, so they show in the notification panel and as a push.

Message: "{Client} declined the service for {ID} ({Client}'s {device}). Reason: {reason}. Please prepare the device for return to owner. Ticket is now On Hold."

### 3. Correct "What's next"
- Normal On Hold (no client decline): keeps the current wording — "Client is not sure yet with service {ID} ({Client}'s {device}). Please monitor for feedback."
- On Hold caused by a client decline: "Client declined the service for {ID} ({Client}'s {device}). Please prepare the device for return to owner and update status to RTO once returned."

Both `/manage-client` and `/service-update` show the decline-aware wording; `/track` continues to show the declined state as it does now.

## Technical notes
- `supabase/functions/submit-client-approval/index.ts`: add `status: "On Hold"` + `client_approved_at` to the decline update branch; broaden the notification fan-out (receiving staff + management fallback) and route through the existing `notify-service-event` function so pushes fire; return the new status in the response.
- `src/lib/serviceNotifications.ts`: add a `declined` variant to the On Hold branch of `getStatusNotificationMessages` (extra optional flag) and expose it through `getStatusGuidance`.
- `src/pages/ManageClient.tsx` / `src/pages/ServiceUpdate.tsx`: detect a client decline from the admin-notes remark ("Declined by ... ") when status is On Hold and pass that flag to the guidance helper.
- `src/pages/ServiceTracking.tsx`: after a decline, use the returned status so the page reflects On Hold immediately.
