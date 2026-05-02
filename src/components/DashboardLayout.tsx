import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Home, FileText, Users, Settings, ClipboardList, Package, DollarSign, UserCog,
  LayoutDashboard, LogOut, ChevronLeft, ChevronRight, ChevronDown, Wrench,
  MessageSquare, Monitor, Menu, ShoppingCart, Loader2,
} from "lucide-react";
import acTechLogo from "@/assets/S_S_Marketing-2.png";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { MessagingPanel, MessagingPanelRef } from "@/components/MessagingPanel";
import { logAuthActivity } from "@/lib/activityLogger";
interface NavItem { title: string; icon: React.ElementType; path: string; roles?: string[]; }
interface NavSection { title: string; icon: React.ElementType; items: NavItem[]; roles?: string[]; }

const adminSection: NavSection = {
  title: "Admin Portal", icon: LayoutDashboard,
  items: [
    { title: "Point of Sales", icon: ShoppingCart, path: "/pos", roles: ["management", "admin"] },
    { title: "Client Intake Form", icon: FileText, path: "/service-form" },
    { title: "Manage Client", icon: Users, path: "/manage-client" },
    { title: "Customer Management", icon: UserCog, path: "/customer-management" },
    { title: "Service Tracker", icon: ClipboardList, path: "/service-tracker" },
    { title: "Inventory Management", icon: Package, path: "/inventory-management", roles: ["management", "admin"] },
    { title: "Completed Transactions", icon: DollarSign, path: "/completed-transactions", roles: ["management"] },
    { title: "Transaction Tracker", icon: DollarSign, path: "/transaction-tracker", roles: ["management", "admin"] },
    { title: "Salary Disbursement", icon: DollarSign, path: "/salary-disbursement", roles: ["management"] },
    { title: "Staff Management", icon: Settings, path: "/staff-management", roles: ["management"] },
    { title: "Admin Dashboard", icon: LayoutDashboard, path: "/admin-dashboard", roles: ["management"] },
  ],
  roles: ["admin", "management"],
};

const techSection: NavSection = {
  title: "Technician Portal", icon: Wrench,
  items: [
    { title: "Service Update", icon: Wrench, path: "/service-update" },
    { title: "Service Tracking", icon: ClipboardList, path: "/service-tracking" },
    { title: "Tech Dashboard", icon: Monitor, path: "/tech-dashboard", roles: ["management"] },
  ],
  roles: ["technician", "management"],
};

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(true);
  const [techOpen, setTechOpen] = useState(true);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const userRole = sessionStorage.getItem("userRole");
  const userFullName = sessionStorage.getItem("userFullName") || "User";
  const userId = sessionStorage.getItem("staffId") || sessionStorage.getItem("username");
  const messagingPanelRef = useRef<MessagingPanelRef>(null);

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

  const handleLogout = () => { 
    const username = sessionStorage.getItem("username") || "Unknown";
    const role = sessionStorage.getItem("userRole") || "unknown";
    logAuthActivity(username, "User logged out", role);
    sessionStorage.clear(); 
    navigate("/"); 
  };
  const canViewSection = (s: NavSection) => !s.roles || s.roles.includes(userRole || "");
  const canViewItem = (i: NavItem) => !i.roles || i.roles.includes(userRole || "");

  const handleOpenMessaging = () => {
    messagingPanelRef.current?.openPanel();
  };

  const renderNavSection = (section: NavSection, isOpen: boolean, setIsOpen: (o: boolean) => void) => {
    if (!canViewSection(section)) return null;
    const items = section.items.filter(canViewItem);
    if (!items.length) return null;
    const hasActive = items.some((i) => location.pathname === i.path);
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all", hasActive ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50", !isMobile && collapsed && "justify-center px-2")}>
            <section.icon className="h-5 w-5 shrink-0" />
            {(isMobile || !collapsed) && <><span className="flex-1 text-left truncate">{section.title}</span><ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} /></>}
          </button>
        </CollapsibleTrigger>
        {(isMobile || !collapsed) && <CollapsibleContent className="pl-4 mt-1 space-y-1">
          {items.map((i) => <button key={i.path} onClick={() => navigate(i.path)} className={cn("w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all", location.pathname === i.path ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" : "text-sidebar-foreground/60 hover:bg-sidebar-accent")}><i.icon className="h-4 w-4 shrink-0" /><span className="truncate">{i.title}</span></button>)}
        </CollapsibleContent>}
      </Collapsible>
    );
  };

  const SidebarContent = () => (
    <>
      <div className="flex h-20 items-center px-4 border-b border-sidebar-border">
        <div className={cn("flex items-center gap-3", !isMobile && collapsed && "justify-center w-full")}>
          <div className="h-10 w-10 rounded-lg bg-card border border-border/60 shadow-sm p-1">
            <img src={acTechLogo} alt="AC Tech Repair logo" className="h-full w-full object-contain" loading="lazy" />
          </div>
          {(isMobile || !collapsed) && <div className="flex flex-col"><span className="text-sm font-bold text-sidebar-foreground">AC Tech Repair</span><span className="text-xs text-sidebar-foreground/60">Service Portal</span></div>}
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto overscroll-none" style={{ maxHeight: "calc(100vh - 180px)" }}>
        <button onClick={() => navigate("/menu")} className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all", location.pathname === "/menu" ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg" : "text-sidebar-foreground/70 hover:bg-sidebar-accent", !isMobile && collapsed && "justify-center px-2")}><Home className="h-5 w-5 shrink-0" />{(isMobile || !collapsed) && <span>Home</span>}</button>
        {renderNavSection(adminSection, adminOpen, setAdminOpen)}
        {renderNavSection(techSection, techOpen, setTechOpen)}
        {/* Request for Parts - visible to admin and technician only */}
        {(userRole === "admin" || userRole === "technician") && (
          <button onClick={() => navigate("/request-for-parts")} className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all", location.pathname === "/request-for-parts" ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg" : "text-sidebar-foreground/70 hover:bg-sidebar-accent", !isMobile && collapsed && "justify-center px-2")}><ShoppingCart className="h-5 w-5 shrink-0" />{(isMobile || !collapsed) && <span>Request for Parts</span>}</button>
        )}
      </nav>
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border bg-sidebar">
        {(isMobile || !collapsed) && <div className="mb-3 px-2"><p className="text-sm font-medium text-sidebar-foreground truncate">{userFullName}</p><p className="text-xs text-sidebar-foreground/60 capitalize">{userRole}</p></div>}
        <Button variant="ghost" className={cn("w-full justify-start text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10", !isMobile && collapsed && "justify-center px-2")} onClick={handleLogout}><LogOut className="h-5 w-5" />{(isMobile || !collapsed) && <span className="ml-3">Logout</span>}</Button>
      </div>
    </>
  );

  // Show loading spinner while checking auth
  if (!isAuthChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isMobile) return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 shrink-0 items-center justify-between px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 bg-sidebar">
            <div className="relative h-full">
              <SidebarContent />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-card border border-border/60 shadow-sm p-1">
            <img src={acTechLogo} alt="AC Tech Repair logo" className="h-full w-full object-contain" loading="lazy" />
          </div>
          <span className="text-sm font-bold">AC Tech</span>
        </div>

        <div className="flex items-center gap-1">
          <NotificationDropdown userId={userId} userRole={userRole || undefined} onOpenMessaging={handleOpenMessaging} />
          <MessagingPanel ref={messagingPanelRef} userId={userId} userName={userFullName} />
        </div>
      </header>
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain pt-14" style={{ WebkitOverflowScrolling: "touch" }}>{children}</main>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all border-r border-sidebar-border",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-24 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      <main className={cn("flex flex-col flex-1 h-screen min-w-0", collapsed ? "ml-20" : "ml-64")}>
        <header className={cn("fixed top-0 right-0 z-50 flex h-14 shrink-0 items-center justify-end gap-2 px-6 border-b bg-background/95 backdrop-blur", collapsed ? "left-20" : "left-64")}>
          <NotificationDropdown userId={userId} userRole={userRole || undefined} onOpenMessaging={handleOpenMessaging} />
          <MessagingPanel ref={messagingPanelRef} userId={userId} userName={userFullName} />
        </header>
        <div className="flex-1 min-w-0 w-full overflow-auto overscroll-contain p-0 pt-14">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
