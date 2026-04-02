import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { useStaff } from "@/hooks/useStaff";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { logActivityAsync } from "@/lib/activityLogger";
import { displayDate } from "@/lib/timezone";

const parseCurrency = (val: string | number | undefined): number => {
  if (val === undefined || val === null || val === "") return 0;
  return parseFloat(String(val).replace(/[^0-9.\-]/g, "")) || 0;
};

const fmtCurrency = (val: number) =>
  `Php ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface SalaryLog {
  timestamp: string;
  staffId: string;
  staffName: string;
  salaryAmount: string;
  status: string;
}

interface ServiceRecord {
  serviceId: string;
  clientName: string;
  device: string;
  deviceType: string;
  finalCost: string;
  partsCost: string;
  technician: string;
  status: string;
}

const fetchSalaryLogs = async (): Promise<SalaryLog[]> => {
  const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getSalaryLogs`);
  const data = await response.json();
  if (data.status === "success" && data.logs) return data.logs;
  return [];
};

const fetchTechnicianServices = async (): Promise<ServiceRecord[]> => {
  const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getAllOngoingServices`);
  const data = await response.json();
  if (data.status === "success" && data.services) {
    return data.services.map((s: any) => ({
      serviceId: s.serviceId,
      clientName: s.clientName,
      device: s.device || s.deviceType || "",
      deviceType: s.deviceType || "",
      finalCost: s.serviceCost || "0",
      partsCost: "0",
      technician: s.technician || "",
      status: s.status || "",
    }));
  }
  return [];
};

const FUND_TYPES = ["Money In Bank", "Savings (General)", "Savings (Tax)", "Other Banks"];

const SalaryDisbursement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userRole = sessionStorage.getItem("userRole");
  const username = sessionStorage.getItem("userFullName") || sessionStorage.getItem("username") || "Unknown";

  const [activeTab, setActiveTab] = useState("disbursement");
  const [fundSource, setFundSource] = useState("Money In Bank");
  const [salaryPeriod, setSalaryPeriod] = useState<"15th Salary" | "End of Month Salary">("15th Salary");

  // Disbursement state
  const [commissions, setCommissions] = useState<Record<string, string>>({});
  const [bonuses, setBonuses] = useState<Record<string, string>>({});
  const [deductions, setDeductions] = useState<Record<string, string>>({});
  const [techCommissions, setTechCommissions] = useState<Record<string, string>>({});
  const [disbursing, setDisbursing] = useState<string | null>(null);
  const [disbursedList, setDisbursedList] = useState<{ staffId: string; staffName: string; amount: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Salary Logs state
  const [logSearch, setLogSearch] = useState("");
  const [logStartDate, setLogStartDate] = useState<Date | undefined>();
  const [logEndDate, setLogEndDate] = useState<Date | undefined>();
  const [logPage, setLogPage] = useState(1);
  const logsPerPage = 15;

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) navigate("/");
    if (userRole !== "management" && userRole !== "admin") navigate("/menu");
  }, [navigate, userRole]);

  const { data: staffData = [] } = useStaff();
  const { data: salaryLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ["salaryLogs"],
    queryFn: fetchSalaryLogs,
    staleTime: 60 * 1000,
  });
  const { data: allServices = [] } = useQuery({
    queryKey: ["techServices"],
    queryFn: fetchTechnicianServices,
    staleTime: 60 * 1000,
  });

  // Separate staff
  const fixedStaff = useMemo(() =>
    staffData.filter((s) => s.status?.toLowerCase() === "active" && parseCurrency((s as any).salary) > 0),
    [staffData]
  );

  const serviceBasedStaff = useMemo(() =>
    staffData.filter((s) => s.status?.toLowerCase() === "active" && (!(s as any).salary || parseCurrency((s as any).salary) === 0)),
    [staffData]
  );

  // Get services per technician
  const getServicesForStaff = (name: string) => {
    return allServices.filter((s) => s.technician?.toLowerCase() === name.toLowerCase() && (s.status?.toLowerCase() === "done" || s.status?.toLowerCase() === "completed"));
  };

  const getServiceCostTotal = (name: string) => {
    return getServicesForStaff(name).reduce((sum, s) => sum + parseCurrency(s.finalCost), 0);
  };

  const computeFixedFinal = (staff: any) => {
    const salary = parseCurrency(staff.salary);
    const commission = parseCurrency(commissions[staff.staffId]);
    const bonus = parseCurrency(bonuses[staff.staffId]);
    const deduction = parseCurrency(deductions[staff.staffId]);
    return salary + commission + bonus - deduction;
  };

  const computeServiceFinal = (staff: any) => {
    const serviceCost = getServiceCostTotal(staff.name);
    const commission = parseCurrency(techCommissions[staff.staffId]);
    // 10% markup from parts cost for Laptop Daily Repairs is auto-computed
    // Commission % is applied to service cost
    const commissionAmount = serviceCost * (commission / 100);
    return commissionAmount;
  };

  const handleDisburse = async (staff: any, finalAmount: number) => {
    if (finalAmount <= 0) {
      toast({ title: "Error", description: "Final amount must be greater than 0", variant: "destructive" });
      return;
    }
    if (disbursedList.some((d) => d.staffId === staff.staffId)) {
      toast({ title: "Already Disbursed", description: `${staff.name} has already been disbursed in this batch.`, variant: "destructive" });
      return;
    }
    setDisbursing(staff.staffId);
    try {
      const params = new URLSearchParams();
      params.append("action", "disburseSalary");
      params.append("staffId", staff.staffId);
      params.append("staffName", staff.name);
      params.append("salaryAmount", finalAmount.toFixed(2));
      params.append("status", "Disbursed");
      params.append("disbursedBy", username);
      params.append("fundSource", fundSource);

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, { method: "POST", body: params });
      let result: any = null;
      try { result = await response.json(); } catch { /* CORS */ }

      const isSuccess = (result && (result.status === "success" || result.result === "success")) || (response.ok && result === null);

      if (isSuccess) {
        toast({ title: "Disbursed", description: `Salary of ${fmtCurrency(finalAmount)} logged for ${staff.name}` });
        setDisbursedList((prev) => [...prev, { staffId: staff.staffId, staffName: staff.name, amount: finalAmount }]);
        // Reset inputs for this staff
        setCommissions((p) => ({ ...p, [staff.staffId]: "" }));
        setBonuses((p) => ({ ...p, [staff.staffId]: "" }));
        setDeductions((p) => ({ ...p, [staff.staffId]: "" }));
        setTechCommissions((p) => ({ ...p, [staff.staffId]: "" }));
        refetchLogs();
      } else {
        toast({ title: "Error", description: result?.message || "Failed to disburse", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to disburse salary", variant: "destructive" });
    } finally {
      setDisbursing(null);
    }
  };

  const totalDisbursed = disbursedList.reduce((sum, d) => sum + d.amount, 0);

  const handleSubmitBatch = async () => {
    if (disbursedList.length === 0) {
      toast({ title: "No Disbursements", description: "Disburse at least one staff member before submitting.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const params = new URLSearchParams();
      params.append("action", "addTransaction");
      params.append("transactionType", salaryPeriod);
      params.append("category", "Expenses");
      params.append("amount", totalDisbursed.toFixed(2));
      params.append("description", `${salaryPeriod} - ${disbursedList.length} staff members`);
      params.append("mop", "Bank Transfer");
      params.append("attendant", username);
      params.append("remarks", disbursedList.map((d) => `${d.staffName}: ${fmtCurrency(d.amount)}`).join("; "));
      params.append("fundSource", fundSource);

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, { method: "POST", body: params });
      let result: any = null;
      try { result = await response.json(); } catch { /* CORS */ }

      const isSuccess = (result && (result.status === "success" || result.result === "success")) || (response.ok && result === null);

      if (isSuccess) {
        toast({ title: "Submitted", description: `${salaryPeriod} transaction of ${fmtCurrency(totalDisbursed)} submitted successfully.` });
        logActivityAsync({
          serviceId: "SALARY",
          username,
          role: userRole || "",
          activity: `Submitted ${salaryPeriod} batch of ${fmtCurrency(totalDisbursed)} for ${disbursedList.length} staff from ${fundSource}`,
        });
        setDisbursedList([]);
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
      } else {
        toast({ title: "Error", description: "Failed to submit salary transaction", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to submit salary transaction", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Salary Logs filtering
  const filteredLogs = useMemo(() => {
    return salaryLogs.filter((log) => {
      if (logSearch) {
        const q = logSearch.toLowerCase();
        if (!log.staffName?.toLowerCase().includes(q) && !log.staffId?.toLowerCase().includes(q)) return false;
      }
      if (logStartDate || logEndDate) {
        const d = log.timestamp ? new Date(log.timestamp) : null;
        if (!d || isNaN(d.getTime())) return false;
        if (logStartDate && d < logStartDate) return false;
        if (logEndDate) { const end = new Date(logEndDate); end.setHours(23, 59, 59, 999); if (d > end) return false; }
      }
      return true;
    });
  }, [salaryLogs, logSearch, logStartDate, logEndDate]);

  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / logsPerPage));
  const paginatedLogs = filteredLogs.slice((logPage - 1) * logsPerPage, logPage * logsPerPage);

  // Group logs by date for dividers
  const getDateKey = (ts: string) => {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? "Unknown" : format(d, "MMMM dd, yyyy");
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Salary Disbursement</h1>
          <p className="text-muted-foreground">Manage staff salary and commission disbursements</p>
        </div>

        {/* Fund Source Selector */}
        <Card className="mb-4">
          <CardContent className="p-3 flex items-center gap-3">
            <Label className="text-sm font-medium whitespace-nowrap">Deduct From:</Label>
            <Select value={fundSource} onValueChange={setFundSource}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FUND_TYPES.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="disbursement">Disbursement</TabsTrigger>
            <TabsTrigger value="logs">Salary Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="disbursement" className="space-y-6 mt-4">
            {/* Fixed Salary Staff */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Fixed Salary Employees</CardTitle>
              </CardHeader>
              <CardContent>
                {fixedStaff.length === 0 ? (
                  <p className="text-center py-6 text-muted-foreground">No fixed salary staff found. Set salary in Staff Management.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Staff Name</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Salary</TableHead>
                          <TableHead>Commission/Bonus</TableHead>
                          <TableHead>Deductions</TableHead>
                          <TableHead>Final Amount</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fixedStaff.map((staff: any) => {
                          const final = computeFixedFinal(staff);
                          return (
                            <TableRow key={staff.staffId}>
                              <TableCell className="font-medium">{staff.name}</TableCell>
                              <TableCell className="capitalize">{staff.role}</TableCell>
                              <TableCell>{fmtCurrency(parseCurrency(staff.salary))}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  className="w-24"
                                  value={commissions[staff.staffId] || ""}
                                  onChange={(e) => setCommissions((p) => ({ ...p, [staff.staffId]: e.target.value }))}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  className="w-24"
                                  value={deductions[staff.staffId] || ""}
                                  onChange={(e) => setDeductions((p) => ({ ...p, [staff.staffId]: e.target.value }))}
                                />
                              </TableCell>
                              <TableCell className="font-bold">{fmtCurrency(final)}</TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  onClick={() => handleDisburse(staff, final)}
                                  disabled={disbursing === staff.staffId || final <= 0}
                                >
                                  {disbursing === staff.staffId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disburse"}
                                </Button>
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

            {/* Service Based Staff */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Service Based Employees</CardTitle>
              </CardHeader>
              <CardContent>
                {serviceBasedStaff.length === 0 ? (
                  <p className="text-center py-6 text-muted-foreground">No service-based staff found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Staff Name</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Service Cost (Total)</TableHead>
                          <TableHead>Commission %</TableHead>
                          <TableHead>Final Amount</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {serviceBasedStaff.map((staff: any) => {
                          const serviceCostTotal = getServiceCostTotal(staff.name);
                          const commPct = parseCurrency(techCommissions[staff.staffId]);
                          const final = serviceCostTotal * (commPct / 100);
                          return (
                            <TableRow key={staff.staffId}>
                              <TableCell className="font-medium">{staff.name}</TableCell>
                              <TableCell>{staff.department || "-"}</TableCell>
                              <TableCell>{fmtCurrency(serviceCostTotal)}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="%"
                                  className="w-20"
                                  value={techCommissions[staff.staffId] || ""}
                                  onChange={(e) => setTechCommissions((p) => ({ ...p, [staff.staffId]: e.target.value }))}
                                />
                              </TableCell>
                              <TableCell className="font-bold">{fmtCurrency(final)}</TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  onClick={() => handleDisburse(staff, final)}
                                  disabled={disbursing === staff.staffId || final <= 0}
                                >
                                  {disbursing === staff.staffId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disburse"}
                                </Button>
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
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Salary Logs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Input
                      placeholder="Search by name or staff ID..."
                      value={logSearch}
                      onChange={(e) => { setLogSearch(e.target.value); setLogPage(1); }}
                    />
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-[130px]", !logStartDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {logStartDate ? format(logStartDate, "MMM dd") : "From"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={logStartDate} onSelect={setLogStartDate} className="pointer-events-auto" /></PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-[130px]", !logEndDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {logEndDate ? format(logEndDate, "MMM dd") : "To"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={logEndDate} onSelect={setLogEndDate} className="pointer-events-auto" /></PopoverContent>
                  </Popover>
                  {(logStartDate || logEndDate) && (
                    <Button variant="ghost" size="sm" onClick={() => { setLogStartDate(undefined); setLogEndDate(undefined); }}>Clear</Button>
                  )}
                </div>

                {/* Logs Table */}
                {filteredLogs.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No salary logs found</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Staff ID</TableHead>
                            <TableHead>Staff Name</TableHead>
                            <TableHead>Salary Amount</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            let lastDateKey = "";
                            return paginatedLogs.map((log, idx) => {
                              const dateKey = getDateKey(log.timestamp);
                              const showDivider = dateKey !== lastDateKey;
                              lastDateKey = dateKey;
                              return (
                                <>
                                  {showDivider && (
                                    <TableRow key={`divider-${idx}`}>
                                      <TableCell colSpan={5} className="bg-muted/50 text-xs font-semibold text-muted-foreground py-2">
                                        {dateKey}
                                      </TableCell>
                                    </TableRow>
                                  )}
                                  <TableRow key={`log-${idx}`}>
                                    <TableCell className="text-xs">{log.timestamp ? displayDate(log.timestamp, "MMM dd, yyyy hh:mm a") : "-"}</TableCell>
                                    <TableCell className="font-mono text-xs">{log.staffId}</TableCell>
                                    <TableCell>{log.staffName}</TableCell>
                                    <TableCell className="font-semibold">{fmtCurrency(parseCurrency(log.salaryAmount))}</TableCell>
                                    <TableCell>
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        {log.status}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                </>
                              );
                            });
                          })()}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    {totalLogPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-sm text-muted-foreground">
                          Showing {(logPage - 1) * logsPerPage + 1}-{Math.min(logPage * logsPerPage, filteredLogs.length)} of {filteredLogs.length}
                        </p>
                        <div className="flex gap-1">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setLogPage((p) => Math.max(1, p - 1))} disabled={logPage === 1}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setLogPage((p) => Math.min(totalLogPages, p + 1))} disabled={logPage >= totalLogPages}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="text-center mt-8 text-sm text-muted-foreground">
          powered by Stack&Scale
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SalaryDisbursement;
