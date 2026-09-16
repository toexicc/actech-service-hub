import { useState, useEffect, useMemo } from "react";
import { payableHours, FULL_SHIFT_HOURS } from "@/lib/attendanceHours";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, CalendarIcon, ChevronLeft, ChevronRight, Printer, Download, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { logActivityAsync } from "@/lib/activityLogger";
import { displayDate, parseManilaDate } from "@/lib/timezone";
import { supabase } from "@/integrations/supabase/client";
import { useAllServiceBreakdowns, type ServiceBreakdown } from "@/hooks/useServiceBreakdowns";
import { useFilterPersistence } from "@/hooks/useFilterPersistence";
import {
  generateCommissionPayslipPdf,
  type PayslipData,
  type PayslipRow,
  type DeductionLine,
} from "@/lib/commissionPayslipPdf";
import { downloadPdfBytes, printPdfBytes } from "@/lib/pdfActions";

/** Current Manila month as "YYYY-MM". */
const manilaMonthKey = (): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  return parts.slice(0, 7);
};

/** Last 24 months, newest first. */
const buildMonthOptions = () => {
  const [y, m] = manilaMonthKey().split("-").map((n) => parseInt(n, 10));
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(y, m - 1 - i, 1);
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: format(d, "MMMM yyyy"),
    });
  }
  return out;
};


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
  // Only completed tickets matter for payouts, and they must be ordered:
  // an unordered wide select gets clipped by the API row cap, which silently
  // dropped tickets and under-reported commissions.
  const { data, error } = await supabase
    .from("services")
    .select("service_id, client_name, device_type, final_cost, total_cost, parts_cost, technicians, status, date_completed, last_updated")
    .eq("status", "Completed")
    .order("date_completed", { ascending: false })
    .limit(1000);
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
  // Cut-off (month + half) is shared with Completed Services so both pages read
  // the exact same payout window.
  const [cutoff, setCutoff] = useFilterPersistence<{
    month: string;
    period: "15th Salary" | "End of Month Salary";
  }>("payoutCutoff", { month: manilaMonthKey(), period: "15th Salary" });
  const selectedMonth = cutoff.month;
  const salaryPeriod = cutoff.period;
  const [payslipBusy, setPayslipBusy] = useState<string | null>(null);
  const monthOptions = useMemo(buildMonthOptions, []);

  // Disbursement state
  const [commissions, setCommissions] = useState<Record<string, string>>({});
  const [bonuses, setBonuses] = useState<Record<string, string>>({});
  const [deductions, setDeductions] = useState<Record<string, string>>({});
  const [techCommissions, setTechCommissions] = useState<Record<string, string>>({});
  const [disbursing, setDisbursing] = useState<string | null>(null);
  /** Staff ids whose already-disbursed row was unlocked for editing. */
  const [editingStaff, setEditingStaff] = useState<string[]>([]);
  const [disbursedList, setDisbursedList] = useState<{ staffId: string; staffName: string; amount: number }[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Additional deductions (description + amount) per staff, applied to the payout
  // and saved with the disbursement record.
  const [addlDeductions, setAddlDeductions] = useState<Record<string, DeductionLine[]>>({});
  const [dedModalStaff, setDedModalStaff] = useState<{ staffId: string; name: string } | null>(null);
  const [dedDraft, setDedDraft] = useState<DeductionLine[]>([]);

  const addlTotal = (staffId: string) =>
    (addlDeductions[staffId] || []).reduce((s, d) => s + (Number(d.amount) || 0), 0);

  const openDeductionModal = (staff: any) => {
    setDedModalStaff({ staffId: staff.staffId, name: staff.name });
    setDedDraft([...(addlDeductions[staff.staffId] || [])]);
  };

  const saveDeductionModal = () => {
    if (!dedModalStaff) return;
    const clean = dedDraft.filter((d) => (Number(d.amount) || 0) > 0);
    setAddlDeductions((p) => ({ ...p, [dedModalStaff.staffId]: clean }));
    setDedModalStaff(null);
  };

  // Calculator inputs (per staff)
  const [daysPresent, setDaysPresent] = useState<Record<string, string>>({});
  const [dailyRateOverride, setDailyRateOverride] = useState<Record<string, string>>({});
  const [pagibig, setPagibig] = useState<Record<string, string>>({});
  const [sss, setSss] = useState<Record<string, string>>({});
  const [philhealth, setPhilhealth] = useState<Record<string, string>>({});

  // Selected month drives every cut-off figure on the page.
  const [year, month] = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map((n) => parseInt(n, 10));
    return [y, (m || 1) - 1];
  }, [selectedMonth]);

  // Mon-Sat workdays in the active half-period
  const workdaysInPeriod = useMemo(() => {
    const startDay = salaryPeriod === "15th Salary" ? 1 : 16;
    const endDay = salaryPeriod === "15th Salary" ? 15 : new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let d = startDay; d <= endDay; d++) {
      const dow = new Date(year, month, d).getDay(); // 0 Sun ... 6 Sat
      if (dow !== 0) count++;
    }
    return count;
  }, [salaryPeriod, year, month]);

  // Mon-Sat workdays in the WHOLE month. The salary figure is monthly, so the
  // daily rate must divide by the full month; dividing by the half-period
  // doubled the rate and paid a full month's salary each cut-off.
  const workdaysInMonth = useMemo(() => {
    const days = new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let d = 1; d <= days; d++) {
      if (new Date(year, month, d).getDay() !== 0) count++;
    }
    return count;
  }, [year, month]);

  // Period date range (for attendance auto-fill)
  const periodRange = useMemo(() => {
    const startDay = salaryPeriod === "15th Salary" ? 1 : 16;
    const endDay = salaryPeriod === "15th Salary" ? 15 : new Date(year, month + 1, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      start: `${year}-${pad(month + 1)}-${pad(startDay)}`,
      end: `${year}-${pad(month + 1)}-${pad(endDay)}`,
    };
  }, [salaryPeriod, year, month]);

  // Pull attendance for the active period and count days present per staff.
  const { data: periodAttendance = [] } = useQuery({
    queryKey: ["attendance", periodRange.start, periodRange.end],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_logs")
        .select("staff_id,log_date,time_in,time_out,overtime_status")
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
      const hrs = payableHours(r.time_in, r.time_out, r.overtime_status);
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
      m[r.staff_id] =
        Math.round(((m[r.staff_id] || 0) + payableHours(r.time_in, r.time_out, r.overtime_status)) * 100) / 100;
    });
    return m;
  }, [periodAttendance]);

  const computeCalculator = (staff: any) => {
    const monthly = parseCurrency(staff.salary);
    const autoDaily = workdaysInMonth > 0 ? monthly / workdaysInMonth : 0;
    const daily = parseCurrency(dailyRateOverride[staff.staffId]) || autoDaily;
    const attendanceDays = attendanceByStaffId[staff.userId] ?? 0;
    const override = daysPresent[staff.staffId];
    const days = override !== undefined && override !== "" ? parseCurrency(override) : attendanceDays;
    const gross = days * daily;
    const dPagibig = parseCurrency(pagibig[staff.staffId]);
    const dSss = parseCurrency(sss[staff.staffId]);
    const dPhilhealth = parseCurrency(philhealth[staff.staffId]);
    const otherDeductions = parseCurrency(deductions[staff.staffId]);
    const additional = addlTotal(staff.staffId);
    const totalDeductions = dPagibig + dSss + dPhilhealth + otherDeductions + additional;
    const net = gross - totalDeductions;
    return { monthly, autoDaily, daily, days, gross, dPagibig, dSss, dPhilhealth, otherDeductions, additional, totalDeductions, net };
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
    queryKey: ["fundTransactions"],
    queryFn: fetchTransactions,
    staleTime: 60 * 1000,
  });

  // Payouts already recorded for this cut-off. Read from the database so the
  // Disburse button stays disabled after a refresh — one payout per staff, once.
  const periodLabelFull = useMemo(
    () => `${salaryPeriod} - ${displayDate(periodRange.start, "MMMM yyyy")}`,
    [salaryPeriod, periodRange.start],
  );
  const { data: periodPayouts = [] } = useQuery({
    queryKey: ["salaryDisbursements", periodRange.start, periodRange.end, periodLabelFull],
    queryFn: async () => {
      const { data } = await supabase
        .from("salary_disbursements")
        .select("staff_id, staff_name, net_pay, period_label, period_start, period_end")
        .or(`period_label.eq.${periodLabelFull},and(period_start.eq.${periodRange.start},period_end.eq.${periodRange.end})`);
      return data ?? [];
    },
    staleTime: 30 * 1000,
  });

  const paidStaffNames = useMemo(
    () => new Set(periodPayouts.map((p: any) => (p.staff_name || "").trim().toLowerCase())),
    [periodPayouts],
  );
  const hasPayout = (staff: any) =>
    paidStaffNames.has((staff.name || "").trim().toLowerCase()) ||
    disbursedList.some((d) => d.staffId === staff.staffId);
  /** Rows unlocked by Edit behave like unpaid rows until re-disbursed. */
  const isAlreadyPaid = (staff: any) => hasPayout(staff) && !editingStaff.includes(staff.staffId);

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

  // Allocations saved in Completed Services are the only thing that pays a
  // technician — no percentage fallback, so both pages always agree.
  const computeServiceFinal = (staff: any) => getAllocatedCommission(staff.name);

  /** Per-ticket allocation rows for a staff member, used by the payslip PDF. */
  const getCommissionRows = (name: string): PayslipRow[] => {
    const target = (name || "").trim().toLowerCase();
    if (!target) return [];
    const rows: PayslipRow[] = [];
    Object.entries(breakdownMap as Record<string, ServiceBreakdown[]>).forEach(([serviceId, lines]) => {
      const service = periodServices.find((s) => s.serviceId === serviceId);
      if (!service) return;
      const ticketTechs = (service.technician || "")
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      const soleTech = ticketTechs.length === 1 ? ticketTechs[0].toLowerCase() : "";
      const amount = (lines || [])
        .filter((r) => {
          const rowTech = (r.technicianName || "").trim().toLowerCase();
          return rowTech ? rowTech === target : soleTech === target;
        })
        .reduce((s, r) => s + (Number(r.cost) || 0), 0);
      if (amount <= 0) return;
      rows.push({
        completedDate: displayDate((service as any).timestamp || "", "MM/dd/yyyy"),
        serviceId,
        clientName: service.clientName || "-",
        amount,
      });
    });
    return rows.sort((a, b) => a.completedDate.localeCompare(b.completedDate));
  };

  /**
   * Tickets in the cut-off that still block a clean payout. Only tickets that
   * actually pay a service-based (commission) employee count — fixed-salary
   * staff tickets never need an allocation.
   */
  const readiness = useMemo(() => {
    // Parts cost is not a payout blocker: blank means "no parts yet", which
    // already counts as zero in the math. Only missing allocations matter.
    let missingAllocation = 0;
    periodServices.forEach((s) => {
      const paysCommission = serviceBasedStaff.some((st: any) => isAssignedTo(s.technician, st.name));
      if (!paysCommission) return;
      const lines = (breakdownMap as Record<string, ServiceBreakdown[]>)[s.serviceId] || [];
      if (!lines.length) missingAllocation += 1;
    });
    return { missingAllocation };
  }, [periodServices, breakdownMap, serviceBasedStaff]);

  /** Deep link into Completed Services already filtered to this cut-off. */
  const openCompletedServices = (technician?: string, issuesOnly = false) => {
    const params = new URLSearchParams({ from: periodRange.start, to: periodRange.end });
    if (technician) params.set("technician", technician);
    if (issuesOnly) params.set("issues", "1");
    navigate(`/completed-transactions?${params.toString()}`);
  };

  const cutoffLabel = `${displayDate(periodRange.start, "MMMM d")} - ${displayDate(periodRange.end, "d, yyyy")}`;

  const buildPayslip = (staff: any): PayslipData => {
    const rows = getCommissionRows(staff.name);
    const lines = addlDeductions[staff.staffId] || [];
    const gross = rows.reduce((s, r) => s + r.amount, 0);
    return {
      employeeName: staff.name,
      department: staff.department || "Service Based",
      cutoffLabel,
      periodLabel: salaryPeriod,
      rows,
      deductionLines: lines,
      total: gross - lines.reduce((s, d) => s + (Number(d.amount) || 0), 0),
      preparedBy: username,
      generatedAt: displayDate(new Date().toISOString(), "MM/dd/yyyy h:mm a"),
    };
  };

  /** Fixed-salary payslip: attendance + deductions instead of ticket rows. */
  const buildFixedPayslip = (staff: any): PayslipData => {
    const c = computeCalculator(staff);
    return {
      employeeName: staff.name,
      department: staff.department || staff.role || "Staff",
      cutoffLabel,
      periodLabel: salaryPeriod,
      rows: [],
      deductionLines: addlDeductions[staff.staffId] || [],
      attendance: {
        daysPresent: c.days,
        workdays: workdaysInPeriod,
        hours: hoursByStaffId[staff.userId] ?? 0,
        dailyRate: c.daily,
        monthlySalary: c.monthly,
        gross: c.gross,
        pagibig: c.dPagibig,
        sss: c.dSss,
        philhealth: c.dPhilhealth,
        otherDeductions: c.otherDeductions,
      },
      total: c.net,
      preparedBy: username,
      generatedAt: displayDate(new Date().toISOString(), "MM/dd/yyyy h:mm a"),
    };
  };


  const outputPayslip = async (entries: PayslipData[], action: "print" | "download", filename: string) => {
    const bytes = await generateCommissionPayslipPdf(entries);
    if (action === "download") downloadPdfBytes(bytes, filename);
    else {
      const ok = await printPdfBytes(bytes, filename);
      if (!ok) toast({ title: "Print blocked", description: "Allow pop-ups to print, or use Download.", variant: "destructive" });
    }
  };
  const handleFixedPayslip = async (staff: any, action: "print" | "download") => {
    setPayslipBusy(staff.staffId);
    try {
      await outputPayslip([buildFixedPayslip(staff)], action, `Payslip-${staff.name}-${periodRange.start}.pdf`);
    } catch {
      toast({ title: "Error", description: "Failed to build the payslip.", variant: "destructive" });
    } finally {
      setPayslipBusy(null);
    }
  };

  const handleFixedBatchPayslip = async (action: "print" | "download") => {
    const entries = fixedStaff.map((s: any) => buildFixedPayslip(s));
    if (!entries.length) {
      toast({ title: "Nothing to print", description: "No fixed salary staff found.", variant: "destructive" });
      return;
    }
    setPayslipBusy("fixed-batch");
    try {
      await outputPayslip(entries, action, `Fixed-Payslips-${periodRange.start}.pdf`);
    } catch {
      toast({ title: "Error", description: "Failed to build the payslips.", variant: "destructive" });
    } finally {
      setPayslipBusy(null);
    }
  };


  const handleStaffPayslip = async (staff: any, action: "print" | "download") => {
    setPayslipBusy(staff.staffId);
    try {
      await outputPayslip([buildPayslip(staff)], action, `Payslip-${staff.name}-${periodRange.start}.pdf`);
    } catch {
      toast({ title: "Error", description: "Failed to build the payslip.", variant: "destructive" });
    } finally {
      setPayslipBusy(null);
    }
  };

  const handleBatchPayslip = async (action: "print" | "download") => {
    const entries = serviceBasedStaff
      .map((s: any) => buildPayslip(s))
      .filter((e) => e.rows.length > 0);
    if (!entries.length) {
      toast({ title: "Nothing to print", description: "No allocated commissions in this cut-off.", variant: "destructive" });
      return;
    }
    setPayslipBusy("batch");
    try {
      await outputPayslip(entries, action, `Payslips-${periodRange.start}.pdf`);
    } catch {
      toast({ title: "Error", description: "Failed to build the payslips.", variant: "destructive" });
    } finally {
      setPayslipBusy(null);
    }
  };


  const handleDisburse = async (staff: any, finalAmount: number) => {
    if (finalAmount <= 0) {
      toast({ title: "Error", description: "Final amount must be greater than 0", variant: "destructive" });
      return;
    }
    const isEdit = hasPayout(staff);
    if (isEdit && !editingStaff.includes(staff.staffId)) {
      toast({ title: "Already Disbursed", description: `${staff.name} has already been paid for this cut-off.`, variant: "destructive" });
      return;
    }
    setDisbursing(staff.staffId);
    // Mark paid up-front so the button locks on the first click.
    setDisbursedList((prev) => [
      ...prev.filter((d) => d.staffId !== staff.staffId),
      { staffId: staff.staffId, staffName: staff.name, amount: finalAmount },
    ]);
    setEditingStaff((prev) => prev.filter((id) => id !== staff.staffId));
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
      // Month-scoped label keeps one row per staff per cut-off (the table is
      // unique on staff + label) and lets paid cut-offs be locked precisely.
      params.append("periodLabel", periodLabelFull);
      params.append("periodStart", periodRange.start);
      params.append("periodEnd", periodRange.end);
      params.append("monthlySalary", c.monthly.toFixed(2));
      params.append("workdaysInPeriod", String(workdaysInPeriod));
      params.append("daysPresent", String(c.days));
      params.append("dailyRate", c.daily.toFixed(2));
      params.append("contributionPagibig", c.dPagibig.toFixed(2));
      params.append("contributionSss", c.dSss.toFixed(2));
      params.append("contributionPhilhealth", c.dPhilhealth.toFixed(2));
      params.append("otherDeductions", c.otherDeductions.toFixed(2));
      params.append("additionalDeductions", JSON.stringify(addlDeductions[staff.staffId] || []));
      params.append("grossPay", c.gross.toFixed(2));
      params.append("totalDeductions", c.totalDeductions.toFixed(2));
      params.append("netPay", finalAmount.toFixed(2));

      const response = await fetch(DATA_BRIDGE_URL, { method: "POST", body: params });
      let result: any = null;
      try { result = await response.json(); } catch { /* CORS */ }

      const isSuccess = (result && (result.status === "success" || result.result === "success")) || (response.ok && result === null);

      if (!isSuccess) {
        setDisbursedList((prev) => prev.filter((d) => d.staffId !== staff.staffId));
        toast({ title: "Error", description: result?.message || "Failed to disburse", variant: "destructive" });
        return;
      }

      // One expense entry per staff per cut-off: an edited payout overwrites the
      // existing entry instead of posting a second one.
      const txDescription = `${staff.name} — ${periodLabelFull}`;
      const { data: existingTx } = await supabase
        .from("transactions")
        .select("id")
        .eq("type", "Salary Disbursement")
        .eq("description", txDescription)
        .limit(1);
      if (existingTx && existingTx.length > 0) {
        const { error: updateError } = await supabase
          .from("transactions")
          .update({
            amount: Number(finalAmount.toFixed(2)),
            fund_name: fundSource,
            created_by_name: username,
            transaction_date: new Date().toISOString(),
          })
          .eq("id", (existingTx[0] as any).id);
        toast({
          title: "Disbursement Updated",
          description: updateError
            ? `${staff.name}'s payout was saved, but the transaction entry could not be updated.`
            : `${staff.name}'s payout is now ${fmtCurrency(finalAmount)} and the existing transaction was updated.`,
          variant: updateError ? "destructive" : undefined,
        });
        logActivityAsync({
          serviceId: "SALARY",
          username,
          role: userRole || "",
          activity: `Updated disbursement to ${fmtCurrency(finalAmount)} for ${staff.name} (${periodLabelFull})`,
        });
        refetchLogs();
        queryClient.invalidateQueries({ queryKey: ["salaryDisbursements"] });
        queryClient.invalidateQueries({ queryKey: ["fundTransactions"] });
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        return;
      }

      const txParams = new URLSearchParams();
      txParams.append("action", "addTransaction");
      txParams.append("transactionType", "Salary Disbursement");
      txParams.append("category", "Expenses");
      txParams.append("amount", finalAmount.toFixed(2));
      txParams.append("description", txDescription);
      txParams.append("mop", "Bank Transfer");
      txParams.append("attendant", username);
      txParams.append("remarks", `${salaryPeriod} payout for ${staff.name}`);
      txParams.append("fundSource", fundSource);
      const txRes = await fetch(DATA_BRIDGE_URL, { method: "POST", body: txParams });
      let txResult: any = null;
      try { txResult = await txRes.json(); } catch { /* CORS */ }
      const txOk = (txResult && (txResult.status === "success" || txResult.result === "success")) || (txRes.ok && txResult === null);

      toast({
        title: "Disbursed",
        description: txOk
          ? `${fmtCurrency(finalAmount)} paid to ${staff.name} and recorded in Transactions.`
          : `${fmtCurrency(finalAmount)} paid to ${staff.name}, but the transaction entry failed to record.`,
        variant: txOk ? undefined : "destructive",
      });
      logActivityAsync({
        serviceId: "SALARY",
        username,
        role: userRole || "",
        activity: `Disbursed ${fmtCurrency(finalAmount)} to ${staff.name} for ${periodLabelFull} from ${fundSource}`,
      });
      refetchLogs();
      queryClient.invalidateQueries({ queryKey: ["salaryDisbursements"] });
      queryClient.invalidateQueries({ queryKey: ["fundTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    } catch {
      setDisbursedList((prev) => prev.filter((d) => d.staffId !== staff.staffId));
      toast({ title: "Error", description: "Failed to disburse salary", variant: "destructive" });
    } finally {
      setDisbursing(null);
    }
  };

  const totalDisbursed = disbursedList.reduce((sum, d) => sum + d.amount, 0);

  /** Read-only review of this cut-off: who has been paid and who is still pending. */
  const reviewSummary = useMemo(() => {
    const all = [...fixedStaff, ...serviceBasedStaff];
    const paid: { name: string; amount: number }[] = [];
    const pending: { name: string; amount: number }[] = [];
    all.forEach((staff: any) => {
      const row = periodPayouts.find(
        (p: any) => (p.staff_name || "").trim().toLowerCase() === (staff.name || "").trim().toLowerCase(),
      );
      const local = disbursedList.find((d) => d.staffId === staff.staffId);
      if (row || local) {
        paid.push({ name: staff.name, amount: local?.amount ?? parseCurrency(row?.net_pay) });
      } else {
        const amount = staff.salaryType === "service"
          ? computeServiceFinal(staff) - addlTotal(staff.staffId)
          : computeCalculator(staff).net;
        pending.push({ name: staff.name, amount });
      }
    });
    return {
      paid,
      pending,
      paidTotal: paid.reduce((s, p) => s + p.amount, 0),
      pendingTotal: pending.reduce((s, p) => s + p.amount, 0),
    };
  }, [fixedStaff, serviceBasedStaff, periodPayouts, disbursedList, addlDeductions, deductions, pagibig, sss, philhealth, daysPresent, dailyRateOverride]);

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
          <CardContent className="p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium whitespace-nowrap">Month:</Label>
              <Select value={selectedMonth} onValueChange={(v) => setCutoff({ month: v })}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium whitespace-nowrap">Salary Period:</Label>
              <Select value={salaryPeriod} onValueChange={(v: "15th Salary" | "End of Month Salary") => setCutoff({ period: v })}>
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
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg">Fixed Salary Employees</CardTitle>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button size="sm" variant="outline" disabled={payslipBusy !== null} onClick={() => handleFixedBatchPayslip("print")}>
                    {payslipBusy === "fixed-batch" ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Printer className="mr-2 h-3.5 w-3.5" />}
                    Print All Payslips
                  </Button>
                  <Button size="sm" variant="outline" disabled={payslipBusy !== null} onClick={() => handleFixedBatchPayslip("download")}>
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Download All
                  </Button>
                </div>
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
                          <TableHead>Addtl. Ded.</TableHead>
                          <TableHead>Net Pay</TableHead>
                          <TableHead>Payslip</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fixedStaff.map((staff: any) => {
                          const c = computeCalculator(staff);
                          const isDone = isAlreadyPaid(staff);
                          return (
                            <TableRow key={staff.staffId} className={cn(isDone && "opacity-50 bg-muted/40")}>
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
                              <TableCell className="whitespace-nowrap">
                                <Button size="sm" variant="outline" disabled={isDone} onClick={() => openDeductionModal(staff)}>
                                  {c.additional > 0 ? `−${fmtCurrency(c.additional)}` : "Add"}
                                </Button>
                              </TableCell>
                              <TableCell className="font-bold whitespace-nowrap">{fmtCurrency(c.net)}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    title="Print payslip"
                                    disabled={payslipBusy !== null}
                                    onClick={() => handleFixedPayslip(staff, "print")}
                                  >
                                    {payslipBusy === staff.staffId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    title="Download payslip"
                                    disabled={payslipBusy !== null}
                                    onClick={() => handleFixedPayslip(staff, "download")}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant={isDone ? "secondary" : "default"}
                                    onClick={() => handleDisburse(staff, c.net)}
                                    disabled={disbursing === staff.staffId || c.net <= 0 || isDone}
                                  >
                                    {disbursing === staff.staffId ? <Loader2 className="h-4 w-4 animate-spin" /> : isDone ? "Disbursed" : "Disburse"}
                                  </Button>
                                  {isDone && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                                      title="Edit this disbursement"
                                      onClick={() => setEditingStaff((prev) => [...prev, staff.staffId])}
                                    >
                                      Edit
                                    </Button>
                                  )}
                                </div>
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

            {/* Readiness check before any payout */}
            {readiness.missingAllocation > 0 && (
              <Card className="border-amber-300 bg-amber-50/60">
                <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-900">Not ready for payout</p>
                      <p className="text-xs text-amber-800">
                        {readiness.missingAllocation} completed ticket{readiness.missingAllocation === 1 ? "" : "s"} in this cut-off have no commission allocated.
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openCompletedServices(undefined, true)}>
                    Review in Completed Services
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Service Based Staff */}
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-lg">Service Based Employees</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Commissions count only tickets completed {displayDate(periodRange.start, "MMM dd")} – {displayDate(periodRange.end, "MMM dd, yyyy")} ({salaryPeriod}). Allocations saved in Completed Services are the only source of the payout. Daily rate = monthly salary ÷ {workdaysInMonth} workdays in {displayDate(periodRange.start, "MMMM yyyy")} (Sundays excluded), so both cut-offs together pay exactly one month.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={payslipBusy !== null}
                    onClick={() => handleBatchPayslip("print")}
                  >
                    {payslipBusy === "batch" ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Printer className="mr-2 h-3.5 w-3.5" />}
                    Print All Payslips
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={payslipBusy !== null}
                    onClick={() => handleBatchPayslip("download")}
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Download All
                  </Button>
                </div>
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
                          <TableHead>Tickets</TableHead>
                          <TableHead>Allocated Commission</TableHead>
                          <TableHead>Addtl. Ded.</TableHead>
                          <TableHead>Final Amount</TableHead>
                          <TableHead>Payslip</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {serviceBasedStaff.map((staff: any) => {
                          const serviceCostTotal = getServiceCostTotal(staff.name);
                          const rows = getCommissionRows(staff.name);
                          const allocated = rows.reduce((s, r) => s + r.amount, 0);
                          const extra = addlTotal(staff.staffId);
                          const final = allocated - extra;
                          const isDone = isAlreadyPaid(staff);
                          return (
                            <TableRow key={staff.staffId} className={cn(isDone && "opacity-50 bg-muted/40")}>
                              <TableCell className="font-medium">{staff.name}</TableCell>
                              <TableCell>{staff.department || "-"}</TableCell>
                              <TableCell>{fmtCurrency(serviceCostTotal)}</TableCell>
                              <TableCell>
                                <button
                                  type="button"
                                  className="text-primary underline-offset-2 hover:underline"
                                  onClick={() => openCompletedServices(staff.name)}
                                >
                                  {rows.length}
                                </button>
                              </TableCell>
                              <TableCell className={cn(allocated > 0 && "font-semibold text-orange-600")}>
                                {fmtCurrency(allocated)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <Button size="sm" variant="outline" disabled={isDone} onClick={() => openDeductionModal(staff)}>
                                  {extra > 0 ? `−${fmtCurrency(extra)}` : "Add"}
                                </Button>
                              </TableCell>
                              <TableCell className="font-bold">{fmtCurrency(final)}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    title="Print payslip"
                                    disabled={payslipBusy !== null || rows.length === 0}
                                    onClick={() => handleStaffPayslip(staff, "print")}
                                  >
                                    {payslipBusy === staff.staffId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    title="Download payslip"
                                    disabled={payslipBusy !== null || rows.length === 0}
                                    onClick={() => handleStaffPayslip(staff, "download")}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant={isDone ? "secondary" : "default"}
                                    onClick={() => handleDisburse(staff, final)}
                                    disabled={disbursing === staff.staffId || final <= 0 || isDone}
                                  >
                                    {disbursing === staff.staffId ? <Loader2 className="h-4 w-4 animate-spin" /> : isDone ? "Disbursed" : "Disburse"}
                                  </Button>
                                  {isDone && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                                      title="Edit this disbursement"
                                      onClick={() => setEditingStaff((prev) => [...prev, staff.staffId])}
                                    >
                                      Edit
                                    </Button>
                                  )}
                                </div>
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


            {/* Review panel — read-only, posts nothing */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Each Disburse click pays that staff member and records the expense in Transactions immediately.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {reviewSummary.paid.length} disbursed · {reviewSummary.pending.length} pending for {periodLabelFull}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total Disbursed</p>
                      <p className="text-xl font-bold">{fmtCurrency(reviewSummary.paidTotal)}</p>
                    </div>
                    <Button variant="outline" className="min-w-[200px]" onClick={() => setReviewOpen(true)}>
                      Review Salary Disbursement
                    </Button>
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

        {/* Review summary — read-only */}
        <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
          <DialogContent className="max-w-lg !flex !flex-col max-h-[95dvh]">
            <DialogHeader>
              <DialogTitle>Review Salary Disbursement</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto space-y-4 text-sm">
              <p className="text-xs text-muted-foreground">{periodLabelFull} · {cutoffLabel}</p>
              <div>
                <p className="font-semibold mb-1">Disbursed ({reviewSummary.paid.length})</p>
                {reviewSummary.paid.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nobody has been paid for this cut-off yet.</p>
                ) : (
                  <div className="space-y-0.5">
                    {reviewSummary.paid.map((p) => (
                      <div key={p.name} className="flex justify-between">
                        <span>{p.name}</span>
                        <span className="font-medium">{fmtCurrency(p.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t pt-1 font-bold">
                      <span>Total</span><span>{fmtCurrency(reviewSummary.paidTotal)}</span>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <p className="font-semibold mb-1">Pending ({reviewSummary.pending.length})</p>
                {reviewSummary.pending.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Everyone has been paid for this cut-off.</p>
                ) : (
                  <div className="space-y-0.5">
                    {reviewSummary.pending.map((p) => (
                      <div key={p.name} className="flex justify-between text-muted-foreground">
                        <span>{p.name}</span>
                        <span>{fmtCurrency(p.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t pt-1 font-semibold">
                      <span>Total</span><span>{fmtCurrency(reviewSummary.pendingTotal)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="shrink-0">
              <Button variant="outline" onClick={() => setReviewOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Additional deductions */}
        <Dialog open={!!dedModalStaff} onOpenChange={(o) => !o && setDedModalStaff(null)}>
          <DialogContent className="max-w-md !flex !flex-col max-h-[95dvh]">
            <DialogHeader>
              <DialogTitle>Additional Deductions — {dedModalStaff?.name}</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto space-y-2">
              {dedDraft.length === 0 && (
                <p className="text-xs text-muted-foreground">No additional deductions yet.</p>
              )}
              {dedDraft.map((d, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    placeholder="Description"
                    value={d.description}
                    onChange={(e) => setDedDraft((p) => p.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-28"
                    value={d.amount === 0 ? "" : String(d.amount)}
                    onChange={(e) => setDedDraft((p) => p.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) || 0 } : x)))}
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDedDraft((p) => p.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setDedDraft((p) => [...p, { description: "", amount: 0 }])}>
                <Plus className="mr-2 h-3.5 w-3.5" />Add deduction
              </Button>
              <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                <span>Total</span>
                <span className="text-destructive">−{fmtCurrency(dedDraft.reduce((s, d) => s + (Number(d.amount) || 0), 0))}</span>
              </div>
            </div>
            <DialogFooter className="shrink-0">
              <Button variant="outline" onClick={() => setDedModalStaff(null)}>Cancel</Button>
              <Button onClick={saveDeductionModal}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="text-center mt-8 text-sm text-muted-foreground">
          
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SalaryDisbursement;
