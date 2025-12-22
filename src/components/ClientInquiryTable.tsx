import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { cn } from "@/lib/utils";
import { Search, RefreshCw, ExternalLink, Pencil, Trash2, ChevronLeft, ChevronRight, Loader2, CalendarIcon } from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { useClientInquiriesData, useInvalidateClientInquiriesData } from "@/hooks/useClientInquiriesData";

interface ClientInquiry {
  rowIndex: number;
  clientId: string;
  serviceId: string;
  timestamp: string;
  name: string;
  address: string;
  contactNumber: string;
  modeOfTransfer: string;
  device: string;
  initialDiagnosis: string;
  quotation: string;
  pickUpDate: string;
  directChatLink: string;
  aiStatus?: string;
  preOrder?: string;
  initialPayment?: string;
  partId?: string;
}

const ITEMS_PER_PAGE = 9;

const ClientInquiryTable = () => {
  const { data: inquiries = [], isLoading: loading, refetch } = useClientInquiriesData();
  const invalidateInquiries = useInvalidateClientInquiriesData();
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [modeFilter, setModeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [togglingAI, setTogglingAI] = useState<number | null>(null);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState<ClientInquiry | null>(null);
  const [editForm, setEditForm] = useState<Partial<ClientInquiry>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingInquiry, setDeletingInquiry] = useState<ClientInquiry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchInquiries = () => {
    invalidateInquiries();
    refetch();
  };

  const filteredInquiries = useMemo(() => {
    return inquiries
      .filter((inquiry) => {
        // Search filter
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || 
          inquiry.name?.toLowerCase().includes(searchLower) ||
          inquiry.clientId?.toLowerCase().includes(searchLower) ||
          inquiry.serviceId?.toLowerCase().includes(searchLower);

        // Date range filter
        let matchesDateRange = true;
        if (startDate || endDate) {
          try {
            const inquiryDate = inquiry.timestamp ? new Date(inquiry.timestamp) : null;
            if (inquiryDate && !isNaN(inquiryDate.getTime())) {
              const start = startDate ? startOfDay(startDate) : new Date(0);
              const end = endDate ? endOfDay(endDate) : new Date(8640000000000000);
              matchesDateRange = isWithinInterval(inquiryDate, { start, end });
            }
          } catch {
            matchesDateRange = true;
          }
        }

        // Mode filter
        const matchesMode = modeFilter === "all" || 
          inquiry.modeOfTransfer?.toLowerCase() === modeFilter.toLowerCase();

        return matchesSearch && matchesDateRange && matchesMode;
      })
      .sort((a, b) => {
        // Sort by timestamp descending (most recent first)
        const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return dateB - dateA;
      });
  }, [inquiries, searchQuery, startDate, endDate, modeFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredInquiries.length / ITEMS_PER_PAGE);
  const paginatedInquiries = filteredInquiries.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, startDate, endDate, modeFilter]);

  const handleEdit = (inquiry: ClientInquiry) => {
    setEditingInquiry(inquiry);
    setEditForm({ ...inquiry });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingInquiry || isSaving) return;
    
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("action", "updateClientInquiry");
      formData.append("rowIndex", editingInquiry.rowIndex.toString());
      formData.append("clientId", editForm.clientId || "");
      formData.append("serviceId", editForm.serviceId || "");
      formData.append("timestamp", editForm.timestamp || "");
      formData.append("name", editForm.name || "");
      formData.append("address", editForm.address || "");
      formData.append("contactNumber", editForm.contactNumber || "");
      formData.append("modeOfTransfer", editForm.modeOfTransfer || "");
      formData.append("device", editForm.device || "");
      formData.append("initialDiagnosis", editForm.initialDiagnosis || "");
      formData.append("quotation", editForm.quotation || "");
      formData.append("pickUpDate", editForm.pickUpDate || "");
      formData.append("directChatLink", editForm.directChatLink || "");
      formData.append("preOrder", editForm.preOrder || "");
      formData.append("initialPayment", editForm.initialPayment || "");
      formData.append("partId", editForm.partId || "");
      
      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData
      });
      
      const result = await response.json();
      
      if (result.status === "success" || result.result === "success") {
        toast({ title: "Success", description: "Inquiry updated successfully" });
        setEditDialogOpen(false);
        fetchInquiries();
      } else {
        throw new Error(result.message || "Update failed");
      }
    } catch (error) {
      console.error("Error updating inquiry:", error);
      toast({ title: "Error", description: "Failed to update inquiry", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (inquiry: ClientInquiry) => {
    setDeletingInquiry(inquiry);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingInquiry || isDeleting) return;
    
    setIsDeleting(true);
    try {
      const formData = new FormData();
      formData.append("action", "deleteClientInquiry");
      formData.append("rowIndex", deletingInquiry.rowIndex.toString());
      
      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData
      });
      
      const result = await response.json();
      
      if (result.status === "success" || result.result === "success") {
        toast({ title: "Success", description: "Inquiry deleted successfully" });
        setDeleteDialogOpen(false);
        fetchInquiries();
      } else {
        throw new Error(result.message || "Delete failed");
      }
    } catch (error) {
      console.error("Error deleting inquiry:", error);
      toast({ title: "Error", description: "Failed to delete inquiry", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleAI = async (inquiry: ClientInquiry) => {
    if (togglingAI === inquiry.rowIndex) return;
    
    setTogglingAI(inquiry.rowIndex);
    const newStatus = inquiry.aiStatus === "ON-AI" ? "OFF-AI" : "ON-AI";
    
    try {
      // Use URL-encoded form body (Apps Script reliably reads this via e.parameter)
      const body = new URLSearchParams({
        action: "updateClientInquiryAI",
        rowIndex: inquiry.rowIndex.toString(),
        aiStatus: newStatus,
      });

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body,
      });
      
      const result = await response.json();
      
      if (result.status === "success" || result.result === "success") {
        // Refetch to get updated data
        fetchInquiries();
        toast({ title: "Success", description: `AI ${newStatus === "ON-AI" ? "enabled" : "disabled"}` });
      } else {
        throw new Error(result.message || "Update failed");
      }
    } catch (error) {
      console.error("Error toggling AI status:", error);
      toast({ title: "Error", description: "Failed to update AI status", variant: "destructive" });
    } finally {
      setTogglingAI(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return format(date, "MMM dd, yyyy hh:mm a");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Container */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search - Left */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search Name, Client ID, Service ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">From:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-36 justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "MMM dd, yyyy") : <span>Pick date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">To:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-36 justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "MMM dd, yyyy") : <span>Pick date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Mode of Transfer Filter */}
          <Select value={modeFilter} onValueChange={setModeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Mode of Transfer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modes</SelectItem>
              <SelectItem value="pickup">Pickup</SelectItem>
              <SelectItem value="delivery">Delivery</SelectItem>
              <SelectItem value="store visit">Store Visit</SelectItem>
            </SelectContent>
          </Select>

          {/* Reload Button - Icon only */}
          <Button variant="outline" size="icon" onClick={fetchInquiries} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="whitespace-nowrap w-16">AI</TableHead>
                <TableHead className="whitespace-nowrap">Time/Date</TableHead>
                <TableHead className="whitespace-nowrap">Client ID</TableHead>
                <TableHead className="whitespace-nowrap">Name</TableHead>
                <TableHead className="whitespace-nowrap">Address/Contact</TableHead>
                <TableHead className="whitespace-nowrap">Service ID</TableHead>
                <TableHead className="whitespace-nowrap">Device</TableHead>
                <TableHead className="whitespace-nowrap">Initial Diagnosis</TableHead>
                <TableHead className="whitespace-nowrap">Quotation</TableHead>
                <TableHead className="whitespace-nowrap">Pre-Order</TableHead>
                <TableHead className="whitespace-nowrap">Initial Payment</TableHead>
                <TableHead className="whitespace-nowrap">Part ID</TableHead>
                <TableHead className="whitespace-nowrap">Mode of Transfer</TableHead>
                <TableHead className="whitespace-nowrap">Pick-Up Date</TableHead>
                <TableHead className="whitespace-nowrap">Direct Chat</TableHead>
                <TableHead className="whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                // Loading skeleton rows
                Array.from({ length: 5 }).map((_, rowIndex) => (
                  <TableRow key={`skeleton-${rowIndex}`}>
                    <TableCell><Skeleton className="h-6 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedInquiries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={16} className="text-center py-8 text-muted-foreground">
                    No inquiries found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedInquiries.map((inquiry) => {
                  // Row color based on Mode of Transfer
                  const getRowColor = () => {
                    const mode = inquiry.modeOfTransfer?.toLowerCase();
                    if (mode === "pickup") return "bg-blue-100 dark:bg-blue-900/30";
                    if (mode === "delivery") return "bg-orange-100 dark:bg-orange-900/30";
                    if (mode === "store visit") return "bg-yellow-100 dark:bg-yellow-900/30";
                    return "";
                  };
                  
                  return (
                  <TableRow key={inquiry.rowIndex} className={getRowColor()}>
                    <TableCell>
                      <Switch
                        checked={inquiry.aiStatus === "ON-AI"}
                        onCheckedChange={() => handleToggleAI(inquiry)}
                        disabled={togglingAI === inquiry.rowIndex}
                        className="data-[state=checked]:bg-green-500"
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(inquiry.timestamp)}</TableCell>
                    <TableCell className="font-mono text-xs">{inquiry.clientId || "-"}</TableCell>
                    <TableCell>{inquiry.name || "-"}</TableCell>
                    <TableCell>
                      <div className="text-sm">{inquiry.address || "-"}</div>
                      {inquiry.contactNumber && (
                        <div className="text-xs text-muted-foreground">{inquiry.contactNumber}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{inquiry.serviceId || "-"}</TableCell>
                    <TableCell>{inquiry.device || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{inquiry.initialDiagnosis || "-"}</TableCell>
                    <TableCell>{inquiry.quotation || "-"}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "px-2 py-1 rounded text-xs font-medium",
                        inquiry.preOrder?.toLowerCase() === "true" 
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" 
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      )}>
                        {inquiry.preOrder?.toLowerCase() === "true" ? "Yes" : "No"}
                      </span>
                    </TableCell>
                    <TableCell>{inquiry.initialPayment || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{inquiry.partId || "-"}</TableCell>
                    <TableCell>{inquiry.modeOfTransfer || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{inquiry.pickUpDate || "-"}</TableCell>
                    <TableCell>
                      {inquiry.directChatLink ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(inquiry.directChatLink, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(inquiry)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(inquiry)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredInquiries.length)} of {filteredInquiries.length} entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client Inquiry</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name</Label>
              <Input
                value={editForm.name || ""}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={editForm.address || ""}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
            </div>
            <div>
              <Label>Contact Number</Label>
              <Input
                value={editForm.contactNumber || ""}
                onChange={(e) => setEditForm({ ...editForm, contactNumber: e.target.value })}
              />
            </div>
            <div>
              <Label>Device</Label>
              <Input
                value={editForm.device || ""}
                onChange={(e) => setEditForm({ ...editForm, device: e.target.value })}
              />
            </div>
            <div>
              <Label>Mode of Transfer</Label>
              <Select
                value={editForm.modeOfTransfer || ""}
                onValueChange={(value) => setEditForm({ ...editForm, modeOfTransfer: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pickup">Pickup</SelectItem>
                  <SelectItem value="Delivery">Delivery</SelectItem>
                  <SelectItem value="Store Visit">Store Visit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pick-Up Date</Label>
              <Input
                value={editForm.pickUpDate || ""}
                onChange={(e) => setEditForm({ ...editForm, pickUpDate: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Initial Diagnosis</Label>
              <Textarea
                value={editForm.initialDiagnosis || ""}
                onChange={(e) => setEditForm({ ...editForm, initialDiagnosis: e.target.value })}
              />
            </div>
            <div>
              <Label>Quotation</Label>
              <Input
                value={editForm.quotation || ""}
                onChange={(e) => setEditForm({ ...editForm, quotation: e.target.value })}
              />
            </div>
            <div>
              <Label>Pre-Order</Label>
              <Select
                value={editForm.preOrder || "false"}
                onValueChange={(value) => setEditForm({ ...editForm, preOrder: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Initial Payment</Label>
              <Input
                value={editForm.initialPayment || ""}
                onChange={(e) => setEditForm({ ...editForm, initialPayment: e.target.value })}
                placeholder="Enter initial payment amount"
              />
            </div>
            <div>
              <Label>Part ID</Label>
              <Input
                value={editForm.partId || ""}
                onChange={(e) => setEditForm({ ...editForm, partId: e.target.value })}
                placeholder="Enter part ID(s)"
              />
            </div>
            <div>
              <Label>Direct Chat Link</Label>
              <Input
                value={editForm.directChatLink || ""}
                onChange={(e) => setEditForm({ ...editForm, directChatLink: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inquiry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this inquiry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground" disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientInquiryTable;
