import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { Edit, Trash2, Package, CalendarIcon, Loader2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Dialog states
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<FastMovingPart | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Order form state
  const [orderForm, setOrderForm] = useState({
    supplier: "",
    cost: "",
    dateOrdered: undefined as Date | undefined,
    remarks: ""
  });

  // Edit form state
  const [editForm, setEditForm] = useState<FastMovingPart | null>(null);

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
    return parts.filter(part => {
      const search = searchQuery.toLowerCase();
      return (
        part.partId?.toLowerCase().includes(search) ||
        part.partName?.toLowerCase().includes(search) ||
        part.serviceId?.toLowerCase().includes(search) ||
        part.requestedBy?.toLowerCase().includes(search)
      );
    });
  }, [parts, searchQuery]);

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
      const formData = new FormData();
      formData.append("action", "receiveFastMovingPart");
      formData.append("partId", part.partId);
      formData.append("serviceId", part.serviceId);
      formData.append("requestedBy", part.requestedBy);
      formData.append("partName", part.partName);
      formData.append("cost", part.cost);
      formData.append("quantity", part.quantity);
      formData.append("dateReceived", format(new Date(), "yyyy-MM-dd"));

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.result === "success") {
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

  const handleDelete = async () => {
    if (!selectedPart) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("action", "deleteFastMovingPart");
      formData.append("partId", selectedPart.partId);

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.result === "success") {
        toast({
          title: "Success",
          description: "Part request deleted",
        });
        setIsDeleteDialogOpen(false);
        setSelectedPart(null);
        fetchParts();
      } else {
        toast({
          title: "Error",
          description: "Failed to delete part",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting part:", error);
      toast({
        title: "Error",
        description: "Failed to delete part",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      "For Ordering": "bg-orange-100 text-orange-800",
      "Ordered": "bg-blue-100 text-blue-800",
      "Received": "bg-green-100 text-green-800"
    };
    return statusClasses[status as keyof typeof statusClasses] || "bg-gray-100 text-gray-800";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Fast Moving Parts
          </CardTitle>
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
                    <TableHead>Supplier</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedParts.map((part) => (
                    <TableRow key={part.partId}>
                      <TableCell className="font-medium">{part.partId}</TableCell>
                      <TableCell>{part.requestedBy}</TableCell>
                      <TableCell>{part.serviceId}</TableCell>
                      <TableCell>{part.partName}</TableCell>
                      <TableCell>{part.deviceType || "N/A"}</TableCell>
                      <TableCell>{part.quantity}</TableCell>
                      <TableCell>{part.dateNeeded || "N/A"}</TableCell>
                      <TableCell>{part.dateOrdered || "N/A"}</TableCell>
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
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
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

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Part Request</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the request for "{selectedPart?.partName}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
