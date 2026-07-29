## 1. Duplicate "Dashboard" tab in the Workbench tab bar

Root cause (verified in code):
- `WorkbenchContext.tsx` seeds a pinned Home tab with `id: "home"`, `path: "/menu"`.
- The sidebar Dashboard button in `DashboardLayout.tsx` opens it as `id: "page:/menu"`. `openTab` dedupes by `id`, so a second tab is appended.

Fix:
- In `DashboardLayout.tsx`, when a nav item's path equals `/menu`, open it with `id: "home"` so it reuses the pinned Home tab.
- Harden `WorkbenchContext.openTab`: before appending, if any existing tab has the same `path`, activate that tab instead of creating a new one. This also stops future duplicates from any other call site.

## 2. Every workbench tab "reloads" on switch (app-wide)

Root cause (verified): the workbench uses one shared `<Routes>` outlet in `App.tsx`. Switching a workbench tab calls `navigate(tab.path)`, which unmounts the previous page component and mounts the new one from scratch. React Query keeps data cached, but component state (scroll, form drafts, expanded rows, filters, search text, `activeTab` in nested pages) is lost every time — this is what feels like a reload.

Fix — real IDE-style keep-alive:
- Extract the current per-page route table (`/menu`, `/pos`, `/service-form`, `/manage-client`, `/service-update`, `/service-tracker`, `/service-tracking` (internal), `/inventory-management`, `/customer-management`, `/staff-management`, `/completed-transactions`, `/transaction-tracker`, `/tech-dashboard`, `/admin-dashboard`, `/request-for-parts`, `/salary-disbursement`, `/attendance-overview`) into a shared `workbenchRoutes` array of `{ pattern, element, roles? }`.
- Add a new `WorkbenchOutlet` component rendered inside `DashboardLayout` (replacing the single `<Outlet />`-like slot for authenticated pages). For every currently open tab in `WorkbenchContext`, it renders that tab's page element inside its own div, wrapped so that:
  - The active tab's div is visible.
  - Inactive tabs' divs stay mounted but hidden (`hidden` attribute + `aria-hidden`), preserving their component tree, refs, scroll position, and internal state.
  - Each tab wrapper uses a stable `key={tab.id}` so React never reconciles two different pages into the same instance.
- Matching: for each tab.path, find the first route in `workbenchRoutes` whose pattern matches (support `:serviceId`-style params via `matchPath` from `react-router-dom`). The matched element is rendered inside a lightweight `<MemoryRouter>`-free context: the URL used for `useLocation`/`useSearchParams` inside the page needs to reflect that tab's own path, not the global URL. To keep this simple and avoid nested router complexity, tabs will render against the browser URL only when they are active; inactive tabs render against their last-known path via a small `TabLocationProvider` that overrides `useLocation`/`useSearchParams` for hidden tabs. Pages that only read `useLocation()` for the current pathname will continue to work because that value is captured on mount and stays stable while hidden.
- Public/unauth routes (`/`, `/track`, `/track/:serviceId`, `/install`, `/attendance`, `/intake`) stay on the ordinary `<Routes>` path and are NOT part of the workbench keep-alive. They will remount normally, since they're not part of the tabbed shell.
- When a tab is closed via `closeTab`, its wrapper is unmounted and its state is discarded — expected.
- Memory guardrail: cap simultaneously mounted tabs at 12. When opening a 13th, close-and-unmount the least-recently-active non-pinned tab. Home is always pinned.

Secondary cleanup enabled by this change:
- The `ServiceTracker` internal `activeTab` state will now survive tab switches naturally, so no URL-param workaround is needed. The existing "reset `currentPage` to 1 when `activeTab` changes" effect can stay as-is.

## 3. Improve the AI Chief Complaint formatter

Update the `supabase/functions/format-complaint/index.ts` system prompt to a short but useful intake note:
- Sentence 1: concise professional restatement of the complaint.
- Sentence 2: brief likely context/cause, hedged with "Likely" or "Possibly".
- Sentence 3 (optional, only when clearly applicable): a first troubleshooting or repair direction as "Suggested check: …".
- Hard cap 3 sentences, plain text, no markdown/headers, no invented model numbers, part numbers, or prices.
- Keep temperature low (0.3) and preserve the existing "no em dashes" rules.

No client-side change needed.

## Technical notes

- Files touched:
  - `src/App.tsx` — split public routes from workbench routes; render `DashboardLayout` with the workbench outlet for the authenticated route group.
  - `src/components/workbench/workbenchRoutes.ts` (new) — shared route table + role guards.
  - `src/components/workbench/WorkbenchOutlet.tsx` (new) — keep-alive renderer.
  - `src/components/workbench/WorkbenchContext.tsx` — path-based dedupe in `openTab`; expose LRU order for the mount cap.
  - `src/components/DashboardLayout.tsx` — nav Dashboard button uses `id: "home"`; embeds `WorkbenchOutlet`.
  - `supabase/functions/format-complaint/index.ts` — new prompt; requires redeploy.
- No schema, RLS, data model, or auth changes.
- Risks: pages that call `useNavigate()` from inside a hidden tab could still fire (e.g., a background timer). Mitigation: pages already gate side effects on visibility/focus where relevant; if any regressions surface, we can add a `useIsTabActive()` hook to short-circuit background work in inactive tabs.
