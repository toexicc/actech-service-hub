# Time frames, tracking page polish, tracker defaults, sheets cleanup

## 1. Public tracking page (/track)
- Show the **Discount** amount as its own line in the cost summary (the discount value is already loaded, it just isn't displayed).
- Display **Diagnostic Time Frame** and **Repair Time Frame** in the details column, replacing the current "Estimated Time Frame" line.
- Change the "Notes from the team" card to a light-yellow surface so it stands out.
- Re-verify public access end to end in a signed-out browser session: open a real ticket by ID, confirm amounts, breakdown, required badges and the approval submit all work without an account.

## 2. Rename to "Diagnostic Time Frame"
Every place currently labelled "Estimated Time Frame" becomes **Diagnostic Time Frame**:
- /track, /manage-client, /service-update
- Client intake form field label and placeholder
- Client details editor
- Client Intake Form PDF row label

The stored value and options list stay the same — label-only change.

## 3. New "Repair Time Frame"
- New field on /manage-client (same dropdown options as the diagnostic time frame), saved with the ticket.
- Displayed directly below Diagnostic Time Frame in Client Information on **/manage-client** and **/service-update**, and on **/track**.
- Editable from the ticket details editor as well, so admins/management can correct it.

## 4. /service-tracker
- "In service (X) days" currently counts Service Date → today. Change it to count **Service Date → Estimated Target Date** (the planned service window). When either date is missing, show "—".
- Default tab becomes **All** instead of Ongoing (deep links with `?tab=` or `?status=` still win).

## 5. Client information editor
- Remove the **Address** field from the edit form (not used by the shop). Existing stored values are left untouched, just no longer editable there.

## 6. Remove Google Sheets remnants
- Delete the legacy sheets client/bridge helpers and the unused `GOOGLE_SHEETS_SCRIPT_URL` imports across the pages that still reference them, plus the sheet-shaped fallback merge paths.
- After this, every page reads and writes the database only, and no sheet fallback can reintroduce stale or zeroed data.

## Technical notes
- Migration: add `repair_time_frame text` to `public.services`, and expose it in `public_service_snapshot` so anonymous /track visitors receive it. No policy changes.
- `estimated_completion` keeps holding the diagnostic time frame (no data migration).
- Files: `src/pages/ServiceTracking.tsx`, `src/pages/ManageClient.tsx`, `src/pages/ServiceUpdate.tsx`, `src/pages/ServiceForm.tsx`, `src/pages/ServiceTracker.tsx`, `src/components/workspace/ServiceDetailsEditor.tsx`, `src/hooks/useServices.ts`, `src/lib/serviceRecordShape.ts`, `src/lib/pdfGenerator.ts`, and removal of `src/lib/googleSheets.ts`, `src/lib/corsPostHandler.ts`, `src/lib/bridgeFetchInterceptor.ts` plus the `sheets-bridge` / `sheet-status-webhook` functions if nothing else calls them.
- Notes card uses a themed light-yellow token added to the global stylesheet (no hardcoded colors).
