# AI Interim Report — new findings mid-repair

An interim report is raised when new findings appear during **Ongoing Service** and the client must approve extra work before the repair continues. It sits between the initial AI Diagnosis and the AI Report, reuses the diagnosis wording, and **adds** to the quotation instead of replacing it.

## Where it appears

**Service Update (technician)** — only while the status is Ongoing Service:
1. Toggle **"Needs interim report"** (off by default, so nothing new appears on normal tickets).
2. Fields appear: Interim Findings (raw notes), then **Create Interim Report** — the AI reads the saved initial AI Diagnosis plus the new notes and writes the same section layout (Findings / Cause / Suggested Solution / Recommendations / Service Breakdown / Warranty / Summary), opening with a short reference to the initial diagnosis.
3. **Interim Report - Photos** panel, same behaviour as Device Diagnosis Photos (upload / camera, max 9, gallery).
4. A **"Send back to Confirmed Diagnosis"** button under the block sets the status manually, exactly as today's flow does.
5. Saving with an interim report present notifies the **assigned admin**: "Interim report submitted — review and move to Waiting to Proceed for client approval", linking straight to the ticket.

**Manage Client (admin)** — the interim block is always visible (read-only interim fields are editable by admin like the diagnosis fields are today), ordered:

```text
AI Diagnosis
Device Diagnosis Photos      (view only)
AI Interim Report
Interim Report Photos        (view only)
AI Report
Device Report Photos         (view only)
```

The interim block carries the same Approve control as the AI Diagnosis, with one hard rule: **Approve appends** the interim service lines to the existing Service Breakdown and never rewrites or removes existing lines. Appended lines are tagged `interim`, start unselected/unlocked, and existing approved lines keep their approval.

## Client side (/track)

- Once the ticket moves to Waiting to Proceed, the interim report appears **below** the initial diagnosis, in its own card headed "Interim Report — new findings", with its photos.
- In the service list, appended lines carry an amber **Interim** chip.
- Already-approved lines stay locked and shown as "Already approved"; the client only ticks the new interim lines. Approving them extends `approved_services` and recomputes totals — nothing previously approved is touched.

## Keeping it frictionless

- One toggle gates everything, so tickets that never need an interim report look exactly as they do now.
- Same AI button style, same field names, same photo panel, same Approve semantics as the diagnosis — nothing new to learn.
- The technician never changes the quote or the status silently: they write, attach photos, and hand back to Confirmed Diagnosis; the admin still owns Waiting to Proceed and pricing.
- The bundle-discount rule is left alone: interim lines are additive, so the original discount stays tied to the original bundle.
- One interim report per ticket (as agreed). If a second round is ever needed, the same fields can be appended to instead.

## Technical notes

Migration on `services`: `interim_needed boolean not null default false`, `interim_diagnosis text`, `ai_interim_report text`, `interim_warranty text`, `interim_summary text`, `interim_breakdown_text text`, `interim_created_at timestamptz`, `interim_approved_at timestamptz`. New `service_file_kind` enum value `interim_photo`; interim photos reuse the public `diagnosis-photos` bucket so `/track` can read them without signing.

New edge function `format-interim` mirroring `format-diagnosis` (same model and error contract via `invokeAiFunction`), taking `initialDiagnosis` + `interimFindings` + device context and returning `formattedInterim`. Reuse `splitDiagnosisText` to store the segmented fields.

Frontend: generalise `DiagnosisPhotos` to accept a `kind`/bucket prop (new thin `InterimPhotos` wrapper) instead of duplicating the component; a shared `InterimReportBlock` used by both Service Update (gated on Ongoing Service + toggle) and Manage Client (always). Approve path calls a new `appendQuotedLines(existing, parsed)` helper that de-duplicates by normalised name and marks new lines `interim: true` — `quoted_breakdown` is jsonb, so no schema change. `/track` and `submit-client-approval` render/accept the `interim` flag and keep the existing partial-approval logic (`approval_locked` is re-opened by the admin move to Waiting to Proceed, as it is today). Logging uses the existing `diffFields`/`diffBreakdown` so interim edits read in plain words.
