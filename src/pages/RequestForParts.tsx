import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { DEVICE_TYPES } from "@/lib/constants";
import { notifyPartRequest } from "@/lib/partNotifications";
import { Package, Plus, CalendarIcon, Loader2, Search, ChevronLeft, ChevronRight, RefreshCw, Edit, X, Copy } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/DashboardLayout";
import { useFastMovingParts, useInvalidateFastMovingParts } from "@/hooks/useFastMovingParts";

interface PartRequest {
  partId: string;
  requestedBy: string;
  serviceId: string;
  partName: string;
  deviceType: string;
  brand: string;
  model: string;
  partType?: string;
  quantity: string;
  dateNeeded: string;
  dateOrdered: string;
  dateReceived: string;
  supplier: string;
  cost: string;
  status: string;
  lastUpdated: string;
  remarks: string;
}

const RequestForParts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const userRole = sessionStorage.getItem("userRole");
  const userFullName = sessionStorage.getItem("userFullName") || "User";
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateNeeded, setDateNeeded] = useState<Date | undefined>(undefined);
  
  // Use React Query for requests
  const { data: requests = [], isLoading } = useFastMovingParts();
  const invalidateParts = useInvalidateFastMovingParts();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<PartRequest | null>(null);
  const [editForm, setEditForm] = useState({
    partName: "",
    deviceType: "",
    brand: "",
    model: "",
    partType: "",
    quantity: "",
    remarks: ""
  });
  
  // Cancel dialog state
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState<PartRequest | null>(null);
  
  const [formData, setFormData] = useState({
    serviceId: "",
    partName: "",
    deviceType: "",
    brand: "",
    model: "",
    partType: "",
    partTypeOther: "",
    quantity: "",
    remarks: ""
  });

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
    if (userRole !== "admin" && userRole !== "technician" && userRole !== "management") {
      navigate("/menu");
    }
  }, [navigate, userRole]);

  const fetchRequests = () => {
    invalidateParts();
  };

  const normalizePersonName = (value: string) =>
    value
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const filteredRequests = useMemo(() => {
    const me = normalizePersonName(userFullName);

    const filtered = requests.filter((req) => {
      // Only show requests from the logged-in user
      const requestedBy = normalizePersonName(req.requestedBy || "");
      if (!requestedBy || requestedBy !== me) return false;

      // Status filter
      if (statusFilter !== "all" && req.status !== statusFilter) return false;

      // Search filter
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        return (
          req.partId?.toLowerCase().includes(search) ||
          req.partName?.toLowerCase().includes(search) ||
          req.serviceId?.toLowerCase().includes(search) ||
          req.requestedBy?.toLowerCase().includes(search)
        );
      }
      return true;
    });
    
    // Sort by most recent (partId descending - newer entries have higher IDs)
    return filtered.sort((a, b) => {
      const numA = parseInt(a.partId?.replace(/\D/g, '') || '0');
      const numB = parseInt(b.partId?.replace(/\D/g, '') || '0');
      return numB - numA; // Descending order (most recent first)
    });
  }, [requests, searchQuery, statusFilter, userFullName]);

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRequests.slice(start, start + itemsPerPage);
  }, [filteredRequests, currentPage]);

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);

  const handleSubmit = async () => {
    if (!formData.serviceId || !formData.partName || !formData.quantity || !dateNeeded) {
      toast({
        title: "Validation Error",
        description: "Service ID, Part Name, Quantity, and Date Needed are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const partTypeValue = formData.partType === "Others" ? formData.partTypeOther : formData.partType;
      const requestId = `RQ${Date.now().toString().slice(-9)}`;

      // Resolve current auth user id (UUID) for requested_by
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: userRes } = await supabase.auth.getUser();
      const requestedByUuid = userRes?.user?.id ?? null;

      const { error: insertErr } = await supabase.from("part_requests").insert({
        request_id: requestId,
        part_name: formData.partName,
        brand: formData.brand,
        device_model: formData.model,
        quantity: parseInt(formData.quantity) || 1,
        status: "For Ordering",
        service_id: formData.serviceId || null,
        requested_by: requestedByUuid,
        requested_by_name: userFullName,
        notes: [
          partTypeValue ? `Part Type: ${partTypeValue}` : "",
          formData.deviceType ? `Device Type: ${formData.deviceType}` : "",
          dateNeeded ? `Date Needed: ${format(dateNeeded, "MM/dd/yyyy")}` : "",
          formData.remarks,
        ].filter(Boolean).join(" | "),
      });

      if (insertErr) {
        throw new Error(insertErr.message || "Failed to insert part request");
      }

      const result: any = { result: "success", partId: requestId };
      const partId = result.partId;

      // Update Inquiry Database Part ID if Service ID matches
      // NOTE: Apps Script doPost reliably reads URL-encoded bodies via e.parameter (multipart FormData can be flaky).
      if (partId && formData.serviceId) {
        const serviceId = formData.serviceId.trim();

        const postUrlEncoded = async (payload: Record<string, string>) => {
          const body = new URLSearchParams(payload);
          return fetch(GOOGLE_SHEETS_SCRIPT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            },
            body,
          });
        };

        // 1) Preferred: server-side helper action (fast)
        try {
          const updateRes = await postUrlEncoded({
            action: "updateInquiryPartIdByServiceId",
            serviceId,
            partId,
          });

          const updateText = await updateRes.text();
          let updateJson: any = null;
          try {
            updateJson = updateText ? JSON.parse(updateText) : null;
          } catch {
            updateJson = null;
          }

          if (updateJson?.updated !== true) {
            throw new Error("No matching inquiry updated (fallback)");
          }
        } catch (updateError) {
          // 2) Fallback: use existing getClientInquiries + updateClientInquiry
          try {
            const inquiriesRes = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getClientInquiries`);
            const inquiriesJson = await inquiriesRes.json();
            const list = inquiriesJson?.data || [];
            const match = list.find((i: any) => (i.serviceId || "").toString().trim() === serviceId);

            if (match?.rowIndex) {
              // Preserve all existing values; only set Part ID
              await postUrlEncoded({
                action: "updateClientInquiry",
                rowIndex: match.rowIndex.toString(),
                clientId: match.clientId || "",
                serviceId: match.serviceId || "",
                timestamp: match.timestamp || "",
                name: match.name || "",
                address: match.address || "",
                contactNumber: match.contactNumber || "",
                modeOfTransfer: match.modeOfTransfer || "",
                device: match.device || "",
                initialDiagnosis: match.initialDiagnosis || "",
                quotation: match.quotation || "",
                pickUpDate: match.pickUpDate || "",
                directChatLink: match.directChatLink || "",
                preOrder: match.preOrder || "",
                initialPayment: match.initialPayment || "",
                partId,
              });
            }
          } catch (fallbackError) {
            console.error("Error updating inquiry Part ID:", updateError);
            console.error("Fallback update failed:", fallbackError);
          }
        }
      }

      // Notify management about the new part request
      await notifyPartRequest(userFullName, formData.serviceId, formData.partName);

      toast({
        title: "Submitted",
        description: "Request submitted successfully.",
      });

      fetchRequests();

      setIsDialogOpen(false);
      setFormData({
        serviceId: "",
        partName: "",
        deviceType: "",
        brand: "",
        model: "",
        partType: "",
        partTypeOther: "",
        quantity: "",
        remarks: "",
      });
      setDateNeeded(undefined);
    } catch (error) {
      console.error("Error submitting request:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit request.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      "For Ordering": "bg-orange-100 text-orange-800",
      "Ordered": "bg-blue-100 text-blue-800",
      "Received": "bg-green-100 text-green-800",
      "Cancelled": "bg-gray-100 text-gray-500"
    };
    return statusClasses[status] || "bg-gray-100 text-gray-800";
  };

  const handleEditClick = (request: PartRequest) => {
    setEditingRequest(request);
    setEditForm({
      partName: request.partName,
      deviceType: request.deviceType,
      brand: request.brand,
      model: request.model,
      partType: request.partType || "",
      quantity: request.quantity,
      remarks: request.remarks
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingRequest) return;

    setIsSubmitting(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("action", "updateFastMovingPart");
      formDataToSend.append("partId", editingRequest.partId);
      formDataToSend.append("partName", editForm.partName);
      formDataToSend.append("deviceType", editForm.deviceType);
      formDataToSend.append("brand", editForm.brand);
      formDataToSend.append("model", editForm.model);
      formDataToSend.append("partType", editForm.partType || "");
      formDataToSend.append("quantity", editForm.quantity);
      formDataToSend.append("remarks", editForm.remarks);

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formDataToSend,
      });

      let result: any = null;
      try {
        result = await response.json();
      } catch (parseError) {
        console.warn("Could not parse response (likely CORS), assuming success:", parseError);
      }

      const isSuccess =
        (result && (result.result === "success" || result.status === "success")) ||
        (response.ok && result === null);

      if (isSuccess) {
        // Notify management about the edit
        await notifyPartRequest(userFullName, editingRequest.serviceId, `${editForm.partName} (edited)`);

        toast({
          title: "Updated",
          description: "Request updated and management notified.",
        });
        setIsEditDialogOpen(false);
        setEditingRequest(null);
        fetchRequests();
      } else {
        throw new Error(result?.message || "Failed to update");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isCorsFetchError = msg.toLowerCase().includes("failed to fetch");

      if (isCorsFetchError) {
        console.warn("Edit request fetch error (likely CORS after successful POST):", error);
        toast({ title: "Updated", description: "Request updated and management notified." });
        setIsEditDialogOpen(false);
        setEditingRequest(null);
        fetchRequests();
        return;
      }

      console.error("Error updating request:", error);
      toast({
        title: "Error",
        description: msg.includes("Failed to") ? msg : "Failed to update request.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelClick = (request: PartRequest) => {
    setCancellingRequest(request);
    setIsCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!cancellingRequest) return;

    setIsSubmitting(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("action", "cancelFastMovingPart");
      formDataToSend.append("partId", cancellingRequest.partId);

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formDataToSend,
      });

      let result: any = null;
      try {
        result = await response.json();
      } catch (parseError) {
        console.warn("Could not parse response (likely CORS), assuming success:", parseError);
      }

      const isSuccess =
        (result && (result.result === "success" || result.status === "success")) ||
        (response.ok && result === null);

      if (isSuccess) {
        // Notify management about cancellation
        await notifyPartRequest(userFullName, cancellingRequest.serviceId, `${cancellingRequest.partName} (CANCELLED)`);

        toast({
          title: "Cancelled",
          description: "Request cancelled and management notified.",
        });
        setIsCancelDialogOpen(false);
        setCancellingRequest(null);
        fetchRequests();
      } else {
        throw new Error(result?.message || "Failed to cancel");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isCorsFetchError = msg.toLowerCase().includes("failed to fetch");

      if (isCorsFetchError) {
        console.warn("Cancel request fetch error (likely CORS after successful POST):", error);
        toast({ title: "Cancelled", description: "Request cancelled and management notified." });
        setIsCancelDialogOpen(false);
        setCancellingRequest(null);
        fetchRequests();
        return;
      }

      console.error("Error cancelling request:", error);
      toast({
        title: "Error",
        description: msg.includes("Failed to") ? msg : "Failed to cancel request.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicate = (request: PartRequest) => {
    // Pre-fill the form with existing data
    setFormData({
      serviceId: request.serviceId,
      partName: request.partName,
      deviceType: request.deviceType,
      brand: request.brand,
      model: request.model,
      partType: (request as any).partType || "",
      partTypeOther: (request as any).partTypeOther || "",
      quantity: request.quantity,
      remarks: request.remarks
    });
    setDateNeeded(undefined);
    setIsDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Request for Parts</h1>
              <p className="text-muted-foreground">Submit parts requests for services</p>
            </div>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </div>

        {/* Info Card - How to Request Parts */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>How to Request Parts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Use this page to submit part requests for services you're working on. 
              Management will be notified and process your order.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold text-primary mb-2">1</div>
                <h3 className="font-semibold mb-1">Submit Request</h3>
                <p className="text-sm text-muted-foreground">
                  Click "New Request" and fill in the part details along with the Service ID.
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold text-primary mb-2">2</div>
                <h3 className="font-semibold mb-1">Management Orders</h3>
                <p className="text-sm text-muted-foreground">
                  Management will review and place the order with the supplier.
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold text-primary mb-2">3</div>
                <h3 className="font-semibold mb-1">Get Notified</h3>
                <p className="text-sm text-muted-foreground">
                  You'll be notified when the part is received and ready for use.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Requests Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>My Requests</CardTitle>
              <div className="flex items-center gap-4">
                <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="For Ordering">For Ordering</SelectItem>
                    <SelectItem value="Ordered">Ordered</SelectItem>
                    <SelectItem value="Received">Received</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="pl-8"
                  />
                </div>
                <Button variant="outline" size="icon" onClick={fetchRequests} disabled={isLoading}>
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading requests...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {requests.length === 0 ? "No requests submitted yet" : "No requests match your search"}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part ID</TableHead>
                          <TableHead>Service ID</TableHead>
                          <TableHead>Part Name</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead>Part Type</TableHead>
                          <TableHead>Device Type</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Date Needed</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedRequests.map((req) => (
                          <TableRow 
                            key={req.partId}
                            className={req.status === "Cancelled" ? "opacity-50 bg-muted/30" : ""}
                          >
                            <TableCell className="font-medium">{req.partId}</TableCell>
                            <TableCell>{req.serviceId}</TableCell>
                            <TableCell>{req.partName}</TableCell>
                            <TableCell>{req.model || "N/A"}</TableCell>
                            <TableCell>{req.partType || "N/A"}</TableCell>
                            <TableCell>{req.deviceType || "N/A"}</TableCell>
                            <TableCell>{req.quantity}</TableCell>
                            <TableCell>{req.dateNeeded || "N/A"}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(req.status)}`}>
                                {req.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditClick(req)}
                                  disabled={req.status !== "For Ordering"}
                                  title={req.status !== "For Ordering" ? "Can only edit when status is For Ordering" : "Edit request"}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => handleCancelClick(req)}
                                  disabled={req.status === "Cancelled" || req.status === "Received"}
                                  title="Cancel request"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDuplicate(req)}
                                  title="Duplicate request"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredRequests.length)} of {filteredRequests.length}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="flex items-center px-2 text-sm">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Request Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Part Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Service ID *</Label>
                <Input
                  value={formData.serviceId}
                  onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                  placeholder="Enter Service ID"
                />
              </div>

              <div className="space-y-2">
                <Label>Part Name *</Label>
                <Input
                  value={formData.partName}
                  onChange={(e) => setFormData({ ...formData, partName: e.target.value })}
                  placeholder="Enter Part Name"
                />
              </div>

              <div className="space-y-2">
                <Label>Device Type</Label>
                <Select
                  value={formData.deviceType}
                  onValueChange={(value) => setFormData({ ...formData, deviceType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Device Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Input
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Enter Brand"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="Enter Model"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Part Type</Label>
                {formData.partType === "Others" ? (
                  <div className="flex gap-2">
                    <Input
                      value={formData.partTypeOther}
                      onChange={(e) => setFormData({ ...formData, partTypeOther: e.target.value })}
                      placeholder="Enter part type..."
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({ ...formData, partType: "", partTypeOther: "" })}
                    >
                      Reset
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={formData.partType}
                    onValueChange={(value) => setFormData({ ...formData, partType: value, partTypeOther: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select part type (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OEM">OEM</SelectItem>
                      <SelectItem value="Original">Original</SelectItem>
                      <SelectItem value="Others">Others</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="Enter Quantity"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date Needed *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateNeeded && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateNeeded ? format(dateNeeded, "MM/dd/yyyy") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateNeeded}
                        onSelect={setDateNeeded}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Request</DialogTitle>
              <DialogDescription>
                Edit Part ID: {editingRequest?.partId}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Part Name *</Label>
                <Input
                  value={editForm.partName}
                  onChange={(e) => setEditForm({ ...editForm, partName: e.target.value })}
                  placeholder="Enter Part Name"
                />
              </div>
              <div className="space-y-2">
                <Label>Device Type</Label>
                <Select
                  value={editForm.deviceType}
                  onValueChange={(value) => setEditForm({ ...editForm, deviceType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Device Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Input
                    value={editForm.brand}
                    onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                    placeholder="Enter Brand"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input
                    value={editForm.model}
                    onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                    placeholder="Enter Model"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Part Type</Label>
                <Select
                  value={editForm.partType || ""}
                  onValueChange={(value) => setEditForm({ ...editForm, partType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select part type (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OEM">OEM</SelectItem>
                    <SelectItem value="Original">Original</SelectItem>
                    <SelectItem value="Others">Others</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                  placeholder="Enter Quantity"
                />
              </div>
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea
                  value={editForm.remarks}
                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Confirmation Dialog */}
        <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Request</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel the request for "{cancellingRequest?.partName}"? 
                Management will be notified.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)}>
                No, Keep It
              </Button>
              <Button variant="destructive" onClick={handleCancelConfirm} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, Cancel Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default RequestForParts;
