# Compact the update forms on /manage-client and /service-update

Same treatment as Client Information: group the short, single-line fields into tidy 2-column rows so the update panel is much shorter and faster to fill in. Long-form fields (paragraphs) stay exactly as they are, full width.

## /manage-client — "Update Client Information"

Grouped into labeled sub-sections, each a 2-column grid on desktop (single column on mobile):

- Assignment: Status, Admin Rep, Technician
  (Raise Concern button stays inline at the top-right of the section header)
- Classification: Device Type, Client Type, Priority
- Pricing: Service Cost, Discount type + value, Requesting Invoice (VAT) checkbox, Final Cost
  (Final Cost keeps its large highlighted display, placed beside the VAT box)
- Schedule: Diagnostic Time Frame, Repair Time Frame, Estimated Target Date

Untouched, still full width and in the same order/place:
Chief Complaint, AI Diagnosis block (Technician Diagnosis + AI Diagnosis + buttons), AI Service Report block, Service/s, quoted Service Breakdown panel, Parts Used, Admin Notes (Customer), Admin Notes (Internal), photos, and the Save button.

## /service-update — "Service Update"

- Step 1 status selector, Waiting for Parts toggle, Additional Repair / Raise Concern buttons: unchanged (status-first workflow stays intact).
- Short fields after the status change (Assigned Technician, and any other single-line selects in that stage) move into a 2-column grid row.
- Untouched: Technician Diagnosis, AI Diagnosis, Technician Report, AI Report, Technician Notes (Internal), Parts Used, diagnosis/report photo uploaders.

## Also

- Read-only Client Information cards on both pages: no change (already compacted).
- Tighter vertical spacing inside the update cards (`gap-y` on the grids instead of stacked `space-y-4`), same font sizes and controls.

## Technical notes

- Presentation-only edit: wrap existing field `div`s in `grid gap-x-4 gap-y-3 sm:grid-cols-2` wrappers inside `src/pages/ManageClient.tsx` (Update Client Information card) and `src/pages/ServiceUpdate.tsx` (Service Update card). No state, validation, save payload, or conditional-visibility logic changes.
- Long-form fields get `sm:col-span-2` where they sit inside a grid, so they keep full width.
- Section headings reuse the existing small uppercase muted label style used in the Client Information cards.
