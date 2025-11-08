import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
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

type SortField = "timestamp" | "technician" | "inService" | "targetDate";
type SortOrder = "asc" | "desc";

const ServiceTracker = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("targetDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

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
      // Parse the timestamp format: "MM/DD/YYYY" or "MM-DD-YYYY, HH:mm"
      const [datePart] = timestamp.split(", ");
      const parts = datePart.split(/[-/]/); // Handle both - and / separators
      if (parts.length !== 3) return 0;
      
      const [month, day, year] = parts;
      const serviceDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      serviceDate.setHours(0, 0, 0, 0); // Set to start of day
      
      if (isNaN(serviceDate.getTime())) {
        console.error("Invalid service date:", timestamp, serviceDate);
        return 0;
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day for fair comparison
      
      const days = differenceInDays(today, serviceDate);
      console.log("Calculating days for:", timestamp, "Service Date:", serviceDate, "Today:", today, "Days:", days);
      
      return Math.max(0, days);
    } catch (error) {
      console.error("Error calculating in service days:", error);
      return 0;
    }
  };

  const isOverdue = (targetDate: string): boolean => {
    if (!targetDate) return false;
    try {
      // Parse target date format: "MM-DD-YYYY" or "MM/DD/YYYY"
      const parts = targetDate.split(/[-/]/); // Handle both - and / separators
      if (parts.length !== 3) return false;
      
      const [month, day, year] = parts;
      const target = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      target.setHours(23, 59, 59, 999); // Set to end of day
      
      if (isNaN(target.getTime())) return false;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day
      
      return today > target;
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

  const paginatedServices = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedServices.slice(startIndex, endIndex);
  }, [filteredAndSortedServices, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedServices.length / itemsPerPage);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [deviceTypeFilter, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
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
                      <TableHead>Service ID</TableHead>
                      <TableHead>Status</TableHead>
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
                    {paginatedServices.map((service) => {
                      const inServiceDays = calculateInServiceDays(service.timestamp);
                      const overdueStatus = isOverdue(service.targetDate);

                      return (
                        <TableRow
                          key={service.serviceId}
                          className={overdueStatus ? "bg-destructive/10" : ""}
                        >
                          <TableCell className="font-medium">
                            {service.serviceId}
                            {overdueStatus && <AlertCircle className="inline-block ml-2 h-4 w-4 text-destructive" />}
                          </TableCell>
                          <TableCell>{service.status || "N/A"}</TableCell>
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

            {!isLoading && filteredAndSortedServices.length > 0 && (
              <div className="mt-6">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                      return null;
                    })}

                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                <div className="text-center mt-2 text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages} • Showing {paginatedServices.length} of {filteredAndSortedServices.length} services
                </div>
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
