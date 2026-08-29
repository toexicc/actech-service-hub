import { useState, useEffect, useMemo } from "react";
import { workedHours, FULL_SHIFT_HOURS } from "@/lib/attendanceHours";
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
import { DATA_BRIDGE_URL } from "@/lib/dataBridge";
import { useStaff } from "@/hooks/useStaff";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { logActivityAsync } from "@/lib/activityLogger";
import { displayDate, parseManilaDate } from "@/lib/timezone";
import { supabase } from "@/integrations/supabase/client";
import { useAllServiceBreakdowns, type ServiceBreakdown } from "@/hooks/useServiceBreakdowns";


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
  const response = await fetch(`${DATA_BRIDGE_URL}?action=getSalaryLogs`);
  const data = await response.json();
  if (data.status === "success" && data.logs) return data.logs;
  return [];
};

const fetchTechnicianServices = async (): Promise<ServiceRecord[]> => {
  const { data, error } = await supabase
    .from("services")
    .select("service_id, client_name, device_type, final_cost, total_cost, parts_cost, technicians, status, date_completed, last_updated")
    .limit(2000);
  if (error) return [];
  return (data ?? []).map((s: any) => ({
    serviceId: s.service_id ?? "",
    clientName: s.client_name ?? "",
    device: s.device_type ?? "",
    deviceType: s.device_type ?? "",
    finalCost: String(s.final_cost || s.total_cost || 0),
    partsCost: String(s.parts_cost ?? 0),
    technician: Array.isArray(s.technicians) ? s.technicians.join(", ") : (s.technicians ?? ""),
    status: s.status ?? "",
    timestamp: s.date_completed ?? s.last_updated ?? "",
  }));
};

const FUND_TYPES = ["Money In Bank", "Savings (General)", "Savings (Tax)", "Other Banks"];
const EXPENSE_TYPES = ["Parts Inventory", "Rent", "Miscellaneous Expense", "Salary Disbursement"];
const REFUND_TYPE = "Refund";

const fetchTransactions = async (): Promise<any[]> => {
  const { data, error } = await supabase
    .from("transactions")
    .select("amount, type, fund_name")
    .limit(5000);
  if (error) return [];
  return (data ?? []).map((t: any) => ({
    amount: t.amount,
    transactionType: t.type ?? "",
    fundSource: t.fund_name || "Money In Bank",
  }));
};


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

  // Calculator inputs (per staff)
  const [daysPresent, setDaysPresent] = useState<Record<string, string>>({});
  const [dailyRateOverride, setDailyRateOverride] = useState<Record<string, string>>({});
  const [pagibig, setPagibig] = useState<Record<string, string>>({});
  const [sss, setSss] = useState<Record<string, string>>({});
  const [philhealth, setPhilhealth] = useState<Record<string, string>>({});

  // Mon-Sat workdays in the active half-period
  const workdaysInPeriod = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const startDay = salaryPeriod === "15th Salary" ? 1 : 16;
    const endDay = salaryPeriod === "15th Salary" ? 15 : new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let d = startDay; d <= endDay; d++) {
      const dow = new Date(year, month, d).getDay(); // 0 Sun ... 6 Sat
      if (dow !== 0) count++;
    }
    return count;
  }, [salaryPeriod]);

  // Period date range (for attendance auto-fill)
  const periodRange = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const startDay = salaryPeriod === "15th Salary" ? 1 : 16;
    const endDay = salaryPeriod === "15th Salary" ? 15 : new Date(year, month + 1, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      start: `${year}-${pad(month + 1)}-${pad(startDay)}`,
      end: `${year}-${pad(month + 1)}-${pad(endDay)}`,
    };
  }, [salaryPeriod]);

  // Pull attendance for the active period and count days present per staff.
  const { data: periodAttendance = [] } = useQuery({
    queryKey: ["attendance", periodRange.start, periodRange.end],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_logs")
        .select("staff_id,log_date,time_in,time_out")
        .gte("log_date", periodRange.start)
        .lte("log_date", periodRange.end);
      return data || [];
    },
    staleTime: 60 * 1000,
  });

  /**
   * Days present per staff, derived from worked hours (unpaid 12-1 PM lunch
   * excluded, 8 hours = one full day). Days with a Time In but no Time Out
   * still count as a full day so payroll is not penalised by a missing tap-out.
   */
  const attendanceByStaffId = useMemo(() => {
    const m: Record<string, number> = {};
    periodAttendance.forEach((r: any) => {
      if (!r.time_in) return;
      const hrs = workedHours(r.time_in, r.time_out);
      const dayValue = r.time_out
        ? Math.min(1, Math.round((hrs / FULL_SHIFT_HOURS) * 100) / 100)
        : 1;
      m[r.staff_id] = Math.round(((m[r.staff_id] || 0) + dayValue) * 100) / 100;
    });
    return m;
  }, [periodAttendance]);

  /** Total worked hours per staff for the period (lunch excluded). */
  const hoursByStaffId = useMemo(() => {
    const m: Record<string, number> = {};
    periodAttendance.forEach((r: any) => {
      if (!r.time_in || !r.time_out) return;
      m[r.staff_id] = Math.round(((m[r.staff_id] || 0) + workedHours(r.time_in, r.time_out)) * 100) / 100;
    });
    return m;
  }, [periodAttendance]);

  const computeCalculator = (staff: any) => {
    const monthly = parseCurrency(staff.salary);
    const autoDaily = workdaysInPeriod > 0 ? monthly / workdaysInPeriod : 0;
    const daily = parseCurrency(dailyRateOverride[staff.staffId]) || autoDaily;
    const attendanceDays = attendanceByStaffId[staff.userId] ?? 0;
    const override = daysPresent[staff.staffId];
    const days = override !== undefined && override !== "" ? parseCurrency(override) : attendanceDays;
    const gross = days * daily;
    const dPagibig = parseCurrency(pagibig[staff.staffId]);
    const dSss = parseCurrency(sss[staff.staffId]);
    const dPhilhealth = parseCurrency(philhealth[staff.staffId]);
    const otherDeductions = parseCurrency(deductions[staff.staffId]);
    const totalDeductions = dPagibig + dSss + dPhilhealth + otherDeductions;
    const net = gross - totalDeductions;
    return { monthly, autoDaily, daily, days, gross, dPagibig, dSss, dPhilhealth, otherDeductions, totalDeductions, net };
  };


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
  const { data: allTransactions = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: fetchTransactions,
    staleTime: 60 * 1000,
  });

  // Compute balance per fund from transactions (mirrors TransactionTracker logic)
  const fundBalances = useMemo(() => {
    const totals: Record<string, number> = {};
    FUND_TYPES.forEach((f) => (totals[f] = 0));
    allTransactions.forEach((t: any) => {
      const amt = parseCurrency(t.amount);
      const type = t.transactionType || "";
      const fundSrc = totals[t.fundSource] !== undefined ? t.fundSource : "Money In Bank";
      const isOutflow = EXPENSE_TYPES.includes(type) || type === REFUND_TYPE || /refund|expense|disbursement/i.test(type);
      totals[fundSrc] = (totals[fundSrc] || 0) + (isOutflow ? -amt : amt);
    });

    return totals;
  }, [allTransactions]);

  const selectedFundBalance = fundBalances[fundSource] ?? 0;

  // Separate staff
  const fixedStaff = useMemo(() =>
    staffData.filter((s) => s.status?.toLowerCase() === "active" && parseCurrency((s as any).salary) > 0),
    [staffData]
  );

  const serviceBasedStaff = useMemo(() =>
    staffData.filter((s) => s.status?.toLowerCase() === "active" && (!(s as any).salary || parseCurrency((s as any).salary) === 0)),
    [staffData]
  );

  // Get services per technician (technician field may hold several names)
  const isAssignedTo = (technicianField: string | undefined, name: string) =>
    (technicianField || "")
      .split(",")
      .map((n) => n.trim().toLowerCase())
      .filter(Boolean)
      .includes((name || "").trim().toLowerCase());

  const isDoneStatus = (status?: string) => {
    const s = (status || "").toLowerCase();
    return s === "done" || s.includes("completed");
  };

  // Completed within the selected salary period (1-15 or 16-end), by completion date.
  const isInPeriod = (timestamp?: string) => {
    const d = parseManilaDate(timestamp || "");
    if (!d) return false;
    const start = parseManilaDate(periodRange.start);
    const end = parseManilaDate(periodRange.end);
    if (!start || !end) return false;
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return (
      day >= new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() &&
      day <= new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
    );
  };

  const periodServices = useMemo(
    () => allServices.filter((s) => isDoneStatus(s.status) && isInPeriod((s as any).timestamp)),
    [allServices, periodRange],
  );

  const getServicesForStaff = (name: string) =>
    periodServices.filter((s) => isAssignedTo(s.technician, name));

  const getServiceCostTotal = (name: string) => {
    return getServicesForStaff(name).reduce((sum, s) => sum + parseCurrency(s.finalCost), 0);
  };

  // Allocated commissions saved in the Completed Transactions breakdown panel,
  // limited to tickets completed within the active salary period.
  const doneServiceIds = useMemo(
    () => periodServices.map((s) => s.serviceId).filter(Boolean),
    [periodServices],
  );
  const { data: breakdownMap = {} } = useAllServiceBreakdowns(doneServiceIds);
  const getAllocatedCommission = (name: string) => {
    const target = (name || "").trim().toLowerCase();
    if (!target) return 0;
    return Object.entries(breakdownMap as Record<string, ServiceBreakdown[]>).reduce(
      (sum, [serviceId, rows]) => {
        // Allocation lines with no technician fall back to the ticket's technician
        // when it has exactly one, so no peso goes unclaimed.
        const ticketTechs = (periodServices.find((s) => s.serviceId === serviceId)?.technician || "")
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean);
        const soleTech = ticketTechs.length === 1 ? ticketTechs[0].toLowerCase() : "";
        return (
          sum +
          (rows || [])
            .filter((r) => {
              const rowTech = (r.technicianName || "").trim().toLowerCase();
              return rowTech ? rowTech === target : soleTech === target;
            })
            .reduce((s, r) => s + (Number(r.cost) || 0), 0)
        );
      },
      0,
    );
  };



  const computeFixedFinal = (staff: any) => {
    const salary = parseCurrency(staff.salary) / 2; // Divided by 2 (15th and end of month)
    const commission = parseCurrency(commissions[staff.staffId]);
    const bonus = parseCurrency(bonuses[staff.staffId]);
    const deduction = parseCurrency(deductions[staff.staffId]);
    return salary + commission + bonus - deduction;
  };

  const computeServiceFinal = (staff: any) => {
    // Manual allocations win; otherwise fall back to the commission percentage.
    const allocated = getAllocatedCommission(staff.name);
    if (allocated > 0) return allocated;
    const serviceCost = getServiceCostTotal(staff.name);
    const commission = parseCurrency(techCommissions[staff.staffId]);
    return serviceCost * (commission / 100);
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
      const c = computeCalculator(staff);
      const params = new URLSearchParams();
      params.append("action", "disburseSalary");
      params.append("staffId", (staff as any).userId || staff.staffId);
      params.append("staffName", staff.name);
      params.append("salaryAmount", finalAmount.toFixed(2));
      params.append("status", "Disbursed");
      params.append("disbursedBy", username);
      params.append("fundSource", fundSource);
      params.append("periodLabel", salaryPeriod);
      params.append("monthlySalary", c.monthly.toFixed(2));
      params.append("workdaysInPeriod", String(workdaysInPeriod));
      params.append("daysPresent", String(c.days));
      params.append("dailyRate", c.daily.toFixed(2));
      params.append("contributionPagibig", c.dPagibig.toFixed(2));
      params.append("contributionSss", c.dSss.toFixed(2));
      params.append("contributionPhilhealth", c.dPhilhealth.toFixed(2));
      params.append("otherDeductions", c.otherDeductions.toFixed(2));
      params.append("grossPay", c.gross.toFixed(2));
      params.append("totalDeductions", c.totalDeductions.toFixed(2));
      params.append("netPay", c.net.toFixed(2));

      const response = await fetch(DATA_BRIDGE_URL, { method: "POST", body: params });
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
        setDaysPresent((p) => ({ ...p, [staff.staffId]: "" }));
        setDailyRateOverride((p) => ({ ...p, [staff.staffId]: "" }));
        setPagibig((p) => ({ ...p, [staff.staffId]: "" }));
        setSss((p) => ({ ...p, [staff.staffId]: "" }));
        setPhilhealth((p) => ({ ...p, [staff.staffId]: "" }));
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
      params.append("transactionType", "Salary Disbursement");
      params.append("category", "Expenses");
      params.append("amount", totalDisbursed.toFixed(2));
      params.append("description", `${salaryPeriod} - ${disbursedList.length} staff members`);
      params.append("mop", "Bank Transfer");
      params.append("attendant", username);
      params.append("remarks", `${salaryPeriod}: ` + disbursedList.map((d) => `${d.staffName} (${fmtCurrency(d.amount)})`).join("; "));
      params.append("fundSource", fundSource);

      const response = await fetch(DATA_BRIDGE_URL, { method: "POST", body: params });
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

        {/* Salary Period & Fund Source */}
        <Card className="mb-4">
          <CardContent className="p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium whitespace-nowrap">Salary Period:</Label>
              <Select value={salaryPeriod} onValueChange={(v: "15th Salary" | "End of Month Salary") => setSalaryPeriod(v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15th Salary">15th Salary</SelectItem>
                  <SelectItem value="End of Month Salary">End of Month Salary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium whitespace-nowrap">Deduct From:</Label>
              <Select value={fundSource} onValueChange={setFundSource}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUND_TYPES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f} — {fmtCurrency(fundBalances[f] ?? 0)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className={cn("text-xs", selectedFundBalance < 0 ? "text-destructive" : "text-muted-foreground")}>
                Available: <span className="font-semibold">{fmtCurrency(selectedFundBalance)}</span>
              </span>
            </div>
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
                          <TableHead>Staff</TableHead>
                          <TableHead>Monthly</TableHead>
                          <TableHead>Days Present</TableHead>
                          <TableHead>Daily Rate</TableHead>
                          <TableHead>Pag-IBIG</TableHead>
                          <TableHead>SSS</TableHead>
                          <TableHead>PhilHealth</TableHead>
                          <TableHead>Other Ded.</TableHead>
                          <TableHead>Gross</TableHead>
                          <TableHead>Deductions</TableHead>
                          <TableHead>Net Pay</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fixedStaff.map((staff: any) => {
                          const c = computeCalculator(staff);
                          const isDone = disbursedList.some((d) => d.staffId === staff.staffId);
                          return (
                            <TableRow key={staff.staffId} className={cn(isDone && "opacity-50 bg-muted/40 pointer-events-none")}>
                              <TableCell className="font-medium">
                                <div>{staff.name}</div>
                                <div className="text-xs text-muted-foreground capitalize">{staff.role}</div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">{fmtCurrency(c.monthly)}</TableCell>
                              <TableCell>
                                <Input type="number" step="0.5" placeholder={String(attendanceByStaffId[staff.userId] ?? 0)} className="w-20" disabled={isDone}
                                  value={daysPresent[staff.staffId] || ""}
                                  onChange={(e) => setDaysPresent((p) => ({ ...p, [staff.staffId]: e.target.value }))}
                                />
                                <div className="text-[10px] text-muted-foreground mt-1">
                                  attd: {attendanceByStaffId[staff.userId] ?? 0}/{workdaysInPeriod}
                                  {" · "}{(hoursByStaffId[staff.userId] ?? 0).toFixed(2)}h
                                </div>
                              </TableCell>
                              <TableCell>
                                <Input type="number" step="0.01" placeholder={c.autoDaily.toFixed(2)} className="w-24" disabled={isDone}
                                  value={dailyRateOverride[staff.staffId] || ""}
                                  onChange={(e) => setDailyRateOverride((p) => ({ ...p, [staff.staffId]: e.target.value }))}
                                />
                              </TableCell>
                              <TableCell>
                                <Input type="number" step="0.01" placeholder="0.00" className="w-24" disabled={isDone}
                                  value={pagibig[staff.staffId] || ""}
                                  onChange={(e) => setPagibig((p) => ({ ...p, [staff.staffId]: e.target.value }))}
                                />
                              </TableCell>
                              <TableCell>
                                <Input type="number" step="0.01" placeholder="0.00" className="w-24" disabled={isDone}
                                  value={sss[staff.staffId] || ""}
                                  onChange={(e) => setSss((p) => ({ ...p, [staff.staffId]: e.target.value }))}
                                />
                              </TableCell>
                              <TableCell>
                                <Input type="number" step="0.01" placeholder="0.00" className="w-24" disabled={isDone}
                                  value={philhealth[staff.staffId] || ""}
                                  onChange={(e) => setPhilhealth((p) => ({ ...p, [staff.staffId]: e.target.value }))}
                                />
                              </TableCell>
                              <TableCell>
                                <Input type="number" step="0.01" placeholder="0.00" className="w-24" disabled={isDone}
                                  value={deductions[staff.staffId] || ""}
                                  onChange={(e) => setDeductions((p) => ({ ...p, [staff.staffId]: e.target.value }))}
                                />
                              </TableCell>
                              <TableCell className="font-medium whitespace-nowrap">{fmtCurrency(c.gross)}</TableCell>
                              <TableCell className="text-destructive whitespace-nowrap">−{fmtCurrency(c.totalDeductions)}</TableCell>
                              <TableCell className="font-bold whitespace-nowrap">{fmtCurrency(c.net)}</TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant={isDone ? "secondary" : "default"}
                                  onClick={() => handleDisburse(staff, c.net)}
                                  disabled={disbursing === staff.staffId || c.net <= 0 || isDone}
                                >
                                  {disbursing === staff.staffId ? <Loader2 className="h-4 w-4 animate-spin" /> : isDone ? "Disbursed" : "Disburse"}
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
                <p className="text-xs text-muted-foreground">
                  Commissions and service costs count only tickets completed {displayDate(periodRange.start, "MMM dd")} – {displayDate(periodRange.end, "MMM dd, yyyy")} ({salaryPeriod}).
                </p>
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
                          <TableHead>Allocated Commission</TableHead>
                          <TableHead>Commission %</TableHead>
                          <TableHead>Final Amount</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {serviceBasedStaff.map((staff: any) => {
                          const serviceCostTotal = getServiceCostTotal(staff.name);
                          const allocated = getAllocatedCommission(staff.name);
                          const commPct = parseCurrency(techCommissions[staff.staffId]);
                          const final = allocated > 0 ? allocated : serviceCostTotal * (commPct / 100);
                          const isDone = disbursedList.some((d) => d.staffId === staff.staffId);
                          return (
                            <TableRow key={staff.staffId} className={cn(isDone && "opacity-50 bg-muted/40 pointer-events-none")}>
                              <TableCell className="font-medium">{staff.name}</TableCell>
                              <TableCell>{staff.department || "-"}</TableCell>
                              <TableCell>{fmtCurrency(serviceCostTotal)}</TableCell>
                              <TableCell className={cn(allocated > 0 && "font-semibold text-orange-600")}>
                                {fmtCurrency(allocated)}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="%"
                                  className="w-20"
                                  disabled={isDone || allocated > 0}
                                  value={techCommissions[staff.staffId] || ""}
                                  onChange={(e) => setTechCommissions((p) => ({ ...p, [staff.staffId]: e.target.value }))}
                                />
                              </TableCell>
                              <TableCell className="font-bold">{fmtCurrency(final)}</TableCell>

                              <TableCell>
                                <Button
                                  size="sm"
                                  variant={isDone ? "secondary" : "default"}
                                  onClick={() => handleDisburse(staff, final)}
                                  disabled={disbursing === staff.staffId || final <= 0 || isDone}
                                >
                                  {disbursing === staff.staffId ? <Loader2 className="h-4 w-4 animate-spin" /> : isDone ? "Disbursed" : "Disburse"}
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

            {/* Submit Batch Section */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {disbursedList.length === 0
                        ? "Disburse staff salaries above, then submit as one transaction."
                        : `${disbursedList.length} staff disbursed`}
                    </p>
                    {disbursedList.length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                        {disbursedList.map((d) => (
                          <div key={d.staffId}>{d.staffName}: {fmtCurrency(d.amount)}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total Disbursed</p>
                      <p className="text-xl font-bold">{fmtCurrency(totalDisbursed)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Button
                        onClick={handleSubmitBatch}
                        disabled={isSubmitting || disbursedList.length === 0 || totalDisbursed > selectedFundBalance}
                        className="min-w-[140px]"
                      >
                        {isSubmitting ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
                        ) : (
                          "Submit Transaction"
                        )}
                      </Button>
                      {totalDisbursed > selectedFundBalance && disbursedList.length > 0 && (
                        <p className="text-xs text-destructive">
                          Insufficient funds in {fundSource} ({fmtCurrency(selectedFundBalance)})
                        </p>
                      )}
                    </div>
                  </div>
                </div>
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
          
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SalaryDisbursement;
