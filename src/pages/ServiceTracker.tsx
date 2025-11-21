import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays, subDays, startOfMonth, endOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { STATUS_OPTIONS } from "@/lib/constants";
import { ArrowUpDown, Calendar, Clock, AlertCircle, CalendarIcon, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/ac-tech-logo.jpg";
import ActivityLogRow from "@/components/ActivityLogRow";

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
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [techniciansWithDept, setTechniciansWithDept] = useState<Array<{name: string, department: string}>>([]);
  const [sortField, setSortField] = useState<SortField>("targetDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dueDateFilter, setDueDateFilter] = useState("all");
  const itemsPerPage = 15;

  // Check if user is a technician with locked filters
  const userRole = sessionStorage.getItem("userRole");
  const username = sessionStorage.getItem("username");
  const isTechnician = userRole === "technician";
  const [technicianName, setTechnicianName] = useState("");
  const [technicianDepartment, setTechnicianDepartment] = useState("");

  const applyDatePreset = (preset: string) => {
    const today = new Date();
    
    switch (preset) {
      case "last7":
        setStartDate(subDays(today, 7));
        setEndDate(today);
        break;
      case "last30":
        setStartDate(subDays(today, 30));
        setEndDate(today);
        break;
      case "thisMonth":
        setStartDate(startOfMonth(today));
        setEndDate(endOfMonth(today));
        break;
      case "clear":
        setStartDate(undefined);
        setEndDate(undefined);
        break;
    }
  };

  useEffect(() => {
    fetchTechnicians();
  }, []);

  useEffect(() => {
    // Fetch technician info and set filters if user is a technician
    const initializeTechnicianFilters = async () => {
      if (isTechnician && username) {
        try {
          const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getStaffList`);
          const data = await response.json();
          if (data.status === "success" && data.data) {
            const techInfo = data.data.find((staff: any) => staff.username === username);
            if (techInfo) {
              setTechnicianName(techInfo.name);
              setTechnicianDepartment(techInfo.department || "");
              setTechnicianFilter(techInfo.name);
              setDepartmentFilter(techInfo.department || "all");
            }
          }
        } catch (error) {
          console.error("Error fetching technician info:", error);
        }
      }
      fetchAllServices();
    };

    initializeTechnicianFilters();
    
    // Set up polling for real-time updates every 30 seconds
    const intervalId = setInterval(() => {
      fetchAllServices();
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [isTechnician, username]);

  // Refresh data when filters change to ensure accurate filtering
  useEffect(() => {
    if (technicianFilter !== "all" || departmentFilter !== "all") {
      fetchAllServices();
    }
  }, [technicianFilter, departmentFilter]);

  const fetchTechnicians = async () => {
    try {
      const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getStaffList`);
      const data = await response.json();
      if (data.status === "success" && data.data) {
        const techList = data.data
          .filter((staff: any) => staff.role === "Technician" && staff.status === "Active")
          .map((staff: any) => ({
            name: staff.name,
            department: staff.department || ""
          }));
        setTechniciansWithDept(techList);
      }
    } catch (error) {
      console.error("Error fetching technicians:", error);
    }
  };

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

  const calculateInServiceDays = (timestamp: string, status?: string): number => {
    // Completed services should not accumulate in-service days
    if (status && status.toLowerCase().includes("completed")) {
      return 0;
    }
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

  const isOverdue = (targetDate: string, status: string): boolean => {
    if (!targetDate) return false;
    // Completed services should never be marked as overdue
    if (status === "Completed") return false;
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

  const getDaysUntilDue = (targetDate: string): number => {
    if (!targetDate) return 999;
    try {
      const parts = targetDate.split(/[-/]/);
      if (parts.length !== 3) return 999;
      
      const [month, day, year] = parts;
      const target = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      target.setHours(23, 59, 59, 999);
      
      if (isNaN(target.getTime())) return 999;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      return differenceInDays(target, today);
    } catch (error) {
      return 999;
    }
  };

  const deviceTypes = useMemo(() => {
    const types = new Set(services.map(s => s.deviceType).filter(Boolean));
    return Array.from(types).sort();
  }, [services]);

  const technicians = useMemo(() => {
    const techs = new Set(services.map(s => s.technician).filter(Boolean));
    return Array.from(techs).sort();
  }, [services]);

  const filteredAndSortedServices = useMemo(() => {
    // Don't filter while loading to prevent showing unfiltered data
    if (isLoading) {
      return [];
    }

    let filtered = services.filter(service => {
      // Do NOT filter out any services by status - show ALL services

      // Search filter - search by Service ID or Client Name
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesServiceId = service.serviceId?.toLowerCase().includes(query);
        const matchesClientName = service.clientName?.toLowerCase().includes(query);
        
        if (!matchesServiceId && !matchesClientName) {
          return false;
        }
      }

      // Device type filter
      if (deviceTypeFilter !== "all" && service.deviceType !== deviceTypeFilter) {
        return false;
      }

      // Technician filter - if a specific technician is selected, show ONLY their services
      if (technicianFilter !== "all") {
        if (service.technician !== technicianFilter) {
          return false;
        }
      } else if (departmentFilter !== "all") {
        // Department filter - only apply if no specific technician is selected
        const techDept = techniciansWithDept.find(t => t.name === service.technician)?.department;
        if (techDept !== departmentFilter) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "all" && service.status !== statusFilter) {
        return false;
      }

      // Date range filter - filter by TARGET DATE
      if (startDate || endDate) {
        try {
          const targetParts = service.targetDate.split(/[-/]/);
          if (targetParts.length === 3) {
            const [month, day, year] = targetParts;
            const targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            targetDate.setHours(0, 0, 0, 0);
            
            if (startDate) {
              const start = new Date(startDate);
              start.setHours(0, 0, 0, 0);
              if (targetDate < start) {
                return false;
              }
            }
            
            if (endDate) {
              const end = new Date(endDate);
              end.setHours(23, 59, 59, 999);
              if (targetDate > end) {
                return false;
              }
            }
          }
        } catch (error) {
          console.error("Error parsing target date for filter:", error);
        }
      }

      // Due date filter
      if (dueDateFilter !== "all") {
        const daysUntilDue = getDaysUntilDue(service.targetDate);
        
        if (dueDateFilter === "overdue") {
          if (!isOverdue(service.targetDate, service.status)) return false;
        } else if (dueDateFilter === "dueToday") {
          if (daysUntilDue !== 0) return false;
        } else if (dueDateFilter === "dueSoon") {
          if (daysUntilDue < 0 || daysUntilDue >= 2) return false;
        }
      }

      return true;
    });

    // Sort: Put overdue services at the top, and completed/closed/cancelled at the bottom
    filtered.sort((a, b) => {
      const aStatus = a.status?.toLowerCase() || "";
      const bStatus = b.status?.toLowerCase() || "";

      // 1. Overdue services always on top
      const aOverdue = isOverdue(a.targetDate, a.status) || aStatus.includes("overdue");
      const bOverdue = isOverdue(b.targetDate, b.status) || bStatus.includes("overdue");

      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      // 2. Completed/closed/cancelled services at the bottom
      const aIsCompleted = aStatus.includes("completed") || aStatus.includes("closed") || aStatus.includes("cancelled");
      const bIsCompleted = bStatus.includes("completed") || bStatus.includes("closed") || bStatus.includes("cancelled");
      
      if (aIsCompleted && !bIsCompleted) return 1;
      if (!aIsCompleted && bIsCompleted) return -1;
      
      // 3. Otherwise, sort by selected field
      let compareValue = 0;

      switch (sortField) {
        case "timestamp":
          compareValue = (a.timestamp || "").localeCompare(b.timestamp || "");
          break;
        case "technician":
          compareValue = (a.technician || "").localeCompare(b.technician || "");
          break;
        case "inService":
          compareValue = calculateInServiceDays(a.timestamp, a.status) - calculateInServiceDays(b.timestamp, b.status);
          break;
        case "targetDate":
          compareValue = (a.targetDate || "").localeCompare(b.targetDate || "");
          break;
      }

      return sortOrder === "asc" ? compareValue : -compareValue;
    });

    return filtered;
  }, [services, deviceTypeFilter, technicianFilter, departmentFilter, statusFilter, startDate, endDate, sortField, sortOrder, searchQuery, dueDateFilter, techniciansWithDept]);

  const departments = useMemo(() => {
    const depts = new Set(techniciansWithDept.map(t => t.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [techniciansWithDept]);

  const paginatedServices = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedServices.slice(startIndex, endIndex);
  }, [filteredAndSortedServices, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedServices.length / itemsPerPage);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [deviceTypeFilter, technicianFilter, departmentFilter, startDate, endDate, sortField, sortOrder, searchQuery, dueDateFilter]);

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
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl w-full">
        {/* Header */}
        <div className="flex items-center justify-center mb-8">
          <img src={logo} alt="AC Tech Repair PH" className="h-16 mr-4" />
          <div>
            <h1 className="text-3xl font-bold">AC Tech Repair PH</h1>
            <p className="text-muted-foreground">Service Tracker Dashboard</p>
          </div>
        </div>

        <Button onClick={() => navigate(isTechnician ? "/technician-portal" : "/admin-portal")} variant="outline" className="mb-6">
          Back to {isTechnician ? "Technician" : "Admin"} Portal
        </Button>

        {/* Search Bar */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by Service ID or Client Name..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSearchQuery(searchInput);
                    }
                  }}
                  onFocus={(e) => {
                    if (!e.target.value) {
                      setSearchInput("AC");
                      e.target.setSelectionRange(2, 2);
                    }
                  }}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => setSearchQuery(searchInput)}>
                Search
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
                }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-7">
              <div className="space-y-2">
                <Label>Due Date Status</Label>
                <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Services" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="dueToday">Due Today</SelectItem>
                    <SelectItem value="dueSoon">Due Soon (&lt;2 days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
                <Label>Technician</Label>
                <Select 
                  value={technicianFilter} 
                  onValueChange={setTechnicianFilter}
                  disabled={isTechnician}
                >
                  <SelectTrigger className={isTechnician ? "opacity-60 cursor-not-allowed" : ""}>
                    <SelectValue placeholder="All Technicians" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-md z-[100] max-h-[300px] overflow-y-auto">
                    <SelectItem value="all">All Technicians</SelectItem>
                    {techniciansWithDept.map(tech => (
                      <SelectItem key={tech.name} value={tech.name}>
                        {tech.name} - {tech.department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isTechnician && (
                  <p className="text-xs text-muted-foreground">Locked to your account</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <Select 
                  value={departmentFilter} 
                  onValueChange={setDepartmentFilter}
                  disabled={isTechnician}
                >
                  <SelectTrigger className={isTechnician ? "opacity-60 cursor-not-allowed" : ""}>
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-md z-[100]">
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isTechnician && (
                  <p className="text-xs text-muted-foreground">Locked to your department</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-md z-[100] max-h-[300px] overflow-y-auto">
                    <SelectItem value="all">All Statuses</SelectItem>
                    {STATUS_OPTIONS.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sort By</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "From date"}
                      {startDate && (
                        <X 
                          className="ml-auto h-4 w-4" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setStartDate(undefined);
                          }}
                        />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "To date"}
                      {endDate && (
                        <X 
                          className="ml-auto h-4 w-4" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEndDate(undefined);
                          }}
                        />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      disabled={(date) => startDate ? date < startDate : false}
                    />
                  </PopoverContent>
                </Popover>
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

              <div className="space-y-2 lg:col-span-4">
                <Label>Quick Date Filters</Label>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => applyDatePreset("last7")}
                  >
                    Last 7 Days
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => applyDatePreset("last30")}
                  >
                    Last 30 Days
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => applyDatePreset("thisMonth")}
                  >
                    This Month
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => applyDatePreset("clear")}
                  >
                    Clear Date Filter
                  </Button>
                </div>
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
                  <p className="text-2xl font-bold">
                    {filteredAndSortedServices.filter(s => {
                      const status = s.status?.toLowerCase() || "";
                      return !status.includes("completed") && !status.includes("cancelled");
                    }).length}
                  </p>
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
                    {filteredAndSortedServices.filter(s => {
                      const status = s.status?.toLowerCase() || "";
                      const isOngoing = !status.includes("completed") && !status.includes("cancelled");
                      return isOngoing && isOverdue(s.targetDate, s.status);
                    }).length}
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
                    {filteredAndSortedServices.filter(s => {
                      const status = s.status?.toLowerCase() || "";
                      const isOngoing = !status.includes("completed") && !status.includes("cancelled");
                      return isOngoing && !isOverdue(s.targetDate, s.status) && s.targetDate;
                    }).length}
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
                      <TableHead>Client Name</TableHead>
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
                       const inServiceDays = calculateInServiceDays(service.timestamp, service.status);
                       const overdueStatus = isOverdue(service.targetDate, service.status);
                       const isCompleted = (service.status || "").toLowerCase().includes("completed");

                       return (
                         <ActivityLogRow
                           key={service.serviceId}
                           service={service}
                           overdueStatus={overdueStatus}
                           inServiceDays={inServiceDays}
                         >
                           <TableCell className="font-medium">
                             {service.serviceId}
                             {overdueStatus && <AlertCircle className="inline-block ml-2 h-4 w-4 text-destructive" />}
                           </TableCell>
                           <TableCell>{service.status || "N/A"}</TableCell>
                           <TableCell>{service.clientName || "N/A"}</TableCell>
                           <TableCell>{service.timestamp || "N/A"}</TableCell>
                           <TableCell>
                             <div className="flex flex-col">
                               <span>{service.technician || "Unassigned"}</span>
                               <span className="text-xs text-muted-foreground">
                                 {techniciansWithDept.find(t => t.name === service.technician)?.department || ""}
                               </span>
                             </div>
                           </TableCell>
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
                             {isCompleted ? (
                               <span className="text-muted-foreground">-</span>
                             ) : (
                               <span className={`font-semibold ${inServiceDays > 7 ? "text-orange-600" : ""}`}>
                                 {inServiceDays} {inServiceDays === 1 ? "day" : "days"}
                               </span>
                             )}
                           </TableCell>
                         </ActivityLogRow>
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
