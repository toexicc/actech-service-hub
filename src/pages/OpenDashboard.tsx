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
    const interval = setInterval(fetchServices, 30000); // Refresh every 30 seconds
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
        // Parse target date format: "MM-DD-YYYY" or "MM/DD/YYYY"
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

    // Initialize all known departments so they always show
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="max-w-[1800px] mx-auto">
        <div className="text-center mb-8">
          <img 
            src={acTechLogo} 
            alt="AC Tech Repair" 
            className="mx-auto h-20 mb-4 object-contain"
          />
          <h1 className="text-4xl font-bold text-blue-600 mb-2">AC Tech Repair</h1>
          <p className="text-xl text-muted-foreground">Open Dashboard</p>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          <Button onClick={() => navigate(userRole === "management" ? "/menu" : "/technician-portal")} variant="outline">
            Back to {userRole === "management" ? "Menu" : "Portal"}
          </Button>
          <Button onClick={handleLogout} variant="destructive">
            Logout
          </Button>
        </div>

        <div className="flex gap-4 justify-center mb-8">
          <Button
            onClick={() => setViewMode("dueToday")}
            className={cn(
              "rounded-full px-12 py-6 text-lg font-semibold",
              viewMode === "dueToday"
                ? "bg-blue-900 hover:bg-blue-950 text-white"
                : "bg-gray-400 hover:bg-gray-500 text-white"
            )}
          >
            <Clock className="mr-2 h-5 w-5" />
            Due Today
          </Button>
          <Button
            onClick={() => setViewMode("overdue")}
            className={cn(
              "rounded-full px-12 py-6 text-lg font-semibold",
              viewMode === "overdue"
                ? "bg-blue-900 hover:bg-blue-950 text-white"
                : "bg-gray-400 hover:bg-gray-500 text-white"
            )}
          >
            <AlertCircle className="mr-2 h-5 w-5" />
            Overdue
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-xl">Loading...</div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedServices).map(([category, departments]) => (

              <div key={category} className="bg-white rounded-lg p-6 shadow-lg">
                <h2 className="text-4xl font-black text-center mb-6">{category}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {Object.entries(departments).map(([department, serviceList]) => (
                    <div key={department} className="border-2 border-gray-200 rounded-lg p-4">
                      <h3 className="text-lg font-bold mb-4 text-center pb-2 border-b-2 border-gray-300">
                        {department.replace("Laptop (", "").replace("Mobile (", "").replace(")", "")}
                      </h3>
                      {serviceList.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm py-2">No services</div>
                      ) : (
                        <div className="space-y-3">
                          {serviceList.map((service, idx) => (
                            <div 
                              key={idx}
                              className="text-center space-y-1 bg-blue-50 rounded p-2"
                            >
                              <div className="font-mono text-2xl font-black text-blue-600">
                                &lt;{service.serviceId}&gt;
                              </div>
                              <div className="text-xs text-muted-foreground">
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

        <footer className="text-center text-sm text-muted-foreground mt-8">
          Powered by Stack&Scale
        </footer>
      </div>
    </div>
  );
};

export default OpenDashboard;
