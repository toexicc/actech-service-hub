## 1. Public `/intake` form trims (`src/pages/ServiceForm.tsx`)

- Serial: make it optional in the schema when `isPublic` (keep required for staff form).
- Hide the whole Device Annotation block (annotation device type, canvas, annotation notes) when `isPublic`. Staff still see it, and the completion modal keeps working — public payloads simply carry no annotation.
- Hide the "Format with AI" button on Chief Complaint when `isPublic` (staff keeps it).

## 2. Live queue not updating when an entry is completed

Confirmed cause: the public read rule on queue entries only allows anonymous visitors to see rows with status `waiting` or `proceed`. When staff mark an entry `completed`, the updated row no longer passes that rule, so the realtime event is never delivered to the public `/queue` screen and the tile stays on the board.

Fix: widen the anonymous read rule to recent entries (created within the last 12 hours) regardless of status, so the completion event reaches the board. The public page keeps filtering to waiting/proceed, so completed numbers disappear immediately. Exposure stays equivalent to today (same recent-day rows).

Also add a light safety net: `useQueueEntries` keeps a slow background refetch even while realtime is "live" (every 30s) so the board self-heals from any missed event.

## 3. Intake tab (`src/components/IntakeQueuePanel.tsx`)

- Remove the Actions column and its buttons entirely (Complete/move/cancel remain in the Queue tab). Rows stay read-only records.
- Replace the preset date dropdown with a date range filter (From / To date pickers, still with quick "All" reset).
- Add a Device Type filter populated from the existing device types (Laptop/Macbook, IPad/Tablet, IPhone/Mobile, Apple Watch, Computer/IMac), plus "All".
- Keep search, status filter, pagination, and record count.

## 4. Kiosk confirmation screen with QR (`src/pages/ServiceForm.tsx`)

- Extend the auto-return countdown from 5s to 10s.
- Render a scannable QR code next to/below the big queue number pointing at `https://actechrepair-service.com/queue?entry=<display_code>` — the live queue page already highlights the matching entry via the `entry` param.
- Caption under the QR: "Scan to watch the live queue on your phone."
- QR is generated client-side with the `qrcode` package already in the project (no new dependency).

## Technical notes

- One database migration for the widened public read rule on `queue_entries`; no schema changes.
- `Complete Intake` flow, `CompleteIntakeModal`, and the Queue tab are untouched.
