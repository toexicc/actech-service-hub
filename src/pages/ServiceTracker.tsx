import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { ArrowUpDown, Calendar, Clock, AlertCircle } from "lucide-react";
import logo from "@/assets/ac-tech-logo.jpg";

interface ServiceRecord {
  serviceId: string;
  timestamp: string;
  technician: string;
  service: string;
  deviceType: string;
  brand: string;
  device: string;
  targetDate: string;
  status: string;
  clientName: string;
}

type SortField = "serviceId" | "timestamp" | "technician" | "inService" | "targetDate";
type SortOrder = "asc" | "desc";

const ServiceTracker = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("targetDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  useEffect(() => {
    fetchAllServices();
  }, []);

  const fetchAllServices = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=getAllOngoingServices`
      );
      const data = await response.json();

      if (data.status === "success" && data.services) {
        setServices(data.services);
      } else {
        toast({
          title: "Error",
          description: "Failed to load services",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({
        title: "Error",
        description: "Failed to load services",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateInServiceDays = (timestamp: string): number => {
    if (!timestamp) return 0;
    try {
      // Parse the timestamp format: "MM-DD-YYYY, HH:mm"
      const [datePart] = timestamp.split(", ");
      const [month, day, year] = datePart.split("-");
      const serviceDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return differenceInDays(new Date(), serviceDate);
    } catch (error) {
      return 0;
    }
  };

  const isOverdue = (targetDate: string): boolean => {
    if (!targetDate) return false;
    try {
      // Parse target date format: "MM-DD-YYYY"
      const [month, day, year] = targetDate.split("-");
      const target = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return new Date() > target;
    } catch (error) {
      return false;
    }
  };

  const deviceTypes = useMemo(() => {
    const types = new Set(services.map(s => s.deviceType).filter(Boolean));
    return Array.from(types).sort();
  }, [services]);

  const filteredAndSortedServices = useMemo(() => {
    let filtered = services.filter(service => {
      // Filter out completed/closed services
      const status = service.status?.toLowerCase() || "";
      if (status.includes("completed") || status.includes("closed") || status.includes("cancelled")) {
        return false;
      }

      // Device type filter
      if (deviceTypeFilter !== "all" && service.deviceType !== deviceTypeFilter) {
        return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let compareValue = 0;

      switch (sortField) {
        case "serviceId":
          compareValue = (a.serviceId || "").localeCompare(b.serviceId || "");
          break;
        case "timestamp":
          compareValue = (a.timestamp || "").localeCompare(b.timestamp || "");
          break;
        case "technician":
          compareValue = (a.technician || "").localeCompare(b.technician || "");
          break;
        case "inService":
          compareValue = calculateInServiceDays(a.timestamp) - calculateInServiceDays(b.timestamp);
          break;
        case "targetDate":
          compareValue = (a.targetDate || "").localeCompare(b.targetDate || "");
          break;
      }

      return sortOrder === "asc" ? compareValue : -compareValue;
    });

    return filtered;
  }, [services, deviceTypeFilter, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleServiceClick = (serviceId: string, deviceType: string) => {
    navigate(`/manage-client?serviceId=${serviceId}&deviceType=${deviceType}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-center mb-8">
          <img src={logo} alt="AC Tech Repair PH" className="h-16 mr-4" />
          <div>
            <h1 className="text-3xl font-bold">AC Tech Repair PH</h1>
            <p className="text-muted-foreground">Service Tracker Dashboard</p>
          </div>
        </div>

        <Button onClick={() => navigate("/admin-portal")} variant="outline" className="mb-6">
          Back to Admin Portal
        </Button>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Device Type</Label>
                <Select value={deviceTypeFilter} onValueChange={setDeviceTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Device Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Device Types</SelectItem>
                    {deviceTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sort By</Label>
                <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="targetDate">Target Date</SelectItem>
                    <SelectItem value="timestamp">Service Date</SelectItem>
                    <SelectItem value="inService">In Service Days</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="serviceId">Service ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Order</Label>
                <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Ongoing</p>
                  <p className="text-2xl font-bold">{filteredAndSortedServices.length}</p>
                </div>
                <Clock className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold text-destructive">
                    {filteredAndSortedServices.filter(s => isOverdue(s.targetDate)).length}
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">On Track</p>
                  <p className="text-2xl font-bold text-green-600">
                    {filteredAndSortedServices.filter(s => !isOverdue(s.targetDate) && s.targetDate).length}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Services Table */}
        <Card>
          <CardHeader>
            <CardTitle>Ongoing Services</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading services...</div>
            ) : filteredAndSortedServices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No ongoing services found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("serviceId")}>
                        <div className="flex items-center gap-1">
                          Service ID <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("timestamp")}>
                        <div className="flex items-center gap-1">
                          Service Date <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("technician")}>
                        <div className="flex items-center gap-1">
                          Technician <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead>Service/s</TableHead>
                      <TableHead>Device Type</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("targetDate")}>
                        <div className="flex items-center gap-1">
                          Target Date <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("inService")}>
                        <div className="flex items-center gap-1">
                          In Service <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedServices.map((service) => {
                      const inServiceDays = calculateInServiceDays(service.timestamp);
                      const overdueStatus = isOverdue(service.targetDate);

                      return (
                        <TableRow
                          key={service.serviceId}
                          className={`cursor-pointer hover:bg-muted/50 ${overdueStatus ? "bg-destructive/10" : ""}`}
                          onClick={() => handleServiceClick(service.serviceId, service.deviceType)}
                        >
                          <TableCell className="font-medium">
                            {service.serviceId}
                            {overdueStatus && <AlertCircle className="inline-block ml-2 h-4 w-4 text-destructive" />}
                          </TableCell>
                          <TableCell>{service.timestamp || "N/A"}</TableCell>
                          <TableCell>{service.technician || "Unassigned"}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={service.service}>
                            {service.service || "N/A"}
                          </TableCell>
                          <TableCell>{service.deviceType || "N/A"}</TableCell>
                          <TableCell>{service.brand || "N/A"}</TableCell>
                          <TableCell>{service.device || "N/A"}</TableCell>
                          <TableCell className={overdueStatus ? "text-destructive font-semibold" : ""}>
                            {service.targetDate || "N/A"}
                          </TableCell>
                          <TableCell>
                            <span className={`font-semibold ${inServiceDays > 7 ? "text-orange-600" : ""}`}>
                              {inServiceDays} {inServiceDays === 1 ? "day" : "days"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          powered by Stack&Scale
        </div>
      </div>
    </div>
  );
};

export default ServiceTracker;
