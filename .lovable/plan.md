# Migrate to Lovable Cloud + Feature Updates

## Overview

Replace the entire Google Sheets / Apps Script backend with Lovable Cloud (Postgres + Storage + Edge Functions + AI Gateway). Start with empty tables (no data import). Keep the existing UI, but rewire every page to Cloud. Then ship the requested feature updates.

This is a large migration — once approved, we'll execute it in phased sub-deliveries so each phase is verifiable in the preview before moving on.

---

## Phase 1 — Enable Cloud + Schema

Enable Lovable Cloud and create the full schema with RLS:

**Tables**
- `profiles` (id, name, username, department, status, salary, salary_type) — mirrors auth.users
- `user_roles` (user_id, role: admin|technician|management) — separate table per security policy
- `services` — every column currently in the Service Database sheet (clientId, deviceType, brand, model, serial, issue, diagnosis, status, technician[], adminRep[], receivingStaff, dateReceived, targetDate, dateCompleted, partsUsed, laborCost, totalCost, paymentStatus, remarks, internalAdminNotes, internalTechnicianNotes, etc.)
- `service_files` (service_id, kind: intake|quotation|signature|annotation|device_report, storage_path, uploaded_at) — replaces AG/AK/AP/AQ/AV/AW link columns
- `clients` (clientId, name, contact, email, address, …)
- `client_inquiries` — current inquiry sheet
- `inventory_parts` + `fast_moving_parts` + `part_requests` + `part_logs`
- `transactions`, `expenses`, `funds` (POS / transaction tracker)
- `notifications`, `messages`, `chat_threads`, `chat_members`, `read_receipts`, `typing_indicators`
- `activity_logs`
- `closed_dates`
- `salary_disbursements` (period, staff_id, days_present, daily_rate, contributions_pagibig, contributions_sss, contributions_philhealth, gross, deductions, net)

**Storage buckets** (private, signed URLs)
- `intake-forms`, `quotation-forms`, `signatures`, `annotations`, `device-reports`, `chat-attachments`

**RLS**: `has_role()` security-definer function; technicians see only assigned services; admin/management see all.

**Realtime**: enabled on `services`, `notifications`, `messages`, `typing_indicators`.

## Phase 2 — Auth + Data Layer

- Replace `userCredentials.ts` and Login flow with Cloud email/password auth + Google sign-in.
- Rewrite `googleSheets.ts` consumers as typed Supabase client calls. Create new hooks under `src/hooks/` that mirror existing names (`useServices`, `useStaff`, `useInventory`, `useNotifications`, `useMessaging`, …) so page components don't need rewrites — only the data source changes.
- Delete `googleSheets.ts`, `corsPostHandler.ts`, Apps-Script-specific helpers, and the `sheet-status-webhook` edge function once unused.

## Phase 3 — Files, PDFs, AI

- PDF generators (`pdfGenerator.ts`, `quotationPdfGenerator.ts`) keep producing PDFs client-side, then upload to Cloud Storage; insert a `service_files` row. Modal viewers (`DeviceReportViewer`, intake/quotation/signature/annotation viewers) load via signed URL.
- Move AI calls (`format-diagnosis`, `format-report`) to Lovable AI Gateway (`google/gemini-3-flash-preview`) via the existing edge functions. Drop the user-supplied OpenAI key flow.
- Push notifications (OneSignal) stay client-side; notification rows now live in Cloud and stream via realtime instead of Sheets polling.

## Phase 4 — Status workflow update

- Remove `For Payment` and `For Pickup` from `STATUS_OPTIONS` and everywhere they're referenced (notifications mapping, conditional UI, dashboards, tracker, salary/POS guards). Final list becomes 13 statuses.
- Migrate any logic that depended on those two statuses into the surrounding flow (e.g. `Done Repair - For Release` → `Completed`).

## Phase 5 — Status Progress Helper (manage-client + service-update)

- New `<StatusProgressBar />` component.
- Renders a horizontal stepper of the active statuses with the current step highlighted.
- Below the bar: shows the same role-specific message used in notifications (pulled from the existing status→message map) so the user always sees "what to do next".
- Mounted at the top of `ManageClient.tsx` and `ServiceUpdate.tsx`.

## Phase 6 — Shareable `/track` URL

- Add route `/track/:serviceId` (keep `/track` for the search landing).
- When a service is loaded via search, push `/track/AC########`.
- Page reads `useParams()` and auto-fetches; if param present, skip the search UI and go straight to results.
- Update notifications, forwards, and the "share" flow to use the deep link.

## Phase 7 — AI Report on "Done Repair – Advise Client"

- In `ServiceUpdate.tsx` (and the read-only view in `ManageClient.tsx`), when status equals `Done Repair - Advise Client`, render the AI-formatted report card immediately below the device report photos section.
- Re-uses `format-report` edge function and existing report formatting rules (Performed / Rec / Cost / PROCEED prompt).

## Phase 8 — Approve button on "Waiting to Proceed"

- Below the Client Intake Form and Service Quotation Form previews:
  - Helper text: "Please review the service quotation form, then click Approve once okay."
  - `Approve` button. On click:
    - Update `services.status` → `Proceed Repair`
    - Trigger the existing status-change notification pipeline (assigned technician + admin rep)
    - Log activity
- Visible only when status === `Waiting to Proceed`.

## Phase 9 — Salary Disbursement calculator

Rework the Salary column into a full calculator row per staff member:

| Field | Behavior |
|---|---|
| Monthly Salary | Reference only (read from `profiles.salary`) |
| Days Present | Numeric input |
| Daily Rate | Auto = monthly ÷ workdays-in-period (Mon–Sat). Editable override. |
| Pag-IBIG | Auto-suggested, editable |
| SSS | Auto-suggested, editable |
| PhilHealth | Auto-suggested, editable |
| Gross | days_present × daily_rate (computed) |
| Total Deductions | sum of contributions (computed) |
| Net Pay | gross − deductions (computed) |

Saves a `salary_disbursements` row per staff per period (15th / EoM).

---

## Technical notes

- **Migration order is non-negotiable.** Phases 1–3 must land together as one deploy because they replace the data source. Phases 4–9 land incrementally.
- **No data import.** Old Sheets data stays in Sheets; the new Cloud DB starts empty. Existing Service IDs (AC + 11 digits) remain the format; sequence resets from a configurable seed.
- **Hooks-first approach** keeps the UI changes minimal — most pages only change their import source.
- **Edge functions** to add: `generate-service-id`, `send-status-notification`, `format-diagnosis` (rewritten to AI Gateway), `format-report` (rewritten to AI Gateway). Existing `sheet-status-webhook` deleted.
- **Memory updates**: after migration, replace `architecture/google-sheets-backend-choice` and `features/notifications-messaging-system` memories with their Cloud equivalents.

---

## Deliverables checklist

- [ ] Cloud enabled, schema + RLS + buckets created
- [ ] Auth migrated, hooks rewired, Sheets code removed
- [ ] PDF + file upload + viewer working through Cloud Storage
- [ ] AI formatter on Lovable AI Gateway
- [ ] `For Payment` / `For Pickup` removed everywhere
- [ ] StatusProgressBar on manage-client + service-update
- [ ] `/track/:serviceId` deep link
- [ ] AI report under device photos on `Done Repair - Advise Client`
- [ ] Approve button on `Waiting to Proceed`
- [ ] Salary calculator with contributions

Approve to begin Phase 1.