## 1. Root cause behind two of the biggest issues

Both `/manage-client` and `/service-update` load a ticket by first calling the legacy Google Sheets `searchService` endpoint, then merging only a short whitelist of fields from the database on top (`mergeWithSupabase` in `src/pages/ManageClient.tsx`). Verified in the database: ticket `AC310726495` stores clean values (`device_type: "Laptop (Mac)"`, `brand: "Apple"`, `model: "A1502"`), so the concatenated `"(Apple Watch) (Apple) Apple Watch SE 2"` string and the "edits don't reflect" behavior both come from the stale sheet payload, because `device`/`model`, client name, brand, device type, service, notes and other edited fields are not part of the merge whitelist.

Fix: make the database authoritative on both pages.

- Build the page payload from the database row first (existing `supabaseRowToSheetShape`), then use sheet data only to fill in fields the database has no column for (e.g. Drive folder URLs / legacy PDF links).
- Set `device` from `model` only (no fallback to device type or brand concatenation); Device Type and Brand stay in their own fields.
- After "Save details" in `ServiceDetailsEditor`, re-fetch the ticket from the database and re-seed the update form state so edits appear immediately.

Same treatment in `src/pages/ServiceUpdate.tsx`.

## 2. PDFs

`src/lib/pdfGenerator.ts` (intake form) and `src/lib/quotationPdfGenerator.ts` (quotation) print `data.model`. Callers in `ManageClient`/`ServiceUpdate` pass `serviceData.device` — which will now be the clean model value. Regeneration on "Update Form" / quotation update already exists, so both PDFs will print `Model: A1502` with Device Type and Brand separate.

## 3. Reports

Remove the revenue column from the Technician leaderboard table in `src/pages/Reports.tsx` (keep completed count, avg turnaround, on-time rate). Revenue stays in the financial panels.

## 4. POS auto-complete on full payment

In `src/pages/PointOfSales.tsx`, after a service payment is recorded successfully:

- Recompute total paid (previous payments + this amount) versus final cost.
- If remaining balance is 0 (or below a 1-peso tolerance) **and** the ticket's current status is `Done Repair - For Release` or `Done Repair - Advise Client`, update the status to `Completed`, set `date_completed`, write an activity log entry ("Auto-completed: fully paid via POS"), and fire the existing status-change notification. Any other status is left untouched.

One-time back-fix: a data update that flips existing tickets currently in those two statuses whose recorded payments already cover the final cost to `Completed`, with the same log entry. Scope is limited to those two statuses so nothing else is auto-closed.

## 5. "Format with AI" in Manage Client

`ManageClient` already has `rawDiagnosis`, `technicianReport`, and the format handlers, but the buttons are gated. Enable them for admin/management with the same behavior as `/service-update`: call the `format-diagnosis` / `format-report` functions, write the result to `diagnosis` / `ai_report` (keeping the raw technician notes in `technician_diagnosis`), and allow inline editing afterwards.

## 6. AI diagnosis: no prices + warranty line

In `supabase/functions/format-diagnosis/index.ts`:

- Strengthen the placeholder enforcement so any amount inside Service Breakdown becomes `Php {Enter Amount}` — the current pass misses lines where the number is not currency-tagged or trails other text, and lines using parentheses/tabs. Enforcement will rewrite every breakdown line to the strict shape `<Service Item> - Php {Enter Amount}`, stripping any digits from the price position.
- Add a warranty line directly after the Service Breakdown section, in the template and enforced deterministically after generation:

```text
Service Breakdown:
Screen replacement - Php {Enter Amount}

Warranty: {Enter Duration}
```

## Technical notes

- Files: `src/pages/ManageClient.tsx`, `src/pages/ServiceUpdate.tsx`, `src/components/workspace/ServiceDetailsEditor.tsx`, `src/pages/Reports.tsx`, `src/pages/PointOfSales.tsx`, `supabase/functions/format-diagnosis/index.ts`.
- No schema changes needed; the back-fix is a data update only.
- Sheet fetches are kept only as a fallback for legacy-only fields, so nothing that currently works breaks.
