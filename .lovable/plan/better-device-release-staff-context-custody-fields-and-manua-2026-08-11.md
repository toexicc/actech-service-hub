# Better device release: staff context, custody fields, and manual release

## What changes

### 1. Confirm device release modal shows who owns the ticket
Above the release fields, the summary block gains a "Ticket team" section pulled from the service record:
- Assigned admin (admin reps)
- Assigned technician(s)
- Handling / receiving staff

If the queue entry has no linked Service ID, these rows show "—".

### 2. Release form fields
- **Released from** — dropdown of all active staff, with helper text below: "Who holds the device before releasing." Required.
- **Released by** — read-only, auto-filled with the logged-in staff doing the release.
- **Received by** — free text input (unchanged).
- **Release notes** — textarea (unchanged).

All four values are written to the ticket's activity log as one "Device released to client" entry with structured details (released_from, released_by, received_by, release_notes, queue code, client name), so they appear on the ticket timeline in the workspace pages.

### 3. Manual release (no queue entry)
A "Manual release" button on the Release Queue board, visible to admin and management only. It opens the same modal in manual mode:
- A Service ID search field with a Search button; on match, the modal fills client, contact, device, and ticket team from the service record and enables Confirm release.
- If no match, an inline "No ticket found for that Service ID" message.
- Confirming logs the release against that ticket exactly like a queue release, tagged as a manual release (no queue code). No queue entry is created or modified.

## Technical notes
- `src/components/ConfirmReleaseModal.tsx`: accept either a `QueueEntry` or a manual `open` mode; add service lookup (`services` by `service_id`), staff dropdown from the existing `staff_directory` RPC helper (`src/lib/staffList.ts`), released-by from the current session/auth user, and extend the `logTicketActivity` details payload.
- `src/pages/QueueAdmin.tsx`: add the "Manual release" trigger on the release board and wire the modal's manual mode; gate by role.
- Queue status handling for real queue entries stays as-is (`moveQueueEntry(id, "completed")`).
- No database schema changes; activity details ride in the existing `activity_logs.changes` JSON.
