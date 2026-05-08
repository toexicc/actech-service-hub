## Plan

1. **Stabilize navbar/sidebar scrolling**
   - Update `DashboardLayout` so the sidebar uses a real flex column layout instead of an absolute footer plus a manually capped nav height.
   - Keep the logo/header and logout area fixed while only the navigation list scrolls, preventing the scroll position from snapping back up.

2. **Fix fixed salary saving in Staff Management**
   - Add `salaryType` to the staff data model end-to-end.
   - Save `Salary` to column H and `Salary Type` to column I for both add and update staff.
   - Read column I from `getStaffList`, display salary type directly instead of guessing from whether Salary is blank, and send `salaryType=fixed` / `service-based` in `addUser` and `updateUser`.
   - Update `googleSheets.ts` Apps Script template so `addStaff`, `updateStaff`, and `getStaffList` match the sheet columns: Staff ID, Username, Password, Name, Role, Department, Status, Salary, Salary Type.

3. **Correct service PDF/file-link column mappings**
   - Audit and update the Apps Script template around service creation and PDF uploads so:
     - Client intake PDF URL always writes to Service Database column AP.
     - Service quotation PDF URL always writes to column AG.
     - Existing folder link stays in column AQ.
   - Make the frontend upload actions send enough identifiers to update the correct service row reliably.

4. **Update admin/receiving staff fields on Client Intake Form**
   - Change the Admin Rep dropdown to include active `admin` and `management` staff.
   - Add a new required `Receiving Staff` dropdown using the same admin/management staff list.
   - Include `Receiving Staff` in the form payload and write it to Service Database column BE.
   - Update `googleSheets.ts` row mapping and service fetch/search responses to include `receivingStaff`.

5. **Make Service Tracker visibility include Receiving Staff**
   - Add `receivingStaff` to the service record model and Apps Script `getAllOngoingServices` response.
   - For admin users, show services where they are either Admin Rep or Receiving Staff; management continues to see all, technicians keep technician-based filtering.
   - Add Receiving Staff visibility to edit/navigation data where needed.

6. **Create a public client intake form copy**
   - Add a public route for a client-facing intake form.
   - Reuse the intake form structure but remove: Client ID Search, Admin Rep, Receiving Staff, Technician, Estimated Cost, and Time Frame.
   - Submit public entries to Service Database with a status/flag that clearly indicates management must complete missing fields.
   - Notify all active management staff after submission so they can open Service Tracker and finish the missing fields.
   - Update `googleSheets.ts` with a `publicClientIntake`/equivalent handler and notification creation logic.

7. **Verification**
   - Run targeted checks for TypeScript/runtime issues after edits.
   - Confirm the affected mappings in code: Staff columns H/I, Service Database AP/AG/AQ/BE, and Service Tracker service visibility logic.