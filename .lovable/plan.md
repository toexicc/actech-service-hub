# Intake & Queue Console Fixes

## 1. `/intake` kiosk confirmation screen

Currently a successful public submission toasts and navigates to `/queue?entry=...` (the live board), stranding the kiosk on the wrong page.

Replace with a full-screen confirmation overlay rendered inside `ServiceForm` (public mode only):
- Shows only the queue number (e.g. `Q-0007`) in very large type, plus a short instruction line ("Please take a seat and watch the screen — your number will be called shortly.").
- Auto-dismisses after 5 seconds (with a visible countdown), resets the form, and returns to a blank `/intake` form. A "Done" button lets the customer dismiss early.
- No navigation away from `/intake` at any point.

## 2. Hide client signature on `/intake`

Wrap the "Client Signature (Optional)" checkbox and the signature canvas in `!isPublic`, and force `physicalSignature: false` for public submissions so validation never asks for it. Signature is captured by the front-desk admin during completion instead.

## 3. Capture everything from `/intake` into the queue payload

Public submit currently stores `form_payload: data` only — image data (device annotation PNG, signature) and several fields are lost, and the prefill step only copies a partial field list.

Changes:
- Store the complete payload on public submit: all form values **plus** `annotationDeviceType`, `enablePhotoAnnotation`, `annotationNotes`, acknowledgement flags (`ack1`/`ack2`/`ack3`), all condition checkboxes, and `devicePassword`/`username`/`serial`/`color`/`memory`.
- Upload the annotation PNG to the existing `annotations` bucket under a queue-scoped path and keep only the path in the payload (keeps the row small, reuses existing storage).
- Rewrite the prefill routine to restore **every** field from the payload — including annotation radio selection + annotation image preview, acknowledgements, and all condition toggles — replacing the current hardcoded 20-field list.

## 4. "Complete Intake" opens a modal, not a page navigation

Today both `IntakeQueuePanel` and `QueueAdmin` call `navigate('/service-form?queueId=...')`.

- Extract the intake form body into a reusable component so it can render either as a page or inside a dialog.
- Add a `CompleteIntakeModal` (large dialog, `!flex-col`, `max-h-[95dvh]`, internal scroll, fixed footer — per project modal standard) rendering the full staff intake form pre-filled from the queue entry.
- On successful submit the modal closes, the queue entry is marked completed with its `service_id`, and the list refreshes in place — no navigation, no back button.

## 5. Intake tab becomes a tracker table (not a duplicate of the Queue tab)

Replace the card grid in `IntakeQueuePanel` with a table covering **all** submissions (`activeOnly: false`):

| Column | Notes |
|---|---|
| Queue # | `display_code` |
| Date/Time | `created_at`, MM/dd/yyyy |
| Client | name + contact |
| Device | type • brand • model |
| Complaint | truncated |
| Status | Waiting / Proceed / Completed / Cancelled badge |
| Service ID | link to created service when completed |
| Actions | Complete Intake (modal), Proceed / Back, Cancel |

Controls above the table: date filter (Today / Last 7 days / This month / custom range), status filter, search (queue #, name, phone, service ID), pagination at 10 rows per page.

## 6. Compact the Queue tab cards

The Queue tab is expected to hold many entries, so the current large tiles waste space. Slim them down:
- Single-line-dense layout: queue code on the left in a compact badge-style block, client name + device on one line, phone/complaint truncated to one line each.
- Smaller padding, tighter radius, smaller type; actions become compact icon-first buttons in a single row instead of a 2x2 grid.
- Waiting/Proceed columns switch to a stacked compact list so many more entries fit without scrolling.

## Technical notes

- `useQueueEntries` already supports `activeOnly: false` and shares one realtime channel — the tracker table reuses it, no new subscriptions.
- Signature/annotation uploads on final service creation stay unchanged; they simply receive values rehydrated from the queue payload.
- No schema migration needed: `queue_entries.form_payload` (jsonb) and `service_id` already exist.
