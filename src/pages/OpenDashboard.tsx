import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { isSameDay, isBefore, startOfDay, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Clock, AlertCircle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEPARTMENTS } from "@/lib/constants";
import acTechLogo from "@/assets/S_S_Marketing-2.png";
import DashboardLayout from "@/components/DashboardLayout";
import { useServices } from "@/hooks/useServices";
import { useStaff } from "@/hooks/useStaff";

interface ServiceRecord {
  serviceId: string;
  technician: string;
  technicianDepartment: string; // Comma-separated if multiple departments
  service: string;
  deviceType: string;
  targetDate: string;
  status: string;
  timestamp: string;
  internalTechnicianNotes: string;
}

interface GroupedServices {
  [deviceCategory: string]: {
    [department: string]: ServiceRecord[];
  };
}

type ViewMode = "dueToday" | "overdue";

const OpenDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("dueToday");
  const [currentTime, setCurrentTime] = useState(new Date());
  const userRole = sessionStorage.getItem("userRole");

  // Use React Query hooks for cached data
  const { data: allServices = [], isPending: isServicesLoading, refetch: refetchServices } = useServices();
  const { data: staffList = [] } = useStaff();

  // Filter services for this dashboard
  const services = useMemo(() => {
    const excludedStatuses = [
      "Completed",
      "Cancelled",
      "RTO - ACTech",
      "RTO - Client",
      "RTO",
      "On Hold",
      "Done Repair - For Release",
      "Done Repair - Advise Client",
    ];

    return allServices.filter(
      (service: any) => !excludedStatuses.includes(service.status)
    );
  }, [allServices]);

  // Get technicians with departments
  const techniciansWithDept = useMemo(() => {
    return staffList
      .filter((staff: any) =>
        (staff.role || "").toLowerCase() === "technician" &&
        (staff.status || "active").toLowerCase() === "active")

      .map((staff: any) => ({
        name: staff.name,
        department: staff.department || "",
      }));
  }, [staffList]);

  const isLoading = isServicesLoading;

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
  }, [navigate]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => refetchServices(), 60000);
    return () => clearInterval(interval);
  }, [refetchServices]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("authenticated");
    sessionStorage.removeItem("userRole");
    navigate("/");
  };

  const filterServicesByDate = (services: any[]) => {
    const today = startOfDay(new Date());
    
    const filtered = services.filter((service) => {
      if (!service.targetDate) {
        return false;
      }
      
      try {
        const parts = service.targetDate.split(/[-/T ]/);
        if (parts.length < 3) {
          return false;
        }
        let year: number, month: number, day: number;
        if (parts[0].length === 4) {
          year = parseInt(parts[0]); month = parseInt(parts[1]); day = parseInt(parts[2]);
        } else {
          month = parseInt(parts[0]); day = parseInt(parts[1]); year = parseInt(parts[2]);
        }
        const targetDate = new Date(year, month - 1, day);
        targetDate.setHours(0, 0, 0, 0);
        
        if (isNaN(targetDate.getTime())) {
          return false;
        }
        
        if (viewMode === "dueToday") {
          return isSameDay(targetDate, today);
        } else {
          return isBefore(targetDate, today);
        }
      } catch (error) {
        return false;
      }
    });
    
    return filtered;
  };

  const groupServicesByCategory = (services: ServiceRecord[]): GroupedServices => {
    const grouped: GroupedServices = {
      LAPTOP: {},
      MOBILE: {},
    };

    DEPARTMENTS.forEach((dept) => {
      if (dept.startsWith("Laptop")) {
        grouped.LAPTOP[dept] = [];
      } else if (dept.startsWith("Mobile")) {
        grouped.MOBILE[dept] = [];
      }
    });

    services.forEach((service) => {
      // Handle multiple departments (comma-separated from Column AN)
      const departments = service.technicianDepartment
        ?.split(',')
        .map(d => d.trim())
        .filter(Boolean) || [];

      // Add service to EACH department
      departments.forEach(department => {
        let category: keyof GroupedServices | null = null;
        if (department.startsWith("Laptop")) {
          category = "LAPTOP";
        } else if (department.startsWith("Mobile")) {
          category = "MOBILE";
        }

        if (!category) return;

        if (!grouped[category][department]) {
          grouped[category][department] = [];
        }

        grouped[category][department].push(service);
      });

      // Fallback: If no department found, use deviceType to categorize
      if (departments.length === 0) {
        let category: keyof GroupedServices | null = null;
        if (service.deviceType?.toLowerCase().includes("laptop") ||
            service.deviceType?.toLowerCase().includes("mac") ||
            service.deviceType?.toLowerCase().includes("computer") ||
            service.deviceType?.toLowerCase().includes("imac")) {
          category = "LAPTOP";
        } else if (service.deviceType?.toLowerCase().includes("mobile") ||
                   service.deviceType?.toLowerCase().includes("iphone") ||
                   service.deviceType?.toLowerCase().includes("android") ||
                   service.deviceType?.toLowerCase().includes("ipad")) {
          category = "MOBILE";
        }
        // Skip if no category can be determined
      }
    });

    // Sort each department group by timestamp (oldest first)
    Object.values(grouped).forEach((categoryGroup) => {
      Object.keys(categoryGroup).forEach((dept) => {
        categoryGroup[dept].sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          return timeA - timeB;
        });
      });
    });

    // Grouped services ready
    return grouped;
  };

  const filteredServices = filterServicesByDate(services);
  const groupedServices = groupServicesByCategory(filteredServices);

  const totalCount = filteredServices.length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 px-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-foreground leading-none">Tech Service Dashboard</h1>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {format(currentTime, "EEE, MMM d")} • {format(currentTime, "h:mm:ss a")} • {totalCount} ticket{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            onClick={() => setViewMode("dueToday")}
            className={cn(
              "rounded-full h-7 px-3 text-xs font-semibold",
              viewMode === "dueToday"
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            )}
          >
            <Clock className="mr-1 h-3.5 w-3.5" />
            Due Today
          </Button>
          <Button
            size="sm"
            onClick={() => setViewMode("overdue")}
            className={cn(
              "rounded-full h-7 px-3 text-xs font-semibold",
              viewMode === "overdue"
                ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            )}
          >
            <AlertCircle className="mr-1 h-3.5 w-3.5" />
            Overdue
          </Button>
        </div>
      </div>

      {/* Main Content — everything fits on one screen */}
      <div className="flex-1 min-h-0 overflow-hidden p-2">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-lg">Loading...</div>
        ) : (
          <div className="grid h-full grid-rows-2 gap-2">
            {Object.entries(groupedServices).map(([category, departments]) => (
              <div key={category} className="min-h-0 flex flex-col">
                <div className="flex items-center gap-2 mb-1 shrink-0">
                  <span className="inline-flex items-center px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-[11px] font-black tracking-wide">
                    {category}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid flex-1 min-h-0 grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(departments).map(([department, serviceList]) => (
                    <div
                      key={department}
                      className="border border-border rounded-md p-1.5 flex flex-col min-h-0"
                    >
                      <div className="flex items-center justify-between mb-1 shrink-0">
                        <span className="text-[11px] font-bold text-foreground truncate">
                          {department.replace("Laptop (", "").replace("Mobile (", "").replace(")", "")}
                        </span>
                        <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                          {serviceList.length}
                        </span>
                      </div>
                      {serviceList.length === 0 ? (
                        <div className="text-center text-muted-foreground text-[10px] py-2">—</div>
                      ) : (
                        <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 gap-1 content-start pr-0.5">
                          {serviceList.map((service, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "rounded px-1 py-0.5 text-center",
                                viewMode === "overdue"
                                  ? "bg-destructive/10 border border-destructive/30"
                                  : "bg-primary/5 border border-primary/20"
                              )}
                            >
                              <div className={cn(
                                "font-mono text-[11px] font-black leading-tight truncate",
                                viewMode === "overdue" ? "text-destructive" : "text-primary"
                              )}>
                                {service.serviceId}
                              </div>
                              <div className="text-[9px] text-muted-foreground leading-tight truncate">
                                {service.technician || "Unassigned"}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OpenDashboard;
