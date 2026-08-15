import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { DATA_BRIDGE_URL } from "@/lib/dataBridge";
import { displayDate, parseManilaDate } from "@/lib/timezone";
import {
  Search, Loader2, DollarSign, Edit, Ban, Plus, RefreshCw,
  ChevronLeft, ChevronRight, CreditCard, Landmark, Wallet,
  CalendarIcon, FileText,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { logActivityAsync } from "@/lib/activityLogger";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Transaction {
  transactionId: string;
  timestamp: string;
  serviceId: string;
  transactionType: string;
  modeOfPayment: string;
  name: string;
  device: string;
  amount: string;
  serviceCost: string;
  attendant: string;
  remarks: string;
  partsCost: string;
  remaining: string;
  fundSource?: string;
}

interface ActivityLog {
  logId: string;
  serviceId: string;
  username: string;
  role: string;
  timestamp: string;
  activity: string;
}

const SALES_TYPES = ["Down Payment", "Full Payment", "Partial Payment", "Refund"];
const EXPENSE_TYPES = ["Parts Inventory", "Rent", "Miscellaneous Expense", "Salary Disbursement"];
const OTHER_TYPES = ["Money In Bank", "Investment", "Savings/Interest", "Profit", "Savings (General)", "Savings (Tax)", "Other Banks"];
const FUND_TYPES = ["Money In Bank", "Savings (General)", "Savings (Tax)", "Other Banks"];
const SAVINGS_TYPES = ["Money In Bank", "Investment", "Savings/Interest", "Savings (General)", "Savings (Tax)", "Other Banks"];
const REFUND_TYPE = "Refund";

const ALL_GROUPED = [
  { label: "Sales", items: SALES_TYPES },
  { label: "Expenses", items: EXPENSE_TYPES },
  { label: "Others", items: [...OTHER_TYPES, "Others"] },
];

const EXPENSE_SUB_TABS = [
  { value: "all", label: "General", types: EXPENSE_TYPES },
  { value: "parts", label: "Parts", types: ["Parts Inventory"] },
  { value: "opex", label: "OpEx", types: EXPENSE_TYPES },
  { value: "rent", label: "Rent", types: ["Rent"] },
  { value: "salary", label: "Salary", types: ["Salary Disbursement"] },
  { value: "misc", label: "Miscellaneous", types: ["Miscellaneous Expense"] },
];

const fetchTransactions = async (): Promise<Transaction[]> => {
  const response = await fetch(`${DATA_BRIDGE_URL}?action=getTransactions`);
  const data = await response.json();
  if (data.status === "success" && data.transactions) {
    return data.transactions;
  }
  return [];
};

const parseCurrency = (val: string | number | undefined): number => {
  if (val === undefined || val === null || val === "") return 0;
  return parseFloat(String(val).replace(/[^0-9.\-]/g, "")) || 0;
};

const fmtCurrency = (val: number) => `Php ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PlainShell = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const TransactionTracker = ({ embedded = false }: { embedded?: boolean }) => {
  const Shell = embedded ? PlainShell : DashboardLayout;
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userRole = sessionStorage.getItem("userRole");
  const username = sessionStorage.getItem("userFullName") || sessionStorage.getItem("username") || "Unknown";

  const [searchQuery, setSearchQuery] = useState("");
  const [mopFilter, setMopFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("general");
  const [expenseSubTab, setExpenseSubTab] = useState("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [dashStartDate, setDashStartDate] = useState<Date | undefined>();
  const [dashEndDate, setDashEndDate] = useState<Date | undefined>();
  const itemsPerPage = 15;

  const [editDialog, setEditDialog] = useState(false);
  const [editData, setEditData] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState({
    transactionType: "", otherTransactionType: "", modeOfPayment: "", otherMOP: "",
    amount: "", remarks: "", serviceId: "", name: "", device: "", serviceCost: "", partsCost: "", remaining: "",
    fundSource: "Money In Bank",
  });
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  const [voidDialog, setVoidDialog] = useState(false);
  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);

  const [logsDialog, setLogsDialog] = useState(false);
  const [logsTarget, setLogsTarget] = useState<Transaction | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) navigate("/");
    if (userRole !== "management" && userRole !== "admin") navigate("/menu");
  }, [navigate, userRole]);

  const { data: transactions = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["transactions"],
    queryFn: fetchTransactions,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,

  });

  const handleViewLogs = async (t: Transaction) => {
    setLogsTarget(t);
    setLogsDialog(true);
    setIsLoadingLogs(true);
    try {
      const response = await fetch(
        `${DATA_BRIDGE_URL}?action=getServiceLogs&serviceId=${encodeURIComponent(t.serviceId || t.transactionId)}&limit=50`
      );
      const result = await response.json();
      if (result.status === "success" && result.logs) {
        const relevant = result.logs.filter((l: ActivityLog) =>
          l.activity?.includes(t.transactionId) || l.activity?.includes("POS:") || l.activity?.includes("transaction")
        );
        setActivityLogs(relevant.length > 0 ? relevant : result.logs);
      } else {
        setActivityLogs([]);
      }
    } catch {
      setActivityLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Tab-based filtering
  const tabFilteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const type = t.transactionType || "";
      const isVoid = type.toLowerCase().startsWith("void");
      switch (activeTab) {
        case "sales":
          return SALES_TYPES.includes(type) && !isVoid;
        case "expenses": {
          if (!EXPENSE_TYPES.includes(type)) return false;
          if (expenseSubTab === "all" || expenseSubTab === "opex") return true;
          const subDef = EXPENSE_SUB_TABS.find((s) => s.value === expenseSubTab);
          return subDef ? subDef.types.includes(type) : true;
        }
        case "savings":
          return SAVINGS_TYPES.includes(type) && !isVoid;
        case "logs":
          // Show ALL transactions (including POS-recorded sales) so admins can audit who processed each
          return true;
        default:
          return !isVoid;
      }
    });
  }, [transactions, activeTab, expenseSubTab]);

  const filteredTransactions = useMemo(() => {
    return tabFilteredTransactions.filter((t) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !t.serviceId?.toLowerCase().includes(q) &&
          !t.name?.toLowerCase().includes(q) &&
          !t.transactionType?.toLowerCase().includes(q) &&
          !t.transactionId?.toLowerCase().includes(q) &&
          !t.attendant?.toLowerCase().includes(q)
        ) return false;
      }
      if (mopFilter !== "all" && t.modeOfPayment !== mopFilter) return false;

      if (startDate || endDate) {
        const txDate = t.timestamp ? new Date(t.timestamp) : null;
        if (!txDate || isNaN(txDate.getTime())) return false;
        if (startDate && txDate < startDate) return false;
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (txDate > end) return false;
        }
      }

      return true;
    });
  }, [tabFilteredTransactions, searchQuery, mopFilter, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Filter transactions for dashboard by date range
  const dashTransactions = useMemo(() => {
    if (!dashStartDate && !dashEndDate) return transactions;
    return transactions.filter((t) => {
      const txDate = t.timestamp ? new Date(t.timestamp) : null;
      if (!txDate || isNaN(txDate.getTime())) return false;
      if (dashStartDate && txDate < dashStartDate) return false;
      if (dashEndDate) {
        const end = new Date(dashEndDate);
        end.setHours(23, 59, 59, 999);
        if (txDate > end) return false;
      }
      return true;
    });
  }, [transactions, dashStartDate, dashEndDate]);

  // Dashboard stats - Fund accumulators
  const fundTotals = useMemo(() => {
    const totals: Record<string, number> = {
      "Money In Bank": 0,
      "Savings (General)": 0,
      "Savings (Tax)": 0,
      "Other Banks": 0,
    };
    dashTransactions.forEach((t) => {
      const amt = parseCurrency(t.amount);
      const type = t.transactionType || "";
      const fundSrc = t.fundSource || "Money In Bank";

      // Others types that ADD to their respective fund
      if (FUND_TYPES.includes(type)) {
        totals[type] = (totals[type] || 0) + amt;
      }
      // Expenses DEDUCT from their fund source
      if (EXPENSE_TYPES.includes(type)) {
        if (totals[fundSrc] !== undefined) {
          totals[fundSrc] -= amt;
        }
      }
      // Refunds deduct
      if (type === REFUND_TYPE) {
        if (totals[fundSrc] !== undefined) {
          totals[fundSrc] -= amt;
        }
      }
    });
    return totals;
  }, [dashTransactions]);

  const totalSales = useMemo(() => {
    return dashTransactions
      .filter((t) => SALES_TYPES.includes(t.transactionType) && t.transactionType !== REFUND_TYPE)
      .reduce((sum, t) => sum + parseCurrency(t.amount), 0);
  }, [dashTransactions]);

  const totalExpenses = useMemo(() => {
    return dashTransactions
      .filter((t) => EXPENSE_TYPES.includes(t.transactionType))
      .reduce((sum, t) => sum + parseCurrency(t.amount), 0);
  }, [dashTransactions]);

  const totalRefunds = useMemo(() => {
    return dashTransactions
      .filter((t) => t.transactionType === REFUND_TYPE)
      .reduce((sum, t) => sum + parseCurrency(t.amount), 0);
  }, [dashTransactions]);

  const totalPartsCost = useMemo(() => {
    return dashTransactions
      .reduce((sum, t) => sum + parseCurrency(t.partsCost), 0);
  }, [dashTransactions]);

  const profit = useMemo(() => totalSales - totalExpenses - totalRefunds, [totalSales, totalExpenses, totalRefunds]);

  const mopBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    dashTransactions.forEach((t) => {
      if (!SALES_TYPES.includes(t.transactionType) || t.transactionType === REFUND_TYPE) return;
      const mop = t.modeOfPayment || "Unknown";
      breakdown[mop] = (breakdown[mop] || 0) + parseCurrency(t.amount);
    });
    return breakdown;
  }, [dashTransactions]);

  const handleEdit = (transaction: Transaction) => {
    if (userRole === "admin") {
      toast({ title: "Pending Request", description: "Edit request sent to management for approval", variant: "default" });
      return;
    }
    setEditData(transaction);
    const allKnownTypes = [...SALES_TYPES, ...EXPENSE_TYPES, ...OTHER_TYPES];
    const isOtherType = !allKnownTypes.includes(transaction.transactionType);
    const isOtherMOP = !["GCash", "Bank Transfer", "Credit Card", "Cash", "N/A"].includes(transaction.modeOfPayment);
    setEditForm({
      transactionType: isOtherType ? "Others" : transaction.transactionType,
      otherTransactionType: isOtherType ? transaction.transactionType : "",
      modeOfPayment: isOtherMOP ? "Others" : transaction.modeOfPayment,
      otherMOP: isOtherMOP ? transaction.modeOfPayment : "",
      amount: transaction.amount,
      remarks: transaction.remarks,
      serviceId: transaction.serviceId,
      name: transaction.name,
      device: transaction.device,
      serviceCost: transaction.serviceCost,
      partsCost: transaction.partsCost || "",
      remaining: transaction.remaining || "",
      fundSource: transaction.fundSource || "Money In Bank",
    });
    setEditDialog(true);
  };

  const handleAdd = () => {
    setEditData(null);
    setEditForm({
      transactionType: "", otherTransactionType: "", modeOfPayment: "", otherMOP: "",
      amount: "", remarks: "", serviceId: "", name: "", device: "", serviceCost: "", partsCost: "", remaining: "",
      fundSource: "Money In Bank",
    });
    setEditDialog(true);
  };

  const handleSaveEdit = async () => {
    const finalType = editForm.transactionType === "Others" ? editForm.otherTransactionType : editForm.transactionType;
    const finalMOP = editForm.modeOfPayment === "Others" ? editForm.otherMOP : editForm.modeOfPayment;

    if (!finalType || !editForm.amount) {
      toast({ title: "Validation Error", description: "Please fill Transaction Type and Amount", variant: "destructive" });
      return;
    }
    if (!finalMOP) {
      toast({ title: "Validation Error", description: "Please select a Mode of Payment", variant: "destructive" });
      return;
    }

    setIsEditSubmitting(true);
    try {
      const transactionId = editData ? editData.transactionId : `TXN${Date.now()}`;
      const params = new URLSearchParams();
      params.append("action", editData ? "editTransaction" : "addTransaction");
      params.append("transactionId", editData ? editData.transactionId : transactionId);
      params.append("serviceId", editForm.serviceId);
      params.append("transactionType", finalType);
      params.append("modeOfPayment", finalMOP);
      params.append("name", editForm.name);
      params.append("device", editForm.device);
      params.append("amount", editForm.amount);
      params.append("serviceCost", editForm.serviceCost);
      params.append("attendant", username);
      params.append("remarks", editForm.remarks);
      params.append("partsCost", editForm.partsCost);
      params.append("remaining", editForm.remaining);
      params.append("fundSource", editForm.fundSource);

      const response = await fetch(DATA_BRIDGE_URL, { method: "POST", body: params });
      const result = await response.json();

      if (result.status === "success") {
        toast({ title: "Success", description: editData ? "Transaction updated" : "Transaction added" });
        logActivityAsync({
          serviceId: editForm.serviceId || "TRACKER",
          username,
          role: userRole || "",
          activity: editData
            ? `Edited transaction ${editData.transactionId}: ${finalType} Php ${editForm.amount}`
            : `Added transaction ${transactionId}: ${finalType} Php ${editForm.amount} via ${finalMOP}`,
        });
        setEditDialog(false);
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
      } else {
        toast({ title: "Error", description: result.message || "Failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to save transaction", variant: "destructive" });
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleVoid = async () => {
    if (!voidTarget) return;
    if (!voidReason.trim()) {
      toast({ title: "Reason required", description: "Please enter a reason for voiding this transaction.", variant: "destructive" });
      return;
    }

    setIsVoiding(true);
    try {
      const originalAmount = parseCurrency(voidTarget.amount);
      const voidId = `VOID${Date.now()}`;
      const params = new URLSearchParams();
      params.append("action", "addTransaction");
      params.append("transactionId", voidId);
      params.append("serviceId", voidTarget.serviceId || "");
      params.append("transactionType", `Void - ${voidTarget.transactionType}`);
      params.append("modeOfPayment", voidTarget.modeOfPayment || "N/A");
      params.append("name", voidTarget.name || "");
      params.append("device", voidTarget.device || "");
      params.append("amount", (-Math.abs(originalAmount)).toFixed(2));
      params.append("serviceCost", "0");
      params.append("attendant", username);
      params.append("remarks", `Void of ${voidTarget.transactionId}: ${voidReason.trim()}`);
      params.append("partsCost", "0");
      params.append("finalCost", "0");
      params.append("previousPayments", "0");
      if (voidTarget.fundSource) params.append("fundSource", voidTarget.fundSource);

      const response = await fetch(DATA_BRIDGE_URL, { method: "POST", body: params });
      const result = await response.json();

      if (result.status === "success") {
        toast({ title: "Voided", description: `Transaction ${voidTarget.transactionId} has been voided.` });
        logActivityAsync({
          serviceId: voidTarget.serviceId || "TRACKER",
          username,
          role: userRole || "",
          activity: `Voided transaction ${voidTarget.transactionId} (${voidTarget.transactionType}, ${fmtCurrency(originalAmount)}) — Reason: ${voidReason.trim()}`,
        });
        setVoidDialog(false);
        setVoidReason("");
        setVoidTarget(null);
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
      } else {
        toast({ title: "Error", description: result.message || "Failed to void", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to void transaction", variant: "destructive" });
    } finally {
      setIsVoiding(false);
    }
  };

  const getMOPIcon = (mop: string) => {
    switch (mop) {
      case "GCash": return <Wallet className="h-3 w-3" />;
      case "Bank Transfer": return <Landmark className="h-3 w-3" />;
      case "Credit Card": return <CreditCard className="h-3 w-3" />;
      default: return <DollarSign className="h-3 w-3" />;
    }
  };

  const isExpenseType = EXPENSE_TYPES.includes(editForm.transactionType);

  return (
    <Shell>
      <div className={embedded ? "animate-fade-in" : "p-4 sm:p-6 animate-fade-in"}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
          <div>
            {!embedded && (
              <>
                <h1 className="text-3xl font-bold text-foreground">Transaction Tracker</h1>
                <p className="text-muted-foreground">View and manage all transactions</p>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              Reload
            </Button>
            {(userRole === "management" || userRole === "admin") && (
              <Button size="sm" onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-1" /> Add Transaction
              </Button>
            )}
          </div>
        </div>

        {/* Dashboard Date Range */}
        <Card className="mb-4">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Dashboard Range:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !dashStartDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {dashStartDate ? format(dashStartDate, "MMM dd") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dashStartDate} onSelect={setDashStartDate} className="pointer-events-auto" /></PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !dashEndDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {dashEndDate ? format(dashEndDate, "MMM dd") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dashEndDate} onSelect={setDashEndDate} className="pointer-events-auto" /></PopoverContent>
              </Popover>
              {(dashStartDate || dashEndDate) && (
                <Button variant="ghost" size="sm" onClick={() => { setDashStartDate(undefined); setDashEndDate(undefined); }}>Clear</Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dashboard Row 1: AC Tech Funds */}
        <div className="mb-2">
          <p className="text-xs font-semibold text-muted-foreground mb-2">AC Tech Funds</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {FUND_TYPES.map((fund) => (
              <Card key={fund}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{fund}</p>
                  <p className={`text-xl font-bold ${(fundTotals[fund] || 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                    {fmtCurrency(fundTotals[fund] || 0)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Dashboard Row 2: AC Tech Transactions */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground mb-2">AC Tech Transactions</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Sales</p>
                <p className="text-xl font-bold text-primary">{fmtCurrency(totalSales)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Expenses</p>
                <p className="text-xl font-bold text-destructive">{fmtCurrency(totalExpenses)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Profit</p>
                <p className={`text-xl font-bold ${profit >= 0 ? "text-green-600" : "text-destructive"}`}>{fmtCurrency(profit)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Parts Cost</p>
                <p className="text-xl font-bold text-destructive">{fmtCurrency(totalPartsCost)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-2">Sales by MOP</p>
                <div className="space-y-1">
                  {Object.entries(mopBreakdown).map(([mop, total]) => (
                    <div key={mop} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1">{getMOPIcon(mop)} {mop}</span>
                      <span className="font-bold">{fmtCurrency(total)}</span>
                    </div>
                  ))}
                  {Object.keys(mopBreakdown).length === 0 && (
                    <span className="text-xs text-muted-foreground">No sales yet</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setCurrentPage(1); setExpenseSubTab("all"); }} className="mb-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="savings">Savings</TabsTrigger>
            <TabsTrigger value="logs">Transaction Logs</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Expense Sub-Tabs */}
        {activeTab === "expenses" && (
          <div className="flex flex-wrap gap-1 mb-4">
            {EXPENSE_SUB_TABS.map((sub) => (
              <Button
                key={sub.value}
                variant={expenseSubTab === sub.value ? "default" : "outline"}
                size="sm"
                onClick={() => { setExpenseSubTab(sub.value); setCurrentPage(1); }}
              >
                {sub.label}
              </Button>
            ))}
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Search by ID, Name, Type, or Attendant..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                />
              </div>
              <Select value={mopFilter} onValueChange={(v) => { setMopFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by MOP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All MOP</SelectItem>
                  <SelectItem value="GCash">GCash</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "MMM dd") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); setCurrentPage(1); }} /></PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM dd") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={(d) => { setEndDate(d); setCurrentPage(1); }} /></PopoverContent>
              </Popover>
              {(startDate || endDate) && (
                <Button variant="ghost" size="sm" onClick={() => { setStartDate(undefined); setEndDate(undefined); }}>
                  Clear Dates
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No transactions found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>TXN ID</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Service ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>MOP</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Parts Cost</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Attendant</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransactions.map((t) => (
                      <TableRow key={t.transactionId} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewLogs(t)}>
                        <TableCell className="text-xs font-mono">{t.transactionId}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {t.timestamp ? displayDate(t.timestamp, "MMM dd, yyyy hh:mm a") : "N/A"}
                        </TableCell>
                        <TableCell className="font-medium">{t.serviceId || "-"}</TableCell>
                        <TableCell className="text-xs">{t.transactionType}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
                            {getMOPIcon(t.modeOfPayment)} {t.modeOfPayment}
                          </span>
                        </TableCell>
                        <TableCell>{t.name || "-"}</TableCell>
                        <TableCell className="font-semibold">{fmtCurrency(parseCurrency(t.amount))}</TableCell>
                        <TableCell className="text-xs">{parseCurrency(t.partsCost) > 0 ? fmtCurrency(parseCurrency(t.partsCost)) : "-"}</TableCell>
                        <TableCell className="text-xs">{parseCurrency(t.remaining) > 0 ? fmtCurrency(parseCurrency(t.remaining)) : (t.remaining === "0.00" ? fmtCurrency(0) : "-")}</TableCell>
                        <TableCell className="text-xs">{t.attendant || "-"}</TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate">{t.remarks || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(t)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            {!String(t.transactionType || "").toLowerCase().startsWith("void") && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Void transaction" onClick={() => { setVoidTarget(t); setVoidReason(""); setVoidDialog(true); }}>
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length}
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Edit/Add Dialog */}
        <Dialog open={editDialog} onOpenChange={setEditDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editData ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
              <DialogDescription>
                {editData ? "Update transaction details" : "Manually add a new transaction"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Service ID (optional)</Label>
                <Input value={editForm.serviceId} onChange={(e) => setEditForm({ ...editForm, serviceId: e.target.value })} placeholder="Leave blank if not service-related" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Transaction Type *</Label>
                  <Select value={editForm.transactionType} onValueChange={(v) => setEditForm({ ...editForm, transactionType: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {ALL_GROUPED.map((group) => (
                        <div key={group.label}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group.label}</div>
                          {group.items.map((item) => (
                            <SelectItem key={item} value={item}>{item}</SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                  {editForm.transactionType === "Others" && (
                    <Input placeholder="Specify type" value={editForm.otherTransactionType} onChange={(e) => setEditForm({ ...editForm, otherTransactionType: e.target.value })} />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>MOP *</Label>
                  <Select value={editForm.modeOfPayment} onValueChange={(v) => setEditForm({ ...editForm, modeOfPayment: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GCash">GCash</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Credit Card">Credit Card</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="N/A">N/A</SelectItem>
                      <SelectItem value="Others">Others</SelectItem>
                    </SelectContent>
                  </Select>
                  {editForm.modeOfPayment === "Others" && (
                    <Input placeholder="Specify MOP" value={editForm.otherMOP} onChange={(e) => setEditForm({ ...editForm, otherMOP: e.target.value })} />
                  )}
                </div>
              </div>
              {/* Fund source for expenses */}
              {isExpenseType && (
                <div className="space-y-2">
                  <Label>Deduct From</Label>
                  <Select value={editForm.fundSource} onValueChange={(v) => setEditForm({ ...editForm, fundSource: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FUND_TYPES.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Device</Label>
                  <Input value={editForm.device} onChange={(e) => setEditForm({ ...editForm, device: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <Input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Service Cost</Label>
                  <Input type="number" step="0.01" value={editForm.serviceCost} onChange={(e) => setEditForm({ ...editForm, serviceCost: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Parts Cost</Label>
                  <Input type="number" step="0.01" value={editForm.partsCost} onChange={(e) => setEditForm({ ...editForm, partsCost: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Remaining</Label>
                  <Input type="number" step="0.01" value={editForm.remaining} onChange={(e) => setEditForm({ ...editForm, remaining: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={isEditSubmitting}>
                {isEditSubmitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                {editData ? "Save Changes" : "Add Transaction"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Void Dialog */}
        <Dialog open={voidDialog} onOpenChange={(open) => { setVoidDialog(open); if (!open) { setVoidReason(""); setVoidTarget(null); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Ban className="h-5 w-5 text-destructive" /> Void Transaction</DialogTitle>
              <DialogDescription>
                Voiding posts a reversing entry that cancels this transaction. The original record stays in the books for audit. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {voidTarget && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm p-3 rounded-lg bg-muted/50">
                  <div><span className="text-muted-foreground text-xs">TXN ID:</span> <strong className="font-mono">{voidTarget.transactionId}</strong></div>
                  <div><span className="text-muted-foreground text-xs">Type:</span> {voidTarget.transactionType}</div>
                  <div><span className="text-muted-foreground text-xs">Amount:</span> <strong>{fmtCurrency(parseCurrency(voidTarget.amount))}</strong></div>
                  <div><span className="text-muted-foreground text-xs">MOP:</span> {voidTarget.modeOfPayment}</div>
                </div>
                <div className="space-y-2">
                  <Label>Reason for voiding *</Label>
                  <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={3} placeholder="e.g. Wrong amount entered, duplicate payment, customer cancellation..." />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setVoidDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleVoid} disabled={isVoiding || !voidReason.trim()}>
                {isVoiding ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Ban className="h-4 w-4 mr-1" />}
                Confirm Void
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Logs Dialog */}
        <Dialog open={logsDialog} onOpenChange={setLogsDialog}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Transaction Logs
              </DialogTitle>
              <DialogDescription>
                {logsTarget?.transactionId} — {logsTarget?.transactionType}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm p-3 rounded-lg bg-muted/50">
                <div><span className="text-muted-foreground text-xs">Amount:</span> <strong>{fmtCurrency(parseCurrency(logsTarget?.amount))}</strong></div>
                <div><span className="text-muted-foreground text-xs">MOP:</span> {logsTarget?.modeOfPayment}</div>
                <div><span className="text-muted-foreground text-xs">Name:</span> {logsTarget?.name || "-"}</div>
                <div><span className="text-muted-foreground text-xs">Attendant:</span> {logsTarget?.attendant || "-"}</div>
                {logsTarget?.remaining && (
                  <div><span className="text-muted-foreground text-xs">Remaining:</span> <strong>{fmtCurrency(parseCurrency(logsTarget.remaining))}</strong></div>
                )}
              </div>
              <Separator />
              <p className="text-sm font-medium">Activity Logs</p>
              {isLoadingLogs ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : activityLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No logs found for this transaction</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {activityLogs.map((log) => (
                    <div key={log.logId} className="p-2 rounded border text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium">{log.username}</span>
                        <span className="text-muted-foreground">{log.timestamp ? displayDate(log.timestamp, "MMM dd, hh:mm a") : ""}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{log.activity}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="text-center mt-8 text-sm text-muted-foreground">
          
        </div>
      </div>
    </Shell>
  );
};

export default TransactionTracker;
