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
import { StatCard } from "@/components/ui/stat-card";
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
  ShoppingCart,
  CalendarCheck,
  LayoutDashboard,
} from "lucide-react";
import { DueDateCalendar } from "@/components/DueDateCalendar";

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
  const { data: fastMovingParts = [], isLoading: isPartsLoading } = useFastMovingParts(isManagement);
  const { data: inventoryItems = [], isLoading: isInventoryLoading } = useInventory(isManagement);
  const { data: inquiriesData = [], isLoading: isInquiriesLoading } = useClientInquiriesData(!isTechnician);

  const isLoading = isServicesLoading || (isManagement && (isPartsLoading || isInventoryLoading)) || (!isTechnician && isInquiriesLoading);

  // Dynamic clock - use longer interval to reduce iOS Safari issues
  useEffect(() => {
    let mounted = true;
    const tick = () => {
      if (mounted) setCurrentTime(new Date());
    };
    const timer = setInterval(tick, 1000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
  }, [navigate]);

  // Compute stats from cached data - wrapped in try-catch for iOS safety
  const { stats, servicesDueToday, servicesOverdue } = useMemo(() => {
    try {
      const today = startOfDay(new Date());

      // Filter services based on role
      const services = isTechnician
        ? allServices.filter((s: any) => s.technician === userFullName)
        : allServices;

      const ongoing = services.filter((s: any) => {
        const status = s.status?.toLowerCase() || "";
        return !status.includes("completed") && !status.includes("cancelled");
      }).length;

      // Helper to safely parse target date
      const parseTarget = (targetDate: string | undefined) => {
        if (!targetDate) return null;
        const parts = targetDate.split(/[-/]/);
        if (parts.length !== 3) return null;
        const [month, day, year] = parts;
        const m = parseInt(month, 10);
        const d = parseInt(day, 10);
        const y = parseInt(year, 10);
        if (isNaN(m) || isNaN(d) || isNaN(y)) return null;
        const date = new Date(y, m - 1, d);
        date.setHours(0, 0, 0, 0);
        return date;
      };

      // Services due today
      const dueToday = services.filter((s: any) => {
        const status = s.status?.toLowerCase() || "";
        if (status.includes("completed") || status.includes("cancelled")) return false;
        const target = parseTarget(s.targetDate);
        return target && isSameDay(target, today);
      });

      // Overdue services
      const overdue = services.filter((s: any) => {
        const status = s.status?.toLowerCase() || "";
        if (status.includes("completed") || status.includes("cancelled")) return false;
        const target = parseTarget(s.targetDate);
        return target && isBefore(target, today);
      });

      const completed = services.filter((s: any) => {
        const status = s.status?.toLowerCase() || "";
        return status.includes("completed");
      }).length;

      // Pending inquiries
      const pendingInquiries =
        !isTechnician && Array.isArray(inquiriesData)
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
    } catch {
      return {
        stats: { pendingInquiries: 0, ongoingServices: 0, overdueServices: 0, completedServices: 0 },
        servicesDueToday: [],
        servicesOverdue: [],
      };
    }
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
        title: "Ongoing Services",
        value: stats.ongoingServices,
        icon: Wrench,
        color: "text-primary",
        bgColor: "bg-primary/10",
        onClick: () => navigate("/service-tracker?status=Ongoing Service"),
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
        {
          title: "Point of Sales",
          description: "Record a sale",
          icon: ShoppingCart,
          path: "/pos",
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
      {
        title: "Point of Sales",
        description: "Record a sale",
        icon: ShoppingCart,
        path: "/pos",
      },
      {
        title: "Admin Dashboard",
        description: "Admin overview",
        icon: LayoutDashboard,
        path: "/admin-dashboard",
      },
      {
        title: "Tech Dashboard",
        description: "Department overview",
        icon: Monitor,
        path: "/tech-dashboard",
      },
      {
        title: "Queue Console",
        description: "Manage the customer intake queue",
        icon: Clock,
        path: "/queueing",
      },
    ];

    if (userRole === "management") {
      return [
        ...baseActions,
        {
          title: "Attendance Overview",
          description: "Track staff attendance",
          icon: CalendarCheck,
          path: "/attendance-overview",
        },
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
          path: "/completed-transactions",
        },
      ];
    }

    return baseActions;
  };

  const statCards = getStatCards();
  const quickActions = getQuickActions();

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
        {/* Hero */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground font-medium">
                {format(currentTime, "EEEE, MMMM d")}
              </p>
              <h1 className="mt-1 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
                Hello, <span className="text-gradient">{userFullName.split(" ")[0]}</span>
              </h1>
              <p className="mt-2 text-base text-muted-foreground">
                Here's what's happening in your <span className="capitalize font-medium text-foreground">{userRole}</span> workspace today.
              </p>
            </div>
            <div className="glass-panel rounded-2xl px-5 py-4 min-w-[240px] flex items-center gap-4">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Local time</p>
                <p className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {format(currentTime, "hh:mm")}
                  <span className="text-sm ml-1.5 text-muted-foreground font-sans font-medium">{format(currentTime, "a")}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions — compact single row above Today's numbers */}
        <section className="mb-6">
          <div className="glass-panel rounded-2xl px-3 py-2 flex flex-wrap md:flex-nowrap items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 shrink-0">
              Quick actions
            </span>
            <div className="h-4 w-px bg-border/60 hidden md:block" />
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => { if ("path" in action && action.path) navigate(action.path); }}
                className="h-9 px-3 rounded-full inline-flex items-center gap-2 text-xs font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors whitespace-nowrap shrink-0"
                title={action.description}
              >
                <action.icon className="h-4 w-4" />
                <span>{action.title}</span>
              </button>
            ))}
          </div>
        </section>


        {/* Today's numbers */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Today's numbers</h2>
            <button
              onClick={() => navigate("/service-tracker")}
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              View all <ExternalLink className="h-3 w-3" />
            </button>
          </div>
          <div className={`grid grid-cols-2 ${isTechnician ? "lg:grid-cols-3" : "lg:grid-cols-4"} gap-3 sm:gap-4`}>
            {statCards.map((stat, index) => (
              <StatCard
                key={index}
                label={stat.title}
                value={isLoading ? "…" : stat.value}
                icon={<stat.icon className="h-5 w-5" />}
                tone={
                  stat.color.includes("destructive") ? "destructive" :
                  stat.color.includes("success") ? "success" :
                  stat.color.includes("warning") ? "warning" : "primary"
                }
                onClick={stat.onClick}
              />
            ))}
          </div>
        </section>

        {/* Service calendar with due-date sidebar */}
        {!isLoading && (
          <div className="mb-8">
            <DueDateCalendar role={userRole} userFullName={userFullName} />
          </div>
        )}


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
          
        </div>

      </div>
    </DashboardLayout>
  );
};

export default Menu;
