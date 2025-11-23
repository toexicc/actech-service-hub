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
    const interval = setInterval(fetchServices, 5000); // Real-time: refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchServices = async () => {
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=getAllOngoingServices`
      );
      const data = await response.json();
      
      if (data.status === "success" && data.services) {
        setServices(data.services);
      }
    } catch (error) {
      console.error("Error fetching services:", error);
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
    
    return services.filter((service) => {
      if (!service.targetDate) return false;
      
      try {
        const parts = service.targetDate.split(/[-/]/);
        if (parts.length !== 3) return false;
        
        const [month, day, year] = parts;
        const targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        targetDate.setHours(0, 0, 0, 0);
        
        if (isNaN(targetDate.getTime())) return false;
        
        if (viewMode === "dueToday") {
          return isSameDay(targetDate, today);
        } else {
          return isBefore(targetDate, today);
        }
      } catch (error) {
        return false;
      }
    });
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

    return grouped;
  };

  const filteredServices = filterServicesByDate(services);
  const groupedServices = groupServicesByCategory(filteredServices);

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 p-4 flex flex-col">
      <div className="w-full flex flex-col h-full">
        <div className="text-center mb-2">
          <img 
            src={acTechLogo} 
            alt="AC Tech Repair" 
            className="mx-auto h-12 mb-1 object-contain"
          />
          <h1 className="text-2xl font-bold text-blue-600">AC Tech Repair - Open Dashboard</h1>
        </div>

        <div className="flex justify-center gap-2 mb-2">
          <Button onClick={() => navigate(userRole === "management" ? "/menu" : "/technician-portal")} variant="outline" size="sm">
            Back
          </Button>
          <Button
            onClick={() => setViewMode("dueToday")}
            size="sm"
            className={cn(
              "rounded-full px-6",
              viewMode === "dueToday"
                ? "bg-blue-900 hover:bg-blue-950 text-white"
                : "bg-gray-400 hover:bg-gray-500 text-white"
            )}
          >
            <Clock className="mr-1 h-3 w-3" />
            Due Today
          </Button>
          <Button
            onClick={() => setViewMode("overdue")}
            size="sm"
            className={cn(
              "rounded-full px-6",
              viewMode === "overdue"
                ? "bg-blue-900 hover:bg-blue-950 text-white"
                : "bg-gray-400 hover:bg-gray-500 text-white"
            )}
          >
            <AlertCircle className="mr-1 h-3 w-3" />
            Overdue
          </Button>
          <Button onClick={handleLogout} variant="destructive" size="sm">
            Logout
          </Button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col gap-3">
          {isLoading ? (
            <div className="text-center py-8 text-xl">Loading...</div>
          ) : (
            <>
              {Object.entries(groupedServices).map(([category, departments]) => (
                <div key={category} className="bg-white rounded-lg p-3 shadow-lg flex-1 flex flex-col min-h-0">
                  <h2 className="text-2xl font-black text-center mb-2">{category}</h2>
                  <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">
                    {Object.entries(departments).map(([department, serviceList]) => (
                      <div key={department} className="border-2 border-gray-300 rounded-lg p-2 flex flex-col min-h-0">
                        <h3 className="text-base font-bold text-center pb-2 mb-2 border-b-2 border-gray-300">
                          {department.replace("Laptop (", "").replace("Mobile (", "").replace(")", "")}
                        </h3>
                        <div className="flex-1 overflow-hidden">
                          {serviceList.length === 0 ? (
                            <div className="text-center text-muted-foreground text-sm py-2">No services</div>
                          ) : (
                            <div className="space-y-1 h-full overflow-y-auto">
                              {serviceList.map((service, idx) => (
                                <div 
                                  key={idx}
                                  className="bg-blue-50 rounded p-1.5"
                                >
                                  <div className="font-mono text-base font-black text-blue-600 text-center break-all">
                                    &lt;{service.serviceId}&gt;
                                  </div>
                                  <div className="text-[10px] text-center text-muted-foreground truncate">
                                    {service.technician || "Unassigned"}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <footer className="text-center text-xs text-muted-foreground py-1">
          Powered by Stack&Scale
        </footer>
      </div>
    </div>
  );
};

export default OpenDashboard;
