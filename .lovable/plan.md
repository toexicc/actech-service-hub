# Fix & Restore Plan

This is a large scope, so I'll deliver it in phases. Each phase is independently shippable so you can verify as we go. Tell me if you want to reorder or drop anything before I start.

---

## Phase 1 — Data integrity (highest priority)
Many issues below stem from intake fields not being persisted/displayed. Fix the pipeline first.

- Audit Client Intake Form → DB → `/manage-client` → `/service-update` → PDFs for every field:
  phone, email, username, password, memory, color, service date, device notes, plus any other intake fields.
- Ensure each field is:
  1. Saved to `services` (add columns via migration if missing),
  2. Read back into manage-client + service-update forms,
  3. Rendered in Client Intake PDF and Service Quotation PDF.
- Fix **Technician Notes (internal)** — verify write path on service-update and read on manage-client.
- Make **Estimated Cost** optional on intake form (remove `required`, allow null in DB).
- Rename **Time Frame → Estimated Time Frame** (form label + PDF).
- Rename **Target Date → Estimated Target Date** on /manage-client (UI + PDF).

## Phase 2 — AI Diagnosis & Formatter UX
- Update `format-diagnosis` edge function prompt: in **Service Breakdown**, output `[Enter Amount]` instead of any Php value. Never guess prices.
- On `/manage-client` AI Diagnosis **Approve** → confirmation modal ("Confirm the generated diagnosis is correct?").
- On `/service-update`, when AI Diagnosis or AI Formatter buttons appear, show a notice modal reminding user to use them; block save until acknowledged.

## Phase 3 — Device Report Photos
- New **Device Diagnosis – Photos** uploader on `/service-update` shown at status **Pending Diagnosis** (technicians).
- Display the same photos on `/manage-client` at status **Confirmed Diagnosis**.
- On `/track`, render below **Service Diagnosis** starting at **Advise Client** status (mirror Service Diagnosis rules).
- Verify existing Service Report photos appear on `/track` below Service Report at **Done - Advise Client**.

## Phase 4 — /track cleanup
- Remove **Admin Rep**, **Technician Name**, and **Handling Staff** from `/track`.

## Phase 5 — /service-update conditional UI
- **Technician Report** field only visible from **Done Repair – Under Observation** onward.
- Greyed-out/disabled state for any file slot (intake PDF, quotation PDF, device report, service report) when the file is not yet in DB on `/track`, `/manage-client`, `/service-update`.

## Phase 6 — Service Quotation PDF button
- Replace reload-dependent state: after `Generate PDF` succeeds, immediately swap to `Update Form` by invalidating the file query / updating local state from the upload response.

## Phase 7 — /service-tracker tabs
- Convert the current Ongoing list into a **Tabs** layout:
  - Tab 1: **Ongoing**
  - Tab 2: **Completed**
  - Tab 3: **Cancelled / RTO / On Hold** (combined)
- Fix **Forward** and **Notify** actions (will diagnose root cause — likely missing recipient resolution or broken edge call).

## Phase 8 — Chat feature
- Diagnose current breakage (likely thread membership or RLS-related after the Sheets→Cloud migration). Restore send/receive, read receipts, typing.

## Phase 9 — Request for Parts
- Fix the request flow so it writes a row to `part_requests` with status **For Ordering** and surfaces in `/inventory-management` Pre-Ordered tab.
- Verify auto-link to inquiry / service IDs still works.

## Phase 10 — POS refund → technician deduction
- When a refund is processed against a service ID in POS:
  - Show a **Deduction** field (default to refund amount, editable).
  - Create/append a deduction record tied to the service's assigned technician for the current cutoff (15th / EoM).
  - Surface it under that technician's `other_deductions` in `salary_disbursements` for the active period.

## Phase 11 — Branding
- Remove **"Powered by Stack&Scale"** wherever it appears (footer, login, splash, etc.).

## Phase 12 — Regression sweep ("missing data after migration")
After Phase 1, walk every page that reads `services` / `client_inquiries` and confirm no field is silently dropped vs. the old Sheets schema. I'll list anything I find missing and add it.

---

## Technical Notes

- **Migrations needed (Phase 1):** likely add columns on `services` for any intake fields not yet stored (e.g. `username`, `password`, `memory`, `color`, `service_date`, `device_notes`). I'll inventory before writing the migration.
- **Edge functions touched:** `format-diagnosis` (prompt), possibly `notify-service-event` (forward/notify fixes).
- **No schema-destructive changes.** All migrations additive.
- **Auth/RLS:** chat fix may require revisiting `is_thread_member` usage; no policy weakening.

---

## Questions before I start

1. **Order of execution** — Phase 1 → 12 as listed, or do you want chat (Phase 8) and tracker tabs (Phase 7) bumped earlier since they're user-visible blockers?
2. **POS refund deduction** — should the deduction be **automatic** (created the moment refund posts) or **prompted** (admin confirms amount in a modal first)?
3. **Service Quotation "Update Form"** — when user clicks Update Form after generating, should it regenerate the PDF from current form values, or open an edit dialog first?

If you just say "go", I'll proceed in the order above with sensible defaults (auto-deduction with editable amount; Update Form regenerates from current values).