import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Search,
  Pencil,
  Trash2,
  ExternalLink,
  RefreshCw,
  CalendarIcon,
  X,
  Loader2,
} from "lucide-react";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";

interface ClientInquiry {
  rowIndex: number;
  timestamp: string;
  clientId: string;
  name: string;
  address: string;
  contactNumber: string;
  serviceId: string;
  device: string;
  initialDiagnosis: string;
  quotation: string;
  modeOfTransfer: string;
  pickUpDate: string;
  directChatLink: string;
}

const ClientInquiryTable = () => {
  const [inquiries, setInquiries] = useState<ClientInquiry[]>([]);
  const [filteredInquiries, setFilteredInquiries] = useState<ClientInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<ClientInquiry | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<ClientInquiry>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=getClientInquiries`
      );
      const data = await response.json();
      
      if (data.status === "success" && data.data) {
        // Sort by timestamp (most recent first)
        const sortedData = data.data.sort((a: ClientInquiry, b: ClientInquiry) => {
          const dateA = new Date(a.timestamp);
          const dateB = new Date(b.timestamp);
          return dateB.getTime() - dateA.getTime();
        });
        setInquiries(sortedData);
        setFilteredInquiries(sortedData);
      } else {
        console.error("Failed to fetch inquiries:", data);
        toast.error("Failed to load client inquiries");
      }
    } catch (error) {
      console.error("Error fetching inquiries:", error);
      toast.error("Error loading client inquiries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  // Apply filters
  useEffect(() => {
    let filtered = [...inquiries];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (inquiry) =>
          inquiry.name?.toLowerCase().includes(term) ||
          inquiry.clientId?.toLowerCase().includes(term) ||
          inquiry.serviceId?.toLowerCase().includes(term)
      );
    }

    // Date filter
    if (dateFilter) {
      const filterDateStr = format(dateFilter, "MM-dd-yyyy");
      filtered = filtered.filter((inquiry) => {
        const inquiryDate = inquiry.timestamp?.split(",")[0];
        return inquiryDate === filterDateStr;
      });
    }

    // Mode of transfer filter
    if (modeFilter && modeFilter !== "all") {
      filtered = filtered.filter(
        (inquiry) =>
          inquiry.modeOfTransfer?.toLowerCase() === modeFilter.toLowerCase()
      );
    }

    setFilteredInquiries(filtered);
  }, [inquiries, searchTerm, dateFilter, modeFilter]);

  const handleEdit = (inquiry: ClientInquiry) => {
    setSelectedInquiry(inquiry);
    setEditFormData({ ...inquiry });
    setEditDialogOpen(true);
  };

  const handleDelete = (inquiry: ClientInquiry) => {
    setSelectedInquiry(inquiry);
    setDeleteDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedInquiry || !editFormData) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("action", "updateClientInquiry");
      formData.append("rowIndex", selectedInquiry.rowIndex.toString());
      formData.append("clientId", editFormData.clientId || "");
      formData.append("name", editFormData.name || "");
      formData.append("address", editFormData.address || "");
      formData.append("contactNumber", editFormData.contactNumber || "");
      formData.append("serviceId", editFormData.serviceId || "");
      formData.append("device", editFormData.device || "");
      formData.append("initialDiagnosis", editFormData.initialDiagnosis || "");
      formData.append("quotation", editFormData.quotation || "");
      formData.append("modeOfTransfer", editFormData.modeOfTransfer || "");
      formData.append("pickUpDate", editFormData.pickUpDate || "");
      formData.append("directChatLink", editFormData.directChatLink || "");

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.status === "success") {
        toast.success("Inquiry updated successfully");
        setEditDialogOpen(false);
        fetchInquiries();
      } else {
        toast.error("Failed to update inquiry");
      }
    } catch (error) {
      console.error("Error updating inquiry:", error);
      toast.error("Error updating inquiry");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedInquiry) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("action", "deleteClientInquiry");
      formData.append("rowIndex", selectedInquiry.rowIndex.toString());

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.status === "success") {
        toast.success("Inquiry deleted successfully");
        setDeleteDialogOpen(false);
        fetchInquiries();
      } else {
        toast.error("Failed to delete inquiry");
      }
    } catch (error) {
      console.error("Error deleting inquiry:", error);
      toast.error("Error deleting inquiry");
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDateFilter(undefined);
    setModeFilter("all");
  };

  const openDirectChat = (link: string) => {
    if (link) {
      window.open(link, "_blank");
    } else {
      toast.error("No chat link available");
    }
  };

  // Get unique modes of transfer for filter dropdown
  const uniqueModes = Array.from(
    new Set(inquiries.map((i) => i.modeOfTransfer).filter(Boolean))
  );

  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="text-xl text-blue-600">Client Inquiry</CardTitle>
          <Button
            onClick={fetchInquiries}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Name, Client ID, or Service ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[180px] justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFilter ? format(dateFilter, "MMM dd, yyyy") : "Filter by Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFilter}
                  onSelect={setDateFilter}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Mode of Transfer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                {uniqueModes.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {mode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(searchTerm || dateFilter || modeFilter !== "all") && (
              <Button variant="ghost" size="icon" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time/Date</TableHead>
                  <TableHead>Client ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Address/Contact</TableHead>
                  <TableHead>Service ID</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Initial Diagnosis</TableHead>
                  <TableHead>Quotation</TableHead>
                  <TableHead>Mode of Transfer</TableHead>
                  <TableHead>Pick-Up Date</TableHead>
                  <TableHead>Direct Chat</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInquiries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      No inquiries found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInquiries.map((inquiry, index) => (
                    <TableRow key={`${inquiry.clientId}-${index}`}>
                      <TableCell className="whitespace-nowrap">{inquiry.timestamp}</TableCell>
                      <TableCell>{inquiry.clientId}</TableCell>
                      <TableCell>{inquiry.name}</TableCell>
                      <TableCell>
                        <div className="max-w-[150px]">
                          <p className="truncate text-sm">{inquiry.address}</p>
                          <p className="text-sm text-muted-foreground">{inquiry.contactNumber}</p>
                        </div>
                      </TableCell>
                      <TableCell>{inquiry.serviceId}</TableCell>
                      <TableCell>{inquiry.device}</TableCell>
                      <TableCell>
                        <p className="max-w-[150px] truncate" title={inquiry.initialDiagnosis}>
                          {inquiry.initialDiagnosis}
                        </p>
                      </TableCell>
                      <TableCell>{inquiry.quotation}</TableCell>
                      <TableCell>{inquiry.modeOfTransfer}</TableCell>
                      <TableCell>{inquiry.pickUpDate}</TableCell>
                      <TableCell>
                        {inquiry.directChatLink ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDirectChat(inquiry.directChatLink)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(inquiry)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(inquiry)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
                <Label>Client ID</Label>
                <Input
                  value={editFormData.clientId || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, clientId: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  value={editFormData.name || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Address</Label>
                <Input
                  value={editFormData.address || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, address: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Contact Number</Label>
                <Input
                  value={editFormData.contactNumber || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, contactNumber: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Service ID</Label>
                <Input
                  value={editFormData.serviceId || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, serviceId: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Device</Label>
                <Input
                  value={editFormData.device || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, device: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <Label>Initial Diagnosis</Label>
                <Textarea
                  value={editFormData.initialDiagnosis || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, initialDiagnosis: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Quotation</Label>
                <Input
                  value={editFormData.quotation || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, quotation: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Mode of Transfer</Label>
                <Input
                  value={editFormData.modeOfTransfer || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, modeOfTransfer: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Pick-Up Date</Label>
                <Input
                  value={editFormData.pickUpDate || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, pickUpDate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Direct Chat Link</Label>
                <Input
                  value={editFormData.directChatLink || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, directChatLink: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
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

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
            </DialogHeader>
            <p>
              Are you sure you want to delete the inquiry for{" "}
              <strong>{selectedInquiry?.name}</strong>? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default ClientInquiryTable;
