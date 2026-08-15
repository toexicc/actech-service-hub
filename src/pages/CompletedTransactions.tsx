import { useState, useEffect, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { displayDate } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/DashboardLayout";
import { useDoneServices } from "@/hooks/useDoneServices";
import { ChevronRight } from "lucide-react";
import { ServiceBreakdownPanel } from "@/components/ServiceBreakdownPanel";
import { useAllServiceBreakdowns } from "@/hooks/useServiceBreakdowns";


const CompletedTransactions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const userRole = sessionStorage.getItem("userRole");

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
    if (userRole !== "management") {
      navigate("/menu", { replace: true });
    }
  }, [navigate, userRole]);

  const { data: services = [], isLoading, refetch } = useDoneServices();
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [commissionRate, setCommissionRate] = useState(0);
  
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
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
  }, [services, technicianFilter, departmentFilter, startDate, endDate]);

  // Actual allocations saved in the breakdown panel drive commissions.
  const { data: breakdownMap = {} } = useAllServiceBreakdowns(
    useMemo(() => filteredServices.map((s) => s.serviceId).filter(Boolean), [filteredServices]),
  );
  const allocatedFor = (serviceId: string) =>
    (breakdownMap[serviceId] ?? []).reduce((s, r) => s + (Number(r.cost) || 0), 0);
  const hasAllocation = (serviceId: string) => (breakdownMap[serviceId] ?? []).length > 0;

  // Single source of truth: no hidden department formulas.
  // Profit = quoted price - discount - parts cost. Commission = profit x rate%.
  const computeRow = (service: (typeof services)[number]) => {
    const partsCost = service.partsCost || 0;
    const discount = service.discount || 0;
    const profit = (service.quotedPrice || 0) - discount - partsCost;
    const allocated = hasAllocation(service.serviceId);
    const commission = allocated
      ? allocatedFor(service.serviceId)
      : Math.max(0, (profit * (commissionRate || 0)) / 100);
    return { partsCost, discount, profit, allocated, commission };
  };

  const financialSummary = useMemo(() => {
    let totalCommission = 0;
    let totalCosts = 0;
    let totalDiscounts = 0;
    let grossSales = 0;

    filteredServices.forEach((service) => {
      const { partsCost, discount, commission } = computeRow(service);
      grossSales += service.quotedPrice || 0;
      totalDiscounts += discount;
      totalCosts += partsCost;
      totalCommission += commission;
    });

    const netProfit = grossSales - totalDiscounts - totalCosts;

    return {
      grossSales,
      totalDiscounts,
      totalCosts,
      netProfit,
      commission: totalCommission,
      profitAfterCommission: netProfit - totalCommission,
    };
  }, [filteredServices, commissionRate, breakdownMap]);



  // Reset to the first page whenever the filters change the result set.
  useEffect(() => {
    setPage(1);
  }, [technicianFilter, departmentFilter, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedServices = useMemo(
    () => filteredServices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredServices, currentPage],
  );

  const uniqueTechnicians = useMemo(() => {
    return Array.from(new Set(services.map((s) => s.technician))).filter(Boolean);
  }, [services]);

  const uniqueDepartments = useMemo(() => {
    return Array.from(new Set(services.map((s) => s.department))).filter(Boolean);
  }, [services]);

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Completed Services</h1>
          <p className="text-muted-foreground">View Completed Services Overview</p>
        </div>

        {/* Financial Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Gross Sales</CardTitle>
            </CardHeader>
            <CardContent>
          <div className="text-2xl font-bold text-green-600">
            ₱{financialSummary.grossSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Discounts</CardTitle>
            </CardHeader>
            <CardContent>
          <div className="text-2xl font-bold text-amber-600">
            ₱{financialSummary.totalDiscounts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Costs</CardTitle>
            </CardHeader>
            <CardContent>
          <div className="text-2xl font-bold text-red-600">
            ₱{financialSummary.totalCosts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            ₱{financialSummary.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Commission
              </CardTitle>
            </CardHeader>
            <CardContent>
          <div className="text-2xl font-bold text-orange-600">
            ₱{financialSummary.commission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Final Profit</CardTitle>
            </CardHeader>
            <CardContent>
          <div className="text-2xl font-bold text-purple-600">
            ₱{financialSummary.profitAfterCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                <Label>Commission Rate (% of profit)</Label>
                <Input
                  type="number"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                  min="0"
                  max="100"
                  step="0.5"
                />
                <p className="text-xs text-muted-foreground">
                  Applied to Quoted Price − Discount − Parts Cost for the filtered tickets.
                </p>
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
                    <SelectItem value="Laptop (Daily Repairs)">Laptop (Daily Repairs)</SelectItem>
                    <SelectItem value="Laptop (Screens)">Laptop (Screens)</SelectItem>
                    <SelectItem value="Laptop (Logic Board)">Laptop (Logic Board)</SelectItem>
                    <SelectItem value="Mobile (Daily Repairs)">Mobile (Daily Repairs)</SelectItem>
                    <SelectItem value="Mobile (Logic Board)">Mobile (Logic Board)</SelectItem>
                    <SelectItem value="Others">Others</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label>Date Range</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "MMM dd, yyyy") : "Start"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                      <CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "MMM dd, yyyy") : "End"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                      <CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setTechnicianFilter("all");
                  setDepartmentFilter("all");
                  setStartDate(undefined);
                  setEndDate(undefined);
                  setCommissionRate(0);
                }}
              >
                Clear All Filters
              </Button>
              <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading} title="Reload table">
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Services Table */}
        <Card>
          <CardHeader>
            <CardTitle>Completed Services ({filteredServices.length})</CardTitle>
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
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Service ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Quoted Price</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Parts Cost</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedServices.map((service) => {
                      const { partsCost, discount, profit, allocated, commission } = computeRow(service);
                      const isOpen = expandedRow === service.serviceId;
                      const techList = (service.technician || "").split(",").map((s) => s.trim()).filter(Boolean);
                      return (
                        <Fragment key={service.serviceId}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => setExpandedRow(isOpen ? null : service.serviceId)}
                        >
                          <TableCell>
                            <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
                          </TableCell>
                          <TableCell className="font-medium">{service.serviceId}</TableCell>
                          <TableCell>{service.timestamp ? displayDate(service.timestamp, "MMM dd, yyyy, hh:mm a") : "N/A"}</TableCell>
                          <TableCell>{service.clientName}</TableCell>
                          <TableCell>{service.technician}</TableCell>
                          <TableCell>{service.department}</TableCell>
                      <TableCell className="text-right">₱{(service.quotedPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">₱{discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">₱{partsCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className={cn("text-right font-medium", profit >= 0 ? "text-green-600" : "text-red-600")}>
                        ₱{profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <span
                              className="text-orange-600 font-medium"
                              title={allocated ? "Total allocated in the service breakdown" : "Profit x commission rate"}
                            >
                              ₱{commission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </TableCell>

                        </TableRow>
                        {isOpen && (
                          <TableRow key={`${service.serviceId}-expand`}>
                            <TableCell colSpan={11} className="bg-muted/10">
                              <ServiceBreakdownPanel
                                serviceId={service.serviceId}
                                totalCost={(service.quotedPrice || 0) - discount}
                                defaultTechnicians={techList}
                                partsCost={partsCost}
                                commissionRate={commissionRate}
                              />
                            </TableCell>
                          </TableRow>
                        )}

                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {!isLoading && filteredServices.length > PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(currentPage * PAGE_SIZE, filteredServices.length)} of {filteredServices.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-8 text-sm text-muted-foreground">
          
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CompletedTransactions;
