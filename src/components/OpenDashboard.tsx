import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { format, parseISO, isSameDay, isBefore, startOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const { toast } = useToast();
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("dueToday");

  useEffect(() => {
    fetchServices();
    const interval = setInterval(fetchServices, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchServices = async () => {
    try {
      const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getOngoingServices`);
      const data = await response.json();
      
      if (data.status === "success" && data.data) {
        setServices(data.data);
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
    
    return services.filter((service) => {
      if (!service.targetDate) return false;
      
      const targetDate = parseISO(service.targetDate);
      
      if (viewMode === "dueToday") {
        return isSameDay(targetDate, today);
      } else {
        return isBefore(targetDate, today);
      }
    });
  };

  const groupServicesByCategory = (services: ServiceRecord[]): GroupedServices => {
    const grouped: GroupedServices = {};
    
    services.forEach((service) => {
      let category = "OTHERS";
      
      if (service.deviceType?.toLowerCase().includes("laptop") || 
          service.deviceType?.toLowerCase().includes("mac") ||
          service.deviceType?.toLowerCase().includes("computer")) {
        category = "LAPTOP";
      } else if (service.deviceType?.toLowerCase().includes("mobile") || 
                 service.deviceType?.toLowerCase().includes("iphone") ||
                 service.deviceType?.toLowerCase().includes("android")) {
        category = "MOBILE";
      }
      
      if (!grouped[category]) {
        grouped[category] = {};
      }
      
      const department = service.service || "Others";
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-center">Open Dashboard</CardTitle>
        <div className="flex gap-2 justify-center mt-4">
          <Button
            onClick={() => setViewMode("dueToday")}
            className={cn(
              "rounded-full px-8 py-2",
              viewMode === "dueToday"
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-400 hover:bg-gray-500 text-white"
            )}
          >
            <Clock className="mr-2 h-4 w-4" />
            Due Today
          </Button>
          <Button
            onClick={() => setViewMode("overdue")}
            className={cn(
              "rounded-full px-8 py-2",
              viewMode === "overdue"
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-400 hover:bg-gray-500 text-white"
            )}
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            Overdue
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No {viewMode === "dueToday" ? "services due today" : "overdue services"}
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedServices).map(([category, departments]) => (
              <div key={category}>
                <h2 className="text-3xl font-bold text-center mb-6">{category}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(departments).map(([department, serviceList]) => (
                    <div key={department} className="bg-background border rounded-lg p-4">
                      <h3 className="text-xl font-semibold mb-4 text-center border-b pb-2">
                        {department}
                      </h3>
                      <div className="space-y-3">
                        {serviceList.map((service, idx) => (
                          <div 
                            key={idx}
                            className="bg-muted/50 rounded p-3 hover:bg-muted transition-colors"
                          >
                            <div className="font-mono text-sm font-bold">&lt;{service.serviceId}&gt;</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {service.technician || "Unassigned"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OpenDashboard;
