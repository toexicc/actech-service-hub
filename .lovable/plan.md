# Manage Client contact details, editable estimated cost, open Waiting for Parts, TV board fix

## 1. Show email and phone on Client Information (`/manage-client`)

Add two read-only rows to the Client Information details block, right under Client Name / Client ID:

- Contact Number (falls back to "N/A")
- Email (falls back to "N/A")

Both values already exist on the loaded ticket and are already editable through the "Edit details" editor, so this is display only.

## 2. Make Estimated Cost editable

Currently Estimated Cost is display-only on `/manage-client` and only set at intake.

- Add an "Estimated Cost" number field to the existing Edit details form (next to the Diagnostic/Repair Time Frame fields), saved to the ticket.
- Amounts are parsed with the currency-safe parser, blank means 0, negatives rejected.
- The change is recorded in the activity log like the other detail edits (old value → new value).

## 3. Waiting for Parts toggle for all roles

Today the toggle on `/manage-client` is wrapped in the admin/management-only block, so a technician opening the same page can't use it. The `/service-update` toggle is already open to technicians.

- Move the Waiting for Parts card out of the admin/management gate on `/manage-client` so admin, management, and technician can all flip it.
- The activity log entry keeps recording the actual staff name and role that toggled it.
- Client pre-approves diagnosis stays admin/management only.

## 4. TV browser not loading `/queue`

The board is served through a separate lightweight entry (`QueueRoot`), but it still pulls in the shadcn `Card`, `lucide-react` icons, a bundled logo image, and the shared Supabase realtime hook. Any one of those failing on an old Tizen/webOS engine leaves a blank screen with no clue on the TV.

Harden the board so it degrades instead of blanking:

- Replace `Card` and `lucide-react` icons on `QueueDisplay` with plain elements/inline SVG so the board depends on no component library at runtime.
- Fetch queue entries with a simple polling read (every ~10s) as the source of truth, and treat realtime as an optional accelerator: if the websocket never connects, the board still refreshes.
- Wrap the board in its own visible error state — if data or rendering fails, the TV shows a readable message and keeps retrying rather than a white screen.
- Keep layout to plain flex/percentage grid with no `dvh`, no container queries, no backdrop filters, no modern color functions; stacked fallback when the 4 columns don't fit.
- Add a `?plain=1` mode that renders the numbers only (largest possible type, no logo, no images) as a guaranteed-render fallback for the oldest TVs.

## Technical notes

- `src/pages/ManageClient.tsx`: contact/email rows in the details block; ungate the Waiting for Parts card.
- `src/components/workspace/ServiceDetailsEditor.tsx`: add `estimated_cost` to the draft, payload, and change diff.
- `src/pages/QueueDisplay.tsx`: dependency-free rewrite of the board markup; polling refresh added in `src/hooks/useQueueEntries.ts` (opt-in flag so the staff console keeps current behaviour).
- No database changes needed — `estimated_cost` and `waiting_for_parts` columns already exist.
