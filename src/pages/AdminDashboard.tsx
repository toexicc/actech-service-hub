import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { isSameDay, isBefore, startOfDay, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Clock, AlertCircle, Package, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/DashboardLayout";

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

interface PartRequest {
  partId: string;
  requestedBy: string;
  serviceId: string;
  partName: string;
  dateNeeded: string;
  status: string;
}

interface InventoryItem {
  partId: string;
  partName: string;
  model: string;
  quantity: string;
}

type ViewMode = "dueToday" | "overdue";

const STATUS_COLUMNS = [
  "Confirmed Diagnosis",
  "Ongoing Service",
  "For Pickup",
  "On Hold",
  "RTO"
] as const;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("dueToday");
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Fast moving parts and inventory states
  const [fastMovingParts, setFastMovingParts] = useState<PartRequest[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoadingParts, setIsLoadingParts] = useState(true);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    fetchServices();
    fetchFastMovingParts();
    fetchInventory();
    const interval = setInterval(() => {
      fetchServices();
      fetchFastMovingParts();
      fetchInventory();
    }, 60000);
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

  const fetchFastMovingParts = async () => {
    setIsLoadingParts(true);
    try {
      const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getFastMovingParts`);
      const data = await response.json();

      if (data.status === "success" && data.parts) {
        // Filter for "For Ordering" status only
        const forOrderingParts = data.parts.filter(
          (part: PartRequest) => part.status === "For Ordering"
        );
        setFastMovingParts(forOrderingParts);
      }
    } catch (error) {
      console.error("Error fetching fast moving parts:", error);
    } finally {
      setIsLoadingParts(false);
    }
  };

  const fetchInventory = async () => {
    setIsLoadingInventory(true);
    try {
      const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getInventory`);
      const data = await response.json();

      if (data.status === "success" && data.inventory) {
        // Filter for low stock items (quantity <= 2)
        const lowStockItems = data.inventory.filter(
          (item: InventoryItem) => {
            const qty = parseInt(item.quantity) || 0;
            return qty <= 2;
          }
        );
        setInventoryItems(lowStockItems);
      }
    } catch (error) {
      console.error("Error fetching inventory:", error);
    } finally {
      setIsLoadingInventory(false);
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

  // Filter fast moving parts for services due today
  const getPartsForServicesDueToday = () => {
    const today = startOfDay(new Date());
    const servicesDueToday = services.filter((service) => {
      if (!service.targetDate) return false;
      try {
        const parts = service.targetDate.split(/[-/]/);
        if (parts.length !== 3) return false;
        const [month, day, year] = parts;
        const targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        targetDate.setHours(0, 0, 0, 0);
        return isSameDay(targetDate, today);
      } catch {
        return false;
      }
    });

    const serviceIdsDueToday = servicesDueToday.map(s => s.serviceId.toLowerCase());
    
    return fastMovingParts.filter(part => 
      serviceIdsDueToday.includes(part.serviceId?.toLowerCase())
    );
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
  const partsForServicesDueToday = getPartsForServicesDueToday();

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Admin Service Dashboard</h1>
          <p className="text-muted-foreground">
            {format(currentTime, "EEEE, MMMM d, yyyy")} • {format(currentTime, "h:mm:ss a")}
          </p>
        </div>

        {/* Fast Moving Inventory & Low Stock Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Fast Moving Inventory - For Ordering */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-orange-500" />
                Parts For Ordering (Due Today)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingParts ? (
                <div className="text-center py-4 text-muted-foreground">Loading...</div>
              ) : partsForServicesDueToday.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No parts for ordering under services due today
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service ID</TableHead>
                        <TableHead>Part Name</TableHead>
                        <TableHead>Requested By</TableHead>
                        <TableHead>Date Needed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partsForServicesDueToday.slice(0, 5).map((part) => (
                        <TableRow key={part.partId}>
                          <TableCell className="font-medium">{part.serviceId}</TableCell>
                          <TableCell>{part.partName}</TableCell>
                          <TableCell>{part.requestedBy}</TableCell>
                          <TableCell>{part.dateNeeded || "N/A"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {partsForServicesDueToday.length > 5 && (
                    <div className="text-center mt-2">
                      <Button 
                        variant="link" 
                        size="sm"
                        onClick={() => navigate('/inventory-management?tab=fast-moving')}
                      >
                        View all ({partsForServicesDueToday.length})
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock Inventory Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Low Stock Items (≤2)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingInventory ? (
                <div className="text-center py-4 text-muted-foreground">Loading...</div>
              ) : inventoryItems.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No low stock items
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Part ID</TableHead>
                        <TableHead>Part Name</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryItems.slice(0, 5).map((item) => (
                        <TableRow key={item.partId}>
                          <TableCell className="font-medium">{item.partId}</TableCell>
                          <TableCell>{item.partName}</TableCell>
                          <TableCell>{item.model || "N/A"}</TableCell>
                          <TableCell>
                            <span className="text-destructive font-semibold">{item.quantity}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {inventoryItems.length > 5 && (
                    <div className="text-center mt-2">
                      <Button 
                        variant="link" 
                        size="sm"
                        onClick={() => navigate('/inventory-management')}
                      >
                        View all ({inventoryItems.length})
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
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