# Plan: Simplify `/track` for closed tickets (RTO / Cancelled / On Hold)

## Goal
When a public `/track` lookup resolves to a ticket whose status is **RTO**, **Cancelled**, or **On Hold**, hide all service-detail content (AI diagnosis, AI report, pricing, device photos, intake/quotation PDFs) and show only the client + device information plus the general shop/contact rail. A short status banner explains why the detail is limited.

## Confirmed scope
- Keep the **Repair Ticket card** (client + device info) and the **right rail** shop/contact info (Visit Us, Terms & Conditions, Stay updated).
- Hide: AI Diagnosis, AI Report, Quote/pricing card, customer admin notes, paid/balance mini-stats, step chips, device diagnosis/report photos, and the Intake PDF + Quotation PDF document buttons.
- Add an explanatory **banner** above the simplified view, worded per status.

## Implementation (single file: `src/pages/ServiceTracking.tsx`)

1. **Import the existing helper.** Add `isClosedStatus` to the import from `@/lib/serviceStatus` (already partially imported for `clientStatusLabel`).

2. **Compute the closed flag** inside the result render block (around line 973, near `currentStatus`):
   ```ts
   const isClosed = isClosedStatus(currentStatus);
   const CLOSED_BANNER: Record<string, string> = {
     "RTO": "This device has been returned to its owner. Please contact the shop if you have questions.",
     "Cancelled": "This service has been cancelled. Please contact the shop for details.",
     "On Hold": "This service is currently on hold. Please contact the shop for an update.",
   };
   const closedBanner = isClosed ? (CLOSED_BANNER[currentStatus] ?? CLOSED_BANNER["On Hold"]) : "";
   ```

3. **Banner.** When `isClosed`, render a small amber/warning banner immediately above the grid (left column) with the `closedBanner` text and the off-path status chip.

4. **Repair Ticket card — trim closed content.** Wrap the following sub-blocks so they only render when `!isClosed`:
   - The **mini-stats** grid (Paid / Progress / Balance). When closed, drop the whole mini-stats row (or keep only the Progress tile — chose to drop the row entirely per "client + device only" inside the card).
   - The **step chips** row (line 1072) and the **offPath** chip row (line 1096) — the banner already conveys the closed status, so hide the step chips; keep the offPath chip inside the banner instead.
   - Keep: ticket header (id + share + StatusChip), status title + updated timestamp, waitingForParts badge, and the full client/device/complaint/time-frame grid + disclaimer.

5. **Hide the detail sections when closed.** Gate each of these with `!isClosed`:
   - `{showAiDiagnosis && ...}` block (line 1156).
   - `{showAiReport && ...}` block (line 1391).
   - Quote/pricing card (line 1398).
   - Customer-facing admin notes card (line 1485).

6. **Right rail — trim the Documents card.** Inside the Documents card, keep the **Terms and Conditions** row. Hide the **Client Intake Form** and **Service Quotation** rows when `isClosed`. Keep the Visit Us and Stay updated cards unchanged.

7. **Device Photo Gallery.** The existing status-allowlist at line 1607 already excludes RTO/Cancelled/On Hold, so photos already do not render for these — no change needed, but I'll verify the allowlist is intact.

## Verification
- Build/typecheck via the harness.
- Playwright on `/track` with a known RTO, Cancelled, and On Hold service ID — confirm only the trimmed Repair Ticket card + rail show, banner text matches status, and no diagnosis/report/pricing/quotes/photos/Intake-or-Quotation PDF buttons appear.
- Re-check an active-status ticket to confirm nothing regressed.
