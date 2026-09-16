# Completed Services chips, payout readiness, Edit button colour, and a global ticket preview panel

## 1. Rush / Invoice chips on Completed Services

Under each ticket ID in the Completed Services list, small chips appear when the ticket is marked Rush or when the client requested an invoice (the "Requesting Invoice" toggle), so both are visible at a glance for tracking. Orange for Rush, violet for Invoice Requested; nothing shows when neither applies.

## 2. Parts cost defaults to "no parts yet"

Parts cost is now assumed to be "no parts used yet" unless someone records one. So:

- On Completed Services, a ticket with no recorded parts cost shows "No parts yet" in the Parts Cost column instead of ₱0.00 (and it only flips to an amount once a parts cost is added).
- The "Not ready for payout" warning on Salary Disbursement counts only tickets with no commission allocated. The "…have no parts cost recorded" sentence is removed.
- "Review in Completed Services" filters to tickets missing an allocation only — parts cost is ignored there too.
- Money math is untouched: a blank parts cost already counts as zero.

## 3. Edit button colour on Salary Disbursement

The Edit button beside a disbursed row becomes light blue (tinted background, blue text and border) instead of the plain outline that reads as greyed out. Same on both the fixed-salary and service-based tables.

## 4. Global ticket preview side panel

Anywhere a ticket ID is shown, a small icon button (like the reference) opens a right-side slide-over with a read-only preview of that ticket — no page change, no navigation, nothing editable.

Contents, in order:
- Header: ticket ID, status, client, device, Rush / Released / Pre-Order / Backjob / Waiting-for-Parts / Invoice chips
- Client and device details
- Chief complaint and issue description
- Diagnosis (technician + AI) and technician report
- Approved / pending service choices with the quoted breakdown
- Charges summary and payments received (with balance)
- Photos: device report and diagnosis photos, opening the existing gallery viewer
- Footer: "Open in Manage Client" button, and Close

Where the button appears: Service Tracker, Completed Services, Transaction Tracker, Point of Sales, Reports lists, dashboards, Release/Intake queue panels, notifications lists — anywhere a ticket ID renders. Excluded, as requested: the technician portal pages Service Update and Service Tracking.

Nothing existing is modified beyond adding the button next to ticket IDs; the panel is read-only and shares the data hooks already used, so no workflow, save path, or permission changes.

## Technical notes

- `src/hooks/useDoneServices.ts`: add `rush_fee`, `vat_requested`, `is_released`, `has_pre_order`, `is_backjob`, `waiting_for_parts` to `DONE_COLUMNS` and map them; render `TicketFlagChips` (extended with an "Invoice Requested" chip driven by `vatRequested`) under the ID cell in `CompletedTransactions.tsx`.
- `src/pages/SalaryDisbursement.tsx`: drop `missingPartsCost` from `readiness` (line ~505) and from the banner copy (~1058); Edit buttons (~1032, ~1189) get `className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"`.
- `src/pages/CompletedTransactions.tsx`: issues filter keeps only `!(breakdownMap[s.serviceId] ?? []).length` plus the existing service-based technician gate; the parts-cost clause is removed.
- New `src/components/ServicePreviewSheet.tsx`: shadcn `Sheet` (side="right", `w-full sm:max-w-xl`, internal `overflow-y-auto`, fixed footer per the modal convention). Fetches by ticket ID with a `useQuery(["servicePreview", id])` over `services` (single row, mapped through `mapServiceRow`-style shape), plus `useServiceBreakdowns`, `useServicePayments`, and the existing photo components in read-only mode.
- New `src/components/ServicePreviewProvider.tsx` + `useServicePreview()` context mounted once in `DashboardLayout`, exposing `openPreview(serviceId)`; plus `ServicePreviewButton` (ghost icon button, `ExternalLink`) for use beside ticket IDs. Pages only add the button — no local state.
- Panel is display-only: no mutations, no status writes, no PDF regeneration.
