import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  Wrench,
  MessageSquare,
} from "lucide-react";
import acTechLogo from "@/assets/ac-tech-logo.jpg";

interface NavItem {
  title: string;
  icon: React.ElementType;
  path: string;
  roles?: string[];
}

const adminNavItems: NavItem[] = [
  { title: "Dashboard", icon: Home, path: "/menu" },
  { title: "Client Inquiry", icon: MessageSquare, path: "/client-inquiry" },
  { title: "Client Intake Form", icon: FileText, path: "/service-form" },
  { title: "Manage Client", icon: Users, path: "/manage-client" },
  { title: "Customer Management", icon: UserCog, path: "/customer-management" },
  { title: "Service Tracker", icon: ClipboardList, path: "/service-tracker" },
  { title: "Inventory Management", icon: Package, path: "/inventory-management", roles: ["management"] },
  { title: "Transaction Tracker", icon: DollarSign, path: "/transaction-tracker", roles: ["management"] },
  { title: "Staff Management", icon: Settings, path: "/staff-management", roles: ["management"] },
  { title: "Admin Dashboard", icon: LayoutDashboard, path: "/admin-dashboard", roles: ["management"] },
];

const techNavItems: NavItem[] = [
  { title: "Dashboard", icon: Home, path: "/technician-portal" },
  { title: "Service Update", icon: Wrench, path: "/service-update" },
  { title: "Service Tracker", icon: ClipboardList, path: "/service-tracker" },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
  portalType?: "admin" | "technician";
}

const DashboardLayout = ({ children, portalType = "admin" }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const userRole = sessionStorage.getItem("userRole");
  const userFullName = sessionStorage.getItem("userFullName") || "User";

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/");
  };

  const navItems = portalType === "technician" ? techNavItems : adminNavItems;

  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(userRole || "");
  });

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 ease-in-out border-r border-sidebar-border",
          collapsed ? "w-20" : "w-64"
        )}
      >
        {/* Logo Section */}
        <div className="flex h-20 items-center justify-between px-4 border-b border-sidebar-border">
          <div className={cn("flex items-center gap-3", collapsed && "justify-center w-full")}>
            <img
              src={acTechLogo}
              alt="AC Tech"
              className="h-10 w-10 rounded-lg object-cover"
            />
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-bold text-sidebar-foreground">AC Tech Repair</span>
                <span className="text-xs text-sidebar-foreground/60">Service Portal</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  collapsed && "justify-center px-2"
                )}
              >
                <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-sidebar-primary-foreground")} />
                {!collapsed && <span className="truncate">{item.title}</span>}
              </button>
            );
          })}
        </nav>

        {/* User Section & Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border bg-sidebar">
          {!collapsed && (
            <div className="mb-3 px-2">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{userFullName}</p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">{userRole}</p>
            </div>
          )}
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10",
              collapsed && "justify-center px-2"
            )}
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span className="ml-3">Logout</span>}
          </Button>
        </div>

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
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
