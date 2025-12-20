import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { DEVICE_TYPES } from "@/lib/constants";
import { Edit, X, Package, CalendarIcon, Loader2, ChevronLeft, ChevronRight, Search, Copy, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { notifyPartOrdered, notifyPartReceived, notifyPartCancelled } from "@/lib/partNotifications";

interface FastMovingPart {
  partId: string;
  requestedBy: string;
  serviceId: string;
  partName: string;
  deviceType: string;
  brand: string;
  model: string;
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

export const FastMovingPartsTab = () => {
  const { toast } = useToast();
  const [parts, setParts] = useState<FastMovingPart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Dialog states
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<FastMovingPart | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelRemark, setCancelRemark] = useState("");

  // Order form state
  const [orderForm, setOrderForm] = useState({
    supplier: "",
    cost: "",
    dateOrdered: undefined as Date | undefined,
    remarks: ""
  });

  // Edit form state
  const [editForm, setEditForm] = useState<FastMovingPart | null>(null);

  // Duplicate form state
  const [duplicateForm, setDuplicateForm] = useState({
    serviceId: "",
    partName: "",
    deviceType: "",
    brand: "",
    model: "",
    quantity: "",
    dateNeeded: undefined as Date | undefined,
    remarks: ""
  });

  useEffect(() => {
    fetchParts();
  }, []);

  const fetchParts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getFastMovingParts`);
      const data = await response.json();

      if (data.status === "success" && data.parts) {
        setParts(data.parts);
      } else {
        toast({
          title: "Error",
          description: "Failed to load fast moving parts",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching parts:", error);
      toast({
        title: "Error",
        description: "Failed to load fast moving parts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredParts = useMemo(() => {
    const filtered = parts.filter(part => {
      // Status filter
      if (statusFilter !== "all" && part.status !== statusFilter) return false;
      
      // Search filter
      const search = searchQuery.toLowerCase();
      if (search) {
        return (
          part.partId?.toLowerCase().includes(search) ||
          part.partName?.toLowerCase().includes(search) ||
          part.serviceId?.toLowerCase().includes(search) ||
          part.requestedBy?.toLowerCase().includes(search)
        );
      }
      return true;
    });
    // Sort: Cancelled items last, then by most recent (partId descending)
    return filtered.sort((a, b) => {
      // Cancelled items go to the end
      if (a.status === "Cancelled" && b.status !== "Cancelled") return 1;
      if (a.status !== "Cancelled" && b.status === "Cancelled") return -1;
      
      // Extract numeric part from partId for proper sorting (e.g., FMP-001 -> 1)
      const numA = parseInt(a.partId?.replace(/\D/g, '') || '0');
      const numB = parseInt(b.partId?.replace(/\D/g, '') || '0');
      return numB - numA; // Descending order (most recent first)
    });
  }, [parts, searchQuery, statusFilter]);

  const paginatedParts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredParts.slice(start, start + itemsPerPage);
  }, [filteredParts, currentPage]);

  const totalPages = Math.ceil(filteredParts.length / itemsPerPage);

  const handleOrder = async () => {
    if (!selectedPart || !orderForm.supplier || !orderForm.cost || !orderForm.dateOrdered) {
      toast({
        title: "Validation Error",
        description: "Supplier, Cost, and Date Ordered are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("action", "updateFastMovingPartOrder");
      formData.append("partId", selectedPart.partId);
      formData.append("supplier", orderForm.supplier);
      formData.append("cost", orderForm.cost);
      formData.append("dateOrdered", format(orderForm.dateOrdered, "yyyy-MM-dd"));
      formData.append("remarks", orderForm.remarks || selectedPart.remarks);
      formData.append("status", "Ordered");

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

       if (result.result === "success") {
         // Notify the requester that their part has been ordered
         await notifyPartOrdered(
           selectedPart.requestedBy,
           selectedPart.serviceId,
           selectedPart.partName,
           orderForm.supplier
         );

        toast({
          title: "Success",
          description: "Order placed successfully",
        });
        setIsOrderDialogOpen(false);
        setSelectedPart(null);
        setOrderForm({ supplier: "", cost: "", dateOrdered: undefined, remarks: "" });
        fetchParts();
      } else {
        toast({
          title: "Error",
          description: "Failed to place order",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error placing order:", error);
      toast({
        title: "Error",
        description: "Failed to place order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceive = async (part: FastMovingPart) => {
    setIsSubmitting(true);
    try {
      const normalizedCost = String(part.cost ?? '').replace(/[^0-9.]/g, '');
      const normalizedQty = String(part.quantity ?? '').replace(/[^0-9]/g, '');

      const formData = new FormData();
      formData.append("action", "receiveFastMovingPart");
      formData.append("partId", part.partId);
      formData.append("serviceId", part.serviceId);
      formData.append("requestedBy", part.requestedBy);
      // IMPORTANT: Service Database (Column AU - Parts Used) must store Part ID, not Part Name
      // The deployed Apps Script currently reads `partName` when building Column AU, so we send the Part ID here.
      // (Part name is still available in the Fast Moving sheet itself and in client-side notifications.)
      formData.append("partName", part.partId);
      formData.append("cost", normalizedCost);
      formData.append("quantity", normalizedQty);
      formData.append("dateReceived", format(new Date(), "yyyy-MM-dd"));

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.result === "success") {
        // Notify assigned admin and technician that the part is received
        await notifyPartReceived(part.serviceId, part.partName);

        toast({
          title: "Success",
          description: "Part received and added to service",
        });
        fetchParts();
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to receive part",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error receiving part:", error);
      toast({
        title: "Error",
        description: "Failed to receive part",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editForm) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("action", "updateFastMovingPart");
      formData.append("partId", editForm.partId);
      formData.append("partName", editForm.partName);
      formData.append("deviceType", editForm.deviceType);
      formData.append("brand", editForm.brand);
      formData.append("model", editForm.model);
      formData.append("quantity", editForm.quantity);
      formData.append("remarks", editForm.remarks);

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.result === "success") {
        toast({
          title: "Success",
          description: "Part updated successfully",
        });
        setIsEditDialogOpen(false);
        setEditForm(null);
        fetchParts();
      } else {
        toast({
          title: "Error",
          description: "Failed to update part",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating part:", error);
      toast({
        title: "Error",
        description: "Failed to update part",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedPart) return;

    setIsSubmitting(true);
    try {
      const userFullName = sessionStorage.getItem("userFullName") || "Management";
      
      const formData = new FormData();
      formData.append("action", "cancelFastMovingPart");
      formData.append("partId", selectedPart.partId);
      formData.append("cancelRemark", cancelRemark);
      formData.append("status", "Cancelled");

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.result === "success") {
        // Notify the requester about the cancellation with proper tag
        await notifyPartCancelled(
          selectedPart.requestedBy,
          selectedPart.serviceId,
          selectedPart.partName,
          userFullName,
          cancelRemark
        );

        toast({
          title: "Cancelled",
          description: "Part request cancelled and requester notified",
        });
        setIsCancelDialogOpen(false);
        setSelectedPart(null);
        setCancelRemark("");
        fetchParts();
      } else {
        toast({
          title: "Error",
          description: "Failed to cancel part request",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error cancelling part:", error);
      toast({
        title: "Error",
        description: "Failed to cancel part request",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicateOpen = (part: FastMovingPart) => {
    setDuplicateForm({
      serviceId: part.serviceId,
      partName: part.partName,
      deviceType: part.deviceType,
      brand: part.brand,
      model: part.model,
      quantity: part.quantity,
      dateNeeded: undefined,
      remarks: part.remarks
    });
    setIsDuplicateDialogOpen(true);
  };

  const handleDuplicateSubmit = async () => {
    if (!duplicateForm.serviceId || !duplicateForm.partName || !duplicateForm.quantity || !duplicateForm.dateNeeded) {
      toast({
        title: "Validation Error",
        description: "Service ID, Part Name, Quantity, and Date Needed are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const userFullName = sessionStorage.getItem("userFullName") || "Management";
      
      const formData = new FormData();
      formData.append("action", "addFastMovingPart");
      formData.append("requestedBy", userFullName);
      formData.append("serviceId", duplicateForm.serviceId);
      formData.append("partName", duplicateForm.partName);
      formData.append("deviceType", duplicateForm.deviceType);
      formData.append("brand", duplicateForm.brand);
      formData.append("model", duplicateForm.model);
      formData.append("quantity", duplicateForm.quantity);
      formData.append("dateNeeded", format(duplicateForm.dateNeeded, "MM/dd/yyyy"));
      formData.append("status", "For Ordering");
      formData.append("remarks", duplicateForm.remarks);

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.result === "success") {
        toast({
          title: "Duplicated",
          description: "New part request created",
        });
        setIsDuplicateDialogOpen(false);
        fetchParts();
      } else {
        throw new Error(result.message || "Failed to create duplicate");
      }
    } catch (error) {
      console.error("Error duplicating part:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to duplicate request",
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Fast Moving Parts
          </CardTitle>
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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : filteredParts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No part requests found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part ID</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Service ID</TableHead>
                    <TableHead>Part Name</TableHead>
                    <TableHead>Device Type</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Date Needed</TableHead>
                    <TableHead>Date Ordered</TableHead>
                    <TableHead>Date Received</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedParts.map((part) => (
                    <TableRow key={part.partId} className={part.status === "Cancelled" ? "opacity-50 bg-muted/30" : ""}>
                      <TableCell className="font-medium">{part.partId}</TableCell>
                      <TableCell>{part.requestedBy}</TableCell>
                      <TableCell>{part.serviceId}</TableCell>
                      <TableCell>{part.partName}</TableCell>
                      <TableCell>{part.deviceType || "N/A"}</TableCell>
                      <TableCell>{part.quantity}</TableCell>
                      <TableCell>{part.dateNeeded || "N/A"}</TableCell>
                      <TableCell>{part.dateOrdered || "N/A"}</TableCell>
                      <TableCell>{part.dateReceived || "N/A"}</TableCell>
                      <TableCell>{part.supplier || "N/A"}</TableCell>
                      <TableCell>{part.cost ? `₱${part.cost}` : "N/A"}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(part.status)}`}>
                          {part.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditForm(part);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setSelectedPart(part);
                              setIsCancelDialogOpen(true);
                            }}
                            disabled={part.status === "Cancelled" || part.status === "Received"}
                            title="Cancel request"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDuplicateOpen(part)}
                            title="Duplicate request"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {part.status === "For Ordering" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                setSelectedPart(part);
                                setIsOrderDialogOpen(true);
                              }}
                            >
                              Order
                            </Button>
                          )}
                          {part.status === "Ordered" && (
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleReceive(part)}
                              disabled={isSubmitting}
                            >
                              Receive
                            </Button>
                          )}
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
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredParts.length)} of {filteredParts.length}
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

        {/* Order Dialog */}
        <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Place Order</DialogTitle>
              <DialogDescription>
                Part: {selectedPart?.partName} | Service ID: {selectedPart?.serviceId}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Supplier *</Label>
                <Input
                  value={orderForm.supplier}
                  onChange={(e) => setOrderForm({ ...orderForm, supplier: e.target.value })}
                  placeholder="Enter supplier name"
                />
              </div>
              <div className="space-y-2">
                <Label>Cost *</Label>
                <Input
                  type="number"
                  value={orderForm.cost}
                  onChange={(e) => setOrderForm({ ...orderForm, cost: e.target.value })}
                  placeholder="Enter cost"
                />
              </div>
              <div className="space-y-2">
                <Label>Date Ordered *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !orderForm.dateOrdered && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {orderForm.dateOrdered ? format(orderForm.dateOrdered, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={orderForm.dateOrdered}
                      onSelect={(date) => setOrderForm({ ...orderForm, dateOrdered: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea
                  value={orderForm.remarks}
                  onChange={(e) => setOrderForm({ ...orderForm, remarks: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOrderDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleOrder} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Part Request</DialogTitle>
            </DialogHeader>
            {editForm && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Part Name</Label>
                  <Input
                    value={editForm.partName}
                    onChange={(e) => setEditForm({ ...editForm, partName: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Brand</Label>
                    <Input
                      value={editForm.brand}
                      onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Input
                      value={editForm.model}
                      onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Remarks</Label>
                  <Textarea
                    value={editForm.remarks}
                    onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEdit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Confirmation Dialog */}
        <Dialog open={isCancelDialogOpen} onOpenChange={(open) => {
          setIsCancelDialogOpen(open);
          if (!open) setCancelRemark("");
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Part Request</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel the request for "{selectedPart?.partName}"? 
                The requester will be notified.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Remark (optional)</Label>
                <Textarea
                  value={cancelRemark}
                  onChange={(e) => setCancelRemark(e.target.value)}
                  placeholder="Reason for cancellation..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)}>
                No, Keep It
              </Button>
              <Button variant="destructive" onClick={handleCancel} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, Cancel Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Duplicate Dialog */}
        <Dialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Duplicate Part Request</DialogTitle>
              <DialogDescription>Create a new request with the same details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Service ID *</Label>
                <Input
                  value={duplicateForm.serviceId}
                  onChange={(e) => setDuplicateForm({ ...duplicateForm, serviceId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Part Name *</Label>
                <Input
                  value={duplicateForm.partName}
                  onChange={(e) => setDuplicateForm({ ...duplicateForm, partName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={duplicateForm.quantity}
                    onChange={(e) => setDuplicateForm({ ...duplicateForm, quantity: e.target.value })}
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
                          !duplicateForm.dateNeeded && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {duplicateForm.dateNeeded ? format(duplicateForm.dateNeeded, "MM/dd/yyyy") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={duplicateForm.dateNeeded}
                        onSelect={(date) => setDuplicateForm({ ...duplicateForm, dateNeeded: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDuplicateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleDuplicateSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
