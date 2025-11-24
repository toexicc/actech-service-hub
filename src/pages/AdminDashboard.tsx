import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { isSameDay, isBefore, startOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import acTechLogo from "@/assets/ac-tech-logo.jpg";

interface ServiceRecord {
  serviceId: string;
  technician: string;
  service: string;
  deviceType: string;
  targetDate: string;
  status: string;
  clientName: string;
}

type ViewMode = "dueToday" | "overdue";

const STATUS_COLUMNS = [
  "Confirmed Diagnosis",
  "Ongoing Service",
  "Pending Pickup (Completed)",
  "RTO"
] as const;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("dueToday");

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    fetchServices();
    const interval = setInterval(fetchServices, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchServices = async () => {
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=getAllOngoingServices`
      );
      const data = await response.json();
      
      if (data.status === "success" && data.services) {
        console.log("Total services fetched (admin dashboard):", data.services.length);
        
        // Filter for specific statuses only
        const filteredServices = data.services.filter(
          (service: ServiceRecord) => STATUS_COLUMNS.includes(service.status as any)
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

  const filterServicesByDate = (services: ServiceRecord[]) => {
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
        console.error(`Error parsing date for service ${service.serviceId}:`, error);
        return false;
      }
    });
    
    return filtered;
  };

  const groupServicesByStatus = (services: ServiceRecord[]) => {
    const grouped: Record<string, ServiceRecord[]> = {};
    
    STATUS_COLUMNS.forEach((status) => {
      grouped[status] = [];
    });

    services.forEach((service) => {
      if (STATUS_COLUMNS.includes(service.status as any)) {
        grouped[service.status].push(service);
      }
    });

    return grouped;
  };

  const filteredServices = filterServicesByDate(services);
  const groupedServices = groupServicesByStatus(filteredServices);

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      {/* Header */}
      <div className="flex flex-col items-center justify-center py-4 px-4 border-b">
        <div className="flex items-center gap-3">
          <img src={acTechLogo} alt="AC Tech Repair" className="h-16" />
          <h1 className="text-3xl font-bold">AC Tech Repair PH</h1>
        </div>
        <p className="text-muted-foreground mt-1">Admin Service Dashboard</p>
      </div>

      {/* Buttons */}
      <div className="flex justify-center gap-2 py-3 px-4">
        <Button onClick={() => navigate("/admin-portal")} variant="outline">
          Back to Admin Portal
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
            <div className="bg-white rounded-xl p-3 shadow-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {STATUS_COLUMNS.map((status) => (
                  <div
                    key={status}
                    className="border-2 border-gray-300 rounded-lg p-3"
                  >
                    <div className="flex justify-center mb-3">
                      <span className="inline-flex items-center px-4 py-2 rounded-full bg-blue-900 text-white text-sm font-bold text-center">
                        {status}
                      </span>
                    </div>
                    {groupedServices[status].length === 0 ? (
                      <div className="text-center text-muted-foreground text-xs py-4">No services</div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {groupedServices[status].map((service, idx) => (
                          <div
                            key={idx}
                            className="bg-blue-50 rounded-lg p-3 flex flex-col"
                          >
                            <div className="font-mono text-lg font-black text-blue-600 text-center leading-tight break-all mb-1">
                              &lt;{service.serviceId}&gt;
                            </div>
                            <div className="text-sm text-muted-foreground text-center font-medium">
                              {service.technician || "Unassigned"}
                            </div>
                            <div className="text-xs text-muted-foreground text-center mt-1">
                              {service.clientName}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
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

export default AdminDashboard;
