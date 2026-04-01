import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { Search, Loader2, DollarSign, CreditCard, Receipt } from "lucide-react";
import { logActivityAsync } from "@/lib/activityLogger";

// Strip commas/spaces so parseFloat works on "16,500.00" → 16500.00
const parseCurrency = (val: string | number | undefined): number => {
  if (val === undefined || val === null || val === "") return 0;
  const cleaned = String(val).replace(/[^0-9.\-]/g, "");
  return parseFloat(cleaned) || 0;
};

const fmtPeso = (n: number) =>
  `Php ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface ServiceData {
  serviceId: string;
  clientName: string;
  device: string;
  serviceCost: string;
  finalCost: string;
  partsCost: string;
  partsUsed: string;
  status: string;
}

// Transaction types that require service/customer info
const SERVICE_TYPES = ["Down Payment", "Full Payment", "Partial Payment"];

const SALES_TYPES = [...SERVICE_TYPES, "Refund"];
const EXPENSE_TYPES = ["Parts Inventory", "Supplies", "Utilities", "Rent", "Miscellaneous Expense"];
const SALARY_TYPES = ["Salary Disbursement", "Bonus", "Commission"];
const OTHER_TYPES = ["Money In Bank", "Investment", "Savings/Interest", "Profit"];

const ALL_GROUPED = [
  { label: "Sales", items: SALES_TYPES },
  { label: "Expenses", items: EXPENSE_TYPES },
  { label: "Salary", items: SALARY_TYPES },
  { label: "Others", items: [...OTHER_TYPES, "Others"] },
];

const needsServiceInfo = (type: string) => SERVICE_TYPES.includes(type) || type === "Refund";

const PointOfSales = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const userRole = sessionStorage.getItem("userRole");
  const username = sessionStorage.getItem("userFullName") || sessionStorage.getItem("username") || "Unknown";

  const [transactionType, setTransactionType] = useState("");
  const [otherTransactionType, setOtherTransactionType] = useState("");
  const [modeOfPayment, setModeOfPayment] = useState("");
  const [otherMOP, setOtherMOP] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Service-related fields (only for payment types)
  const [searchServiceId, setSearchServiceId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [serviceData, setServiceData] = useState<ServiceData | null>(null);

  // Manual input fields for service payments
  const [manualName, setManualName] = useState("");
  const [manualDevice, setManualDevice] = useState("");
  const [manualServiceCost, setManualServiceCost] = useState("");

  // Remaining balance from previous payments
  const [previousPayments, setPreviousPayments] = useState(0);

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) navigate("/");
    if (userRole !== "management" && userRole !== "admin") navigate("/menu");
  }, [navigate, userRole]);

  const handleSearchService = async () => {
    if (!searchServiceId.trim()) {
      toast({ title: "Error", description: "Please enter a Service ID", variant: "destructive" });
      return;
    }
    setIsSearching(true);
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=searchService&serviceId=${encodeURIComponent(searchServiceId)}`
      );
      const result = await response.json();
      if (result.status === "found" && result.data) {
        setServiceData({
          serviceId: searchServiceId,
          clientName: result.data.clientName || "",
          device: result.data.device || "",
          serviceCost: result.data.serviceCost || "0",
          finalCost: result.data.finalCost || result.data.serviceCost || "0",
          partsCost: result.data.partsCost || "0",
          partsUsed: result.data.partsUsed || "",
          status: result.data.status || "",
        });

        // Fetch previous payments for this service
        const txnResponse = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getServicePayments&serviceId=${encodeURIComponent(searchServiceId)}`);
        const txnResult = await txnResponse.json();
        if (txnResult.status === "success") {
          setPreviousPayments(txnResult.totalPaid || 0);
        } else {
          setPreviousPayments(0);
        }

        toast({ title: "Service Found", description: `Loaded data for ${searchServiceId}` });
      } else {
        toast({ title: "Not Found", description: "Service ID not found in Service Database", variant: "destructive" });
        setServiceData(null);
        setPreviousPayments(0);
      }
    } catch {
      toast({ title: "Error", description: "Failed to search service", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const generateTransactionId = () => `TXN${Date.now()}`;

  // Computed remaining balance - only for service payment types
  const finalCostNum = parseCurrency(serviceData?.finalCost || manualServiceCost);
  const amountNum = parseCurrency(amount);
  const remaining = finalCostNum > 0 ? Math.max(0, finalCostNum - previousPayments - amountNum) : 0;

  const handleSubmitTransaction = async () => {
    const finalTransactionType = transactionType === "Others" ? otherTransactionType : transactionType;
    const finalMOP = modeOfPayment === "Others" ? otherMOP : modeOfPayment;

    if (!finalTransactionType || !finalMOP || !amount) {
      toast({ title: "Validation Error", description: "Please fill in Transaction Type, MOP, and Amount", variant: "destructive" });
      return;
    }

    // For payment types, we need either service data or manual info
    const isServiceType = needsServiceInfo(transactionType);
    if (isServiceType && !serviceData && !manualName) {
      toast({ title: "Error", description: "Please search for a service or enter client details", variant: "destructive" });
      return;
    }

    const isRefund = transactionType === "Refund";
    const showsService = isServiceType || isRefund;
    const name = showsService ? (serviceData?.clientName || manualName) : "";
    const device = showsService ? (serviceData?.device || manualDevice) : "";
    const serviceCostRaw = showsService ? parseCurrency(serviceData?.serviceCost || manualServiceCost).toFixed(2) : "0";
    const serviceId = showsService ? (serviceData?.serviceId || searchServiceId || "MANUAL") : "";
    const partsCostRaw = showsService ? parseCurrency(serviceData?.partsCost).toFixed(2) : "0";
    const amountClean = parseCurrency(amount).toFixed(2);
    const finalCostClean = parseCurrency(serviceData?.finalCost).toFixed(2);
    const transactionId = generateTransactionId();

    setIsSubmitting(true);
    try {
      const params = new URLSearchParams();
      params.append("action", "addTransaction");
      params.append("transactionId", transactionId);
      params.append("serviceId", serviceId);
      params.append("transactionType", finalTransactionType);
      params.append("modeOfPayment", finalMOP);
      params.append("name", name);
      params.append("device", device);
      params.append("amount", amount);
      params.append("serviceCost", serviceCost);
      params.append("attendant", username);
      params.append("remarks", remarks);
      params.append("partsCost", partsCost);
      params.append("finalCost", serviceData?.finalCost || "0");
      params.append("previousPayments", previousPayments.toString());

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, { method: "POST", body: params });
      const result = await response.json();

      if (result.status === "success") {
        toast({ title: "Transaction Recorded", description: `Transaction ${transactionId} saved successfully` });
        logActivityAsync({
          serviceId: serviceId || "POS",
          username,
          role: userRole || "",
          activity: `POS: Recorded ${finalTransactionType} of Php ${amount} via ${finalMOP} (${transactionId})`,
        });

        // Reset form
        setTransactionType("");
        setOtherTransactionType("");
        setModeOfPayment("");
        setOtherMOP("");
        setAmount("");
        setRemarks("");
        setServiceData(null);
        setSearchServiceId("");
        setManualName("");
        setManualDevice("");
        setManualServiceCost("");
        setPreviousPayments(0);
      } else {
        toast({ title: "Error", description: result.message || "Failed to record transaction", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to submit transaction", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const showServiceSection = needsServiceInfo(transactionType);

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="h-8 w-8" />
            Point of Sales
          </h1>
          <p className="text-muted-foreground">Record client payments and transactions</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Transaction Type & Service Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Transaction Type Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Transaction Type</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={transactionType} onValueChange={(v) => { setTransactionType(v); if (!needsServiceInfo(v)) { setServiceData(null); setSearchServiceId(""); setPreviousPayments(0); } }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select transaction type" />
                  </SelectTrigger>
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
                {transactionType === "Others" && (
                  <Input placeholder="Specify transaction type" value={otherTransactionType} onChange={(e) => setOtherTransactionType(e.target.value)} />
                )}
              </CardContent>
            </Card>

            {/* Service Search - only for payment types */}
            {showServiceSection && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Search className="h-5 w-5" />
                    Service Lookup
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Enter Service ID"
                    value={searchServiceId}
                    onChange={(e) => setSearchServiceId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchService()}
                  />
                  <Button onClick={handleSearchService} disabled={isSearching} className="w-full">
                    {isSearching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    {isSearching ? "Searching..." : "Search"}
                  </Button>

                  {serviceData && (
                    <div className="p-3 rounded-lg bg-muted/50 text-sm">
                      <p className="text-primary font-semibold">{serviceData.serviceId} — Service found</p>
                    </div>
                  )}

                  {!serviceData && (
                    <div className="space-y-2 mt-3 p-3 rounded-lg border border-dashed">
                      <p className="text-xs text-muted-foreground mb-2">Or enter details manually:</p>
                      <div className="space-y-2">
                        <Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Client Name" />
                        <Input value={manualDevice} onChange={(e) => setManualDevice(e.target.value)} placeholder="Device" />
                        <Input type="number" value={manualServiceCost} onChange={(e) => setManualServiceCost(e.target.value)} placeholder="Service Cost" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Payment Details */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="h-5 w-5" />
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {!transactionType ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">Select a Transaction Type</p>
                    <p className="text-sm">Choose a transaction type from the left to get started.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Mode of Payment */}
                      <div className="space-y-2">
                        <Label>Mode of Payment *</Label>
                        <Select value={modeOfPayment} onValueChange={setModeOfPayment}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select MOP" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GCash">GCash</SelectItem>
                            <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                            <SelectItem value="Credit Card">Credit Card</SelectItem>
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="Others">Others</SelectItem>
                          </SelectContent>
                        </Select>
                        {modeOfPayment === "Others" && (
                          <Input placeholder="Specify payment method" value={otherMOP} onChange={(e) => setOtherMOP(e.target.value)} />
                        )}
                      </div>

                      {/* Amount */}
                      <div className="space-y-2">
                        <Label>Amount (Php) *</Label>
                        <Input type="number" step="0.01" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg font-semibold" />
                      </div>
                    </div>

                    {/* Pre-filled info from service search */}
                    {showServiceSection && serviceData && (
                      <div className="space-y-3 p-4 rounded-lg bg-muted/50">
                        <div className="grid md:grid-cols-2 gap-3">
                          <div><Label className="text-xs text-muted-foreground">Client Name</Label><p className="font-medium">{serviceData.clientName}</p></div>
                          <div><Label className="text-xs text-muted-foreground">Device</Label><p>{serviceData.device}</p></div>
                          <div><Label className="text-xs text-muted-foreground">Service Cost</Label><p>Php {serviceData.serviceCost}</p></div>
                          <div><Label className="text-xs text-muted-foreground">Final Cost</Label><p className="font-bold text-primary">Php {serviceData.finalCost}</p></div>
                          <div><Label className="text-xs text-muted-foreground">Parts Cost</Label><p>Php {serviceData.partsCost}</p></div>
                          <div><Label className="text-xs text-muted-foreground">Previous Payments</Label><p>Php {previousPayments.toFixed(2)}</p></div>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">Remaining Balance</Label>
                          <p className={`text-lg font-bold ${remaining <= 0 ? "text-green-600" : "text-destructive"}`}>
                            Php {remaining.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Remarks */}
                    <div className="space-y-2">
                      <Label>Remarks (optional)</Label>
                      <Textarea placeholder="Add any notes about this transaction" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} />
                    </div>

                    <Separator />

                    <Button onClick={handleSubmitTransaction} disabled={isSubmitting} className="w-full h-12 text-lg" size="lg">
                      {isSubmitting ? (
                        <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Processing...</>
                      ) : (
                        <><Receipt className="h-5 w-5 mr-2" /> Record Transaction</>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-muted-foreground">
          powered by Stack&Scale
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PointOfSales;
