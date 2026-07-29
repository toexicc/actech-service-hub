import { useEffect, useRef, useState, createContext, useContext } from "react";
import { useLocation } from "react-router-dom";
import { useWorkbench } from "./WorkbenchContext";
import { findWorkbenchRoute } from "./workbenchRoutes";

// Max simultaneously mounted tabs (memory guardrail). Home is always kept.
const MAX_MOUNTED = 12;

interface TabActiveState {
  isActive: boolean;
}
const TabActiveContext = createContext<TabActiveState>({ isActive: true });

/**
 * Hook pages can use to short-circuit expensive background work while their
 * tab is hidden. Not required for correctness — everything keeps working
 * either way — but useful for pollers, autosave timers, etc.
 */
export function useIsTabActive(): boolean {
  return useContext(TabActiveContext).isActive;
}

/**
 * Keep-alive router outlet for the workbench shell.
 *
 * For every open workbench tab we mount its matching page element once and
 * keep it in the DOM. Switching tabs just toggles visibility, so scroll
 * position, form drafts, filters, and any local component state survive.
 *
 * The active tab is derived from the browser URL (which the WorkbenchContext
 * already keeps in sync when tabs are switched or opened).
 */
export function WorkbenchOutlet() {
  const location = useLocation();
  const { tabs, activeId } = useWorkbench();
  const activePath = location.pathname;

  // Per-path element cache. We freeze the element on first mount so subsequent
  // re-renders of this outlet never swap it, preserving the React tree.
  const cacheRef = useRef<Map<string, { element: React.ReactNode; tabId: string | null }>>(new Map());
  const [, force] = useState(0);

  // Ensure every currently open tab whose path resolves to a workbench route
  // is present in the cache.
  useEffect(() => {
    let mutated = false;
    const wantPaths = new Set<string>();
    for (const t of tabs) wantPaths.add(t.path);
    wantPaths.add(activePath);

    for (const p of wantPaths) {
      if (cacheRef.current.has(p)) continue;
      const route = findWorkbenchRoute(p);
      if (!route) continue;
      const owningTab = tabs.find((t) => t.path === p) || null;
      cacheRef.current.set(p, { element: route.element, tabId: owningTab?.id ?? null });
      mutated = true;
    }

    // Evict entries whose tab was closed (keep the currently active path
    // even if no tab tracks it yet — will be adopted momentarily).
    for (const p of Array.from(cacheRef.current.keys())) {
      if (p === activePath) continue;
      const stillOpen = tabs.some((t) => t.path === p);
      if (!stillOpen) {
        cacheRef.current.delete(p);
        mutated = true;
      }
    }

    // Enforce max-mounted cap: drop oldest non-active entries first.
    if (cacheRef.current.size > MAX_MOUNTED) {
      const drop = cacheRef.current.size - MAX_MOUNTED;
      let dropped = 0;
      for (const p of Array.from(cacheRef.current.keys())) {
        if (dropped >= drop) break;
        if (p === activePath) continue;
        cacheRef.current.delete(p);
        dropped++;
        mutated = true;
      }
    }

    if (mutated) force((n) => n + 1);
  }, [tabs, activePath, activeId]);

  // If the active path isn't a workbench route, render nothing — the outer
  // <Routes> in App.tsx will have already picked a different element.
  const hasActive = !!findWorkbenchRoute(activePath);
  if (!hasActive && cacheRef.current.size === 0) return null;

  const entries = Array.from(cacheRef.current.entries());
  return (
    <>
      {entries.map(([path, entry]) => {
        const isActive = path === activePath;
        return (
          <div
            key={path}
            hidden={!isActive}
            aria-hidden={!isActive}
            style={isActive ? undefined : { display: "none" }}
          >
            <TabActiveContext.Provider value={{ isActive }}>
              {entry.element}
            </TabActiveContext.Provider>
          </div>
        );
      })}
    </>
  );
}

export default WorkbenchOutlet;
