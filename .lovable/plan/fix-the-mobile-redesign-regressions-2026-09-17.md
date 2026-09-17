# Fix the mobile redesign regressions

## Goal
Restore the affected pages so they feel usable on phones again, without breaking the existing desktop layout or changing business rules.

## What I will fix

1. **Build failure first**
   - Inspect the full build output again if needed.
   - Fix the failing production/dev build before continuing with UI work.
   - Keep PWA/home-screen support, but if the offline worker is what is breaking builds, adjust it safely rather than leaving the app unbuildable.

2. **Bottom navigation by role**
   - Management primary mobile nav: **Dashboard, POS, Tracker, Reports**.
   - Admin primary mobile nav: **Dashboard, POS, Tracker, Manage Client**.
   - Technician primary mobile nav: **Dashboard, Service Update, Tracking, Parts**.
   - Keep the overflow/More menu for secondary pages.
   - Restore clear grouping inside the mobile More menu:
     - Admin Portal
     - Technician Portal
     - Other actions / Logout

3. **Stop stretched controls on mobile**
   - Fix oversized/narrow checkboxes and switches in the intake acknowledgement, track approval, Manage Client, and Service Update areas.
   - Keep controls touch-friendly, but make them normal-sized and aligned with their labels.
   - Prevent long text from being clipped or pushed off-screen.

4. **Service Tracker mobile cleanup**
   - Fix the tab/view switch overlap around **Cancelled / RTO / On Hold**.
   - Make the status tabs horizontally scroll when needed instead of colliding with the Cards/Table switch.
   - Keep the mobile filter sheet, but make sure it does not crowd the page.

5. **Mobile card click behavior**
   - Make the whole service card/row open the correct ticket page.
   - Remove the extra direct-open icon from mobile cards where it duplicates the card click.
   - Keep only the preview icon for the side modal, and make sure that icon does not navigate away.

6. **Request for Parts mobile layout**
   - Rework the **My Requests** header so the title, status filter, search, and refresh button stack cleanly on phones.
   - Keep the same filters and table data.

7. **Manage Client mobile layout fixes**
   - Tighten the ticket hero so Delete/POS/Release/QR actions wrap cleanly on phones.
   - Fix the Ticket Documents rows so names, hints, and action buttons do not crush each other.
   - Keep Generate/Update/Edit controls only where they are supposed to exist, and use compact icon buttons on phone.

8. **Preserve desktop**
   - Keep the existing desktop sidebar/workbench behavior intact.
   - Only apply the layout changes at mobile sizes unless a shared component must be corrected.

## Verification
- Run the app checks after the fixes.
- Recheck mobile widths: **320, 375, 390, 430px**.
- Recheck tablet and desktop to confirm they are not changed unintentionally.
- Specifically verify:
  - Manage Client
  - Service Tracker
  - Request for Parts
  - Service Form / intake acknowledgement
  - Track approval page
  - Mobile More navigation grouping
  - Mobile service-card click behavior

## Technical notes
- No database, permissions, workflow, status, pricing, or notification logic changes are planned.
- Use existing role and navigation rules; only the mobile presentation and role-specific nav ordering changes.
- Keep semantic design tokens and existing UI components.
- Avoid broad rewrites; fix the exact layout regressions shown in the screenshots.
