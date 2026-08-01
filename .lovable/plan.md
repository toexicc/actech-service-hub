# Editable service details + approval toggle on /manage-client

## 1. Inline edit mode for Service Details

Add an **Edit details** button in the "Service Details" card header, visible only to admin/management (`isAdminOrManagement` from `useAuth`).

When active, the read-only rows switch to inputs, with **Save** / **Cancel** in the same header:

- Client: client name, Facebook Name/Instagram Username, contact number, email, address
- Device: device type (select), brand/model, serial number, storage, color, device password
- Intake meta: client type (select), priority (select), service/s, estimated time frame, estimated target date (date picker), device notes / condition checkboxes (Dents, Scratches, Missing Parts, Physical Damage, Important Files, No Power, Repair History)

Not editable here (kept in the existing Update Client Information card): status, admin rep, technician, service cost, discount, final cost, service date.

Save behavior:
- Trim and length-limit text fields; validate email format when non-empty; numeric-safe target date.
- Single update to the `services` row for the current `service_id`, then refresh the ticket and invalidate the services cache so tracker/dashboard reflect the change.
- Write an activity log entry ("Updated service details") with the changed field names, using the existing activity logger and full-name convention.
- Cancel restores the last saved values without writing.

## 2. Pre-approved diagnosis toggle

Add a **Client pre-approves diagnosis** switch in the same card (admin/management only), bound to the existing `auto_approve_diagnosis` column.

- Toggling it on: "Waiting to Proceed" stays hidden from the status list, `/track` hides the approve/decline buttons and drops that step.
- Toggling it off: reverts the ticket to requiring client approval — "Waiting to Proceed" reappears in the status options and the approval buttons return on `/track`. Any previously stored `client_approved_at` is cleared so the client must approve again.
- Confirmation prompt when turning it off while the ticket is already past "Confirmed Diagnosis", noting the client will need to approve again.

## Technical notes

- All work is in `src/pages/ManageClient.tsx` plus a small edit-form section component; data write goes through the existing services update path in `src/hooks/useServices.ts` (extend the update mapping with any of the above fields not yet handled, e.g. `client_type`, `priority`, `device_password`, `conditions`, `auto_approve_diagnosis`, `client_approved_at`).
- Existing RLS already lets admin/management update `services`; no migration needed.
- Gate the whole edit affordance behind `isAdminOrManagement` so technicians see the current read-only view.
