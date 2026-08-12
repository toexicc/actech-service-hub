# Within-the-day fast track, RTO - AC Tech reports, 9 photos, gallery viewer

## 1. Within the Day priority unlocks diagnosis + report anytime (/service-update)

Today the AI Diagnosis and AI Report blocks are gated by the ticket's saved status (`diagnosisEditable` only at Pending Diagnosis, `reportEditable` only at Done Repair - Under Observation/Observation), and the photo uploaders only appear when the technician picks a new status for the matching stage.

For tickets whose priority is "Within The Day":
- Both the AI Diagnosis container and the AI Report container are always visible and editable, at any status (no status change needed first).
- Format with AI and Clear stay enabled in both blocks.
- Both photo uploaders (Device Diagnosis and Device Report) are always shown and editable.
- A short note explains the fast-track behavior so technicians know why the fields are open.

Normal-priority tickets keep the existing status-first behavior unchanged.

## 2. RTO - AC Tech always available to technicians

- Add `RTO - ACTech` to the technician-allowed transitions from every status, so the option is never disabled in the status dropdown on /service-update.
- When the ticket is at `RTO - ACTech`, or the technician selects it, the AI Report container and Device Report photo uploader appear and are editable, so the technician can write and format the RTO report.

## 3. Photo limit raised to 9

- Device Diagnosis photos: 10 -> 9 cap becomes 9 (currently 10, aligned down to 9 for consistency).
- Device Report photos: 6 -> 9 (report checklist first, then up to 8 device photos).

## 4. /track shows the report for RTO - AC Tech

On the public tracking page, `RTO - ACTech` currently renders the Service Diagnosis card below the ticket card. Replace that with the Service Report (AI report) card, falling back to the diagnosis only if no report exists yet.

Also show the Device Report photos on /track for `RTO - ACTech` tickets (read-only, opened with the gallery viewer below), so the client can see the photos backing the RTO report.

## 4b. Format with AI button placement

In both the AI Diagnosis and AI Report blocks on /service-update (and the matching blocks on /manage-client), move the "Format with AI" and "Clear" buttons from above the technician diagnosis/report field to directly below that field, so the flow reads: type notes -> Format with AI -> review the formatted output.



## 5. Gallery-style photo viewer everywhere

Replace the single-photo preview dialog in both photo panels with a shared gallery viewer used on /manage-client, /service-update and /track:

- Click any thumbnail to open it; Previous/Next arrows move through the whole set without closing.
- Keyboard arrows (left/right) and Escape work; on mobile, swipe left/right.
- Shows a "3 of 9" counter and a thumbnail strip for direct jumps.

## Technical notes

- New `src/components/PhotoGalleryDialog.tsx` (photos array + index, controlled open state), used by `DiagnosisPhotos.tsx` and `DeviceReportPhotos.tsx` in place of their local preview dialogs.
- `ServiceUpdate.tsx`: derive `isWithinTheDay` from `serviceData.priority` and `isRtoActech` from status/selection; fold both into `diagnosisEditable`, `reportEditable`, `reportStageReached`, `showDiagnosisStage`, `showReportStage`, `showReportEditors`.
- `src/lib/serviceStatus.ts`: `technicianAllowedNextStatuses` always appends `RTO - ACTech`.
- `MAX_PHOTOS = 9` in both photo components.
- `ServiceTracking.tsx`: swap the `rtoKind === "actech"` card to render `serviceData.aiReport` with title "Service Report" (diagnosis as fallback), and render read-only `DeviceReportPhotos` for that case.
- Button relocation is a JSX reorder inside the existing diagnosis/report blocks — no logic changes.
- No database or backend changes needed.
