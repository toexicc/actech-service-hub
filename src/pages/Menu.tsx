import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useServices } from "@/hooks/useServices";
import { useFastMovingParts } from "@/hooks/useFastMovingParts";
import { useInventory } from "@/hooks/useInventory";
import { useClientInquiriesData } from "@/hooks/useClientInquiriesData";
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
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Monitor,
  CalendarOff,
} from "lucide-react";
import { ClosedDateModal } from "@/components/ClosedDateModal";
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

interface PartForOrdering {
  partId: string;
  requestedBy: string;
  serviceId: string;
  partName: string;
  dateNeeded: string;
  status: string;
}

interface LowStockItem {
  partId: string;
  partName: string;
  model: string;
  quantity: number;
}

const Menu = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [closedDateModalOpen, setClosedDateModalOpen] = useState(false);
  
  // Pagination for dashboards
  const [partsPage, setPartsPage] = useState(1);
  const [lowStockPage, setLowStockPage] = useState(1);
  const dashboardItemsPerPage = 5;
  const userFullName = sessionStorage.getItem("userFullName") || "User";
  const userRole = sessionStorage.getItem("userRole");

  const isTechnician = userRole === "technician";
  const isManagement = userRole === "management";

  // Use React Query hooks for cached data
  const { data: allServices = [], isLoading: isServicesLoading } = useServices();
  const { data: fastMovingParts = [], isLoading: isPartsLoading } = useFastMovingParts();
  const { data: inventoryItems = [], isLoading: isInventoryLoading } = useInventory();
  const { data: inquiriesData = [], isLoading: isInquiriesLoading } = useClientInquiriesData();

  const isLoading = isServicesLoading || (isManagement && (isPartsLoading || isInventoryLoading)) || (!isTechnician && isInquiriesLoading);

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
  }, [navigate]);

  // Compute stats from cached data
  const { stats, servicesDueToday, servicesOverdue } = useMemo(() => {
    const today = startOfDay(new Date());
    
    // Filter services based on role
    let services = isTechnician 
      ? allServices.filter((s: any) => s.technician === userFullName)
      : allServices;

    const ongoing = services.filter((s: any) => {
      const status = s.status?.toLowerCase() || "";
      return !status.includes("completed") && !status.includes("cancelled");
    }).length;

    // Services due today
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

    // Overdue services
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

    // Pending inquiries
    const pendingInquiries = !isTechnician && Array.isArray(inquiriesData)
      ? (inquiriesData as any[]).filter((inquiry: any) => {
          const modeOfTransfer = (inquiry.modeOfTransfer || "").trim().toUpperCase();
          return modeOfTransfer === "TBD" || modeOfTransfer === "";
        }).length
      : 0;

    return {
      stats: {
        pendingInquiries,
        ongoingServices: ongoing,
        overdueServices: overdue.length,
        completedServices: completed,
      },
      servicesDueToday: dueToday.slice(0, 5),
      servicesOverdue: overdue.slice(0, 5),
    };
  }, [allServices, inquiriesData, isTechnician, userFullName]);

  // Parts for ordering (management only)
  const partsForOrdering = useMemo(() => {
    if (!isManagement) return [];
    return fastMovingParts
      .filter((p: any) => p.status === "For Ordering")
      .map((p: any) => ({
        partId: p.partId,
        requestedBy: p.requestedBy,
        serviceId: p.serviceId,
        partName: p.partName,
        dateNeeded: p.dateNeeded,
        status: p.status,
      }));
  }, [fastMovingParts, isManagement]);

  // Low stock items (management only)
  const lowStockItems = useMemo(() => {
    if (!isManagement) return [];
    return inventoryItems
      .map((it: any) => ({
        partId: it.partId,
        partName: it.partName,
        model: it.model,
        quantity: Number(it.quantity ?? 0),
      }))
      .filter((it) => Number.isFinite(it.quantity) && it.quantity <= 2)
      .sort((a, b) => a.quantity - b.quantity);
  }, [inventoryItems, isManagement]);

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
          onClick: () => navigate("/service-tracker?status=Ongoing Service"),
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
          onClick: () => navigate("/service-tracker?status=Completed"),
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
        onClick: () => navigate("/service-tracker?status=Ongoing Service"),
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
        onClick: () => navigate("/service-tracker?status=Completed"),
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
        {
          title: "Set Closed Dates",
          description: "Manage shop closures",
          icon: CalendarOff,
          action: () => setClosedDateModalOpen(true),
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
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${!isTechnician && userRole === 'management' ? 'xl:grid-cols-6' : ''} gap-4`}>
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if ('action' in action && action.action) {
                      action.action();
                    } else if ('path' in action && action.path) {
                      navigate(action.path);
                    }
                  }}
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
                        <TableRow 
                          key={service.serviceId}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleEditService(service.serviceId)}
                        >
                          <TableCell className="font-medium">{service.serviceId}</TableCell>
                          <TableCell>{service.clientName}</TableCell>
                          <TableCell className="text-warning font-medium">{service.status}</TableCell>
                          <TableCell>
                            <ExternalLink className="h-4 w-4 text-primary" />
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
                        <TableRow 
                          key={service.serviceId}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleEditService(service.serviceId)}
                        >
                          <TableCell className="font-medium">{service.serviceId}</TableCell>
                          <TableCell>{service.clientName}</TableCell>
                          <TableCell className="text-destructive font-medium">{service.status}</TableCell>
                          <TableCell>
                            <ExternalLink className="h-4 w-4 text-primary" />
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

        {/* Management Dashboards */}
        {isManagement && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Parts For Ordering ({partsForOrdering.length})
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/inventory-management?tab=fast-moving")}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {partsForOrdering.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No parts currently for ordering.</p>
                ) : (
                  <>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Service ID</TableHead>
                            <TableHead>Part Name</TableHead>
                            <TableHead>Requested By</TableHead>
                            <TableHead>Date Needed</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {partsForOrdering
                            .slice((partsPage - 1) * dashboardItemsPerPage, partsPage * dashboardItemsPerPage)
                            .map((p) => (
                              <TableRow
                                key={p.partId}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => navigate("/inventory-management?tab=fast-moving")}
                              >
                                <TableCell className="font-medium">{p.serviceId}</TableCell>
                                <TableCell>{p.partName}</TableCell>
                                <TableCell>{p.requestedBy}</TableCell>
                                <TableCell>{p.dateNeeded || "N/A"}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                    {partsForOrdering.length > dashboardItemsPerPage && (
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-muted-foreground">
                          Page {partsPage} of {Math.ceil(partsForOrdering.length / dashboardItemsPerPage)}
                        </p>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setPartsPage((p) => Math.max(1, p - 1))}
                            disabled={partsPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setPartsPage((p) => Math.min(Math.ceil(partsForOrdering.length / dashboardItemsPerPage), p + 1))}
                            disabled={partsPage >= Math.ceil(partsForOrdering.length / dashboardItemsPerPage)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Low Stock Items (≤ 2)
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/inventory-management?tab=items")}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {lowStockItems.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No low stock items.</p>
                ) : (
                  <>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Part ID</TableHead>
                            <TableHead>Part Name</TableHead>
                            <TableHead>Model</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lowStockItems
                            .slice((lowStockPage - 1) * dashboardItemsPerPage, lowStockPage * dashboardItemsPerPage)
                            .map((it) => (
                              <TableRow
                                key={it.partId}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => navigate("/inventory-management?tab=items")}
                              >
                                <TableCell className="font-medium">{it.partId}</TableCell>
                                <TableCell>{it.partName}</TableCell>
                                <TableCell>{it.model || "N/A"}</TableCell>
                                <TableCell className="text-right font-medium text-destructive">{it.quantity}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                    {lowStockItems.length > dashboardItemsPerPage && (
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-muted-foreground">
                          Page {lowStockPage} of {Math.ceil(lowStockItems.length / dashboardItemsPerPage)}
                        </p>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setLowStockPage((p) => Math.max(1, p - 1))}
                            disabled={lowStockPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setLowStockPage((p) => Math.min(Math.ceil(lowStockItems.length / dashboardItemsPerPage), p + 1))}
                            disabled={lowStockPage >= Math.ceil(lowStockItems.length / dashboardItemsPerPage)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          Powered by Stack&Scale
        </div>

        {/* Closed Date Modal */}
        <ClosedDateModal
          open={closedDateModalOpen}
          onOpenChange={setClosedDateModalOpen}
        />
      </div>
    </DashboardLayout>
  );
};

export default Menu;
