## Verified findings

- **Activity log empty for technicians** — confirmed: `activity_logs` has a single read rule limited to admin/management. Technicians write logs fine but can never read them, so the Activity panel on Service Update is always empty for them.
- **Inventory color never saved** — confirmed: the Add/Batch/Edit forms have a Color field and the parts table has a Color column, but the `inventory_parts` table has no `color` column, so nothing is stored and the column always renders "N/A".
- **Quotation form missing handling staff** — confirmed: the quotation PDF template draws a "Handling Staff:" row, but the data passed to it from Manage Client omits `receivingStaff` (the intake PDF passes it), so the row prints blank.
- **"Memory" wording** — confirmed in the intake/service form label and validation message, Manage Client, Service Update and public Track ("Memory & Color").
- **Service Update reveals fields by saved status** — confirmed: diagnosis, report, parts-used and photo sections are all gated on the *saved* status, so a technician can do the work without ever touching the status dropdown.

## Main change: status-first update flow (Service Update)

Choosing the next status becomes step one, and the fields shown belong to the status the technician just selected (not the saved one). So on a ticket sitting at Pending Diagnosis, the technician picks Confirmed Diagnosis, the fields required for that stage appear, they fill them in, and one Update saves both the fields and the new status together.

- Move the **Status** selector to the top of the update card as Step 1, showing the current saved status beside it plus a one-line hint about what the selected stage needs.
- Field sections below are driven by the **selected** status:
  - Confirmed Diagnosis selected → technician diagnosis + AI formatter + diagnosis photos + service summary
  - Ongoing Service selected → parts used from inventory
  - Done Repair (Under Observation / For Release / Advise Client) selected → technician service report + AI formatter + device report photos
  - Completed / RTO / On Hold / Cancelled / Backjob selected → remarks and notes only
- The dropdown puts the expected next status first, other allowed statuses stay selectable, the existing Confirmed → Pending revert stays allowed, and the currently-restricted statuses stay restricted.
- If no status change is made, the sections for the current stage are shown as today with a reminder that the status wasn't advanced — so nothing becomes unreachable.
- Update is blocked with a clear message when the selected stage's required field is empty (e.g. moving to Confirmed Diagnosis with no diagnosis text).
- Entered values are preserved if the technician changes the selected status again before saving.

## Technician access fixes

- Add a read rule so technicians can read activity logs for services assigned to them (reusing the existing assigned-technician helper); other logs stay admin/management only. Also give the Activity panel a clear empty state.
- Sweep the technician workflow pages (Service Update, Service Tracker, Request For Parts, Dashboard) for reads that assume admin-wide visibility. Technicians can only read their own profile row, so any staff-list usage must go through the existing staff-directory function rather than a direct profiles read.

## General fixes

- **Inventory color**: store a color value on inventory parts, save it from Add, Batch Add and Edit, and show it in the parts table (and Fast Moving parts where the same column appears).
- **Quotation form handling staff**: pass the receiving/handling staff through to the quotation PDF so it matches the intake form.
- **Memory → Storage**: rename the user-visible wording everywhere (intake/service form field and message, Manage Client, Service Update, public Track → "Storage & Color"), leaving the stored data field name unchanged so existing records still resolve.

## Technical notes

- One migration: `color text` on `inventory_parts`, plus a technician SELECT policy on `activity_logs` matching the log's service to the technician's assignment.
- Service Update work is contained to `src/pages/ServiceUpdate.tsx`: a single `selectedStatus`-driven visibility map replaces the scattered saved-status checks; the save, notification and sync logic stays as-is.
- Quotation fix is one added field in the Manage Client quotation payload; the PDF template already supports it.
