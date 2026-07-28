import { X, Home, FileText, Users, ClipboardList, Package, ShoppingCart, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkbench } from "./WorkbenchContext";

const ICONS: Record<string, any> = {
  Home, FileText, Users, ClipboardList, Package, ShoppingCart, Wrench,
};

export function TabBar() {
  const { tabs, activeId, setActive, closeTab } = useWorkbench();
  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-none py-1 px-1">
      {tabs.map((tab) => {
        const Icon = tab.iconName ? ICONS[tab.iconName] : null;
        const active = tab.id === activeId;
        return (
          <div
            key={tab.id}
            className={cn(
              "group flex items-center gap-2 px-3 h-9 rounded-lg text-sm shrink-0 cursor-pointer transition-all border",
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
                className="ml-1 h-5 w-5 rounded flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-muted"
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
