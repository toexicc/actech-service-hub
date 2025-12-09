import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Search, RefreshCw, ExternalLink, Pencil, Trash2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby3fTTcFoMpwyqF90CBgdu-5xjSZwSjscd-kKD2qPVorh5Pqrxle28vBha59qt9g9c0pA/exec";

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
}

const ITEMS_PER_PAGE = 9;

const ClientInquiryTable = () => {
  const [inquiries, setInquiries] = useState<ClientInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState<ClientInquiry | null>(null);
  const [editForm, setEditForm] = useState<Partial<ClientInquiry>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingInquiry, setDeletingInquiry] = useState<ClientInquiry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchInquiries = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getClientInquiries`);
      const result = await response.json();
      if (result.status === "success") {
        setInquiries(result.data || []);
      } else {
        toast({ title: "Error", description: "Failed to fetch inquiries", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch inquiries", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

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
              const start = startDate ? startOfDay(new Date(startDate)) : new Date(0);
              const end = endDate ? endOfDay(new Date(endDate)) : new Date(8640000000000000);
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
      
      const response = await fetch(GOOGLE_SCRIPT_URL, {
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
      
      const response = await fetch(GOOGLE_SCRIPT_URL, {
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
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-36"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">To:</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-36"
            />
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
                <TableHead className="whitespace-nowrap">Time/Date</TableHead>
                <TableHead className="whitespace-nowrap">Client ID</TableHead>
                <TableHead className="whitespace-nowrap">Name</TableHead>
                <TableHead className="whitespace-nowrap">Address/Contact</TableHead>
                <TableHead className="whitespace-nowrap">Service ID</TableHead>
                <TableHead className="whitespace-nowrap">Device</TableHead>
                <TableHead className="whitespace-nowrap">Initial Diagnosis</TableHead>
                <TableHead className="whitespace-nowrap">Quotation</TableHead>
                <TableHead className="whitespace-nowrap">Mode of Transfer</TableHead>
                <TableHead className="whitespace-nowrap">Pick-Up Date</TableHead>
                <TableHead className="whitespace-nowrap">Direct Chat</TableHead>
                <TableHead className="whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading...
                  </TableCell>
                </TableRow>
              ) : paginatedInquiries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
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
