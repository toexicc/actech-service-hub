import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays, subDays, startOfMonth, endOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { CalendarIcon, Loader2, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/ac-tech-logo.jpg";

interface DoneService {
  serviceId: string;
  timestamp: string;
  technician: string;
  department: string;
  deviceType: string;
  clientName: string;
  service: string;
  quotedPrice: number;
  actualCost: number;
}

const TransactionTracker = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const userRole = sessionStorage.getItem("userRole");

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
    if (userRole !== "management") {
      navigate("/admin-portal");
    }
  }, [navigate, userRole]);

  const [services, setServices] = useState<DoneService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [commissionRate, setCommissionRate] = useState(15);

  useEffect(() => {
    fetchDoneServices();
  }, []);

  const fetchDoneServices = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=getDoneServices`
      );
      const data = await response.json();

      if (data.status === "success" && data.services) {
        setServices(data.services);
      } else {
        toast({
          title: "Error",
          description: "Failed to load completed services",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({
        title: "Error",
        description: "Failed to load completed services",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      // Device type filter
      if (deviceTypeFilter !== "all" && service.deviceType !== deviceTypeFilter) {
        return false;
      }

      // Technician filter
      if (technicianFilter !== "all" && service.technician !== technicianFilter) {
        return false;
      }

      // Department filter
      if (departmentFilter !== "all" && service.department !== departmentFilter) {
        return false;
      }

      // Date range filter
      if (startDate || endDate) {
        try {
          const [datePart] = service.timestamp.split(" ");
          const [month, day, year] = datePart.split(/[-/]/);
          const serviceDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

          if (startDate && serviceDate < startDate) return false;
          if (endDate && serviceDate > endDate) return false;
        } catch (error) {
          return false;
        }
      }

      return true;
    });
  }, [services, deviceTypeFilter, technicianFilter, departmentFilter, startDate, endDate]);

  const financialSummary = useMemo(() => {
    const grossSales = filteredServices.reduce((sum, s) => sum + (s.quotedPrice || 0), 0);
    const totalCosts = filteredServices.reduce((sum, s) => sum + (s.actualCost || 0), 0);
    const netProfit = grossSales - totalCosts;
    const commission = (netProfit * commissionRate) / 100;
    const profitAfterCommission = netProfit - commission;

    return {
      grossSales,
      totalCosts,
      netProfit,
      commission,
      profitAfterCommission,
    };
  }, [filteredServices, commissionRate]);

  const uniqueTechnicians = useMemo(() => {
    return Array.from(new Set(services.map((s) => s.technician))).filter(Boolean);
  }, [services]);

  const uniqueDepartments = useMemo(() => {
    return Array.from(new Set(services.map((s) => s.department))).filter(Boolean);
  }, [services]);

  const uniqueDeviceTypes = useMemo(() => {
    return Array.from(new Set(services.map((s) => s.deviceType))).filter(Boolean);
  }, [services]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container mx-auto p-6 max-w-7xl flex-grow">
        <div className="flex items-center justify-center mb-8">
          <img src={logo} alt="AC Tech Repair PH" className="h-16 mr-4" />
          <div>
            <h1 className="text-3xl font-bold">AC Tech Repair PH</h1>
            <p className="text-muted-foreground">Transaction Tracker</p>
          </div>
        </div>

        <div className="mb-6">
          <Button onClick={() => navigate("/admin-portal")} variant="outline">
            Back to Admin Portal
          </Button>
        </div>

        {/* Financial Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Gross Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ₱{financialSummary.grossSales.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Costs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                ₱{financialSummary.totalCosts.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                ₱{financialSummary.netProfit.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Commission ({commissionRate}%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                ₱{financialSummary.commission.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Final Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                ₱{financialSummary.profitAfterCommission.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <Label>Commission Rate (%)</Label>
                <Input
                  type="number"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                  min="0"
                  max="100"
                  step="0.5"
                />
              </div>

              <div className="space-y-2">
                <Label>Device Type</Label>
                <Select value={deviceTypeFilter} onValueChange={setDeviceTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {uniqueDeviceTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Technician</Label>
                <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Technicians" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Technicians</SelectItem>
                    {uniqueTechnicians.map((tech) => (
                      <SelectItem key={tech} value={tech}>
                        {tech}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {uniqueDepartments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date Range</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "MMM dd, yyyy") : "Start"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "MMM dd, yyyy") : "End"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setDeviceTypeFilter("all");
                  setTechnicianFilter("all");
                  setDepartmentFilter("all");
                  setStartDate(undefined);
                  setEndDate(undefined);
                  setCommissionRate(15);
                }}
              >
                Clear All Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Services Table */}
        <Card>
          <CardHeader>
            <CardTitle>Completed Transactions ({filteredServices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : filteredServices.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No completed transactions found
              </p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Device Type</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Quoted Price</TableHead>
                      <TableHead className="text-right">Actual Cost</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredServices.map((service) => {
                      const profit = (service.quotedPrice || 0) - (service.actualCost || 0);
                      return (
                        <TableRow key={service.serviceId}>
                          <TableCell className="font-medium">{service.serviceId}</TableCell>
                          <TableCell>{service.timestamp}</TableCell>
                          <TableCell>{service.clientName}</TableCell>
                          <TableCell>{service.deviceType}</TableCell>
                          <TableCell>{service.technician}</TableCell>
                          <TableCell>{service.department}</TableCell>
                          <TableCell className="text-right">₱{service.quotedPrice?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-right">₱{service.actualCost?.toLocaleString() || 0}</TableCell>
                          <TableCell className={cn("text-right font-medium", profit >= 0 ? "text-green-600" : "text-red-600")}>
                            ₱{profit.toLocaleString()}
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
      </div>

      <footer className="mt-auto py-4 text-center text-sm text-muted-foreground border-t">
        Powered by Stack&Scale
      </footer>
    </div>
  );
};

export default TransactionTracker;
