# Tracker time frames, client social name, and TV queue fit

## Service Tracker cards and table
- Add **Diagnostic Time Frame** and **Repair Time Frame** to every service card, using the ticket’s existing saved values and showing `—` when blank.
- Add one **Time Frame** column immediately beside **Flags** in table view.
- Inside that single table cell, stack two clearly labelled lines: **Diagnosis** and **Repair**.
- Keep the card readable by placing the same two labelled values together as one compact section, without disturbing the existing service date, target date, in-service count, or action buttons.
- Update loading placeholders so the table remains aligned while tickets load.

## Manage Client details
- Display the existing **Facebook Name/Instagram Username** value beside **Email** in the Client section.
- Keep it editable through the existing Edit details form.
- No database change is needed because this value is already stored with the ticket.

## Live TV queue
- Make `/queueing` fit a typical TV screen without browser zoom changes: reduce the oversized title, headings, queue numbers, card padding, and vertical gaps.
- Use the available screen height to show substantially more queue entries at once while keeping queue numbers readable from a distance.
- Preserve the two main Intake/Release areas and their Waiting/Proceed columns on TV-sized screens.
- Keep the current stacked fallback for narrow screens and the `?plain=1` compatibility view for older TVs.
- Prevent the queue page from creating avoidable vertical overflow when only the normal header and queue board are present.

## Verification
- Check card and table views with populated and blank time frames.
- Check Manage Client with and without a Facebook/Instagram value.
- Check `/queueing` at the current 1094×825 view and a 1920×1080 TV view, plus a narrow fallback width.
- Confirm the preview remains error-free.

## Technical notes
- Reuse `estimatedCompletion` for Diagnostic Time Frame and `repairTimeFrame` for Repair Time Frame from the existing service record mapping.
- Reuse `username` for Facebook Name/Instagram Username.
- Keep the TV page’s deliberately simple, older-browser-compatible CSS and polling behavior; this is a sizing/layout change only.
