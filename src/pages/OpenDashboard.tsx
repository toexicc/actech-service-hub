import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { isSameDay, isBefore, startOfDay, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Clock, AlertCircle } from "lucide-react";
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
  const { data: allServices = [], isLoading: isServicesLoading, refetch: refetchServices } = useServices();
  const { data: staffList = [] } = useStaff();

  // Filter services for this dashboard
  const services = useMemo(() => {
    const excludedStatuses = [
      "For Pickup",
      "Completed",
      "Backjob",
      "RTO",
      "On Hold",
      "Cancelled"
    ];
    return allServices.filter(
      (service: any) => !excludedStatuses.includes(service.status)
    );
  }, [allServices]);

  // Get technicians with departments
  const techniciansWithDept = useMemo(() => {
    return staffList
      .filter((staff: any) => staff.role === "Technician" && staff.status === "Active")
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
        const parts = service.targetDate.split(/[-/]/);
        if (parts.length !== 3) {
          return false;
        }
        const [month, day, year] = parts;
        const targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
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

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Tech Service Dashboard</h1>
          <p className="text-muted-foreground">
            {format(currentTime, "EEEE, MMMM d, yyyy")} • {format(currentTime, "h:mm:ss a")}
          </p>
        </div>

        {/* Toggle */}
        <div className="flex gap-3 justify-center py-3 mb-6">
          <Button
            onClick={() => setViewMode("dueToday")}
            className={cn(
              "rounded-full px-6 py-2 text-sm font-semibold",
              viewMode === "dueToday"
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            )}
          >
            <Clock className="mr-2 h-4 w-4" />
            Due Today
          </Button>
          <Button
            onClick={() => setViewMode("overdue")}
            className={cn(
              "rounded-full px-6 py-2 text-sm font-semibold",
              viewMode === "overdue"
                ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            )}
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            Overdue
          </Button>
        </div>

        {/* Main Content */}
        <div className="overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center text-2xl py-12">Loading...</div>
          ) : (
            <div className="bg-card rounded-xl p-4 shadow-lg border border-border">
              {Object.entries(groupedServices).map(([category, departments]) => (
                <div key={category} className="mb-6 last:mb-0">
                  <div className="flex justify-center mb-3">
                    <span className="inline-flex items-center px-12 py-2 rounded-full bg-primary text-primary-foreground text-lg font-black">
                      {category}
                  </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(departments).map(([department, serviceList]) => (
                      <div
                        key={department}
                        className="border border-border rounded-lg p-3"
                      >
                        <div className="flex justify-center mb-3">
                          <span className="inline-flex items-center px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold text-center">
                            {department.replace("Laptop (", "").replace("Mobile (", "").replace(")", "")}
                          </span>
                        </div>
                        {serviceList.length === 0 ? (
                          <div className="text-center text-muted-foreground text-xs py-4">No services</div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {serviceList.map((service, idx) => (
                              <div
                                key={idx}
                                className={cn(
                                  "rounded-lg p-3 flex flex-col",
                                  viewMode === "overdue" 
                                    ? "bg-destructive/10 border border-destructive/30" 
                                    : "bg-primary/5 border border-primary/20"
                                )}
                              >
                                <div className={cn(
                                  "font-mono text-lg font-black text-center leading-tight break-all mb-1",
                                  viewMode === "overdue" ? "text-destructive" : "text-primary"
                                )}>
                                  {service.serviceId}
                                </div>
                                <div className="text-sm text-muted-foreground text-center font-medium">
                                  {service.technician || "Unassigned"}
                                </div>
                                {service.internalTechnicianNotes && (
                                  <div className="text-xs text-muted-foreground text-center mt-1 italic">
                                    {service.internalTechnicianNotes}
                                  </div>
                                )}
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

        <div className="text-center mt-8 text-sm text-muted-foreground">
          Powered by Stack&Scale
        </div>
      </div>
    </DashboardLayout>
  );
};

export default OpenDashboard;
