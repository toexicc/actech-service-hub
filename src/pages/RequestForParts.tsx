import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { DEVICE_TYPES } from "@/lib/constants";
import { Package, Plus, CalendarIcon, Loader2, Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/DashboardLayout";

interface PartRequest {
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

const RequestForParts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const userRole = sessionStorage.getItem("userRole");
  const userFullName = sessionStorage.getItem("userFullName") || "User";
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateNeeded, setDateNeeded] = useState<Date | undefined>(undefined);
  
  // Requests table state
  const [requests, setRequests] = useState<PartRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  const [formData, setFormData] = useState({
    serviceId: "",
    partName: "",
    deviceType: "",
    brand: "",
    model: "",
    quantity: "",
    remarks: ""
  });

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
    // Only admin and technician can access
    if (userRole !== "admin" && userRole !== "technician" && userRole !== "management") {
      navigate("/menu");
    }
  }, [navigate, userRole]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getFastMovingParts`);
      const data = await response.json();

      if (data.status === "success" && data.parts) {
        setRequests(data.parts);
      } else {
        console.error("Failed to load requests:", data);
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
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
  }, [requests, searchQuery, statusFilter]);

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
      // Match InventoryManagement submission style (FormData + fetch + JSON response)
      const formDataToSend = new FormData();
      formDataToSend.append("action", "addFastMovingPart");
      formDataToSend.append("requestedBy", userFullName);
      formDataToSend.append("serviceId", formData.serviceId);
      formDataToSend.append("partName", formData.partName);
      formDataToSend.append("deviceType", formData.deviceType);
      formDataToSend.append("brand", formData.brand);
      formDataToSend.append("model", formData.model);
      formDataToSend.append("quantity", formData.quantity);
      formDataToSend.append("dateNeeded", format(dateNeeded, "MM/dd/yyyy"));
      formDataToSend.append("status", "For Ordering");
      formDataToSend.append("remarks", formData.remarks);

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formDataToSend,
      });

      const result = await response.json();

      if (result?.result !== "success") {
        throw new Error(result?.message || "Request not accepted by Apps Script");
      }

      toast({
        title: "Submitted",
        description: "Request submitted successfully.",
      });

      // Refresh list
      fetchRequests();

      setIsDialogOpen(false);
      setFormData({
        serviceId: "",
        partName: "",
        deviceType: "",
        brand: "",
        model: "",
        quantity: "",
        remarks: "",
      });
      setDateNeeded(undefined);

      toast({
        title: "Submitted",
        description: "Request sent. It should appear in Fast Moving Inventory shortly.",
      });

      // Optimistically refresh list (if the sheet write succeeds)
      setTimeout(() => {
        fetchRequests();
      }, 800);

      setIsDialogOpen(false);
      setFormData({
        serviceId: "",
        partName: "",
        deviceType: "",
        brand: "",
        model: "",
        quantity: "",
        remarks: "",
      });
      setDateNeeded(undefined);
    } catch (error) {
      console.error("Error submitting request:", error);
      toast({
        title: "Error",
        description: "Failed to submit request (network/CORS).",
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

        {/* Requests Table */}
        <Card className="mb-6">
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
                        <TableHead>Requested By</TableHead>
                        <TableHead>Service ID</TableHead>
                        <TableHead>Part Name</TableHead>
                        <TableHead>Device Type</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Date Needed</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRequests.map((req) => (
                        <TableRow key={req.partId}>
                          <TableCell className="font-medium">{req.partId}</TableCell>
                          <TableCell>{req.requestedBy}</TableCell>
                          <TableCell>{req.serviceId}</TableCell>
                          <TableCell>{req.partName}</TableCell>
                          <TableCell>{req.deviceType || "N/A"}</TableCell>
                          <TableCell>{req.quantity}</TableCell>
                          <TableCell>{req.dateNeeded || "N/A"}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(req.status)}`}>
                              {req.status}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate" title={req.remarks}>
                            {req.remarks || "N/A"}
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

        {/* Info Card */}
        <Card>
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

        {/* Request Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
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
      </div>
    </DashboardLayout>
  );
};

export default RequestForParts;
