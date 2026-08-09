# Additional repair re-approval + workspace and queue polish

Yes — your suggested solution works, and it's the right shape. The key rule: re-approval never erases what the client already approved; it only opens the *new* lines for approval.

## 1. Additional Repair (technician side)

On `/service-update`, next to **Raise Concern**:

- New **Additional Repair** button, visible only when status is `Proceed Repair`, `Ongoing Service`, or `Done Repair - Under Observation`.
- Opens a small modal: short reason for the new finding (required), then confirm.
- On confirm: status goes back to **Pending Diagnosis**, approval is re-opened (unlocked), previously approved services stay recorded, and the assigned admin(s) are notified ("Additional repair needed on {Service ID}: {reason}").
- Everything is written to the ticket activity log (status change + reason + who did it).
- The technician can then update the diagnosis and service breakdown as normal.

## 2. Resend approval (admin side)

On `/manage-client`, in the quoted service breakdown area:

- The existing re-open control becomes a clearer **Resend approval to client** button, available whenever the saved breakdown contains lines the client has not approved yet (and always available manually).
- A small notice appears when the breakdown changed after the client's last approval: "New services added since the client approved — resend approval."
- Pressing it unlocks approval on `/track` and notifies the client contact where a notification path exists; it never clears `approved_services`.

On `/track`:

- Already-approved lines show as locked/approved with a check and are not selectable.
- Only the new/pending lines are selectable, and the client can submit approval again.
- Cost recalculation keeps prior approvals and adds newly approved lines.

## 3. Client Information layout (both `/manage-client` and `/service-update`)

Replace the one-item-per-line list with a compact 2-column (3 on wide screens) label/value grid using the existing `WorkspaceField` style: small uppercase label, value beneath. Grouped as Client (name, type, priority, contact, email) and Device (type, model, serial, storage & color, password). Same data, roughly half the height.

## 4. Parts Used collapsible

On `/manage-client`, wrap the Parts Used panel in a collapsible section with a header showing part count and total cost. Default state: collapsed.

## 5. Phone number format + release verification

- Client Intake form: contact number required and validated as `09` + 9 digits (11 digits total, e.g. `09171234567`). Inline error on bad input; digits-only entry.
- `/release`: after searching a ticket, the client must type the **last 4 digits** of the phone number on file before "Confirm and join release queue" is enabled. Mismatch shows an error and does not reveal the stored number. Tickets without a stored number fall back to front-desk handling with a clear message.

## 6. Device release page fields

In the confirmation card, replace **Contact** with **Email**, and replace **Storage & Color** with **Service Date**.

## 7. Queue console tabs

- Remove the `(0)` count from the Release Queue tab label.
- Merge into a single **Intake and Release Queue** tab containing both boards, clearly separated with headers (Intake above, Release below, each with its Waiting / Proceed columns) and a quick toggle to jump between them. Records tabs stay as **Intake Records** and **Release Records**.

## Technical notes

- No schema change needed: `approved_services`, `pending_services`, `approval_locked`, `quoted_breakdown` already exist. `pending_services` is recomputed from `quoted_breakdown` minus `approved_services` when approval is re-opened.
- Additional Repair reuses `notifyTechnicianConcern`-style admin resolution in `src/lib/serviceNotifications.ts` plus `logTicketActivity`.
- `/track` selection state derives from the snapshot RPC (`public_service_snapshot`) so re-opened approvals appear without stale-cache issues.
- Release last-4 check is client-side against the number returned by `public_release_summary`; the number itself stays masked in the UI.
