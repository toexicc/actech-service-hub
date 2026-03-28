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
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { displayDate } from "@/lib/timezone";
import {
  Search, Loader2, DollarSign, Edit, Trash2, Plus, RefreshCw,
  ChevronLeft, ChevronRight, CreditCard, Landmark, Wallet, TrendingDown, Banknote,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { logActivityAsync } from "@/lib/activityLogger";

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
  remarks: string;
  partsUsed: string;
  recordedBy: string;
}

const SALES_TYPES = ["Down Payment", "Full Payment", "Payment Settlement (Full Payment)"];
const EXPENSE_TYPES = ["Parts Inventory", "Supplies", "Utilities", "Rent", "Miscellaneous Expense"];
const SALARY_TYPES = ["Salary Disbursement", "Bonus", "Commission"];

const ALL_TRANSACTION_TYPES = [
  ...SALES_TYPES,
  "Money in Bank",
  ...EXPENSE_TYPES,
  ...SALARY_TYPES,
  "Others",
];

const fetchTransactions = async (): Promise<Transaction[]> => {
  const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getTransactions`);
  const data = await response.json();
  if (data.status === "success" && data.transactions) {
    return data.transactions;
  }
  return [];
};

const TransactionTracker = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userRole = sessionStorage.getItem("userRole");
  const username = sessionStorage.getItem("userFullName") || sessionStorage.getItem("username") || "Unknown";

  const [searchQuery, setSearchQuery] = useState("");
  const [mopFilter, setMopFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("general");
  const itemsPerPage = 15;

  // Edit/Add dialog
  const [editDialog, setEditDialog] = useState(false);
  const [editData, setEditData] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState({
    transactionType: "", otherTransactionType: "", modeOfPayment: "", otherMOP: "",
    amount: "", remarks: "", serviceId: "", name: "", device: "", serviceCost: "", partsUsed: "",
  });
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Tab-based filtering
  const tabFilteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const type = t.transactionType || "";
      switch (activeTab) {
        case "sales":
          return SALES_TYPES.includes(type) || type === "Money in Bank";
        case "expenses":
          return EXPENSE_TYPES.includes(type) || type === "Parts Inventory";
        case "salary":
          return SALARY_TYPES.includes(type);
        default: // general
          return true;
      }
    });
  }, [transactions, activeTab]);

  const filteredTransactions = useMemo(() => {
    return tabFilteredTransactions.filter((t) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !t.serviceId?.toLowerCase().includes(q) &&
          !t.name?.toLowerCase().includes(q) &&
          !t.transactionType?.toLowerCase().includes(q) &&
          !t.transactionId?.toLowerCase().includes(q) &&
          !t.recordedBy?.toLowerCase().includes(q)
        ) return false;
      }
      if (mopFilter !== "all" && t.modeOfPayment !== mopFilter) return false;
      return true;
    });
  }, [tabFilteredTransactions, searchQuery, mopFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Mini dashboard stats
  const moneyInBank = useMemo(() => {
    return transactions
      .filter((t) => t.transactionType === "Money in Bank")
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  }, [transactions]);

  const totalSales = useMemo(() => {
    return transactions
      .filter((t) => SALES_TYPES.includes(t.transactionType))
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  }, [transactions]);

  const totalExpenses = useMemo(() => {
    return transactions
      .filter((t) => [...EXPENSE_TYPES, "Parts Inventory"].includes(t.transactionType))
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  }, [transactions]);

  const totalSalary = useMemo(() => {
    return transactions
      .filter((t) => SALARY_TYPES.includes(t.transactionType))
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  }, [transactions]);

  const mopBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    transactions.forEach((t) => {
      if (!SALES_TYPES.includes(t.transactionType)) return;
      const mop = t.modeOfPayment || "Unknown";
      breakdown[mop] = (breakdown[mop] || 0) + (parseFloat(t.amount) || 0);
    });
    return breakdown;
  }, [transactions]);

  const handleEdit = (transaction: Transaction) => {
    if (userRole === "admin") {
      toast({ title: "Pending Request", description: "Edit request sent to management for approval", variant: "default" });
      return;
    }
    setEditData(transaction);
    const isOtherType = !ALL_TRANSACTION_TYPES.filter(t => t !== "Others").includes(transaction.transactionType);
    const isOtherMOP = !["GCash", "Maya", "Bank Transfer", "Credit Card", "Cash", "N/A"].includes(transaction.modeOfPayment);
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
      partsUsed: transaction.partsUsed,
    });
    setEditDialog(true);
  };

  const handleAdd = () => {
    setEditData(null);
    setEditForm({
      transactionType: "", otherTransactionType: "", modeOfPayment: "", otherMOP: "",
      amount: "", remarks: "", serviceId: "", name: "", device: "", serviceCost: "", partsUsed: "",
    });
    setEditDialog(true);
  };

  const handleSaveEdit = async () => {
    const finalType = editForm.transactionType === "Others" ? editForm.otherTransactionType : editForm.transactionType;
    const finalMOP = editForm.transactionType === "Money in Bank" ? "N/A"
      : (editForm.modeOfPayment === "Others" ? editForm.otherMOP : editForm.modeOfPayment);

    if (!finalType || !editForm.amount) {
      toast({ title: "Validation Error", description: "Please fill Transaction Type and Amount", variant: "destructive" });
      return;
    }
    if (editForm.transactionType !== "Money in Bank" && !finalMOP) {
      toast({ title: "Validation Error", description: "Please select a Mode of Payment", variant: "destructive" });
      return;
    }

    setIsEditSubmitting(true);
    try {
      const transactionId = editData ? editData.transactionId : `TXN${Date.now()}`;
      const params = new URLSearchParams();
      params.append("action", editData ? "editTransaction" : "addTransaction");
      if (editData) params.append("transactionId", editData.transactionId);
      else params.append("transactionId", transactionId);
      params.append("serviceId", editForm.serviceId);
      params.append("transactionType", finalType);
      params.append("modeOfPayment", finalMOP);
      params.append("name", editForm.name);
      params.append("device", editForm.device);
      params.append("amount", editForm.amount);
      params.append("serviceCost", editForm.serviceCost);
      params.append("remarks", editForm.remarks);
      params.append("partsUsed", editForm.partsUsed);
      params.append("recordedBy", username);

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, { method: "POST", body: params });
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (userRole === "admin") {
      toast({ title: "Pending Request", description: "Delete request sent to management", variant: "default" });
      setDeleteDialog(false);
      return;
    }

    setIsDeleting(true);
    try {
      const params = new URLSearchParams();
      params.append("action", "deleteTransaction");
      params.append("transactionId", deleteTarget.transactionId);
      params.append("deletedBy", username);

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, { method: "POST", body: params });
      const result = await response.json();

      if (result.status === "success") {
        toast({ title: "Deleted", description: "Transaction removed" });
        logActivityAsync({
          serviceId: deleteTarget.serviceId || "TRACKER",
          username,
          role: userRole || "",
          activity: `Deleted transaction ${deleteTarget.transactionId}`,
        });
        setDeleteDialog(false);
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
      } else {
        toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete transaction", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const getMOPIcon = (mop: string) => {
    switch (mop) {
      case "GCash": case "Maya": return <Wallet className="h-3 w-3" />;
      case "Bank Transfer": return <Landmark className="h-3 w-3" />;
      case "Credit Card": return <CreditCard className="h-3 w-3" />;
      default: return <DollarSign className="h-3 w-3" />;
    }
  };

  const needsMOP = editForm.transactionType !== "Money in Bank";

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Transaction Tracker</h1>
            <p className="text-muted-foreground">View and manage all transactions</p>
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

        {/* Mini Dashboard */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Money in Bank</p>
              <p className="text-xl font-bold text-primary">Php {moneyInBank.toLocaleString()}</p>
              <Landmark className="h-5 w-5 text-muted-foreground/30 mt-1" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Sales</p>
              <p className="text-xl font-bold text-green-600">Php {totalSales.toLocaleString()}</p>
              <DollarSign className="h-5 w-5 text-muted-foreground/30 mt-1" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Expenses</p>
              <p className="text-xl font-bold text-destructive">Php {totalExpenses.toLocaleString()}</p>
              <TrendingDown className="h-5 w-5 text-muted-foreground/30 mt-1" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Salary Disbursed</p>
              <p className="text-xl font-bold text-accent-foreground">Php {totalSalary.toLocaleString()}</p>
              <Banknote className="h-5 w-5 text-muted-foreground/30 mt-1" />
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-3 lg:col-span-1">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2">Sales by MOP</p>
              <div className="space-y-1">
                {Object.entries(mopBreakdown).map(([mop, total]) => (
                  <div key={mop} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1">{getMOPIcon(mop)} {mop}</span>
                    <span className="font-bold">Php {total.toLocaleString()}</span>
                  </div>
                ))}
                {Object.keys(mopBreakdown).length === 0 && (
                  <span className="text-xs text-muted-foreground">No sales yet</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setCurrentPage(1); }} className="mb-6">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="salary">Salary</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Search by ID, Name, Type, or Recorded By..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                />
              </div>
              <Select value={mopFilter} onValueChange={(v) => { setMopFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by MOP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All MOP</SelectItem>
                  <SelectItem value="GCash">GCash</SelectItem>
                  <SelectItem value="Maya">Maya</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="N/A">N/A</SelectItem>
                </SelectContent>
              </Select>
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
                      <TableHead>Recorded By</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransactions.map((t) => (
                      <TableRow key={t.transactionId}>
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
                        <TableCell className="font-semibold">Php {t.amount}</TableCell>
                        <TableCell className="text-xs">{t.recordedBy}</TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate">{t.remarks || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(t)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => { setDeleteTarget(t); setDeleteDialog(true); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
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
                      <SelectItem value="Down Payment">Down Payment</SelectItem>
                      <SelectItem value="Full Payment">Full Payment</SelectItem>
                      <SelectItem value="Payment Settlement (Full Payment)">Payment Settlement</SelectItem>
                      <SelectItem value="Money in Bank">Money in Bank</SelectItem>
                      <SelectItem value="Parts Inventory">Parts Inventory</SelectItem>
                      <SelectItem value="Supplies">Supplies</SelectItem>
                      <SelectItem value="Utilities">Utilities</SelectItem>
                      <SelectItem value="Rent">Rent</SelectItem>
                      <SelectItem value="Miscellaneous Expense">Miscellaneous Expense</SelectItem>
                      <SelectItem value="Salary Disbursement">Salary Disbursement</SelectItem>
                      <SelectItem value="Bonus">Bonus</SelectItem>
                      <SelectItem value="Commission">Commission</SelectItem>
                      <SelectItem value="Others">Others</SelectItem>
                    </SelectContent>
                  </Select>
                  {editForm.transactionType === "Others" && (
                    <Input
                      placeholder="Specify type"
                      value={editForm.otherTransactionType}
                      onChange={(e) => setEditForm({ ...editForm, otherTransactionType: e.target.value })}
                    />
                  )}
                </div>
                {needsMOP && (
                  <div className="space-y-2">
                    <Label>MOP *</Label>
                    <Select value={editForm.modeOfPayment} onValueChange={(v) => setEditForm({ ...editForm, modeOfPayment: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GCash">GCash</SelectItem>
                        <SelectItem value="Maya">Maya</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="Credit Card">Credit Card</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Others">Others</SelectItem>
                      </SelectContent>
                    </Select>
                    {editForm.modeOfPayment === "Others" && (
                      <Input
                        placeholder="Specify MOP"
                        value={editForm.otherMOP}
                        onChange={(e) => setEditForm({ ...editForm, otherMOP: e.target.value })}
                      />
                    )}
                  </div>
                )}
              </div>
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
                  <Input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Service Cost</Label>
                  <Input type="number" value={editForm.serviceCost} onChange={(e) => setEditForm({ ...editForm, serviceCost: e.target.value })} />
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

        {/* Delete Dialog */}
        <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Transaction</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this transaction? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="text-center mt-8 text-sm text-muted-foreground">
          powered by Stack&Scale
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TransactionTracker;
