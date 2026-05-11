import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { isSameDay, isBefore, startOfDay, format } from "date-fns";
import { Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/DashboardLayout";
import { useServices } from "@/hooks/useServices";

interface ServiceRecord {
  serviceId: string;
  technician: string;
  service: string;
  deviceType: string;
  targetDate: string;
  status: string;
  clientName: string;
  timestamp: string;
  internalAdminNotes: string;
}

type ViewMode = "dueToday" | "overdue";

const STATUS_COLUMNS = [
  "Confirmed Diagnosis",
  "Ongoing Service",
  "Done Repair - For Release",
  "Done Repair - Advise Client",
  "On Hold",
] as const;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("dueToday");
  const [currentTime, setCurrentTime] = useState(new Date());

  // Use React Query hooks for cached data
  const { data: allServices = [], isLoading: isServicesLoading, refetch: refetchServices } = useServices();

  // Filter services for specific statuses
  const services = useMemo(() => {
    return allServices.filter(
      (service: any) => STATUS_COLUMNS.includes(service.status as any)
    );
  }, [allServices]);

  const isLoading = isServicesLoading;

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
  }, [navigate]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetchServices();
    }, 60000);
    return () => clearInterval(interval);
  }, [refetchServices]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
        // Error parsing date
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

    // Sort each status group by timestamp (oldest first)
    Object.keys(grouped).forEach((status) => {
      grouped[status].sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeA - timeB;
      });
    });

    return grouped;
  };

  const filteredServices = filterServicesByDate(services);
  const groupedServices = groupServicesByStatus(filteredServices);

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Admin Service Dashboard</h1>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {STATUS_COLUMNS.map((status) => (
                  <div
                    key={status}
                    className="border border-border rounded-lg p-3"
                  >
                    <div className="flex justify-center mb-3">
                      <span className="inline-flex items-center px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold text-center">
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
                              {service.clientName}
                            </div>
                            {service.internalAdminNotes && (
                              <div className="text-xs text-muted-foreground text-center mt-1 italic">
                                {service.internalAdminNotes}
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
          )}
        </div>

        <div className="text-center mt-8 text-sm text-muted-foreground">
          Powered by Stack&Scale
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;