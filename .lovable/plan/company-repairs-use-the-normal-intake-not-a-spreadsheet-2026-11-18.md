# Company Repairs: use the normal intake, not a spreadsheet

## What I checked
- Company devices are normal tickets, so Manage Client and Service Update can already find them by ticket ID.
- The gap: the "Add devices" sheet skips the normal intake. It assigns no technician or admin and has no accessories, device condition, terms or AI-formatted complaint. Technicians only see tickets assigned to them, so they can't see these devices.
- Manage Client, Service Update and Service Tracker don't show which company or batch a ticket belongs to.

## 1. Intake company devices through the Client Intake Form
- Add a **Company** client type. Choosing it shows a company picker and auto-fills the contact, email and billing address.
- Optional **Batch** (pick an existing one or type a new name) and **Location**.
- Everything else stays the same as a normal walk-in: device fields with suggestions, AI-formatted complaint, accessories, condition, timeframes, and technician and admin auto-assignment.
- After saving, a **Same company, next device** button keeps the company, batch and location and clears only the device fields. Bulk intake is just repeating this quickly.
- Remove the spreadsheet-style "Add devices" dialog. Its button now opens this intake form with the company already picked.

## 1b. Fill company tickets in automatically (less work for staff)
- The issue the company reports **becomes the chief complaint**, kept on the same AI-format step as normal intake.
- **Requesting Invoice (Add VAT to Total Cost)** is switched on by default for company tickets. It follows the company's "VAT on quotations" setting, and staff can still turn it off.
- Client type is set to Company, and client name, contact and address come from the company record. Staff only type the device details and the issue.
- On company tickets in Manage Client, the **Service Quotation Form** is replaced by a **Company Quotation Form**: the company billing-statement document with the same branding, created from that ticket's diagnosis and service breakdown. The status gate that requires a quotation before moving forward accepts the Company Quotation Form. Combined quotations for several devices are still made from the Company Repairs page.

## 2. Company Repairs page in the style of Service Tracker
- Company list: one card per company showing in-progress, awaiting-quote and completed counts.
- Inside a company: the header, client link and summary boxes stay. Devices show as **cards grouped by batch**, styled like the Service Tracker cards: ticket ID, model, serial, status chip, technician, quote status and total.
- Clicking a card opens **Manage Client** (admin/management) or **Service Update** (technician), the same as Service Tracker.
- Select cards to **Generate quotation** (one document or one per device) and to move them to another batch. The quotation history stays.

## 3. Company tickets inside the normal work screens
- **Manage Client:** a Company section shows the company, batch, location, quote status and the "own quotation" box. Admin/management can edit these, and changes go to the activity log.
- **Service Update:** a read-only company, batch and location line so technicians know it's a company job.
- **Service Tracker:** a Company chip on cards and rows, plus a **Company** filter.
- Technicians see company tickets only when assigned, the same as any ticket. This comes free from normal intake assignment.

## Technical notes
- Intake passes `company_id`, `company_batch_id` and `company_location` through `create_service_atomic`, or updates the ticket right after creation. Uses the existing columns, so no schema change.
- New shared `CompanyFields` component, reused by the intake form and Manage Client.
- Delete `AddDevicesDialog`. `CompanyRepairs.tsx` switches from a table to grouped cards.
- Check the logged-in flow: intake two Shopee devices, then confirm both show in Company Repairs, Manage Client, Service Update (as the assigned technician) and the tracker filter. Test data is removed afterward.
