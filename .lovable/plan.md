# Auto-clear Waiting for Parts on closed tickets + public device report photos

## 1. Waiting for Parts turns itself off on closed tickets

When a ticket moves to **RTO - ACTech**, **RTO - Client**, **Cancelled**, or **Completed**, the Waiting for Parts flag is cleared automatically as part of the same save — no confirmation modal, since parts are irrelevant once the ticket is closed.

- Applies on both `/manage-client` and `/service-update`, and to auto-completion (a ticket that completes itself when the balance hits zero).
- The existing "parts already arrived?" confirmation modal stays only for moves into Ongoing Service / Done Repair.
- The flag toggle stays hidden on closed tickets as it is today, and the chip disappears everywhere (tracker cards, `/track`) because the flag is now false.

## 2. Device report photos visible on public `/track`

Today the public tracking page can show Device Diagnosis photos but not Device Report photos: the diagnosis photos are stored in a publicly readable bucket with a matching public read rule, while the device report photos have neither. Clients therefore see an empty section.

Fix: give device report photos the same public read path as diagnosis photos, so the existing gallery on `/track` renders them (still only for the near-complete/completed statuses that already gate that section).

## Technical notes

- `ManageClient.tsx` / `ServiceUpdate.tsx`: extend the status-change save to include `waiting_for_parts: false` when the target status matches `RTO`, `Cancelled`, or `Completed`; skip the parts confirmation modal for those. Same in `src/lib/autoCompleteService.ts`.
- Migration: add an `anon` SELECT policy on `public.service_files` for `kind = 'device_report'` (mirroring the existing `diagnosis_photo` policy), and flip the `device-reports` storage bucket to public so anon-created signed URLs resolve. Only device report images become publicly readable — intake forms, quotations, signatures and annotations stay private.
