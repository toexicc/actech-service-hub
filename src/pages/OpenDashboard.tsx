import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { isSameDay, isBefore, startOfDay, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEPARTMENTS } from "@/lib/constants";
import acTechLogo from "@/assets/ac-tech-logo.jpg";
import DashboardLayout from "@/components/DashboardLayout";

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
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("dueToday");
  const [techniciansWithDept, setTechniciansWithDept] = useState<Array<{ name: string; department: string }>>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const userRole = sessionStorage.getItem("userRole");

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    fetchServices();
    fetchTechnicians();
    const interval = setInterval(fetchServices, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchServices = async () => {
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=getAllOngoingServices`
      );
      const data = await response.json();
      
      if (data.status === "success" && data.services) {
        console.log("Total services fetched (dashboard):", data.services.length);
        console.log("Sample services (dashboard):", data.services.slice(0, 3));
        
        // Filter out completed/cancelled statuses
        const excludedStatuses = [
          "Pending Pickup - Completed",
          "Completed",
          "Backjob",
          "RTO",
          "On Hold",
          "Cancelled"
        ];
        
        const filteredServices = data.services.filter(
          (service: ServiceRecord) => !excludedStatuses.includes(service.status)
        );
        
        console.log("Filtered services count:", filteredServices.length);
        setServices(filteredServices);
      } else {
        console.error("Unexpected response for getAllOngoingServices", data);
      }
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({
        title: "Error",
        description: "Failed to fetch services",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getStaffList`);
      const data = await response.json();
      if (data.status === "success" && data.data) {
        const techList = data.data
          .filter((staff: any) => staff.role === "Technician" && staff.status === "Active")
          .map((staff: any) => ({
            name: staff.name,
            department: staff.department || "",
          }));
        console.log("Technicians with departments (dashboard):", techList);
        setTechniciansWithDept(techList);
      }
    } catch (error) {
      console.error("Error fetching technicians for dashboard:", error);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("authenticated");
    sessionStorage.removeItem("userRole");
    navigate("/");
  };

  const filterServicesByDate = (services: ServiceRecord[]) => {
    const today = startOfDay(new Date());
    console.log("Today's date:", today);
    console.log("View mode:", viewMode);
    
    const filtered = services.filter((service) => {
      if (!service.targetDate) {
        console.log(`Service ${service.serviceId} has no target date`);
        return false;
      }
      
      try {
        const parts = service.targetDate.split(/[-/]/);
        if (parts.length !== 3) {
          console.warn(`Unexpected targetDate format for service ${service.serviceId}: ${service.targetDate}`);
          return false;
        }
        const [month, day, year] = parts;
        const targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        targetDate.setHours(0, 0, 0, 0);
        
        if (isNaN(targetDate.getTime())) {
          console.warn(`Invalid date for service ${service.serviceId}: ${service.targetDate}`);
          return false;
        }
        
        console.log(
          `Service ${service.serviceId}: target=${service.targetDate}, parsed=${targetDate}, isSameDay=${isSameDay(
            targetDate,
            today
          )}, isBefore=${isBefore(targetDate, today)}`
        );
        
        if (viewMode === "dueToday") {
          return isSameDay(targetDate, today);
        } else {
          return isBefore(targetDate, today);
        }
      } catch (error) {
        console.error(`Error parsing date for service ${service.serviceId}:`, error);
        return false;
      }
    });
    
    console.log(`Filtered ${filtered.length} services out of ${services.length} total`);
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

    console.log("Grouped services (dashboard):", grouped);
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
