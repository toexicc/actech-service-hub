import { useState, useEffect } from "react";
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

interface ServiceData {
  serviceId: string;
  clientName: string;
  device: string;
  serviceCost: string;
  totalCost: string;
  partsUsed: string;
  status: string;
  paymentStatus: string;
}

const PointOfSales = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const userRole = sessionStorage.getItem("userRole");
  const username = sessionStorage.getItem("userFullName") || sessionStorage.getItem("username") || "Unknown";

  const [searchServiceId, setSearchServiceId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [serviceData, setServiceData] = useState<ServiceData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Transaction fields
  const [transactionType, setTransactionType] = useState("");
  const [otherTransactionType, setOtherTransactionType] = useState("");
  const [modeOfPayment, setModeOfPayment] = useState("");
  const [otherMOP, setOtherMOP] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
    if (userRole !== "management" && userRole !== "admin") {
      navigate("/menu");
    }
  }, [navigate, userRole]);

  const handleSearchService = async () => {
    if (!searchServiceId.trim()) {
      toast({ title: "Error", description: "Please enter a Service ID", variant: "destructive" });
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=search&serviceId=${encodeURIComponent(searchServiceId)}`
      );
      const result = await response.json();

      if (result.found && result.data) {
        setServiceData({
          serviceId: searchServiceId,
          clientName: result.data.name || result.data.clientName || "",
          device: result.data.device || result.data.deviceModel || "",
          serviceCost: result.data.serviceCost || result.data.estimatedCost || "0",
          totalCost: result.data.totalCost || result.data.finalCost || result.data.serviceCost || "0",
          partsUsed: result.data.partsUsed || "",
          status: result.data.status || "",
          paymentStatus: result.data.paymentStatus || "",
        });
        toast({ title: "Service Found", description: `Loaded data for ${searchServiceId}` });
      } else {
        toast({ title: "Not Found", description: "Service ID not found", variant: "destructive" });
        setServiceData(null);
      }
    } catch {
      toast({ title: "Error", description: "Failed to search service", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmitTransaction = async () => {
    if (!serviceData) {
      toast({ title: "Error", description: "Please search for a service first", variant: "destructive" });
      return;
    }

    const finalTransactionType = transactionType === "Others" ? otherTransactionType : transactionType;
    const finalMOP = modeOfPayment === "Others" ? otherMOP : modeOfPayment;

    if (!finalTransactionType || !finalMOP || !amount) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const params = new URLSearchParams();
      params.append("action", "addTransaction");
      params.append("serviceId", serviceData.serviceId);
      params.append("transactionType", finalTransactionType);
      params.append("modeOfPayment", finalMOP);
      params.append("name", serviceData.clientName);
      params.append("device", serviceData.device);
      params.append("amount", amount);
      params.append("serviceCost", serviceData.serviceCost);
      params.append("remarks", remarks);
      params.append("partsUsed", serviceData.partsUsed);
      params.append("recordedBy", username);

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: params,
      });

      const result = await response.json();

      if (result.status === "success") {
        toast({ title: "Transaction Recorded", description: "Transaction has been saved successfully" });
        logActivityAsync(`POS: Recorded ${finalTransactionType} of Php ${amount} for ${serviceData.serviceId} via ${finalMOP}`);
        
        // Reset form
        setTransactionType("");
        setOtherTransactionType("");
        setModeOfPayment("");
        setOtherMOP("");
        setAmount("");
        setRemarks("");
        setServiceData(null);
        setSearchServiceId("");
      } else {
        toast({ title: "Error", description: result.message || "Failed to record transaction", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to submit transaction", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

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
          {/* Search & Service Info - Left Column */}
          <div className="lg:col-span-1 space-y-6">
            {/* Service ID Search */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Search className="h-5 w-5" />
                  Search Service
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
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
                </div>
              </CardContent>
            </Card>

            {/* Service Details */}
            {serviceData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Service Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Service ID</Label>
                    <p className="font-semibold text-primary">{serviceData.serviceId}</p>
                  </div>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground">Client Name</Label>
                    <p className="font-medium">{serviceData.clientName || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Device</Label>
                    <p>{serviceData.device || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Service Cost</Label>
                    <p className="text-lg font-bold">Php {serviceData.serviceCost}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Parts Used</Label>
                    <p className="text-sm">{serviceData.partsUsed || "None"}</p>
                  </div>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <p>{serviceData.status || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Payment Status</Label>
                    <p className="font-medium">{serviceData.paymentStatus || "N/A"}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Transaction Form - Right Column */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="h-5 w-5" />
                  Record Transaction
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {!serviceData ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">Search for a Service ID to begin</p>
                    <p className="text-sm">Enter a Service ID on the left to load service data and record a transaction.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Type of Transaction */}
                      <div className="space-y-2">
                        <Label>Type of Transaction *</Label>
                        <Select value={transactionType} onValueChange={setTransactionType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Down Payment">Down Payment</SelectItem>
                            <SelectItem value="Full Payment">Full Payment</SelectItem>
                            <SelectItem value="Payment Settlement (Full Payment)">Payment Settlement (Full Payment)</SelectItem>
                            <SelectItem value="Others">Others</SelectItem>
                          </SelectContent>
                        </Select>
                        {transactionType === "Others" && (
                          <Input
                            placeholder="Specify transaction type"
                            value={otherTransactionType}
                            onChange={(e) => setOtherTransactionType(e.target.value)}
                          />
                        )}
                      </div>

                      {/* Mode of Payment */}
                      <div className="space-y-2">
                        <Label>Mode of Payment *</Label>
                        <Select value={modeOfPayment} onValueChange={setModeOfPayment}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select MOP" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GCash">GCash</SelectItem>
                            <SelectItem value="Maya">Maya</SelectItem>
                            <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                            <SelectItem value="Credit Card">Credit Card</SelectItem>
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="Others">Others</SelectItem>
                          </SelectContent>
                        </Select>
                        {modeOfPayment === "Others" && (
                          <Input
                            placeholder="Specify payment method"
                            value={otherMOP}
                            onChange={(e) => setOtherMOP(e.target.value)}
                          />
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                      <Label>Amount (Php) *</Label>
                      <Input
                        type="number"
                        placeholder="Enter amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="text-lg font-semibold"
                      />
                    </div>

                    {/* Pre-filled info */}
                    <div className="grid md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                      <div>
                        <Label className="text-xs text-muted-foreground">Client Name (auto)</Label>
                        <p className="font-medium">{serviceData.clientName}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Device (auto)</Label>
                        <p>{serviceData.device}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Service Cost (auto)</Label>
                        <p>Php {serviceData.serviceCost}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Parts Used (auto)</Label>
                        <p>{serviceData.partsUsed || "None"}</p>
                      </div>
                    </div>

                    {/* Remarks */}
                    <div className="space-y-2">
                      <Label>Remarks (optional)</Label>
                      <Textarea
                        placeholder="Add any notes about this transaction"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <Separator />

                    <Button
                      onClick={handleSubmitTransaction}
                      disabled={isSubmitting}
                      className="w-full h-12 text-lg"
                      size="lg"
                    >
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
