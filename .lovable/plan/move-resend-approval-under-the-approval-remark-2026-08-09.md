# Move "Resend approval" under the Approval Remark

## What changes on /manage-client

1. The amber "N service line(s) here haven't been approved yet…" notice with the **Resend approval to client** button moves out of the Service Breakdown editor and sits directly **below the Approval Remark block**.

2. It appears **only for saved data** — it is based on the ticket's saved quoted breakdown compared against the client's approved services, not on what's currently typed in the editor. So a line you just added shows nothing until you save.

3. In the Service Breakdown panel, a small **chip** replaces the old notice: "Unsaved new service line(s) — save to resend approval" (amber, compact, no button). It shows only when the lines currently in the editor contain unapproved names that aren't in the saved breakdown yet. Once saved, the chip disappears and the resend block below the Approval Remark takes over.

## Technical notes

- New derived values in `src/pages/ManageClient.tsx`:
  - `savedUnapproved`: names from `serviceData.quotedBreakdown` (normalized) not present in `serviceData.approvedServices` (case-insensitive).
  - `unsavedNewLines`: names in local `quotedLines` not in the saved breakdown and not approved.
- Resend block renders when `approvedServices.length > 0 && savedUnapproved.length > 0`, placed right after `<ApprovalRemarkBlock />` (~line 1780), reusing `handleReopenApproval` and `isReopeningApproval`.
- The existing IIFE block at ~lines 2639-2666 becomes the chip-only variant driven by `unsavedNewLines`.
- No schema or backend changes.
