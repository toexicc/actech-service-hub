# Pre-Approved card, backjob ticket linking, interim decline rules, wider intake pop-up

## 1. Pre-Approved card on Service Tracker / Service Tracking

Add a new count card labelled **Pre-Approved**, placed directly beside "Within the Day", that
filters every ticket whose pre-approved (auto-approve diagnosis) toggle is on and that is not
already completed. Both pages use the same tracker screen, so the card appears on both.

## 2. Link a backjob ticket to the previous repair

- New field on a ticket: the previous ticket it is a backjob of.
- On **Manage Client**, inside Client Information directly below the status line, a
  "Previous ticket (backjob)" row appears **only while the Backjob toggle is on**. It has a
  ticket-ID search box with suggestions, a Link/Unlink action, and the eye icon that opens the
  read-only side preview of that previous repair.
- On **Service Update** (technician view) the same row shows read-only: the linked ticket ID plus
  the eye preview. No editing.
- Linking and unlinking are written to the ticket log.

## 3. Interim decline should not send the ticket On Hold

When the round being declined is an **interim** round (the ticket already has an approved first
round and an interim report was raised):

- Status goes back to **Done Repair - Under Observation** instead of On Hold, because a repair was
  already completed and approved.
- The approval is not locked for return-to-owner handling.
- Both the assigned admin and the assigned technician are notified that the client declined the
  additional interim work and the ticket returned to Under Observation.

Non-interim declines keep the current behaviour (On Hold, prepare unit for return).

## 4. Interim decline must not erase the earlier approval remark

Today the decline remark replaces what staff see, so AC190926000 reads "Declined by Mari Mar …"
even though the first breakdown was approved. Change so:

- The interim decision is recorded as its own remark line ("Interim declined by … — reason"),
  leaving the original "approved services …" remark intact.
- The Approval Remark block on Manage Client / Service Update and the public tracking page show the
  original approval first, with the interim decision beneath it as a separate note.
- AC190926000 gets its display corrected by this parsing change; the stored history is untouched.

## 5. Intake pop-up is too narrow on desktop

The shared pop-up wrapper currently shrinks any window that declares its own width to fit its
content, which is why Complete Intake shows as a narrow column. Fix the wrapper so a declared width
is treated as a maximum and the window still fills the available screen width, and widen the intake
window so it reads as a full landscape form on desktop. Mobile bottom-sheet behaviour is unchanged.

## Technical notes

- `services.linked_service_id text` added by migration (nullable, no FK so historical IDs stay
  linkable); included in `ServiceRecord` / `LIST_COLUMNS` and the read-only preview snapshot.
- `FLAG_COUNT_CARDS` in `src/pages/ServiceTracker.tsx`: new `preApproved` key matching
  `autoApproveDiagnosis && !isDoneCompleted(s)`, inserted before `withinDay`.
- `supabase/functions/submit-client-approval/index.ts`: detect the interim round from
  `interim_created_at`/interim-flagged quoted lines plus an existing `client_approved_at`; on a
  declined interim set `status = "Done Repair - Under Observation"`, skip `approval_locked`, write
  the `Interim declined by …` tag, and fan out admin + technician notifications. Activity log
  records the interim decline distinctly.
- `src/lib/serviceApproval.ts`: `parseApprovalRemark` keeps the last non-interim remark as the
  primary decision and returns the interim remark separately; `ApprovalRemarkBlock` and
  `ServiceTracking` render both.
- `src/components/ui/dialog.tsx`: drop `sm:w-auto` from the `hasWidth` branch so the consumer's
  `max-w-*` caps the existing `sm:w-[calc(100vw-4rem)]`; `CompleteIntakeModal` moves to a wider
  `max-w-6xl`.
