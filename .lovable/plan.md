# Public payment options, tracker admin filter, and daily front-duty notice

## What will change

1. **Public tracking payment choices**
   - Remove **Credit Card** and **Installment** from the payment choices shown on `/track`.
   - Leave the remaining public payment methods unchanged.

2. **Admin assignment filter**
   - Add an **Admin** selector immediately before **Technician** on both `/service-tracker` and `/service-tracking`.
   - Build its choices from the admin representatives assigned to the loaded tickets.
   - Support tickets with multiple assigned admins and match names without case or spacing issues.
   - Include the Admin selection in filter reset, pagination reset, active-filter detection, and the visible filter summary.

3. **10:00 AM daily front-duty notice**
   - Show a blocking centered notice only to **Joddie Dalicano, Bien Manlise, and Dennis Adriano**.
   - Use Manila time and show it on their first portal use at or after **10:00 AM**, Monday through Saturday; show nothing on Sunday.
   - Display that person's assignment for the day from the supplied schedule:
     - Monday: Joddie and Bien receiving; Dennis releasing and phone calls
     - Tuesday: Dennis receiving; Joddie receiving; Bien releasing and phone calls
     - Wednesday: Bien receiving; Dennis receiving; Joddie releasing and phone calls
     - Thursday: Dennis receiving; Joddie receiving; Bien releasing and phone calls
     - Friday: Joddie and Bien receiving; Dennis releasing and phone calls
     - Saturday: Bien receiving; Dennis receiving; Joddie releasing and phone calls
   - Include the full phone-duty disclaimer and one **I understand** button.
   - Dim and block the portal behind the notice until acknowledged.
   - Record the acknowledgement in the existing activity history so it is dismissed once per account per Manila calendar day, including across devices.

## Technical details

- Both staff tracker URLs already use the same tracker screen, so one filter implementation covers both.
- Ticket data already includes assigned admin representatives.
- The existing authenticated activity history accepts staff inserts and can identify the current account, so no new table is required.
- The uploaded schedule image is reference material only and will not be embedded.

## Verification

- Confirm the removed payment methods are absent on public tracking.
- Confirm Admin filtering works for single and multiple admin assignments on both tracker URLs.
- Test the notice for all three named admins, each weekday assignment, Sunday suppression, pre-10:00 suppression, post-10:00 display, and once-daily cross-device acknowledgement.
- Check narrow mobile and desktop layouts and confirm the project builds without errors.
