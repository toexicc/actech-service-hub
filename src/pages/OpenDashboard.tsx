import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { isSameDay, isBefore, startOfDay } from "date-fns";
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
  const userRole = sessionStorage.getItem("userRole");

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    fetchServices();
    fetchTechnicians();
    const interval = setInterval(fetchServices, 30000);
    return () => clearInterval(interval);
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
        setServices(data.services);
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
    <div className="h-screen overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 p-3 flex flex-col">
      <div className="w-full flex flex-col h-full items-center">
        <div className="text-center mb-3">
          <img 
            src={acTechLogo} 
            alt="AC Tech Repair" 
            className="mx-auto h-16 mb-2 object-contain"
          />
          <h1 className="text-3xl font-bold text-blue-600 mb-1">AC Tech Repair</h1>
          <p className="text-lg text-muted-foreground">Open Dashboard</p>
        </div>

        <div className="flex justify-center gap-2 mb-3">
          <Button onClick={() => navigate(userRole === "management" ? "/menu" : "/technician-portal")} variant="outline" size="sm">
            Back to {userRole === "management" ? "Menu" : "Portal"}
          </Button>
          <Button onClick={handleLogout} variant="destructive" size="sm">
            Logout
          </Button>
        </div>

        <div className="flex gap-3 justify-center mb-3">
          <Button
            onClick={() => setViewMode("dueToday")}
            className={cn(
              "rounded-full px-8 py-4 text-base font-semibold",
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
              "rounded-full px-8 py-4 text-base font-semibold",
              viewMode === "overdue"
                ? "bg-blue-900 hover:bg-blue-950 text-white"
                : "bg-gray-400 hover:bg-gray-500 text-white"
            )}
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            Overdue
          </Button>
        </div>

        <div className="flex-1 overflow-hidden w-full flex justify-center">
          {isLoading ? (
            <div className="text-center py-8 text-xl">Loading...</div>
          ) : (
            <div className="h-full overflow-y-auto space-y-4 w-full max-w-7xl px-4">
              {Object.entries(groupedServices).map(([category, departments]) => (
                <div key={category} className="bg-white rounded-lg p-4 shadow-lg">
                  <h2 className="text-3xl font-black text-center mb-4">{category}</h2>
                  <div className="flex flex-wrap gap-3 justify-center">
                    {Object.entries(departments).map(([department, serviceList]) => (
                      <div key={department} className="border-2 border-gray-200 rounded-lg p-3 w-36">
                        <h3 className="text-sm font-bold mb-2 text-center pb-2 border-b-2 border-gray-300 truncate">
                          {department.replace("Laptop (", "").replace("Mobile (", "").replace(")", "")}
                        </h3>
                        {serviceList.length === 0 ? (
                          <div className="text-center text-muted-foreground text-xs py-2">No services</div>
                        ) : (
                          <div className="space-y-2">
                            {serviceList.map((service, idx) => (
                              <div 
                                key={idx}
                                className="text-center bg-blue-50 rounded p-2"
                              >
                                <div className="font-mono text-lg font-black text-blue-600 break-all">
                                  &lt;{service.serviceId}&gt;
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate">
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

        <footer className="text-center text-xs text-muted-foreground mt-2 py-2">
          Powered by Stack&Scale
        </footer>
      </div>
    </div>
  );
};

export default OpenDashboard;
