import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  ExternalLink,
  Calendar,
  ClipboardList,
  Monitor,
} from "lucide-react";
import { format, isSameDay, isBefore, startOfDay } from "date-fns";

interface DashboardStats {
  pendingInquiries: number;
  ongoingServices: number;
  overdueServices: number;
  completedServices: number;
}

interface ServiceRecord {
  serviceId: string;
  clientName: string;
  status: string;
  targetDate: string;
  technician: string;
  deviceType: string;
}

const Menu = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    pendingInquiries: 0,
    ongoingServices: 0,
    overdueServices: 0,
    completedServices: 0,
  });
  const [servicesDueToday, setServicesDueToday] = useState<ServiceRecord[]>([]);
  const [servicesOverdue, setServicesOverdue] = useState<ServiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const userFullName = sessionStorage.getItem("userFullName") || "User";
  const userRole = sessionStorage.getItem("userRole");

  const isTechnician = userRole === "technician";

  // Dynamic clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
        let services = servicesData.services;
        const today = startOfDay(new Date());

        // For technicians, filter to only show their assigned services
        if (isTechnician) {
          services = services.filter((s: any) => s.technician === userFullName);
        }

        const ongoing = services.filter((s: any) => {
          const status = s.status?.toLowerCase() || "";
          return !status.includes("completed") && !status.includes("cancelled");
        }).length;

        // Filter services due today
        const dueToday = services.filter((s: any) => {
          const status = s.status?.toLowerCase() || "";
          if (status.includes("completed") || status.includes("cancelled")) return false;
          if (!s.targetDate) return false;
          const parts = s.targetDate.split(/[-/]/);
          if (parts.length !== 3) return false;
          const [month, day, year] = parts;
          const target = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          target.setHours(0, 0, 0, 0);
          return isSameDay(target, today);
        });

        // Filter overdue services
        const overdue = services.filter((s: any) => {
          const status = s.status?.toLowerCase() || "";
          if (status.includes("completed") || status.includes("cancelled")) return false;
          if (!s.targetDate) return false;
          const parts = s.targetDate.split(/[-/]/);
          if (parts.length !== 3) return false;
          const [month, day, year] = parts;
          const target = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          target.setHours(0, 0, 0, 0);
          return isBefore(target, today);
        });

        const completed = services.filter((s: any) => {
          const status = s.status?.toLowerCase() || "";
          return status.includes("completed");
        }).length;

        setStats((prev) => ({
          ...prev,
          ongoingServices: ongoing,
          overdueServices: overdue.length,
          completedServices: completed,
        }));

        setServicesDueToday(dueToday.slice(0, 5));
        setServicesOverdue(overdue.slice(0, 5));
      }

      // Fetch inquiries count (only for non-technicians)
      if (!isTechnician) {
        try {
          const inquiryResponse = await fetch(
            `${GOOGLE_SHEETS_SCRIPT_URL}?action=getClientInquiries`
          );
          const inquiryData = await inquiryResponse.json();
          if (inquiryData.status === "success" && inquiryData.data) {
            // Count only inquiries with TBD or blank mode of transfer
            const pendingCount = inquiryData.data.filter((inquiry: any) => {
              const modeOfTransfer = (inquiry.modeOfTransfer || "").trim().toUpperCase();
              return modeOfTransfer === "TBD" || modeOfTransfer === "";
            }).length;
            setStats((prev) => ({
              ...prev,
              pendingInquiries: pendingCount,
            }));
          }
        } catch (error) {
          console.error("Error fetching inquiries:", error);
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditService = (serviceId: string) => {
    if (isTechnician) {
      navigate(`/service-update?serviceId=${encodeURIComponent(serviceId)}`);
    } else {
      navigate(`/manage-client?serviceId=${encodeURIComponent(serviceId)}`);
    }
  };

  // Role-based stat cards
  const getStatCards = () => {
    if (isTechnician) {
      return [
        {
          title: "My Ongoing Services",
          value: stats.ongoingServices,
          icon: Wrench,
          color: "text-primary",
          bgColor: "bg-primary/10",
          onClick: () => navigate("/service-tracker?statusFilter=ongoing"),
        },
        {
          title: "My Overdue Services",
          value: stats.overdueServices,
          icon: AlertTriangle,
          color: "text-destructive",
          bgColor: "bg-destructive/10",
          onClick: () => navigate("/service-tracker?statusFilter=overdue"),
        },
        {
          title: "My Completed Services",
          value: stats.completedServices,
          icon: CheckCircle,
          color: "text-success",
          bgColor: "bg-success/10",
          onClick: () => navigate("/service-tracker?statusFilter=completed"),
        },
      ];
    }

    return [
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
        onClick: () => navigate("/service-tracker?statusFilter=ongoing"),
      },
      {
        title: "Overdue Services",
        value: stats.overdueServices,
        icon: AlertTriangle,
        color: "text-destructive",
        bgColor: "bg-destructive/10",
        onClick: () => navigate("/service-tracker?statusFilter=overdue"),
      },
      {
        title: "Completed Services",
        value: stats.completedServices,
        icon: CheckCircle,
        color: "text-success",
        bgColor: "bg-success/10",
        onClick: () => navigate("/service-tracker?statusFilter=completed"),
      },
    ];
  };

  // Role-based quick actions
  const getQuickActions = () => {
    if (isTechnician) {
      return [
        {
          title: "Service Update",
          description: "Update assigned services",
          icon: Wrench,
          path: "/service-update",
        },
        {
          title: "Service Tracker",
          description: "View all services",
          icon: ClipboardList,
          path: "/service-tracker",
        },
        {
          title: "Tech Dashboard",
          description: "Department overview",
          icon: Monitor,
          path: "/tech-dashboard",
        },
      ];
    }

    const baseActions = [
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
      return [
        ...baseActions,
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
        },
      ];
    }

    return baseActions;
  };

  const statCards = getStatCards();
  const quickActions = getQuickActions();

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 animate-fade-in">
        {/* Header with Clock */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
          {/* User Greeting - Enlarged */}
          <div className="flex-1">
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-2">
              Hello, {userFullName}!
            </h1>
            <p className="text-xl text-muted-foreground capitalize">
              Role: {userRole}
            </p>
          </div>
          
          {/* Dynamic Clock - Right Side */}
          <div className="flex flex-col items-end bg-card border border-border rounded-xl p-5 shadow-sm min-w-[280px]">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Calendar className="h-5 w-5" />
              <span className="text-base font-medium">
                {format(currentTime, "EEEE, MMMM d, yyyy")}
              </span>
            </div>
            <div className="text-5xl font-bold text-primary font-mono tracking-wider">
              {format(currentTime, "hh:mm:ss")}
              <span className="text-2xl ml-2 text-muted-foreground">
                {format(currentTime, "a")}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className={`grid grid-cols-1 md:grid-cols-2 ${isTechnician ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4 mb-8`}>
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
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${!isTechnician && userRole === 'management' ? 'xl:grid-cols-5' : ''} gap-4`}>
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

        {/* Summary Sections with Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-warning" />
                {isTechnician ? "My Services Due Today" : "Services Due Today"} ({servicesDueToday.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : servicesDueToday.length === 0 ? (
                <p className="text-muted-foreground text-sm">No services due today.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service ID</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {servicesDueToday.map((service) => (
                        <TableRow key={service.serviceId}>
                          <TableCell className="font-medium">{service.serviceId}</TableCell>
                          <TableCell>{service.clientName}</TableCell>
                          <TableCell className="text-warning font-medium">{service.status}</TableCell>
                          <TableCell>
                            <button
                              onClick={() => handleEditService(service.serviceId)}
                              className="p-1 rounded hover:bg-muted transition-colors"
                              title={isTechnician ? "Update Service" : "Edit in Manage Client"}
                            >
                              <ExternalLink className="h-4 w-4 text-primary" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                {isTechnician ? "My Overdue Services" : "Overdue Services"} ({servicesOverdue.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : servicesOverdue.length === 0 ? (
                <p className="text-muted-foreground text-sm">No overdue services.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service ID</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {servicesOverdue.map((service) => (
                        <TableRow key={service.serviceId}>
                          <TableCell className="font-medium">{service.serviceId}</TableCell>
                          <TableCell>{service.clientName}</TableCell>
                          <TableCell className="text-destructive font-medium">{service.status}</TableCell>
                          <TableCell>
                            <button
                              onClick={() => handleEditService(service.serviceId)}
                              className="p-1 rounded hover:bg-muted transition-colors"
                              title={isTechnician ? "Update Service" : "Edit in Manage Client"}
                            >
                              <ExternalLink className="h-4 w-4 text-primary" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
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
