
# Premium Redesign — Fixy-inspired

Turn the entire app into an Apple/Fixy-style workspace: soft light-blue background, floating glass sidebar, top workbench with real multi-tabs, functional ⌘K command palette, and a modern classy public /track page. Scope covers the app shell + all pages.

## 1. Design system refresh (`src/index.css`, `tailwind.config.ts`)

New light-first tokens (HSL) matching the Fixy Light Blue palette:

- `--background` = very light blue-white `220 60% 98%` (#F5F8FF)
- `--card` = pure white with subtle border
- `--primary` = vivid blue `221 83% 53%` (#2563EB), `--primary-foreground` white
- `--accent` = soft blue tint `220 70% 94%` (#E8EEFB) for hovers, active nav rows
- `--sidebar-*` = translucent white with blue tint, blur, active row = primary blue with white text
- New tokens: `--surface-glass` (white/70), `--ring-glow`, `--shadow-elegant`, `--shadow-float`, `--radius` = `1rem`
- Typography: Inter-tight for UI, tighter tracking on headings, `font-feature-settings: "cv11","ss01"`
- Global utilities: `.glass-panel`, `.glass-sidebar`, `.card-elevated`, `.chip`, `.kbd`

Dark mode kept but tuned to match (deep navy + same blue accent).

## 2. App shell rewrite (`src/components/DashboardLayout.tsx`)

Replace the current fixed sidebar + header with a **floating shell**:

```text
┌───────────────────────────────────────────────────────────────┐
│  ░░ glass background ░░                                       │
│  ┌──────────┐  ┌───────── Tab bar ─────────┐  [🔍 ⌘K] [🔔] [👤]│
│  │  logo    │  │ 🏠 Dashboard │ 📄 MAA-1192 ✕│               │
│  │──────────│  └───────────────────────────┘                 │
│  │ Nav      │  ┌───────────────────────────────────────────┐ │
│  │ groups   │  │  Page content (rounded, elevated card)    │ │
│  │ …        │  │                                           │ │
│  │          │  │                                           │ │
│  │ user     │  │                                           │ │
│  └──────────┘  └───────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

- Sidebar: `fixed`, `m-3`, `rounded-2xl`, `bg-sidebar/80 backdrop-blur-xl`, `border`, `shadow-float`. Nav rows use pill highlight (blue tint bg, primary text). Groups (Admin/Tech portals) styled as sections with tiny uppercase labels + chevron.
- Collapsed rail keeps icons only, width 68px, tooltips on hover.
- Header: floating pill on top-right containing search trigger (`⌘K` chip), notification bell, messaging, and user avatar.
- Main content wrapped in a rounded elevated surface with generous padding.
- Mobile: sheet sidebar stays, but restyled to same glass look; header becomes glass pill.

## 3. Multi-tab workbench (new `src/components/workbench/`)

- `WorkbenchProvider` (React context) — stores `tabs: {id, kind, title, subtitle, icon, path, state}[]` and `activeTabId`. Persisted to `sessionStorage`.
- `TabBar` renders horizontally under the header. Dashboard tab is pinned (non-closable). Other tabs closable, draggable (dnd-kit) later — v1 just close + click to switch.
- Navigation: opening a service from Manage Client / Service Tracker / Service Update / Menu opens a tab with the record's ID as title (e.g. `MAA-1192 · Regil Badilles`). Same record reuses existing tab.
- Router: keep `react-router` but tabs map to routes; switching a tab does `navigate(tab.path)`. Closing active tab falls back to previous.
- Keyboard: `Cmd/Ctrl+W` closes tab, `Cmd/Ctrl+K` opens palette, `Cmd/Ctrl+1..9` jumps tabs.
- Counter chip like Fixy's `2/10`.

## 4. Functional command palette (⌘K) — new `src/components/CommandPalette.tsx`

Built on `cmdk` (shadcn's `Command` primitive is already available).

- Trigger: header pill or `Cmd/Ctrl+K`.
- Sections (async-searched, debounced 200ms):
  - **Services** — Supabase `services` search by service_id, client_name, device (uses existing `useServices` cache, then falls back to a lightweight `.ilike` query).
  - **Customers** — from `clients` table.
  - **Parts** — from `parts_inventory` / fast-moving parts.
  - **Staff** — from staff directory.
  - **Pages** — hard-coded route list (all nav items, filtered by role).
- Result rows: icon + primary label + subtle secondary. Enter opens the item (services/customers → open as workbench tab; pages → navigate).
- Empty-state and hint chips like Fixy screenshot (`Tip: type MAA-1192 to jump to a ticket`).

## 5. Public /track redesign (`src/pages/ServiceTracking.tsx`)

Match the elegant right-column card layout from the reference:

- Sticky top brand bar (logo, shop name, share button).
- Two-column responsive grid:
  - Left: repair ticket card with status chip, headline (`Your device is ready to collect` etc. driven by status), deposit / step / balance stat trio, horizontal step tracker (Received → Diagnosed → In Repair → Ready → Done), device summary, quote card with itemized services + total, payment methods chips.
  - Right: `Visit us` card (map/address/call/directions), `Stay updated` toggle (email opt-in), `Documents` list with Image / PDF actions (already wired), diagnosis photos gallery, report photos gallery.
- All copy driven by service status; keep existing data hydration logic.
- Fully rounded cards, soft shadows, `bg-background` blue tint.

## 6. Page-level polish (all pages)

Apply new design tokens + components across:

- **Menu / Dashboard** — Fixy-style hero ("Today's numbers") with live stat cards, quick-action row (Tickets/Employees/Clients/Approvals), "Where tickets are now" grouped cards. Reuse existing metrics from `useServices`.
- **Manage Client / Service Update** — restyled forms with section cards, sticky right rail for status + actions, tab-aware header (record ID chip + status pill).
- **Service Tracker** — table restyled to Fixy tickets list: status color chips, priority tag, hover row, right-side filter drawer.
- **POS, Inventory, Salary, Staff, Attendance Overview, Admin Dashboard, Customer Management, RequestForParts** — swap raw shadcn cards for the new `.card-elevated`, unify spacing (`p-6 space-y-6`), consistent page header component `<PageHeader title subtitle actions/>`.
- **Login** — glass card centered on soft blue gradient, matches new palette.

Business logic, data hooks, edge functions, and Supabase schema are untouched.

## 7. Reusable primitives (new)

- `src/components/ui/page-header.tsx` — title / subtitle / actions row used on every page.
- `src/components/ui/section-card.tsx` — elevated white card with header slot.
- `src/components/ui/stat-card.tsx` — Fixy-style number card with live dot, delta, comparison.
- `src/components/ui/status-chip.tsx` — colored pill mapping to the 15 service statuses.

---

## Rollout order (single build pass)

1. Tokens + Tailwind + global utilities.
2. New primitives (PageHeader, SectionCard, StatCard, StatusChip).
3. Workbench provider + TabBar + refactor DashboardLayout shell.
4. Command palette + wire ⌘K.
5. /track redesign.
6. Menu/Dashboard redesign.
7. Sweep remaining pages with new primitives (no logic changes).

## Out of scope

- Any backend/schema changes.
- Real-time collaborative cursors, drag-reorder tabs (v2).
- Full dark-mode retheming beyond token parity.
- Behavior changes to forms, notifications, PDFs — visuals only.
