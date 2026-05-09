## What you reported

1. Client intake PDF, photo annotation image, and service quotation PDF are generated and stored in Drive, but the URL is not landing in the right Sheet column (AP / AW / AG).
2. Admin Rep should accept multiple selections, and any selected admin should see the Service ID on their dashboard (same way multi-technician already works).

## Findings from the deployed Apps Script (Untitled_document.txt)

The deployed `doPost` *positionally* writes the row with `sheet.appendRow([...50 values...])`:

```
... AK signatureUrl, AL "", AM "", AN TechDept, AO "",
    AP pdfUrl, AQ folderUrl, AR HasPwd, AS DevicePwd, AT "",
    AU "", AV deviceReportFolderUrl, AW annotationImageUrl, AX AnnotationNotes
```

That mapping matches your codebase's `googleSheets.ts`. The reason links still appear "off" in your live sheet is that **`appendRow` is column-position based** — if your real Service Database sheet has had any column inserted/removed/reordered (or the headers were renamed) between A and AX, every value after the inserted point shifts by one, so the PDF/annotation/quotation URLs land in the wrong cell. The `updateQuotationPDF` and `updateServicePDF` actions already use explicit `getRange(row, 33)` / `getRange(row, 42)` so they only break if the *headers themselves* moved.

## Plan

### 1. Make Apps Script writes column-name based (robust against column shifts)

Replace the positional `appendRow([...])` in the intake handler with a header-driven write so every value is placed in the column whose header matches its key — no more silent shifts.

In the deployed script (and in `src/lib/googleSheets.ts` template) do:

```js
function writeRowByHeaders(sheet, fieldsByHeader) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var newRow = sheet.getLastRow() + 1;
  var rowArr = new Array(lastCol).fill("");
  Object.keys(fieldsByHeader).forEach(function (h) {
    var idx = headers.indexOf(h);
    if (idx >= 0) rowArr[idx] = fieldsByHeader[h];
  });
  sheet.getRange(newRow, 1, 1, lastCol).setValues([rowArr]);
  return newRow;
}
```

Then build `fieldsByHeader` keyed by exact header text ("Service ID", "Status", "Admin Rep", … "Service Quotation Form", "Client Intake Form", "Folder Link", "Device Annotation", "Device Annotation Notes", "Receiving Staff", etc.) and pass it in. Same approach for `updateServicePDF`, `updateQuotationPDF`, and the annotation save — look up the header name, not a hard-coded `42` / `33` / `48`.

This makes AP / AG / AW / BE always correct regardless of column order, which is the actual root cause of the "link in wrong column" symptom.

### 2. Multi-select Admin Rep (mirror the technician multi-select pattern)

`ServiceForm.tsx`:
- Change `adminRep` schema to an array of strings (`z.array(z.string()).min(1)` for non-public, `optional()` for public).
- Replace the single `<Select>` for Admin Rep with `<MultiSelect>` (same component already used for technicians), populated from `adminList`.
- On submit, send `formData.append("Admin Representative", data.adminRep.join(", "))` so the sheet stores a comma-separated list in column C — identical convention to multi-technician in column D.
- Update notification logic at the bottom of submit to loop through every selected admin and create a notification per admin.
- Auto-select the logged-in admin into the array (instead of `setValue` to a string).

`ManageClient.tsx` and any other write paths that pass `adminRep` need to keep accepting either a string or array and join with `", "` before persisting.

### 3. Show service to every assigned admin

`ServiceTracker.tsx` (and Admin/Management dashboards) currently compare a single `service.adminRep` against the logged-in admin name. Update the filter to:

```ts
const assignedAdmins = (service.adminRep || "")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const isAssigned = assignedAdmins.includes(loggedInName.toLowerCase());
```

Apply the same split-and-includes in:
- `ServiceTracker.tsx` admin-side row visibility & the `findStaffByName(service.adminRep)` lookup (loop over each name).
- Admin/Management dashboard "my services" filtering.
- Notification targeting in `serviceNotifications.ts` / `notifications.ts` so every listed admin gets the alert (same pattern already used for `technicianAssigned`).

### 4. Display

- In `ServiceTracker` table cell, render `service.adminRep` as-is (already comma-separated) — no change needed beyond width/wrap.

## Manual step you must do after the code is updated

Open Sheet → Extensions → Apps Script → paste the new template from `src/lib/googleSheets.ts` → Deploy → Manage deployments → New version → Deploy. The header-name writes only take effect once redeployed. Also confirm the Service Database header row contains the exact header strings the script looks up (e.g. `Client Intake Form` for AP, `Service Quotation Form` for AG, `Device Annotation` for AW, `Folder Link` for AQ, `Receiving Staff` for BE, `Admin Rep` for C). If any header text differs, either rename the column header to match or update the key in `fieldsByHeader`.

## Out of scope

- No changes to PDF generation, Drive folder layout, signature handling, or device-report photo upload.
- No changes to staff salary, sidebar scroll, or form-remount behavior (already shipped).

## Verification

- Submit a fresh intake → AP shows Intake PDF URL, AQ folder, AW annotation image, AX annotation notes, BE receiving staff, C contains comma-joined admin names.
- Generate a quotation later → AG shows the quotation PDF URL.
- Pick two admins on intake → both admins see the service in their dashboard and both receive the notification.
- Insert a dummy column anywhere in Service Database → resubmit → URLs still land under the correct headers.
