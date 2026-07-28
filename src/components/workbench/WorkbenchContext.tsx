import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export interface WorkbenchTab {
  id: string;
  title: string;
  subtitle?: string;
  path: string;
  pinned?: boolean;
  iconName?: string; // lucide icon name (optional, resolved by TabBar)
}

interface WorkbenchState {
  tabs: WorkbenchTab[];
  activeId: string | null;
  openTab: (tab: WorkbenchTab) => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
}

const WorkbenchCtx = createContext<WorkbenchState | null>(null);

const STORAGE_KEY = "actech-workbench-tabs-v1";

const HOME_TAB: WorkbenchTab = { id: "home", title: "Dashboard", path: "/menu", pinned: true, iconName: "Home" };

function load(): { tabs: WorkbenchTab[]; activeId: string | null } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.tabs)) {
        const hasHome = parsed.tabs.some((t: WorkbenchTab) => t.id === "home");
        const tabs = hasHome ? parsed.tabs : [HOME_TAB, ...parsed.tabs];
        return { tabs, activeId: parsed.activeId ?? "home" };
      }
    }
  } catch {}
  return { tabs: [HOME_TAB], activeId: "home" };
}

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(load, []);
  const [tabs, setTabs] = useState<WorkbenchTab[]>(initial.tabs);
  const [activeId, setActiveId] = useState<string | null>(initial.activeId);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeId }));
    } catch {}
  }, [tabs, activeId]);

  // Sync active tab with the current path (for path-only tabs like /menu)
  useEffect(() => {
    const match = tabs.find((t) => t.path === location.pathname + location.search) ||
                  tabs.find((t) => t.path === location.pathname);
    if (match && match.id !== activeId) {
      setActiveId(match.id);
    }
  }, [location.pathname, location.search, tabs, activeId]);

  const openTab = useCallback((tab: WorkbenchTab) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tab.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...prev[idx], ...tab };
        return next;
      }
      return [...prev, tab];
    });
    setActiveId(tab.id);
    if (tab.path && tab.path !== location.pathname + location.search) navigate(tab.path);
  }, [navigate, location.pathname, location.search]);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx < 0) return prev;
      if (prev[idx].pinned) return prev;
      const next = prev.filter((t) => t.id !== id);
      if (activeId === id) {
        const fallback = next[Math.max(0, idx - 1)] || next[0];
        if (fallback) {
          setActiveId(fallback.id);
          navigate(fallback.path);
        }
      }
      return next;
    });
  }, [activeId, navigate]);

  const setActive = useCallback((id: string) => {
    const t = tabs.find((x) => x.id === id);
    if (!t) return;
    setActiveId(id);
    if (t.path !== location.pathname + location.search) navigate(t.path);
  }, [tabs, navigate, location.pathname, location.search]);

  const value = useMemo(() => ({ tabs, activeId, openTab, closeTab, setActive }), [tabs, activeId, openTab, closeTab, setActive]);
  return <WorkbenchCtx.Provider value={value}>{children}</WorkbenchCtx.Provider>;
}

export function useWorkbench() {
  const ctx = useContext(WorkbenchCtx);
  if (!ctx) throw new Error("useWorkbench must be used inside WorkbenchProvider");
  return ctx;
}
