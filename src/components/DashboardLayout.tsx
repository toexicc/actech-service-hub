import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Home,
  FileText,
  Users,
  Settings,
  ClipboardList,
  Package,
  DollarSign,
  UserCog,
  LayoutDashboard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Wrench,
  MessageSquare,
  Monitor,
  Menu,
} from "lucide-react";
import acTechLogo from "@/assets/ac-tech-logo.jpg";
import { useIsMobile } from "@/hooks/use-mobile";
import NotificationDropdown from "@/components/NotificationDropdown";
import MessagingPanel from "@/components/MessagingPanel";

interface NavItem {
  title: string;
  icon: React.ElementType;
  path: string;
  roles?: string[];
}

interface NavSection {
  title: string;
  icon: React.ElementType;
  items: NavItem[];
  roles?: string[];
}

const adminSection: NavSection = {
  title: "Admin Portal",
  icon: LayoutDashboard,
  items: [
    { title: "Client Inquiry", icon: MessageSquare, path: "/client-inquiry" },
    { title: "Client Intake Form", icon: FileText, path: "/service-form" },
    { title: "Manage Client", icon: Users, path: "/manage-client" },
    { title: "Customer Management", icon: UserCog, path: "/customer-management" },
    { title: "Service Tracker", icon: ClipboardList, path: "/service-tracker" },
    { title: "Inventory Management", icon: Package, path: "/inventory-management", roles: ["management"] },
    { title: "Transaction Tracker", icon: DollarSign, path: "/transaction-tracker", roles: ["management"] },
    { title: "Staff Management", icon: Settings, path: "/staff-management", roles: ["management"] },
    { title: "Admin Dashboard", icon: LayoutDashboard, path: "/admin-dashboard", roles: ["management"] },
  ],
  roles: ["admin", "management"],
};

const techSection: NavSection = {
  title: "Technician Portal",
  icon: Wrench,
  items: [
    { title: "Service Update", icon: Wrench, path: "/service-update" },
    { title: "Service Tracking", icon: ClipboardList, path: "/service-tracking" },
    { title: "Tech Dashboard", icon: Monitor, path: "/tech-dashboard", roles: ["management"] },
  ],
  roles: ["technician", "management"],
};

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(true);
  const [techOpen, setTechOpen] = useState(true);
  const userRole = sessionStorage.getItem("userRole");
  const userFullName = sessionStorage.getItem("userFullName") || "User";

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
  }, [navigate]);

  // Auto-open section based on current path
  useEffect(() => {
    const isAdminPath = adminSection.items.some(item => location.pathname === item.path);
    const isTechPath = techSection.items.some(item => location.pathname === item.path);
    
    if (isAdminPath) setAdminOpen(true);
    if (isTechPath) setTechOpen(true);
  }, [location.pathname]);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/");
  };

  const canViewSection = (section: NavSection) => {
    if (!section.roles) return true;
    return section.roles.includes(userRole || "");
  };

  const canViewItem = (item: NavItem) => {
    if (!item.roles) return true;
    return item.roles.includes(userRole || "");
  };

  const renderNavSection = (
    section: NavSection,
    isOpen: boolean,
    setIsOpen: (open: boolean) => void
  ) => {
    if (!canViewSection(section)) return null;

    const filteredItems = section.items.filter(canViewItem);
    if (filteredItems.length === 0) return null;

    const hasActiveItem = filteredItems.some(item => location.pathname === item.path);

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
              hasActiveItem
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              !isMobile && collapsed && "justify-center px-2"
            )}
          >
            <section.icon className="h-5 w-5 shrink-0" />
            {(isMobile || !collapsed) && (
              <>
                <span className="flex-1 text-left truncate">{section.title}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </>
            )}
          </button>
        </CollapsibleTrigger>
        {(isMobile || !collapsed) && (
          <CollapsibleContent className="pl-4 mt-1 space-y-1">
            {filteredItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0")} />
                  <span className="truncate">{item.title}</span>
                </button>
              );
            })}
          </CollapsibleContent>
        )}
      </Collapsible>
    );
  };

  const SidebarContent = () => (
    <>
      {/* Logo Section */}
      <div className="flex h-20 items-center justify-between px-4 border-b border-sidebar-border">
        <div className={cn("flex items-center gap-3", !isMobile && collapsed && "justify-center w-full")}>
          <img
            src={acTechLogo}
            alt="AC Tech"
            className="h-10 w-10 rounded-lg object-cover"
          />
          {(isMobile || !collapsed) && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-sidebar-foreground">AC Tech Repair</span>
              <span className="text-xs text-sidebar-foreground/60">Service Portal</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-180px)]">
        {/* Home */}
        <button
          onClick={() => navigate("/menu")}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200",
            location.pathname === "/menu"
              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            !isMobile && collapsed && "justify-center px-2"
          )}
        >
          <Home className="h-5 w-5 shrink-0" />
          {(isMobile || !collapsed) && <span className="truncate">Home</span>}
        </button>

        {/* Admin Portal Section */}
        {renderNavSection(adminSection, adminOpen, setAdminOpen)}

        {/* Technician Portal Section */}
        {renderNavSection(techSection, techOpen, setTechOpen)}
      </nav>

      {/* User Section & Logout */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border bg-sidebar">
        {(isMobile || !collapsed) && (
          <div className="mb-3 px-2">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{userFullName}</p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">{userRole}</p>
          </div>
        )}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10",
            !isMobile && collapsed && "justify-center px-2"
          )}
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          {(isMobile || !collapsed) && <span className="ml-3">Logout</span>}
        </Button>
      </div>
    </>
  );

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen w-full bg-background">
        {/* Mobile Header */}
        <header className="sticky top-0 z-50 flex h-14 items-center justify-between px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
            <img
              src={acTechLogo}
              alt="AC Tech"
              className="h-8 w-8 rounded-lg object-cover"
            />
            <span className="text-sm font-bold">AC Tech</span>
          </div>

          <div className="flex items-center gap-1">
            <NotificationDropdown />
            <MessagingPanel />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 ease-in-out border-r border-sidebar-border",
          collapsed ? "w-20" : "w-64"
        )}
      >
        <SidebarContent />

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-24 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300 ease-in-out min-h-screen",
          collapsed ? "ml-20" : "ml-64"
        )}
      >
        {/* Desktop Header with Notifications */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-end gap-2 px-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <NotificationDropdown />
          <MessagingPanel />
        </header>
        <div className="p-0">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
