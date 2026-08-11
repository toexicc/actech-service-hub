# Staff password saves reliably + options work for every variant, not just OEM/Original

## 1. Password change on Staff Management silently fails

What the code does today (verified in `supabase/functions/manage-staff/index.ts`, update branch):

- The profile update, the role delete/insert, and `auth.admin.updateUserById({ password })` are all awaited **without checking their error**. The function then always returns `{ ok: true }`.
- So if the password change is rejected (too short / weak password, user lookup issue, auth restriction), Staff Management still shows "Staff member updated successfully" while the old password stays active. That matches the report exactly: it says saved, but the new password does not work.

Fix:

- Check the error of every step in the update branch. If the password update fails, return the real message with a non-2xx status so the dialog shows it (the client already surfaces server messages through `getLastStaffError`).
- Same for the profile update and role change, so a partial failure is never reported as success.
- Add a minimum-length check (6+ characters) in the edit dialog before sending, with a clear inline message.
- On success, confirm in the toast that the password was changed (only when a new password was actually entered), so there is no ambiguity.

Note on permissions: the function already accepts both admin and management callers, so management is authorised — the problem is the unreported failure, not the role.

## 2. Options must behave the same for any variant naming

Current behaviour (verified):

- `/track` option handling is already generic — required lines stay ticked, and their options remain selectable until the client has actually approved them. Nothing there is specific to OEM/Original.
- The breakdown editor on `/manage-client` lets staff type any option label.
- The narrow spot is the parsing of the AI diagnosis draft: `format-diagnosis` only treats a row as an option when it starts with `Option <single letter>`, and the shared parser requires the word "Option" at the start. Rows like `Option 1 - ...`, `Option A2 - ...`, or `Choice A - ...` are then read as separate services instead of variants of the service above, which is why some option sets do not behave like OEM/Original.

Fix:

- Generalise option detection in `src/lib/serviceApproval.ts` and in the `format-diagnosis` amount rules so any of `Option A`, `Option 1`, `Option A2`, `Opt B`, `Choice A`, `Variant A` (letters or numbers, with `-`, `–` or `:`) attaches to the service line above it, keeps its own price, and strips the placeholder amount from the parent line.
- Keep the AI prompt asking for the `Option A / Option B` format so new output stays consistent, while the parser tolerates the variations already stored on older tickets.
- Harden the "already approved" match on `/track`: a line approved earlier as `Battery Replacement (OEM)` is currently matched only via the live option pick, so switching the pick can make it look unapproved. Match on the base service name as well, so approved lines stay locked regardless of the option label — and every other option line stays fully selectable.

## Technical notes

- `supabase/functions/manage-staff/index.ts`: capture and return errors from `profiles.update`, `user_roles` delete/insert, and `auth.admin.updateUserById`; redeploy.
- `src/pages/StaffManagement.tsx`: client-side password length guard, clearer success/failure toast.
- `src/lib/serviceApproval.ts`: broaden `OPTION_RE`; keep `parseQuotedBreakdown` behaviour otherwise unchanged.
- `supabase/functions/format-diagnosis/index.ts`: broaden `isOptionLine` (used both for skipping option rows and for stripping the parent amount); redeploy.
- `src/pages/ServiceTracking.tsx`: `isLineApproved` also matches an approved entry whose name starts with the line name plus a parenthesised option.
