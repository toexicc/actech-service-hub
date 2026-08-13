# Reason modal for Cancelled/On Hold, POS guard, editable stock, track label

## 1. Reason modal on Cancelled and On Hold (like RTO)

On `/manage-client`, changing status to **Cancelled** or **On Hold** now opens the same reason modal already used for RTO. The reason is required before saving and is stored on the ticket (same reason field as RTO).

On `/track`, the reason is shown in its own card **below the Repair Ticket card** (instead of inside the amber banner at the top), for RTO, Cancelled and On Hold alike — titled "Reason for <client-facing status>".

## 2. POS guard rail — final cost required

In Point of Sales, searching a Service ID only loads the ticket if it has a final cost greater than zero. If not, the search is rejected with a message telling the user to set the final cost on the ticket first (the manual/no-service payment path is unchanged).

## 3. Inventory — editable stock quantity + reliable edit

- The Edit Part dialog gets a **Stock Quantity** field (and keeps everything else).
- Saving an edit writes directly to the database instead of the legacy bridge call, so it no longer "reports success" when the request actually failed. A log entry records the edit, including the old → new quantity when the stock is changed, and the item status auto-syncs (0 = Out of Stock).
- The inventory list and logs refresh right after a successful save.

## 4. /track wording

When the internal status is **Confirmed Diagnosis**, clients see **Finalizing Diagnosis**.

## Technical notes

- `src/pages/ManageClient.tsx`: replace `isRtoMove` with a `REASON_REQUIRED_STATUSES = ["RTO - ACTech", "RTO - Client", "RTO", "Cancelled", "On Hold"]` check driving the existing `rtoModalOpen` / `rtoConfirmRef` flow; keep persisting to `rto_reason`.
- `src/pages/ServiceTracking.tsx`: compute `reasonKind` from any reason-required status (not just `/^rto/`); remove the reason block from the closed banner and render a reason card immediately after the Repair Ticket card.
- `src/lib/serviceStatus.ts`: add `"Confirmed Diagnosis": "Finalizing Diagnosis"` to `CLIENT_STATUS_LABELS`.
- `src/pages/PointOfSales.tsx`: in `handleSearchService`, after a found result, `parseCurrency(finalCost) <= 0` → toast + clear `serviceData`.
- `src/pages/InventoryManagement.tsx`: add `quantity` input to the edit dialog; rewrite `handleEditPart` to `supabase.from("inventory_parts").update(...)` + `part_logs` insert, with real error handling (no CORS "assume success" fallback).
