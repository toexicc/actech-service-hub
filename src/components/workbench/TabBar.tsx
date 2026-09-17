import { X, Home, FileText, Users, ClipboardList, Package, ShoppingCart, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkbench } from "./WorkbenchContext";

const ICONS: Record<string, any> = {
  Home, FileText, Users, ClipboardList, Package, ShoppingCart, Wrench,
};

export function TabBar() {
  const { tabs, activeId, setActive, closeTab } = useWorkbench();
  if (tabs.length === 0) return null;

  const visibleTabs = tabs.filter((tab, index, all) => (
    all.findIndex((candidate) => candidate.path === tab.path) === index
  ));

  return (
    <div className="flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-none py-1 px-1 overscroll-x-contain">
      {visibleTabs.map((tab) => {
        const Icon = tab.iconName ? ICONS[tab.iconName] : null;
        const active = tab.id === activeId;
        return (
          <div
            key={tab.id}
            className={cn(
               "group flex items-center gap-2 px-3 h-10 sm:h-9 rounded-lg text-sm shrink-0 cursor-pointer transition-all border active:scale-[0.98]",
              active
                ? "bg-card border-border shadow-soft text-foreground font-medium"
                : "bg-transparent border-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground",
            )}
            onClick={() => setActive(tab.id)}
          >
            {Icon && <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "")} />}
            <span className="truncate max-w-[180px]">{tab.title}</span>
            {tab.subtitle && (
              <span className="hidden sm:inline text-xs text-muted-foreground/80 truncate max-w-[120px]">
                · {tab.subtitle}
              </span>
            )}
            {!tab.pinned && (
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className="ml-1 flex h-7 w-7 items-center justify-center rounded opacity-60 hover:bg-muted hover:opacity-100 sm:h-5 sm:w-5"
                aria-label="Close tab"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default TabBar;
