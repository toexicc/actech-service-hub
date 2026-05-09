## Plan

1. **Fix the intake write path for generated links**
   - Update the Google Apps Script template in `src/lib/googleSheets.ts` so newly submitted intake rows write these generated URLs by both fixed columns and normalized header matching:
     - AK: `Client Signature`
     - AP: `Client Intake Form`
     - AQ: `Google Drive Folder`
     - AV: `Device Report Folder`
     - AW: `Photo Annotation`
   - Add aliases for the current real sheet names, especially `Client Signature`, `Photo Annotation`, and `Google Drive Folder`, because the current script only includes names like `Physical Signature`, `Folder Link`, and `Device Annotation`.

2. **Make header matching tolerant**
   - Replace exact `headers.indexOf(...)` matching with a helper that normalizes header text: trim, lowercase, remove extra spaces/punctuation.
   - This prevents failures from small header differences like `Photo Annotation` vs `Device Annotation`, or extra spaces in the header row.

3. **Fix quotation PDF write path**
   - Update `updateQuotationPDF` so after the quotation file is created inside the AQ folder, its URL is written to:
     - AG by fixed column number
     - the normalized header matching `Service Quotation Form` / quotation aliases
   - Also update AQ using the real header name `Google Drive Folder` if a folder is created during quotation generation.

4. **Add a repair/backfill action for existing affected rows**
   - Add an Apps Script action like `repairGeneratedFileLinks` that, for a given Service ID, opens the AQ Google Drive folder, finds the generated files by filename pattern, and writes missing links back to AK/AP/AG/AW.
   - This addresses the services already generated where the files exist in Drive but the Sheet cells are blank.

5. **Verify related frontend field names**
   - Confirm `ServiceForm.tsx` is still sending `PDF`, `Signature`, and `DeviceAnnotation` plus Base64 fallbacks.
   - No UI changes needed unless a field name mismatch is found.

## Manual step after implementation

After the code is updated, paste the updated Apps Script template from `src/lib/googleSheets.ts` into Apps Script and redeploy a **new version**. The deployed Apps Script is what writes to Google Sheets, so the fix will not affect production until redeployed.

## Expected result

For new submissions and quotation generation:
- AK receives the client signature link.
- AP receives the client intake PDF link.
- AG receives the service quotation PDF link.
- AW receives the photo annotation link.
- AQ and AV continue working as they do now.

For already affected services, the repair action can fill missing Sheet links from the files already present in the AQ folder.