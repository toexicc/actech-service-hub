
## What you're getting

A full structural rebuild of three key surfaces to match the Fixy screenshots, plus a fix to the multi-tab system so tabs actually accumulate as you click around. Core functionality (search, edit, save, notifications, PDFs, storage, chat, statuses) stays exactly the same — only the shell, page composition, and information architecture change.

---

## 1. Fix multi-tabbing (root cause)

Right now `WorkbenchProvider` is mounted **inside** `DashboardLayout`, and `DashboardLayout` is rendered per page. Every route change unmounts and remounts the provider, so `openTab()` fires, the router navigates, and the new provider boots fresh — the tab you just added is gone. That's why clicking sidebar items only switches pages.

Fix: hoist `WorkbenchProvider` up to `src/App.tsx` above `<Routes>` so a single provider instance survives navigation. Result: clicking any sidebar item, command-palette result, or record link **appends a tab** and switches to it; closing the last non-pinned tab returns to the Dashboard pin; tabs persist across reloads via `sessionStorage`.

Also:
- Tab bar becomes the primary navigation surface (Fixy-style pill tabs with a `+` new-tab button that opens the command palette, `1/10` count, and "Close All").
- Middle-click / Ctrl-click a sidebar item → open in background tab without switching.
- Keyboard: `⌘K` (already wired) + `⌘W` close tab + `⌘⇧[` / `⌘⇧]` cycle tabs.

---

## 2. `/menu` → Fixy Dashboard rebuild (screenshot 7)

Full re-composition, not a re-skin.

```text
┌─ Dashboard header ─────────────────────────────────┐
│ Dashboard   Tue, Jul 28 · Regil · Shop overview   │
│                              [Now][Today][7d][30d]│
├─ Quick action chips ───────────────────────────────┤
│ [Tickets] [Employees] [Clients] [Check-ins]        │
│ [Reassign•1] [Approvals] [QA] [Audit]  Export CSV  │
├─ Today's numbers ───────────────────────── Customize
│ ┌ Overdue live ┐ ┌ Completed ┐ ┌ Waiting ┐ ┌ Rev ┐│
│ │ 0 past dl    │ │ 0 today   │ │ 0 tech  │ │ ₱0  ││
│ └──────────────┘ └───────────┘ └─────────┘ └─────┘│
├─ Attention banner ─────────────────────────────────┤
│ ⚠ 1 ticket needs attention → MAA-1192 …  Open →   │
├─ Where tickets are now (grouped by stage) ─────────┤
│ Queue&Assignment • Active Repair • Quotation      │
│ Waiting/Blocked • QA • Ready for Pickup           │
└────────────────────────────────────────────────────┘
```

New components: `DashboardHero`, `QuickActionChips`, `AttentionBanner`, `StageGroupGrid` (renders open tickets grouped by workflow stage using the existing 15-status list from memory).

The current "Quick actions" grid is replaced by the chip row + stage grid — same destinations, more informative layout.

---

## 3. `/track` rebuild (screenshot 1)

Two-column informative layout instead of the single big card:

```text
┌────── Branch header (logo · shop name · city) ───── Your repair: <name> [share] ┐
├── Left column (main) ─────────────┬── Right column (rail) ──────────────────────┤
│ REPAIR TICKET card                │ VISIT US card                                │
│ • Ticket # + copy                 │ • Shop name + address                        │
│ • Big status headline             │ • Google Maps embed                          │
│ • "Updated <ts>"                  │ • [Get directions] [Call]                    │
│ • 3-tile mini stats:              │                                              │
│    Deposit · Step k/5 · Balance   │ STAY UPDATED card                            │
│ • 5-step chip progress            │ • Email me toggle                            │
│    Received→Diagnosed→Repair→…    │                                              │
│ • ACTIVITY (n) show updates ⌄     │ DOCUMENTS card                               │
│ • Device + complaint              │ • Check-in receipt   [Image][PDF]            │
│                                   │ • Repair quote        [Image][PDF]           │
│ YOUR QUOTE card                   │ • Repair summary      [Image][PDF]           │
│ • Line items · service badge      │                                              │
│ • Total · Balance (pay on pickup) │                                              │
│ • [Cash][GCash][Maya] chips       │                                              │
│ • "Settle in person…"             │                                              │
└───────────────────────────────────┴──────────────────────────────────────────────┘
   AC TECH REPAIR · address · phone · email · private-link disclaimer
```

Component split: `TrackHeader`, `RepairTicketCard`, `StepChips`, `ActivityAccordion`, `QuoteCard`, `VisitUsCard` (Google Maps iframe embed with your shop coords), `StayUpdatedCard`, `DocumentsRail`.

The existing search-first entry (paste a service ID) stays as the empty state; once a ticket resolves, this new layout renders. All the existing data hydration (`mergeWithSupabase`, PDF resolution via edge function, status/step mapping) is reused unchanged.

Map: Google Maps iframe embed of your Katipunan address — no API key required for a plain `maps.google.com/maps?q=<address>&output=embed` iframe, so no connector setup needed. Directions button uses `https://www.google.com/maps/dir/?api=1&destination=<address>`; Call button uses `tel:+639456479905`.

---

## 4. `/manage-client` and `/service-update` → shared TicketWorkspace shell (screenshot 4)

Both routes stay (per your choice), but they render inside a new **`TicketWorkspaceShell`** so they feel like the same product:

```text
┌ Back · MAA-1192 [copy] · Apple iPhone 13         [Status pill] ┐
│ Step k of n · <stage label>                                     │
│ ●━━━●━━━●━━━●━━━●━━━● (Intake·Diagnosis·Quote·Parts·Repair·QA)  │
├─ What's next (guided) ─────────── Change status · Override ─────┤
│ ○ <next allowed transition> (guard reasons if blocked)          │
├─ 3-panel row ───────────────────────────────────────────────────┤
│ Assigned To │ Payment (charges/due/paid) │ Actions              │
│  · avatar   │  ₱... of ₱... · ₱... due   │ [Log payment ⌄]      │
│  · priority │                            │ [Open portal]        │
│             │                            │ [Documents ⌄]        │
├─ Main grid (existing forms, restyled and re-ordered) ──────────┤
│ Client Information  │  Repair Timeline / Update form           │
│ (existing fields)   │  · Quick note composer                   │
│                     │  · Timeline entries with icons + status  │
│                     │    change markers, notifications, files  │
├─ Diagnosis / Report sections (existing visibility rules kept) ─┤
│ AI Diagnosis Formatter → Device Diagnosis Photos               │
│ AI Report Formatter → Device Report Photos (Done-Repair only)  │
├─ Right rail (sticky on desktop) ───────────────────────────────┤
│ Ticket Details · Messages panel · Financial Lines              │
└────────────────────────────────────────────────────────────────┘
```

- `TicketWorkspaceShell` is a new component. `/manage-client` renders the admin edit variant; `/service-update` renders the technician update variant. **All existing business logic** (discount, final cost, guard for unquoted status changes, technician notes, notifications on approval / status change, photo uploads to `service_files`, PDF fallback from `intake-forms`, price visibility gates by status, etc.) is preserved as-is — only the surrounding layout and section grouping change.
- Existing `StatusProgressBar` is replaced by a new `StepperHeader` matching the Fixy stepper with a status pill on the right and a "What's next" guided card.
- "Repair Timeline" is a new visual grouping of the activity/notes/status-change events already recorded — sourced from the existing activity logger + status-change notifications; no new tables.

---

## 5. What is *not* changing

- Supabase schema, RLS, storage buckets, edge functions.
- Auth, roles, routing rules (page removals memory respected — Attendance Overview stays management-only).
- Notification logic, chat/messaging backend, part requests, POS, inventory, salary, customer management.
- All the fixes shipped in prior turns (discount persistence, technician notes, photo buckets, quotation guard, `/track` PDF signed URLs, DM vs group split, etc.).

---

## Technical section (for reference)

- **Files created:**
  `src/components/TicketWorkspaceShell.tsx`, `src/components/ticket/StepperHeader.tsx`, `src/components/ticket/WhatsNextCard.tsx`, `src/components/ticket/TicketSidePanels.tsx` (Assigned/Payment/Actions), `src/components/ticket/RepairTimeline.tsx`
  `src/components/track/RepairTicketCard.tsx`, `StepChips.tsx`, `ActivityAccordion.tsx`, `QuoteCard.tsx`, `VisitUsCard.tsx`, `StayUpdatedCard.tsx`, `DocumentsRail.tsx`, `TrackHeader.tsx`
  `src/components/dashboard/DashboardHero.tsx`, `QuickActionChips.tsx`, `AttentionBanner.tsx`, `StageGroupGrid.tsx`
- **Files modified:**
  `src/App.tsx` (hoist `WorkbenchProvider` above `<Routes>`), `src/components/DashboardLayout.tsx` (remove its inner provider, add `+`/Close-All tab-bar affordances, keep everything else), `src/components/workbench/TabBar.tsx` (Fixy pill styling, count, close-all), `src/pages/Menu.tsx` (recompose using new dashboard components), `src/pages/ServiceTracking.tsx` (recompose into two-column Fixy layout, add map/documents/quote), `src/pages/ManageClient.tsx` and `src/pages/ServiceUpdate.tsx` (wrap forms in `TicketWorkspaceShell`, reorder existing sections — no logic changes).
- **No DB migrations, no new edge functions, no new secrets.**

---

## Delivery order

1. Hoist `WorkbenchProvider` + polish tab bar (tabs start working).
2. `/menu` Fixy dashboard.
3. `/track` Fixy layout (with map embed).
4. `TicketWorkspaceShell` + rewire `/manage-client` and `/service-update`.
5. Typecheck + a Playwright screenshot pass on each of the four surfaces.
