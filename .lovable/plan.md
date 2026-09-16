# Service Tracker rows, ticket preview panel, and how service time is counted

## 1. Table view of Service Tracker

- Clicking a row no longer expands activity logs — it opens Manage Client for that ticket ID.
- The extra external-link icon beside the ticket ID is removed; only the side-panel preview icon stays.

## 2. How service duration is computed (explanation)

The clock is **working time**, not calendar time:

- Counts only shop hours (10:00–19:00 Manila), minus the 1.5 hour daily break.
- Sundays and declared closed dates/holidays are skipped entirely.
- Time is measured from the intake stamp to the moment the ticket is completed, rebuilt from the activity log so each status stage is measured separately.

The clock **pauses** (time still shown per stage, but excluded from turnaround) while a ticket sits in:

- Waiting to Proceed
- Done Repair - Advise Client
- On Hold
- Cancelled
- RTO
- any window where the Waiting for Parts flag is on (taken from the on/off log entries, so old tickets stay accurate)

So a ticket that waited 5 days for client approval and 3 days for parts only accrues the hours where staff could actually work on it. Nothing about this logic changes — the preview panel will now surface the same number so it's visible per ticket.

## 3. Side preview panel — content and UI rework

**Header**
- Ticket ID, client name and status stay, spaced properly; flag chips below with room to breathe (fixes the cramped look in image 1).

**New Assignment block (above Client)**
- Assigned Admin, Handling Staff (receiving staff) and Technician(s) on the ticket.

**Client block**
- Unchanged fields; **Ticket Documents** panel added directly below it (same unified panel as Manage Client: intake form, quotation, receipt, warranty — view/print/download only, no warranty editing).

**Device block**
- Serial number removed.

**Complaint & Issue**
- No more duplicate text: the bold chief complaint is kept, and the issue description only appears when it actually differs.
- Technician line replaced with **Duration in system** (working hours per the rules above, with the paused time noted).

**Diagnosis & Reports**
- Split into clearly labelled collapsible sections — Diagnosis, Technician Report, AI Report — each collapsed by default with a one-line preview, so long paragraphs don't flood the panel.

**Photos**
- Device Report photos and Diagnosis photos both render, each under its own labelled heading, read-only.

**Overall styling**
- Consistent section spacing, tighter card padding, monospace ID, aligned label/value rows, softer separators — same glass panel language as the rest of the workspace.

## Technical notes

- `src/pages/ServiceTracker.tsx`: drop `ActivityLogRow` usage in the table (plain `TableRow` with `onClick={() => handleEditService(service.serviceId)}`), remove the inline `ExternalLink` button; keep `ServicePreviewButton` with `stopPropagation`.
- `src/components/ServicePreviewSheet.tsx`: restructure sections; add `PosDocumentActions` (no `allowWarrantyEdit`), assignment fields from `adminRep` / `receivingStaff` / `technician`, `Collapsible` blocks for diagnosis/reports, remove serial.
- Duration: fetch this ticket's `activity_logs` rows, parse with the existing status-log parser, run `buildTimings` from `src/lib/reportMetrics.ts` with `useClosedDates`, format as `Xd Yh` plus paused hours.
- No database or metric-logic changes.
