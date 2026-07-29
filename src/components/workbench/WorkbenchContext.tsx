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

const canonicalizeTab = (tab: WorkbenchTab): WorkbenchTab => {
  if (tab.path === "/menu" || tab.id === "page:/menu") {
    return HOME_TAB;
  }
  return tab;
};

function normalizeTabs(inputTabs: WorkbenchTab[], inputActiveId: string | null): { tabs: WorkbenchTab[]; activeId: string | null } {
  const tabs: WorkbenchTab[] = [];
  const seenPaths = new Set<string>();
  const idMap = new Map<string, string>();

  for (const rawTab of [HOME_TAB, ...inputTabs]) {
    const tab = canonicalizeTab(rawTab);
    const existing = tabs.find((t) => t.path === tab.path);
    if (existing) {
      idMap.set(rawTab.id, existing.id);
      continue;
    }
    if (seenPaths.has(tab.path)) continue;
    seenPaths.add(tab.path);
    idMap.set(rawTab.id, tab.id);
    tabs.push(tab);
  }

  const activeId = idMap.get(inputActiveId || "") || inputActiveId || "home";
  return { tabs, activeId: tabs.some((t) => t.id === activeId) ? activeId : "home" };
}

function load(): { tabs: WorkbenchTab[]; activeId: string | null } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.tabs)) {
        return normalizeTabs(parsed.tabs, parsed.activeId ?? "home");
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
      const normalized = normalizeTabs(tabs, activeId);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch {}
  }, [tabs, activeId]);

  useEffect(() => {
    const normalized = normalizeTabs(tabs, activeId);
    const changed = normalized.activeId !== activeId ||
      normalized.tabs.length !== tabs.length ||
      normalized.tabs.some((tab, index) => tab.id !== tabs[index]?.id || tab.path !== tabs[index]?.path);
    if (changed) {
      setTabs(normalized.tabs);
      setActiveId(normalized.activeId);
    }
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
    const nextTab = canonicalizeTab(tab);
    let resolvedId = nextTab.id;
    setTabs((prev) => {
      // Prefer matching by id
      let idx = prev.findIndex((t) => t.id === nextTab.id);
      // Fall back to matching by path so different call sites can't create duplicates
      if (idx < 0 && nextTab.path) {
        idx = prev.findIndex((t) => t.path === nextTab.path);
      }
      if (idx >= 0) {
        resolvedId = prev[idx].id;
        const next = [...prev];
        next[idx] = { ...prev[idx], ...nextTab, id: prev[idx].id };
        return next;
      }
      return [...prev, nextTab];
    });
    setActiveId(resolvedId);
    if (nextTab.path && nextTab.path !== location.pathname + location.search) navigate(nextTab.path);
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
