import { useRef, createContext, useContext } from "react";
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
 * tab is hidden. Not required for correctness — useful for pollers/timers.
 */
export function useIsTabActive(): boolean {
  return useContext(TabActiveContext).isActive;
}

/**
 * Keep-alive router outlet for the workbench shell.
 *
 * Every open tab's matching page element is mounted once and kept in the DOM.
 * Switching tabs just toggles visibility — scroll, form drafts, filters, and
 * any local component state survive.
 */
export function WorkbenchOutlet() {
  const location = useLocation();
  const { tabs } = useWorkbench();
  // Include the query string: record pages (e.g. /manage-client?serviceId=X)
  // are distinct instances. Keying by pathname alone made two different
  // tickets share one mounted tree, mixing their data.
  const activePath = location.pathname + location.search;

  // Per-URL element cache. Freeze element on first insert so re-renders of
  // this outlet never swap it, preserving the mounted React tree.
  const cacheRef = useRef<Map<string, React.ReactNode>>(new Map());

  // Ensure the active path has an element mounted (adds a tab entry lazily).
  const activeRoute = findWorkbenchRoute(location.pathname);
  if (activeRoute && !cacheRef.current.has(activePath)) {
    cacheRef.current.set(activePath, activeRoute.element);
  }

  // Ensure each open tab whose path is a workbench route has an entry.
  for (const t of tabs) {
    if (cacheRef.current.has(t.path)) continue;
    const r = findWorkbenchRoute(t.path.split("?")[0]);
    if (r) cacheRef.current.set(t.path, r.element);
  }

  // Evict entries whose tab was closed (keep the active path regardless).
  for (const p of Array.from(cacheRef.current.keys())) {
    if (p === activePath) continue;
    const stillOpen = tabs.some((tab) => tab.path === p);
    if (!stillOpen) cacheRef.current.delete(p);
  }

  // Enforce mount cap.
  if (cacheRef.current.size > MAX_MOUNTED) {
    const drop = cacheRef.current.size - MAX_MOUNTED;
    let dropped = 0;
    for (const p of Array.from(cacheRef.current.keys())) {
      if (dropped >= drop) break;
      if (p === activePath) continue;
      cacheRef.current.delete(p);
      dropped++;
    }
  }

  if (cacheRef.current.size === 0) return null;

  const entries = Array.from(cacheRef.current.entries());
  return (
    <>
      {entries.map(([path, element]) => {
        const isActive = path === activePath;
        return (
          <div
            key={path}
            aria-hidden={!isActive}
            style={isActive ? undefined : { display: "none" }}
          >
            <TabActiveContext.Provider value={{ isActive }}>
              {element}
            </TabActiveContext.Provider>
          </div>
        );
      })}
    </>
  );
}

export default WorkbenchOutlet;
