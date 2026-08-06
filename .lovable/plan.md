# Raise a concern to the assigned admin from Service Update

Add a "Raise Concern" button next to the status selector on `/service-update` so a technician can send a message to the ticket's assigned admin(s), who then receive a notification.

## What the technician sees

- A small outlined button with an alert icon beside the Step 1 status label (top-right of the status row), always available regardless of status.
- Clicking it opens a modal:
  - Read-only line: ticket ID, client name, and who will be notified (assigned admin names, or "Management" if no admin is assigned).
  - Required message textarea (concern details), max ~500 chars.
  - Cancel / Send Concern buttons; button disabled while empty or sending.
- On success: toast "Concern sent" and the modal closes. On failure: destructive toast, modal stays open so the text isn't lost.

## What the admin receives

- A notification titled `Concern raised: {Service ID}` with body `{Technician name}: {message}` (client name + device appended for context), linked to the ticket so clicking it opens the service.
- Delivered to every assigned admin rep on the ticket (comma-separated names supported). If none resolve, it falls back to management accounts so the concern is never lost.
- Push notification is delivered through the same path used by existing service alerts.

## Technical notes

- Add `notifyTechnicianConcern(service, message, fromName)` to `src/lib/serviceNotifications.ts`, reusing the existing `fetchStaffList` + `findStaffByName` resolution, the management fallback, and `sendViaEdge` (so rows land via the `notify-service-event` function with a direct-insert fallback).
- Add local state and the dialog in `src/pages/ServiceUpdate.tsx` (shadcn `Dialog` + `Textarea`), mirroring the existing notify dialog pattern used in `ServiceTracker.tsx`.
- Log the action through the existing activity logger so the concern appears in the ticket timeline.
- No schema changes: uses the existing `notifications` table with category `service_update`.
