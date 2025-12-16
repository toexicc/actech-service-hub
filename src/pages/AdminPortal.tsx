import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import {
  MessageSquare,
  FileText,
  Users,
  UserCog,
  ClipboardList,
  Package,
  DollarSign,
  Settings,
  LayoutDashboard,
} from "lucide-react";

const AdminPortal = () => {
  const navigate = useNavigate();
  const userRole = sessionStorage.getItem("userRole");

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
    if (userRole === "technician") {
      navigate("/technician-portal");
    }
  }, [navigate, userRole]);

  const adminSections = [
    {
      title: "Client Inquiry",
      description: "View & Manage Client Inquiries",
      icon: MessageSquare,
      path: "/client-inquiry",
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "Client Intake Form",
      description: "Frontdesk Form",
      icon: FileText,
      path: "/service-form",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Manage Client",
      description: "Client Information View/Update",
      icon: Users,
      path: "/manage-client",
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Customer Management",
      description: "View Customer Service History",
      icon: UserCog,
      path: "/customer-management",
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Service Tracker",
      description: "Monitor All Ongoing Services",
      icon: ClipboardList,
      path: "/service-tracker",
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
  ];

  const managementSections = [
    {
      title: "Transaction Tracker",
      description: "View Financial Reports",
      icon: DollarSign,
      path: "/transaction-tracker",
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Inventory Management",
      description: "Track Parts & Materials",
      icon: Package,
      path: "/inventory-management",
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Staff Management",
      description: "Manage Staff & Roles",
      icon: Settings,
      path: "/staff-management",
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      title: "Admin Dashboard",
      description: "View Services by Status",
      icon: LayoutDashboard,
      path: "/admin-dashboard",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ];

  const renderCard = (section: typeof adminSections[0]) => (
    <Card
      key={section.path}
      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 border-border/50"
      onClick={() => navigate(section.path)}
    >
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${section.bgColor}`}>
            <section.icon className={`h-6 w-6 ${section.color}`} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground mb-1">{section.title}</h3>
            <p className="text-sm text-muted-foreground">{section.description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Admin Portal</h1>
          <p className="text-muted-foreground">Select a section to manage</p>
        </div>

        <div className="space-y-8">
          {/* Main Admin Sections */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Main Sections</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminSections.map(renderCard)}
            </div>
          </div>

          {/* Management Only Sections */}
          {userRole === "management" && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Management Tools</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {managementSections.map(renderCard)}
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-8 text-sm text-muted-foreground">
          Powered by Stack&Scale
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminPortal;
