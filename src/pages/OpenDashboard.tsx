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

interface ServiceRecord {
  serviceId: string;
  technician: string;
  service: string;
  deviceType: string;
  targetDate: string;
  status: string;
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
          "Pending Pickup (Completed)",
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
      OTHERS: {},
    };

    DEPARTMENTS.forEach((dept) => {
      if (dept.startsWith("Laptop")) {
        grouped.LAPTOP[dept] = [];
      } else if (dept.startsWith("Mobile")) {
        grouped.MOBILE[dept] = [];
      } else if (dept === "Others") {
        grouped.OTHERS[dept] = [];
      }
    });

    services.forEach((service) => {
      const techDept = techniciansWithDept.find((t) => t.name === service.technician)?.department || "";
      const department = techDept || "Others";

      let category: keyof GroupedServices | null = null;
      if (department.startsWith("Laptop")) {
        category = "LAPTOP";
      } else if (department.startsWith("Mobile")) {
        category = "MOBILE";
      } else if (department === "Others") {
        category = "OTHERS";
      } else if (service.deviceType?.toLowerCase().includes("laptop") ||
                 service.deviceType?.toLowerCase().includes("mac") ||
                 service.deviceType?.toLowerCase().includes("computer") ||
                 service.deviceType?.toLowerCase().includes("imac")) {
        category = "LAPTOP";
      } else if (service.deviceType?.toLowerCase().includes("mobile") ||
                 service.deviceType?.toLowerCase().includes("iphone") ||
                 service.deviceType?.toLowerCase().includes("android") ||
                 service.deviceType?.toLowerCase().includes("ipad")) {
        category = "MOBILE";
      } else {
        category = "OTHERS";
      }

      if (!category) return;

      if (!grouped[category][department]) {
        grouped[category][department] = [];
      }

      grouped[category][department].push(service);
    });

    console.log("Grouped services (dashboard):", grouped);
    return grouped;
  };

  const filteredServices = filterServicesByDate(services);
  const groupedServices = groupServicesByCategory(filteredServices);

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      {/* Header */}
      <div className="flex flex-col items-center justify-center py-4 px-4 border-b">
        <div className="flex items-center gap-3">
          <img src={acTechLogo} alt="AC Tech Repair" className="h-16" />
          <h1 className="text-3xl font-bold">AC Tech Repair PH</h1>
        </div>
        <p className="text-muted-foreground mt-1">Service Tracker Dashboard</p>
        <div className="mt-2 text-lg font-semibold text-primary">
          {format(currentTime, "EEEE, MMMM d, yyyy")} • {format(currentTime, "h:mm:ss a")}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-center gap-2 py-3 px-4">
        <Button onClick={() => navigate("/technician-portal")} variant="outline">
          Back to Technician Portal
        </Button>
      </div>

      {/* Toggle */}
      <div className="flex gap-3 justify-center py-3 px-4">
        <Button
          onClick={() => setViewMode("dueToday")}
          className={cn(
            "rounded-full px-6 py-2 text-sm font-semibold",
            viewMode === "dueToday"
              ? "bg-blue-900 hover:bg-blue-950 text-white"
              : "bg-gray-400 hover:bg-gray-500 text-white"
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
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-gray-400 hover:bg-gray-500 text-white"
          )}
        >
          <AlertCircle className="mr-2 h-4 w-4" />
          Overdue
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto px-4 pb-2">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-2xl">Loading...</div>
        ) : (
          <div className="h-full flex flex-col justify-start gap-2 py-2">
            {Object.entries(groupedServices).map(([category, departments]) => (
              <div key={category} className="bg-white rounded-xl p-3 shadow-lg">
                <div className="flex justify-center mb-3">
                  <span className="inline-flex items-center px-12 py-2 rounded-full bg-blue-900 text-white text-lg font-black">
                    {category}
                  </span>
                </div>
                <div className="flex justify-center gap-2 flex-wrap">
                  {Object.entries(departments).map(([department, serviceList]) => (
                    <div
                      key={department}
                      className="border-2 border-gray-300 rounded-lg p-2 min-w-[280px]"
                    >
                      <h3 className="text-sm font-bold mb-2 text-center pb-1.5 border-b-2 border-gray-400">
                        {department.replace("Laptop (", "").replace("Mobile (", "").replace(")", "")}
                      </h3>
                      {serviceList.length === 0 ? (
                        <div className="text-center text-muted-foreground text-xs py-2">No services</div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 mt-1.5">
                          {serviceList.map((service, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "rounded-lg p-2 flex flex-col items-center justify-center",
                                viewMode === "overdue" 
                                  ? "bg-red-100 border-2 border-red-400" 
                                  : "bg-blue-50"
                              )}
                            >
                              <div className={cn(
                                "font-mono text-xl font-black text-center leading-tight break-all",
                                viewMode === "overdue" ? "text-red-700" : "text-blue-600"
                              )}>
                                {service.serviceId}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground text-center truncate w-full font-medium">
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

      {/* Footer */}
      <footer className="text-center text-xs text-muted-foreground py-1">
        Powered by Stack&Scale
      </footer>
    </div>
  );
};

export default OpenDashboard;
