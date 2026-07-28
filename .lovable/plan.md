# Restructure Ticket Workspace + /track fidelity pass

Goal: Truly restructure `/manage-client` and `/service-update` to match the Fixy "Ticket Workspace" reference (stepper header + rails + main workspace + right panel), and align `/track` step chips with the real service status vocabulary while retaining every legacy field.

No existing field, handler, alert, or side effect is removed. This is a composition/layout change plus one chip-vocabulary fix on `/track`.

---

## 1. `/track` step chips reflect real statuses

Today `src/pages/ServiceTracking.tsx` renders a synthetic 6-step chip row (`Received / Diagnosed / Waiting / Repair / QA / Ready`) that doesn't match the actual `STATUS_OPTIONS` in `src/lib/constants.ts`.

Change:
- Drive the chip list from the real active workflow statuses:
  1. Pending Diagnosis
  2. Confirmed Diagnosis
  3. Waiting to Proceed
  4. Proceed Repair (merges with Ongoing Service)
  5. Done Repair - Under Observation
  6. Done Repair - For Release
  7. Done Repair - Advise Client
  8. Completed
- Terminal / off-path statuses (`Backjob`, `RTO`, `On Hold`, `Cancelled`) are surfaced as a distinct badge next to the chip row rather than as a step (so the chips still read as forward progress). If the service is in one of these, the last reached main step stays highlighted and the off-path badge appears with the appropriate tone (destructive / warning / muted).
- Chip labels are shortened for the compact rail (`Pending`, `Confirmed`, `Waiting`, `Repair`, `Observation`, `For Release`, `Advise Client`, `Completed`) with the full status name in a `title` tooltip.
- `stepIdx` is derived by looking up the current status in the ordered list — no more substring matching.
- Progress percentage and `stepIdx/total` counter update to use the new length.

Nothing else on `/track` changes.

---

## 2. New shared layout primitive: `TicketWorkspaceShell`

New folder `src/components/workspace/` with:
- `TicketWorkspaceShell.tsx` — 3-column glass layout (left rail / main / right rail) that collapses to one column below `lg`. Slots: `hero`, `leftRail`, `main`, `rightRail`.
- `WorkspacePanel.tsx` — titled glass card wrapper with optional icon + action.
- `WorkspaceField.tsx` — label/value row for read-only info.
- `ChargesBreakdown.tsx` — line-item table for Service Cost / Discount / Final Cost / Initial Payment / Balance / Payment Status.
- `WhatsNextBanner.tsx` — pulls copy from the same `STAGE_MAP` used by `TicketWorkspaceHero`.
- `ActivityTimeline.tsx` — read-only list of `activity_logs` rows for `entity_id = serviceId`.

All styling via existing semantic tokens (`--surface-glass`, `--shadow-float`, `--primary`, etc.). No hardcoded colors. Pure presentational — no business logic.

---

## 3. `/manage-client` rebuild (composition only)

Keep every state variable, mutation, handler, guard, alert, PDF flow, chat/forward action, notify call, notification trigger, and gating condition exactly as-is. Only rearrange JSX into the new shell.

Section → slot mapping:

- **Hero:** existing `TicketWorkspaceHero`.
- **Left rail:**
  - Client Information panel (name, contact, email, address, client type, source).
  - Device Information panel (type, brand, model, serial, memory + color combined to fix the truncation, device notes, device password toggle, device annotation viewer).
  - Assignment panel (technicians, admin reps, receiving staff, target date).
  - Documents rail (Intake PDF, Quotation PDF, Technician Report PDF — same view-pdf handlers).
- **Main column (top-down, existing status gates preserved):**
  - `WhatsNextBanner`.
  - Diagnosis: AI Diagnosis Formatter + Device Diagnosis Photos (Confirmed Diagnosis onward — same gate as today).
  - Repair/Report: AI Report Formatter + Device Report Photos (Done Repair – For Release onward — same gate as today).
  - Notes: Internal Admin Notes, Internal Technician Notes, Remarks.
  - Status controls: Status dropdown + Update button (existing Generate-Quotation-first guard preserved).
- **Right rail:**
  - `ChargesBreakdown` (Service Cost, Discount, Final Cost, Initial Payment, Balance, Payment Status) — same visibility rules (hidden on Pending Diagnosis, service cost + discount only on Confirmed Diagnosis, full breakdown afterward).
  - Quick Actions: Notify, Forward to chat, Print.
  - `ActivityTimeline`.

---

## 4. `/service-update` rebuild (composition only)

Same shell, technician-scoped. Every editable field the technician uses today stays where the workflow needs it, just moved into the new slots.

- **Left rail (read-only refs):** Client card, Device card (Device Password masked toggle preserved, Device Notes, Device Annotation viewer), Assignment, Documents (Intake + Quotation view-pdf with the existing fallback resolver).
- **Main column:** `WhatsNextBanner` → Diagnosis (AI Diagnosis Formatter editable + Device Diagnosis Photos upload) → Repair/Report (AI Report Formatter editable + Device Report Photos upload) → Technician Notes / Diagnosis fields → Status controls (existing dropdown + all current guards, including AI Report → `technician_report` copy on Done Repair – For Release, and reload-after-save behavior).
- **Right rail:** read-only `ChargesBreakdown`, Quick Actions (Save, Forward, Notify), Parts Used / Part Requests summary link, `ActivityTimeline`.

Existing hydration behavior is preserved: every field with stored data preloads on mount (target date, notes, costs, discount, etc.).

---

## Technical notes

New files:
- `src/components/workspace/TicketWorkspaceShell.tsx`
- `src/components/workspace/WorkspacePanel.tsx`
- `src/components/workspace/WorkspaceField.tsx`
- `src/components/workspace/ChargesBreakdown.tsx`
- `src/components/workspace/WhatsNextBanner.tsx`
- `src/components/workspace/ActivityTimeline.tsx`

Modified:
- `src/pages/ManageClient.tsx` — JSX composition only.
- `src/pages/ServiceUpdate.tsx` — JSX composition only.
- `src/pages/ServiceTracking.tsx` — step-chip vocabulary replaced with the real workflow statuses; off-path status badge added; no other changes.

Multi-tab workbench, command palette, `/menu`, `/service-tracker`, and all other pages are untouched.

## Out of scope

- No schema changes, no RLS changes, no new tables, no new edge functions.
- No removal of any existing field or action.
- No visual overhaul of `/track` beyond the chip vocabulary fix.
