# Company Repairs

A dedicated page for bulk company jobs (e.g. Shopee), built on top of normal tickets. Each device stays a regular ticket with its own Service ID, its own Manage Client / Service Update link, and the same admin/technician workflow. The company layer groups them, adds batch tracking, a public company link, and quotation documents.

## What you will get

**1. Side menu:** "Company Repairs" right below Service Tracker (admin, management; technicians see only their assigned devices).

**2. Companies list**
- Company name, contact person, contact number, email, billing address, TIN (optional), VAT default (on/off), notes.
- Each company card shows ongoing / completed / awaiting quotation counts.

**3. Company page (tracker like your sheet)**
One row per device, with the columns you use today:

| Column | Source |
|---|---|
| Batch (e.g. "Faulty Devices - September 5, 2025") | new batch field |
| Location (e.g. PDM) | new field per device |
| Serial number, Model | ticket |
| Issue reported | ticket chief complaint |
| Parts requested + Cost (pricebook) | ticket service breakdown |
| Total price | ticket total |
| Requires individual quotation | checkbox |
| Quotation request (RFQ / Approved / Declined) | new field |
| AC Tech status (Quotation Sent, etc.) | real ticket status + quotation state |
| Link to quotation | generated document |

- Filters: batch, location, status, ongoing/completed, search by serial/model/ticket.
- Clicking a row opens the normal Manage Client (admin) or Service Update (technician).
- Bulk actions: assign technician, set batch, set location, select rows to quote.

**4. Adding devices**
- "Add devices" form for a batch: shared company info filled once, then rows of serial / model / issue / location (paste many rows at once). Each row creates a normal ticket (client type = Company) with its own Service ID and goes through normal auto-assignment.
- Existing company tickets can also be attached to a company.

**5. Quotation / Billing Statement generator** (matches your SHOPEE format)
- Choose: one document for selected devices, or one document per device.
- Header: ACTECH REPAIR PH INC., address, phone numbers, date.
- Customer Name (contact/department, e.g. SOC 8), Company Name.
- Per device line: Serial Number, Model, Issue(s) reported, Part(s) requested, numbered Solutions each with cost, part type (OEM/Original) and warranty, plus standard notes; Price, Quantity, Amount.
- Estimated Timeframe block (parts lead time, installation days) — editable default text.
- Discount, VAT 12% (VAT-inclusive breakdown: Sub Total = Amount / 1.12), Final Amount, warranty, "not valid for claim of input tax" note, contact email.
- Pre-filled from the ticket's diagnosis and breakdown; staff can edit text before generating.
- Output as PDF, saved to the ticket(s) with a quotation number, viewable from the company page and each ticket. Marks quotation request as "Quotation Sent".

**6. Public company link**
- One shareable link per company (secret link, can be regenerated to revoke).
- Shows all devices: Ongoing and Completed tabs, batch filter, serial, model, issue, status, quoted price, and download of sent quotations.
- Each row links to that device's own /track page (still PIN-protected for full details).

## Questions resolved by defaults (tell me if wrong)
- Company approval of quotes stays per ticket via normal flow; the company link is view-only.
- Technicians cannot generate quotations; admin/management can.

## Technical details
- New tables: `companies` (profile + `public_token` + vat default), `company_batches` (company_id, label, received date), `company_quotations` (number, company_id, service_ids[], mode, payload jsonb, pdf path, totals, created_by). Grants + RLS: staff authenticated read; admin/management write.
- New `services` columns: `company_id`, `company_batch_id`, `company_location`, `needs_individual_quote`, `quotation_request_status` (nullable/default, additive).
- Public link uses a security-definer function `public_company_services(_token)` returning limited fields only (no phone, password, internal notes).
- Pages: `/company-repairs`, `/company-repairs/:id`, public `/company/:token`. Nav entry in DashboardLayout after Service Tracker.
- PDF via pdf-lib (existing pattern), stored in `quotation-forms` bucket, linked in `service_files` (kind quotation) for each included ticket.
- Pure helpers (VAT/subtotal math, quotation numbering, grouping) with tests.
