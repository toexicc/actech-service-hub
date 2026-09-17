# Service Update layout fixes, rush fee on the quotation, and a device catalogue with suggestions

## 1. Service Update — move Assigned Technician up

The Assigned Technician picker currently sits far down the Service Update card, after the report block. It moves to the top of the Service Update card, **above "Step 1 — Set Status"**, so the technician is set before anything else.

## 2. Remove the "Additional Repair" button

The amber "Additional Repair" button beside Step 1 (and its dialog) is removed from Service Update — the AI Interim Report now covers that case.

## 3. Rush fee on the Service Quotation form

The quotation PDF prints Service Cost, Discount and VAT (12%) but never the rush fee, even though the 10% rush charge is already part of the total. A **Rush Fee (10%)** line is added to the Service Summary block, shown only when the ticket has rush turned on — same style as the VAT line — so the printed Total Cost adds up.

## 4. Service Update — correct diagnosis / interim / report order

Service Update follows the same order Manage Client uses:

```text
AI Diagnosis Formatter
Device Diagnosis - Photos
AI Interim Report            (toggle + fields + interim photos, all inside this block)
AI Report Formatter
Device Report - Proof
```

Right now the photo panels are rendered after the technician picker, which pushes the interim block out of sequence. The photo panels move directly under their matching formatter, and the interim block (toggle, fields, photos) sits between the diagnosis and report blocks so it is visible where expected during Ongoing Service.

## 5. Device catalogue with type-ahead suggestions

A new catalogue of **brands, models, colours and storage sizes** backs the device fields on the staff intake form, the queue intake and the public intake form (all three use the same form).

- Each field becomes a text box with a suggestion list: staff type, matching entries appear, one click fills the field.
- Free text is still allowed — nothing is blocked if a value isn't in the list yet.
- Anything new that gets typed and saved is added to the catalogue automatically, so the list improves with use. Models are remembered against the brand they were used with, so picking Apple suggests Apple models first.
- The catalogue is seeded from the values already on existing tickets.

### Clean-up of existing values

A one-time clean-up normalises messy capitalisation on existing tickets and in the catalogue: `APPLE` / `aPPLE` → `Apple`, `IPHONE 13` → `iPhone 13`, `MACBOOK PRO` → `MacBook Pro`, `SPACE GRAY` → `Space Gray`, `512gb` → `512GB`. Known product spellings (iPhone, iPad, iMac, MacBook, AirPods, Apple Watch, Samsung Galaxy, ROG, ASUS, MSI, HP, LG, TB/GB) are kept exactly as the brands write them; everything else becomes title case. Only capitalisation changes — no value is renamed or merged into a different one.

## Technical notes

- `src/pages/ServiceUpdate.tsx`: move the `MultiSelect` technician block above the Step 1 status group; delete the `canRequestAdditionalRepair` button, the `addlRepairOpen` dialog and its now-unused state/handlers; relocate `DiagnosisPhotos` under the diagnosis collapsible and `DeviceReportPhotos` under the report collapsible, with `InterimReportBlock` between them (existing visibility gates unchanged).
- `src/lib/quotationPdfGenerator.ts`: add optional `rushFee?: string` to the data type and a `money("Rush Fee (10%):", ...)` row after Discount; `ManageClient.tsx` (~line 1920) fills it from `rushAmount(cost, discount, rushFee)`.
- New table `public.device_catalog` (`kind` text: brand | model | color | storage, `value` text, `brand` text nullable for models, `usage_count` int, unique on kind+lower(value)+coalesce(brand)), with GRANTs: `SELECT, INSERT, UPDATE` to `anon` and `authenticated` (public intake writes too), `ALL` to `service_role`; RLS policies allow read to all and insert/update of catalogue rows only.
- New `src/lib/deviceNameCase.ts` with `normalizeDeviceValue(kind, value)` holding the known-spelling map; used by the seed/clean-up migration equivalent (a one-off script run through the migration tool over `services.brand/model/color/memory`) and on every catalogue write.
- New `src/components/DeviceFieldSuggest.tsx` — an input with a debounced suggestion popover modelled on `ClientSearchSuggestions` (`useDebounce`, `.ilike` query, click-to-pick, keyboard dismiss), wired into the four `FormField`s in `src/pages/ServiceForm.tsx` (covers staff, queue-modal and public intake). On submit, values are upserted into `device_catalog` via a fire-and-forget call so failures never block ticket creation.
