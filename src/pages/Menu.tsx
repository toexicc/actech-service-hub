import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import DashboardLayout from "@/components/DashboardLayout";
import {
  MessageSquare,
  Wrench,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Package,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";

interface DashboardStats {
  pendingInquiries: number;
  ongoingServices: number;
  overdueServices: number;
  completedServices: number;
}

const Menu = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    pendingInquiries: 0,
    ongoingServices: 0,
    overdueServices: 0,
    completedServices: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const userFullName = sessionStorage.getItem("userFullName") || "User";
  const userRole = sessionStorage.getItem("userRole");

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
    fetchDashboardStats();
  }, [navigate]);

  const fetchDashboardStats = async () => {
    try {
      // Fetch services data
      const servicesResponse = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=getAllOngoingServices`
      );
      const servicesData = await servicesResponse.json();

      if (servicesData.status === "success" && servicesData.services) {
        const services = servicesData.services;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const ongoing = services.filter((s: any) => {
          const status = s.status?.toLowerCase() || "";
          return !status.includes("completed") && !status.includes("cancelled");
        }).length;

        const overdue = services.filter((s: any) => {
          const status = s.status?.toLowerCase() || "";
          if (status.includes("completed") || status.includes("cancelled")) return false;
          if (!s.targetDate) return false;
          const parts = s.targetDate.split(/[-/]/);
          if (parts.length !== 3) return false;
          const [month, day, year] = parts;
          const target = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          return today > target;
        }).length;

        const completed = services.filter((s: any) => {
          const status = s.status?.toLowerCase() || "";
          return status.includes("completed");
        }).length;

        setStats((prev) => ({
          ...prev,
          ongoingServices: ongoing,
          overdueServices: overdue,
          completedServices: completed,
        }));
      }

      // Fetch inquiries count
      try {
        const inquiryResponse = await fetch(
          `${GOOGLE_SHEETS_SCRIPT_URL}?action=getInquiries`
        );
        const inquiryData = await inquiryResponse.json();
        if (inquiryData.status === "success" && inquiryData.data) {
          setStats((prev) => ({
            ...prev,
            pendingInquiries: inquiryData.data.length,
          }));
        }
      } catch (error) {
        console.error("Error fetching inquiries:", error);
      }
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    {
      title: "Pending Inquiries",
      value: stats.pendingInquiries,
      icon: MessageSquare,
      color: "text-info",
      bgColor: "bg-info/10",
      onClick: () => navigate("/client-inquiry"),
    },
    {
      title: "Ongoing Services",
      value: stats.ongoingServices,
      icon: Wrench,
      color: "text-primary",
      bgColor: "bg-primary/10",
      onClick: () => navigate("/service-tracker"),
    },
    {
      title: "Overdue Services",
      value: stats.overdueServices,
      icon: AlertTriangle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      onClick: () => navigate("/service-tracker"),
    },
    {
      title: "Completed Services",
      value: stats.completedServices,
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/10",
      onClick: () => navigate("/service-tracker"),
    },
  ];

  const quickActions = [
    {
      title: "New Client Intake",
      description: "Create a new service request",
      icon: MessageSquare,
      path: "/service-form",
    },
    {
      title: "Service Tracker",
      description: "Monitor all ongoing services",
      icon: Clock,
      path: "/service-tracker",
    },
    {
      title: "Manage Clients",
      description: "View and update client info",
      icon: TrendingUp,
      path: "/manage-client",
    },
  ];

  if (userRole === "management") {
    quickActions.push(
      {
        title: "Inventory",
        description: "Track parts & materials",
        icon: Package,
        path: "/inventory-management",
      },
      {
        title: "Transactions",
        description: "View financial reports",
        icon: DollarSign,
        path: "/transaction-tracker",
      }
    );
  }

  return (
    <DashboardLayout portalType="admin">
      <div className="p-6 lg:p-8 animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm text-muted-foreground mb-1">
            Today is {format(new Date(), "MMMM d, yyyy")} | {format(new Date(), "hh:mm:ss a")}
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            Hello, {userFullName}!
          </h1>
          <p className="text-muted-foreground capitalize">Role: {userRole}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat, index) => (
            <Card
              key={index}
              className="stat-card cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
              onClick={stat.onClick}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className={`text-3xl font-bold ${stat.color}`}>
                      {isLoading ? "..." : stat.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => navigate(action.path)}
                  className="flex flex-col items-center p-4 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all duration-200 group"
                >
                  <div className="p-3 rounded-xl bg-primary/10 mb-3 group-hover:bg-primary/20 transition-colors">
                    <action.icon className="h-6 w-6 text-primary" />
                  </div>
                  <span className="font-medium text-sm text-foreground">{action.title}</span>
                  <span className="text-xs text-muted-foreground text-center mt-1">
                    {action.description}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Summary Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-warning" />
                Summary of Services (Due Today)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Click on Service Tracker to view detailed service information.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Summary of Services (Overdue)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                {stats.overdueServices} services are currently overdue.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          Powered by Stack&Scale
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Menu;
