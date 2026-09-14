# Sleeker global view, commission payslip printing, and a tighter payout flow

## 1. Shrink the whole app view by another 10%

The app is already displayed at 80% of full size. That shared wrapper drops to 72%, so every page (not just Salary Disbursement) gets more room and the summary cards stop clipping their amounts. The visible area is widened to match, so nothing gets cut off at the right edge or bottom.

Also fixed globally on the summary cards: big peso amounts currently overflow the card edge (as in the screenshot). Amount text scales down slightly on narrow widths and stays inside its card.

## 2. Print button for Service Based Employees

A Print button is added on each service-based employee row (and next to the section title for a full-batch print). It builds an A4 PDF using the same letterhead style as the intake/quotation/receipt documents:

- AC Tech logo, business information and business hours header
- Employee name and cut-off, e.g. "September 1 - 15, 2026"
- Total allocated commission for the period, stated clearly at the top
- Breakdown table, one row per ticket: Completed Date | Service ID | Client Name | Allocated Commission
- Total row at the bottom of the table
- Right-aligned signature line labelled "AC Tech Finance Management"

Rows come from the same data the page already uses for the payout figure: tickets completed inside the selected cut-off with a commission allocated to that employee, so the printed total always matches the Final Amount shown on screen. If a row has no saved allocation and the payout is coming from the commission percentage instead, the printed line shows that computed share for the ticket, and a note says the figures are percentage-based.

Actions: Print (opens the system print dialog) and Download.

## 3. Make Completed Services and Salary Disbursement seamless

All of the following is included in the build:

1. **One source of truth per ticket.** Make the allocation in Completed Services the only thing that pays a technician, and drop the percentage fallback on the salary page. Today two different mechanisms can pay the same ticket, which is where mismatches come from.
2. **Lock a ticket once paid out.** When a cut-off is disbursed, freeze the allocations for those tickets so a later edit in Completed Services can't silently change a payout that already went out. Edits after that create an adjustment on the next cut-off instead.
3. **"Ready for payout" check.** On Completed Services, show a per-cut-off banner: how many completed tickets still have no parts cost or no allocation. Salary Disbursement warns before disbursing while unallocated tickets remain.
4. **Jump between the two pages.** From an employee row, a link opens Completed Services already filtered to that technician and cut-off, so fixing an allocation is one click instead of re-filtering by hand.
5. **Same cut-off everywhere.** Share one cut-off selector (1-15 / 16-end of month) between the two pages, so both always read the same window.
6. **Batch payslips.** One click prints every service-based employee's payslip for the cut-off as a single multi-page PDF for signing.

## Technical notes

- `src/components/DashboardLayout.tsx`: wrapper `[transform:scale(0.8)]` becomes `0.72`, with `h`/`w` raised to `~139vh/139vw` so the scaled canvas still fills the viewport.
- Stat/summary card amounts: clamp font size (`text-xl sm:text-2xl`) plus `min-w-0` / `truncate` on the value node in the shared card components used by Completed Services, Reports and dashboards.
- New `src/lib/commissionPayslipPdf.ts` using `pdfPremiumKit` (`drawLetterhead`, `drawFooter`, `titledCard`) with A4 page size; reuses `pdfActions.ts` for print/download.
- `SalaryDisbursement.tsx`: extract the per-ticket allocation rows for a staff name from `breakdownMap` + `periodServices` (already computed for `getAllocatedCommission`) into a `getCommissionRows(name)` helper feeding both the total and the PDF; add Print action per row.
- Seamless items: remove the `techCommissions` percentage fallback in `computeServiceFinal` (allocations only); add a readiness banner driven by completed tickets lacking `service_breakdowns` rows or `parts_cost`; deep link to `/completed-transactions?technician=<name>&from=&to=`; persist the shared cut-off through `useFilterPersistence` so both pages read one window; payout lock stored on `salary_disbursements` (locked cut-off + service IDs) and honoured by `ServiceBreakdownPanel` edits; batch payslip loops the same PDF builder into one multi-page document.
