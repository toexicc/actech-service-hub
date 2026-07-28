import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Home, FileText, Users, Settings, ClipboardList, Package, DollarSign, UserCog,
  LayoutDashboard, LogOut, ChevronLeft, ChevronRight, ChevronDown, Wrench,
  Monitor, Menu, ShoppingCart, Loader2, Clock, Search,
} from "lucide-react";
import acTechLogo from "@/assets/S_S_Marketing-2.png";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { MessagingPanel, MessagingPanelRef } from "@/components/MessagingPanel";
import { logAuthActivity } from "@/lib/activityLogger";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkbench } from "@/components/workbench/WorkbenchContext";
import { TabBar } from "@/components/workbench/TabBar";
import { CommandPalette } from "@/components/CommandPalette";

interface NavItem { title: string; icon: React.ElementType; path: string; roles?: string[]; iconName?: string; }
interface NavSection { title: string; icon: React.ElementType; items: NavItem[]; roles?: string[]; }

const adminSection: NavSection = {
  title: "Admin Portal", icon: LayoutDashboard,
  items: [
    { title: "Point of Sales", icon: ShoppingCart, path: "/pos", roles: ["management", "admin"], iconName: "ShoppingCart" },
    { title: "Client Intake Form", icon: FileText, path: "/service-form", iconName: "FileText" },
    { title: "Manage Client", icon: Users, path: "/manage-client", iconName: "Users" },
    { title: "Customer Management", icon: UserCog, path: "/customer-management", iconName: "UserCog" },
    { title: "Service Tracker", icon: ClipboardList, path: "/service-tracker", iconName: "ClipboardList" },
    { title: "Inventory Management", icon: Package, path: "/inventory-management", roles: ["management", "admin"], iconName: "Package" },
    { title: "Completed Transactions", icon: DollarSign, path: "/completed-transactions", roles: ["management"], iconName: "DollarSign" },
    { title: "Transaction Tracker", icon: DollarSign, path: "/transaction-tracker", roles: ["management"], iconName: "DollarSign" },
    { title: "Salary Disbursement", icon: DollarSign, path: "/salary-disbursement", roles: ["management"], iconName: "DollarSign" },
    { title: "Staff Management", icon: Settings, path: "/staff-management", roles: ["management"], iconName: "Settings" },
    { title: "Attendance Overview", icon: Clock, path: "/attendance-overview", roles: ["management"], iconName: "Clock" },
    { title: "Admin Dashboard", icon: LayoutDashboard, path: "/admin-dashboard", roles: ["management"], iconName: "LayoutDashboard" },
  ],
  roles: ["admin", "management"],
};

const techSection: NavSection = {
  title: "Technician Portal", icon: Wrench,
  items: [
    { title: "Service Update", icon: Wrench, path: "/service-update", iconName: "Wrench" },
    { title: "Service Tracking", icon: ClipboardList, path: "/service-tracking", iconName: "ClipboardList" },
    { title: "Tech Dashboard", icon: Monitor, path: "/tech-dashboard", roles: ["management"], iconName: "Monitor" },
  ],
  roles: ["technician", "management"],
};

function ShellInner({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(true);
  const [techOpen, setTechOpen] = useState(true);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const userRole = sessionStorage.getItem("userRole");
  const userFullName = sessionStorage.getItem("userFullName") || "User";
  const userId = sessionStorage.getItem("authUserId") || sessionStorage.getItem("staffId") || sessionStorage.getItem("username");
  const messagingPanelRef = useRef<MessagingPanelRef>(null);
  const { openTab } = useWorkbench();

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    } else {
      setIsAuthChecked(true);
    }
  }, [navigate]);

  useEffect(() => {
    if (adminSection.items.some((i) => location.pathname === i.path)) setAdminOpen(true);
    if (techSection.items.some((i) => location.pathname === i.path)) setTechOpen(true);
  }, [location.pathname]);

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  // Cmd/Ctrl+K to open palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const queryClient = useQueryClient();
  const handleLogout = () => {
    const username = sessionStorage.getItem("username") || "Unknown";
    const role = sessionStorage.getItem("userRole") || "unknown";
    try { logAuthActivity(username, "User logged out", role); } catch {}
    try { sessionStorage.clear(); } catch {}
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i) || "";
        if (k.startsWith("sb-") && k.endsWith("-auth-token")) localStorage.removeItem(k);
      }
    } catch {}
    try { queryClient.clear(); } catch {}
    setMobileMenuOpen(false);
    window.location.replace("/");
    supabase.auth.signOut({ scope: "local" }).catch(() => {});
  };

  const canViewSection = (s: NavSection) => !s.roles || s.roles.includes(userRole || "");
  const canViewItem = (i: NavItem) => !i.roles || i.roles.includes(userRole || "");

  const handleOpenMessaging = () => { messagingPanelRef.current?.openPanel(); };

  const handleNavClick = (item: NavItem) => {
    // Open as a workbench tab so users can jump between pages
    openTab({
      id: `page:${item.path}`,
      title: item.title,
      path: item.path,
      pinned: item.path === "/menu",
      iconName: item.iconName,
    });
  };

  const renderNavSection = (section: NavSection, isOpen: boolean, setIsOpen: (o: boolean) => void) => {
    if (!canViewSection(section)) return null;
    const items = section.items.filter(canViewItem);
    if (!items.length) return null;
    const hasActive = items.some((i) => location.pathname === i.path);
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all",
            hasActive ? "text-primary" : "text-sidebar-foreground/50 hover:text-sidebar-foreground",
            !isMobile && collapsed && "justify-center px-2",
          )}>
            <section.icon className="h-4 w-4 shrink-0" />
            {(isMobile || !collapsed) && (
              <>
                <span className="flex-1 text-left truncate">{section.title}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
              </>
            )}
          </button>
        </CollapsibleTrigger>
        {(isMobile || !collapsed) && (
          <CollapsibleContent className="pl-2 mt-1 space-y-0.5">
            {items.map((i) => {
              const active = location.pathname === i.path;
              return (
                <button
                  key={i.path}
                  onClick={() => handleNavClick(i)}
                  className={cn("nav-item w-full", active && "nav-item-active")}
                >
                  <i.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{i.title}</span>
                </button>
              );
            })}
          </CollapsibleContent>
        )}
      </Collapsible>
    );
  };

  const sidebarContent = (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-4">
        <div className={cn("flex items-center gap-3", !isMobile && collapsed && "justify-center w-full")}>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary-glow shadow-soft p-1.5 flex items-center justify-center">
            <img src={acTechLogo} alt="AC Tech Repair" className="h-full w-full object-contain" loading="lazy" />
          </div>
          {(isMobile || !collapsed) && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-sidebar-foreground tracking-tight">AC Tech Repair</span>
              <span className="text-[11px] text-sidebar-foreground/60">Service Portal</span>
            </div>
          )}
        </div>
      </div>
      <nav className="flex-1 min-h-0 px-3 space-y-3 overflow-y-auto overscroll-contain pb-4" style={{ WebkitOverflowScrolling: "touch" }}>
        <button
          onClick={() => handleNavClick({ title: "Dashboard", icon: Home, path: "/menu", iconName: "Home" })}
          className={cn("nav-item w-full", location.pathname === "/menu" && "nav-item-active", !isMobile && collapsed && "justify-center px-2")}
        >
          <Home className="h-4 w-4 shrink-0" />
          {(isMobile || !collapsed) && <span>Dashboard</span>}
        </button>
        {renderNavSection(adminSection, adminOpen, setAdminOpen)}
        {renderNavSection(techSection, techOpen, setTechOpen)}
        {(userRole === "admin" || userRole === "technician") && (
          <button
            onClick={() => handleNavClick({ title: "Request for Parts", icon: ShoppingCart, path: "/request-for-parts", iconName: "ShoppingCart" })}
            className={cn("nav-item w-full", location.pathname === "/request-for-parts" && "nav-item-active", !isMobile && collapsed && "justify-center px-2")}
          >
            <ShoppingCart className="h-4 w-4 shrink-0" />
            {(isMobile || !collapsed) && <span>Request for Parts</span>}
          </button>
        )}
      </nav>
      <div className="shrink-0 p-3 mt-auto">
        {(isMobile || !collapsed) && (
          <div className="mb-2 px-3 py-2.5 rounded-xl bg-sidebar-accent/60">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{userFullName}</p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">{userRole}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-start text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10",
            !isMobile && collapsed && "justify-center px-2",
          )}
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          {(isMobile || !collapsed) && <span className="ml-2">Logout</span>}
        </Button>
      </div>
    </div>
  );

  const searchTrigger = (
    <button
      onClick={() => setPaletteOpen(true)}
      className="hidden md:flex items-center gap-2 h-9 pl-3 pr-2 rounded-full glass-panel text-sm text-muted-foreground hover:text-foreground transition-colors min-w-[240px]"
    >
      <Search className="h-4 w-4" />
      <span className="flex-1 text-left">Search anything...</span>
      <span className="kbd">⌘K</span>
    </button>
  );

  const searchTriggerMobile = (
    <button
      onClick={() => setPaletteOpen(true)}
      className="md:hidden h-9 w-9 rounded-full glass-panel flex items-center justify-center text-muted-foreground"
      aria-label="Search"
    >
      <Search className="h-4 w-4" />
    </button>
  );

  if (!isAuthChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isMobile) return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 shrink-0 items-center justify-between px-3 gap-2">
        <div className="flex items-center gap-2">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="glass-panel rounded-full h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 glass-sidebar border-r-0">
              <div className="relative h-full">{sidebarContent}</div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 glass-panel rounded-full h-9 px-3">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-primary to-primary-glow p-0.5">
              <img src={acTechLogo} alt="AC Tech" className="h-full w-full object-contain" loading="lazy" />
            </div>
            <span className="text-xs font-bold">AC Tech</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {searchTriggerMobile}
          <div className="glass-panel rounded-full flex items-center">
            <NotificationDropdown userId={userId} userRole={userRole || undefined} onOpenMessaging={handleOpenMessaging} />
            <MessagingPanel ref={messagingPanelRef} userId={userId} userName={userFullName} />
          </div>
        </div>
      </header>
      <div className="fixed top-14 left-0 right-0 z-40 glass-panel rounded-none border-x-0 border-t-0">
        <div className="px-2"><TabBar /></div>
      </div>
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain pt-[104px]" style={{ WebkitOverflowScrolling: "touch" }}>
        {children}
      </main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <aside
        className={cn(
          "fixed left-3 top-3 bottom-3 z-40 glass-sidebar rounded-2xl transition-all",
          collapsed ? "w-[68px]" : "w-64",
        )}
      >
        {sidebarContent}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 z-10"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>

      <main className={cn("flex flex-col flex-1 h-screen min-w-0 transition-all", collapsed ? "ml-[88px]" : "ml-[280px]")}>
        <header className={cn(
          "fixed top-3 right-3 z-40 flex h-14 items-center justify-between gap-3 pl-3 pr-2 glass-panel rounded-2xl",
          collapsed ? "left-[88px]" : "left-[280px]",
        )}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <TabBar />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {searchTrigger}
            <div className="glass-panel rounded-full flex items-center">
              <NotificationDropdown userId={userId} userRole={userRole || undefined} onOpenMessaging={handleOpenMessaging} />
              <MessagingPanel ref={messagingPanelRef} userId={userId} userName={userFullName} />
            </div>
          </div>
        </header>
        <div className="flex-1 min-w-0 w-full overflow-auto overscroll-contain pt-[76px] px-3 pb-3">
          <div className="min-h-full">{children}</div>
        </div>
      </main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

const DashboardLayout = ({ children }: { children: React.ReactNode }) => (
  <ShellInner>{children}</ShellInner>
);

export default DashboardLayout;
