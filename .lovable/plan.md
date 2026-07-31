## What I verified first

- `/track` approval writes the new status straight to the database from an **anonymous** page. The database only allows admins, management, or the assigned technician to update tickets, so that write is rejected silently (the code swallows the error) and the legacy Google Sheets call is dead. Ticket AC310726133 is still "Waiting to Proceed" — consistent with this.
- The technician page saves the technician's **raw** diagnosis into the same `diagnosis` field that the admin page uses for the **AI-formatted** diagnosis, and never saves the AI-formatted text at all. So the formatter output vanishes on reload and can overwrite the admin's version.
- Technician read access is enforced by an exact, case-sensitive, whitespace-sensitive match of the technician's profile name against the ticket's technician list. Any variation (extra space, different casing, name with a suffix) makes assigned tickets invisible. The tracker also tries to auto-lock the technician filter by comparing the logged-in **full name** against the staff **username/email**, which never matches, leaving filters in an inconsistent state.

## Plan

### 1. AI formatter sticking on the technician page
- Add a dedicated `technician_diagnosis` column so raw notes and AI-formatted diagnosis stop fighting over one field.
- Technician save: persist raw notes to `technician_diagnosis` and the AI-formatted text to `diagnosis` (the same field the admin page and `/track` read).
- Technician load: read both fields from the database instead of the dead Sheets response, so the formatted diagnosis reappears after refresh and shows on `/manage-client` and `/track`.

### 2. Technician Service Tracker not showing assigned services
- Make the access rule name comparison normalized (trimmed, case-insensitive) so assigned tickets always resolve, and apply the same normalization to the technician-update rule.
- In the tracker, derive the logged-in technician from the authenticated profile (id/name) rather than comparing full name to email, and match assigned technicians with the same normalized comparison.
- If the technician's identity can't be resolved, fall back to showing everything the database returns rather than an empty list.

### 3. Balance hidden before "Waiting to Proceed"
- On `/track`, hide the Paid/Balance figures (both the summary tiles and the quote footer) until the ticket reaches "Waiting to Proceed" or later. Earlier stages show device/status info only.

### 4. Client approval on /track not registering
- Add a server-side function (`submit-client-approval`) that runs with elevated privileges and, given a service ID and approve/decline decision: appends the approval stamp to the admin notes, sets the status to "Proceed Repair" on approval, fills the Service/s field from the AI breakdown, records the approval timestamp, and triggers the existing technician/admin notifications.
- Point the `/track` approve and decline buttons at this function, surface a real error toast if it fails (instead of the current silent catch), and refresh the page state from the saved record.
- Repair the already-approved ticket(s) that were lost, after confirming with you which ones to move.

## Technical notes
- Migration: new `technician_diagnosis` column on `services`; replace the two technician policies with normalized-name versions.
- New edge function under `supabase/functions/submit-client-approval/` using the service role, with input validation and CORS; it must be callable anonymously.
- Files touched: `src/pages/ServiceUpdate.tsx`, `src/pages/ManageClient.tsx` (read of the new field), `src/pages/ServiceTracker.tsx`, `src/pages/ServiceTracking.tsx`, `src/hooks/useServices.ts` (field mapping).
