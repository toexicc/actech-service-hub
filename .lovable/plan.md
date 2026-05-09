## Verification of previous plan

| Item | In Code | Live in Sheet |
|---|---|---|
| Sidebar `flex-col` + scrollable nav | Done | Buggy — see Cause #1 |
| Salary `Salary Type` add/update (col H/I) | Done in `googleSheets.ts` (lines 1398–1448) | Empty — Apps Script not redeployed |
| Intake PDF → AP, Quotation PDF → AG, Folder → AQ | Done (lines 1621, 1691, 3517–3518) | Wrong — Apps Script not redeployed |
| Receiving Staff → BE | Done (line 3533) | Pending redeploy |
| Admin Rep includes management | Done | OK |
| Public `/intake` route + management notification | Done | OK |
| Form reloads while typing | NOT addressed | See Cause #2 |
| Sidebar rubber-band on Home | NOT fixed | See Cause #1 |

## Real root causes still open

**Cause #1 — Sidebar rubber-bands & loses scroll:**
In `DashboardLayout.tsx`, `SidebarContent` is declared as a function component **inside** the parent (line 109). Every time `DashboardLayout` re-renders (auth check, location change, NotificationDropdown polling, etc.), React sees a brand-new component reference and **unmounts/remounts the entire `<nav>`**, resetting `scrollTop` to 0. That's the "rubber band back to top" you see.

**Cause #2 — Intake form reloads on every keystroke:**
Same anti-pattern in `ServiceForm.tsx` (line 533): `Wrapper` is declared inside the parent. Each form `watch`/state update creates a new `Wrapper` reference, remounting the entire form subtree. Inputs lose focus / appear to "reload".

**Cause #3 — Sheet still showing old behavior:**
The Apps Script code embedded in `src/lib/googleSheets.ts` already contains all the fixes (Salary Type to col I, PDF URL to AP, Quotation to AG, Receiving Staff to BE). However the Apps Script **runs on Google's servers**, not in the React app — so it only takes effect after you copy the updated template into your Apps Script project and redeploy. Until then, your Sheet will keep using the old behavior even though the codebase is fixed.

## Fixes to apply

1. **`src/components/DashboardLayout.tsx`**
   - Move `SidebarContent` out of the `DashboardLayout` body (top-level component) and pass it the props it needs (`collapsed`, `isMobile`, `userRole`, etc.) — OR convert it from `<SidebarContent />` calls into inline JSX so React keeps the same fiber tree across renders.
   - Result: the `<nav>` element is preserved between renders, so `scrollTop` is no longer reset.

2. **`src/pages/ServiceForm.tsx`**
   - Move `Wrapper` out of the component (top-level) and accept `isPublic` as a prop, OR render the wrapping conditionally inline:
     ```tsx
     return isPublic
       ? <div className="min-h-screen ...">{content}</div>
       : <DashboardLayout>{content}</DashboardLayout>;
     ```
   - This stops the entire form from remounting on every keystroke / `form.watch()` re-render, which fixes the "keeps reloading" feel.

3. **Redeploy Apps Script (manual step you must do)** — required for the sheet-side fixes to actually take effect:
   - Open your Google Sheet → Extensions → Apps Script.
   - Replace the script with the contents of `src/lib/googleSheets.ts` (the long template string).
   - Click **Deploy → Manage deployments → Edit (pencil) → New version → Deploy**.
   - Verify by adding a staff with Salary Type "Fixed" → column I should show `fixed`; submit a new intake → column AP should hold the PDF URL, AQ the folder URL, AG the quotation URL once generated, BE the Receiving Staff name.

## Out of scope (no changes needed)

- Salary persistence logic in `userCredentials.ts` / `useStaff.ts` / `staffSalaryOverrides.ts` is already correct.
- PDF column mapping in the Apps Script row template is already correct.
- Public intake route + management notification flow is already implemented.

## Verification after fixes

- Scroll the sidebar to the bottom on `/menu` → it should stay where you left it after navigation/notification refresh.
- Type into Client Name / Phone / etc. on `/intake` → no flicker, no focus loss, no scroll jump.
- After Apps Script redeploy: add staff, check column I; submit intake, check AP/AQ/AG/BE.
