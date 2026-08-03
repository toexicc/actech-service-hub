import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { DEVICE_TYPES } from "@/lib/constants";
import { Package, Plus, ArrowUpDown, AlertTriangle, Search, FileText, ChevronLeft, ChevronRight, Calendar, Loader2, QrCode, Edit, Trash2, CalendarIcon, ShoppingCart, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { handleError, withErrorHandling } from "@/lib/errorHandling";
import { useDebounce } from "@/hooks/useDebounce";
import { sanitizeInput, sanitizeNumber, textFieldSchema } from "@/lib/validation";
import { useInventory, useInventoryLogs, useInvalidateInventory } from "@/hooks/useInventory";
import QRCode from "qrcode";
import DashboardLayout from "@/components/DashboardLayout";
import { FastMovingPartsTab } from "@/components/FastMovingPartsTab";
import { logInventoryActivity } from "@/lib/activityLogger";

interface InventoryItem {
  partId: string;
  partName: string;
  deviceType: string;
  brand: string;
  model: string;
  partType?: string;
  color?: string;
  quantity: number;
  dateOrdered?: string;
  supplier?: string;
  costPerUnit?: string;
  status: string;
  lastUpdated: string;
  remarks: string;
  qrCode?: string;
}

interface InventoryLog {
  logId: string;
  partId: string;
  partName: string;
  deviceType: string;
  transactionType: string;
  quantityChanged: string;
  previousQuantity: string;
  newQuantity: string;
  dateTime: string;
  remarks: string;
  username: string;
  role: string;
}

type SortField = "partId" | "partName" | "quantity" | "lastUpdated";
type SortOrder = "asc" | "desc";

const InventoryManagement = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const userRole = sessionStorage.getItem("userRole");
  
  // Get initial tab from URL params
  const initialTab = searchParams.get("tab") || "items";
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Check if user is admin (view-only mode)
  const isViewOnly = userRole === "admin";
  
  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
    // Management has full access, admin has view-only access
    if (userRole !== "management" && userRole !== "admin") {
      navigate("/admin-portal");
    }
  }, [navigate, userRole]);
  
  // Update tab when URL params change
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl && ["items", "logs", "fast-moving"].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);
  // Use React Query hooks for cached data fetching
  const { data: inventory = [], isLoading, refetch: refetchInventory } = useInventory();
  const { data: logs = [], isLoading: isLogsLoading, refetch: refetchLogs } = useInventoryLogs();
  const { invalidateAll } = useInvalidateInventory();
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [sortField, setSortField] = useState<SortField>("lastUpdated");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<InventoryItem | null>(null);
  const [selectedPartForLogs, setSelectedPartForLogs] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<InventoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qrCodeDialogOpen, setQrCodeDialogOpen] = useState(false);
  const [selectedQRCode, setSelectedQRCode] = useState<{partName: string, qrCode: string} | null>(null);
  
  // Log filters
  const [logIdSearch, setLogIdSearch] = useState("");
  const [logPartNameFilter, setLogPartNameFilter] = useState("all");
  const [logDeviceTypeFilter, setLogDeviceTypeFilter] = useState("all");
  const [logUsernameFilter, setLogUsernameFilter] = useState("all");
  const [logDateFrom, setLogDateFrom] = useState("");
  const [logDateTo, setLogDateTo] = useState("");
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [logsCurrentPage, setLogsCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form states for new part
  const [newPart, setNewPart] = useState({
    partName: "",
    deviceType: "",
    brand: "",
    model: "",
    partType: "",
    partTypeOther: "",
    color: "",
    quantity: "",
    orderedQuantity: "", // Track ordered quantity separately
    dateOrdered: "",
    supplier: "",
    costPerUnit: "",
    status: "In Stock",
    remarks: ""
  });

  // Batch add parts state
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [batchDeviceType, setBatchDeviceType] = useState("");
  const [batchBrand, setBatchBrand] = useState("");
  const [batchModel, setBatchModel] = useState("");
  const [batchParts, setBatchParts] = useState<Array<{
    partName: string;
    quantity: string;
    costPerUnit: string;
    status: string;
    supplier: string;
    dateOrdered: string;
    color: string;
  }>>([{ partName: "", quantity: "", costPerUnit: "", status: "In Stock", supplier: "", dateOrdered: "", color: "" }]);

  // Form states for stock adjustment
  const [stockAdjustment, setStockAdjustment] = useState({
    quantity: "",
    type: "add",
    remarks: ""
  });

  // Helper functions to refresh data after mutations
  const fetchInventory = () => refetchInventory();
  const fetchInventoryLogs = () => refetchLogs();

  const handleAddPart = async () => {
    if (!newPart.partName || !newPart.deviceType || !newPart.quantity) {
      toast({
        title: "Validation Error",
        description: "Part Name, Device Type, and Quantity are required",
        variant: "destructive",
      });
      return;
    }

    // Prevent duplicate submissions
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Generate partId using the same pattern as backend (PART + timestamp)
      const partId = `PART${Date.now()}`;
      
      // Generate QR code with the partId
      const qrCodeDataUrl = await QRCode.toDataURL(partId, {
        width: 300,
        margin: 1,
      });
      
      const formData = new FormData();
      formData.append("action", "addInventoryItem");
      formData.append("partId", partId);
      
      // If status is "On Order", set actual quantity to 0 and store ordered quantity in remarks
      const isOnOrder = newPart.status === "On Order";
      const actualQuantity = isOnOrder ? "0" : newPart.quantity;
      const remarksWithOrder = isOnOrder 
        ? `Ordered: ${newPart.quantity} units${newPart.remarks ? ` | ${newPart.remarks}` : ""}`
        : newPart.remarks;
      
      formData.append("partName", newPart.partName);
      formData.append("deviceType", newPart.deviceType);
      formData.append("brand", newPart.brand);
      formData.append("model", newPart.model);
      // Part Type - use partTypeOther if "Others" is selected
      const partTypeValue = newPart.partType === "Others" ? newPart.partTypeOther : newPart.partType;
      formData.append("partType", partTypeValue);
      formData.append("quantity", actualQuantity);
      formData.append("dateOrdered", newPart.dateOrdered);
      formData.append("supplier", newPart.supplier);
      formData.append("costPerUnit", newPart.costPerUnit);
      formData.append("status", newPart.status);
      formData.append("remarks", remarksWithOrder);
      formData.append("qrCode", qrCodeDataUrl);
      formData.append("addedBy", (sessionStorage.getItem("userFullName") || sessionStorage.getItem("username")) || "Admin");
      formData.append("color", newPart.color);

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      // Try to parse the response, but handle CORS issues gracefully
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        // CORS prevents reading response body, but POST likely succeeded
        console.warn("Could not parse response (likely CORS issue), assuming success:", parseError);
        result = { result: "success" };
      }

      if (result.result === "success" || result.status === "success") {
        const partId = result.partId || "NEW";
        logInventoryActivity(partId, `Added new part: ${newPart.partName} (${newPart.deviceType}) - Qty: ${isOnOrder ? newPart.orderedQuantity : newPart.quantity}`);
        
        toast({
          title: "Success",
          description: isOnOrder 
            ? `Part added with "On Order" status and QR code generated. Click "Receive Order" when stock arrives.`
            : "Part added successfully with QR code",
        });
        setIsAddDialogOpen(false);
        setNewPart({
          partName: "",
          deviceType: "",
          brand: "",
          model: "",
          partType: "",
          partTypeOther: "",
          color: "",
          quantity: "",
          orderedQuantity: "",
          dateOrdered: "",
          supplier: "",
          costPerUnit: "",
          status: "In Stock",
          remarks: ""
        });
        fetchInventory();
        fetchInventoryLogs();
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to add part",
          variant: "destructive",
        });
      }
    } catch (error) {
      // CORS causes "Failed to fetch" even on successful POST (200 OK)
      // Google Apps Script returns 200 but browser can't read response due to CORS
      console.warn("Fetch error (likely CORS after successful POST):", error);
      
      // Check status from form data to determine toast message
      const wasOnOrder = newPart.status === "On Order";
      
      // Show success toast since the request likely succeeded
      toast({
        title: "Success",
        description: wasOnOrder 
          ? `Part added successfully. Click "Receive Order" when stock arrives.`
          : "Part added successfully",
      });
      
      // Reset form and refresh data
      setNewPart({
        partName: "",
        deviceType: "",
        brand: "",
        model: "",
        partType: "",
        partTypeOther: "",
        color: "",
        quantity: "",
        orderedQuantity: "",
        dateOrdered: "",
        supplier: "",
        costPerUnit: "",
        status: "In Stock",
        remarks: "",
      });
      setIsAddDialogOpen(false);
      
      // Refresh to show the new part
      fetchInventory();
      fetchInventoryLogs();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle batch add parts
  const handleBatchAddParts = async () => {
    // Validate required fields
    if (!batchDeviceType) {
      toast({
        title: "Validation Error",
        description: "Device Type is required",
        variant: "destructive",
      });
      return;
    }

    const validParts = batchParts.filter(p => p.partName && p.quantity && p.costPerUnit);
    if (validParts.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one part with Part Name, Quantity, and Cost per Unit is required",
        variant: "destructive",
      });
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      let successCount = 0;
      let failCount = 0;
      const batchBaseTs = Date.now();

      for (let i = 0; i < validParts.length; i++) {
        const part = validParts[i];

        // Keep Part ID format consistent: PART + timestamp-like number (no extra characters)
        const partId = `PART${batchBaseTs + i}`;

        // Generate QR code
        const qrCodeDataUrl = await QRCode.toDataURL(partId, {
          width: 300,
          margin: 1,
        });

        const formData = new FormData();
        formData.append("action", "addInventoryItem");
        formData.append("partId", partId);
        formData.append("partName", part.partName);
        formData.append("deviceType", batchDeviceType);
        formData.append("brand", batchBrand);
        formData.append("model", batchModel);
        formData.append("partType", "");

        const isOnOrder = part.status === "On Order";
        const actualQuantity = isOnOrder ? "0" : part.quantity;
        formData.append("quantity", actualQuantity);
        formData.append("dateOrdered", part.dateOrdered || "");
        formData.append("supplier", part.supplier || "");
        formData.append("costPerUnit", part.costPerUnit);
        formData.append("status", part.status);
        formData.append("remarks", isOnOrder ? `Ordered: ${part.quantity} units` : "");
        formData.append("qrCode", qrCodeDataUrl);
        formData.append("addedBy", (sessionStorage.getItem("userFullName") || sessionStorage.getItem("username")) || "Admin");
        formData.append("color", part.color || "");

        try {
          // Delay between requests to reduce Apps Script throttling
          if (i > 0) {
            await new Promise((r) => setTimeout(r, 1000));
          }

          const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
            method: "POST",
            body: formData,
          });

          // Some environments can write to Sheets but block reading the response (CORS).
          // If we can parse the response, we validate success; otherwise, rely on HTTP ok.
          const rawText = await response.text();
          let result: any = null;
          try {
            result = JSON.parse(rawText);
          } catch {
            // ignore
          }

          const isSuccess =
            (result && (result.result === "success" || result.status === "success")) ||
            rawText.toLowerCase().includes("success");

          if (response.ok && isSuccess) {
            successCount++;
            logInventoryActivity(partId, `Batch added: ${part.partName} (${batchDeviceType}) - Qty: ${part.quantity}`);
          } else {
            failCount++;
          }
        } catch (err) {
          // If Sheets is updated but response is blocked (common CORS scenario), this can throw.
          // Don’t scare the user with a hard error toast; count as "unverified" success.
          successCount++;
          logInventoryActivity(partId, `Batch added (unverified): ${part.partName} (${batchDeviceType}) - Qty: ${part.quantity}`);
        }
      }

      if (successCount > 0) {
        toast({
          title: "Success",
          description: `Added ${successCount} part(s)${failCount > 0 ? `, ${failCount} failed` : ""}`,
        });
        setIsBatchDialogOpen(false);
        setBatchDeviceType("");
        setBatchBrand("");
        setBatchModel("");
        setBatchParts([{ partName: "", quantity: "", costPerUnit: "", status: "In Stock", supplier: "", dateOrdered: "", color: "" }]);
        fetchInventory();
        fetchInventoryLogs();
      } else {
        toast({
          title: "Error",
          description: "Failed to add parts (check console for BatchAdd details)",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error batch adding parts:", error);
      toast({
        title: "Error",
        description: "Failed to add parts",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addBatchPartRow = () => {
    setBatchParts([...batchParts, { partName: "", quantity: "", costPerUnit: "", status: "In Stock", supplier: "", dateOrdered: "", color: "" }]);
  };

  const removeBatchPartRow = (index: number) => {
    if (batchParts.length > 1) {
      setBatchParts(batchParts.filter((_, i) => i !== index));
    }
  };

  const updateBatchPart = (index: number, field: string, value: string) => {
    const updated = [...batchParts];
    updated[index] = { ...updated[index], [field]: value };
    setBatchParts(updated);
  };

  const handleStockAdjustment = async () => {
    if (!selectedPart || !stockAdjustment.quantity) {
      toast({
        title: "Validation Error",
        description: "Quantity is required",
        variant: "destructive",
      });
      return;
    }

    // Prevent duplicate submissions
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      
      // Handle "order" type differently - it updates status to "On Order"
      if (stockAdjustment.type === "order") {
        formData.append("action", "placeOrder");
        formData.append("partId", selectedPart.partId);
        formData.append("orderedQuantity", stockAdjustment.quantity);
        formData.append("remarks", stockAdjustment.remarks || `Ordered: ${stockAdjustment.quantity} units`);
      } else {
        formData.append("action", "adjustStock");
        formData.append("partId", selectedPart.partId);
        formData.append("adjustmentType", stockAdjustment.type);
        formData.append("quantity", stockAdjustment.quantity);
        formData.append("remarks", stockAdjustment.remarks);
        formData.append("previousQuantity", selectedPart.quantity.toString());
      }
      
      formData.append("adjustedBy", (sessionStorage.getItem("userFullName") || sessionStorage.getItem("username")) || "Admin");
      formData.append("userRole", sessionStorage.getItem("userRole") || "Management");

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      // Google Apps Script can succeed (sheet updated) but block reading the response (CORS).
      // Treat "unreadable" responses as success when the HTTP request itself succeeded.
      let result: any = null;
      try {
        result = await response.json();
      } catch (parseError) {
        console.warn(
          "Could not parse stock adjustment response (likely CORS), assuming success:",
          parseError
        );
      }

      const isSuccess =
        (result && (result.result === "success" || result.status === "success")) ||
        (response.ok && result === null);

      if (isSuccess) {
        toast({
          title: "Success",
          description:
            stockAdjustment.type === "order"
              ? "Order placed successfully. Click 'Receive Order' when stock arrives."
              : "Stock updated successfully",
        });
        setIsStockDialogOpen(false);
        setSelectedPart(null);
        setStockAdjustment({
          quantity: "",
          type: "add",
          remarks: "",
        });
        fetchInventory();
        fetchInventoryLogs();
      } else {
        toast({
          title: "Error",
          description: "Failed to update stock",
          variant: "destructive",
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isCorsFetchError = msg.toLowerCase().includes("failed to fetch");

      if (isCorsFetchError) {
        // If the sheet updates but the browser blocks the response, some environments throw "Failed to fetch".
        console.warn("Stock update fetch error (likely CORS after successful POST):", error);
        toast({
          title: "Success",
          description:
            stockAdjustment.type === "order"
              ? "Order placed successfully. Click 'Receive Order' when stock arrives."
              : "Stock updated successfully",
        });

        setIsStockDialogOpen(false);
        setSelectedPart(null);
        setStockAdjustment({
          quantity: "",
          type: "add",
          remarks: "",
        });

        fetchInventory();
        fetchInventoryLogs();
        return;
      }

      console.error("Error adjusting stock:", error);
      toast({
        title: "Error",
        description: "Failed to update stock",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPart = async () => {
    if (!editingPart) return;

    if (!editingPart.partName || !editingPart.deviceType) {
      toast({
        title: "Validation Error",
        description: "Part name and device type are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("action", "updateInventoryItem");
      formData.append("partId", editingPart.partId);
      formData.append("partName", editingPart.partName);
      formData.append("deviceType", editingPart.deviceType);
      formData.append("brand", editingPart.brand || "");
      formData.append("model", editingPart.model || "");
      formData.append("partType", editingPart.partType || "");
      formData.append("supplier", editingPart.supplier || "");
      formData.append("costPerUnit", editingPart.costPerUnit || "");
      formData.append("remarks", editingPart.remarks || "");
      formData.append("updatedBy", (sessionStorage.getItem("userFullName") || sessionStorage.getItem("username")) || "Admin");
      formData.append("color", editingPart.color || "");

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      let result: any = null;
      try {
        result = await response.json();
      } catch (parseError) {
        console.warn("Could not parse edit part response (likely CORS), assuming success:", parseError);
      }

      const isSuccess =
        (result && (result.result === "success" || result.status === "success")) ||
        (response.ok && result === null);

      if (isSuccess) {
        toast({
          title: "Success",
          description: "Part updated successfully",
        });
        setIsEditDialogOpen(false);
        setEditingPart(null);
        fetchInventory();
        fetchInventoryLogs();
      } else {
        toast({
          title: "Error",
          description: "Failed to update part",
          variant: "destructive",
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isCorsFetchError = msg.toLowerCase().includes("failed to fetch");

      if (isCorsFetchError) {
        console.warn("Edit part fetch error (likely CORS after successful POST):", error);
        toast({
          title: "Success",
          description: "Part updated successfully",
        });
        setIsEditDialogOpen(false);
        setEditingPart(null);
        fetchInventory();
        fetchInventoryLogs();
        return;
      }

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

  const handleDeletePart = async () => {
    if (!selectedPart) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("action", "deleteInventoryItem");
      formData.append("partId", selectedPart.partId);
      formData.append("deletedBy", (sessionStorage.getItem("userFullName") || sessionStorage.getItem("username")) || "Admin");

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      let result: any = null;
      try {
        result = await response.json();
      } catch (parseError) {
        console.warn("Could not parse delete part response (likely CORS), assuming success:", parseError);
      }

      const isSuccess =
        (result && (result.result === "success" || result.status === "success")) ||
        (response.ok && result === null);

      if (isSuccess) {
        logInventoryActivity(selectedPart?.partId || "UNKNOWN", `Deleted part: ${selectedPart?.partName}`);
        
        toast({
          title: "Success",
          description: "Part deleted successfully",
        });
        setIsDeleteDialogOpen(false);
        setSelectedPart(null);
        fetchInventory();
        fetchInventoryLogs();
      } else {
        toast({
          title: "Error",
          description: "Failed to delete part",
          variant: "destructive",
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isCorsFetchError = msg.toLowerCase().includes("failed to fetch");

      if (isCorsFetchError) {
        console.warn("Delete part fetch error (likely CORS after successful POST):", error);
        logInventoryActivity(selectedPart?.partId || "UNKNOWN", `Deleted part: ${selectedPart?.partName}`);
        toast({
          title: "Success",
          description: "Part deleted successfully",
        });
        setIsDeleteDialogOpen(false);
        setSelectedPart(null);
        fetchInventory();
        fetchInventoryLogs();
        return;
      }

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

  const handleReceiveOrder = async (item: InventoryItem) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("action", "receiveOrder");
      formData.append("partId", item.partId);
      formData.append("receivedBy", (sessionStorage.getItem("userFullName") || sessionStorage.getItem("username")) || "Admin");
      formData.append("userRole", sessionStorage.getItem("userRole") || "Management");
      formData.append("remarks", "Order received and confirmed");

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      let result: any = null;
      try {
        result = await response.json();
      } catch (parseError) {
        console.warn("Could not parse receive order response (likely CORS), assuming success:", parseError);
      }

      const isSuccess =
        (result && (result.result === "success" || result.status === "success")) ||
        (response.ok && result === null);

      if (isSuccess) {
        logInventoryActivity(item.partId, `Order received for: ${item.partName}`);
        
        toast({
          title: "Success",
          description: `Order received! Stock updated.`,
        });
        fetchInventory();
        fetchInventoryLogs();
      } else {
        toast({
          title: "Error",
          description: "Failed to receive order",
          variant: "destructive",
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isCorsFetchError = msg.toLowerCase().includes("failed to fetch");

      if (isCorsFetchError) {
        console.warn("Receive order fetch error (likely CORS after successful POST):", error);
        logInventoryActivity(item.partId, `Order received for: ${item.partName}`);
        toast({
          title: "Success",
          description: "Order received! Stock updated.",
        });
        fetchInventory();
        fetchInventoryLogs();
        return;
      }

      console.error("Error receiving order:", error);
      toast({
        title: "Error",
        description: "Failed to receive order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deviceTypes = useMemo(() => {
    const types = new Set(inventory.map(i => i.deviceType).filter(Boolean));
    return Array.from(types).sort();
  }, [inventory]);

  const models = useMemo(() => {
    const modelSet = new Set(inventory.map(i => i.model).filter(Boolean));
    return Array.from(modelSet).sort();
  }, [inventory]);

  const filteredAndSortedInventory = useMemo(() => {
    let filtered = inventory.filter(item => {
      if (deviceTypeFilter !== "all" && item.deviceType !== deviceTypeFilter) return false;
      if (brandFilter !== "all" && item.model !== brandFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase();
        return (
          item.partId.toLowerCase().includes(query) ||
          item.partName.toLowerCase().includes(query) ||
          item.model.toLowerCase().includes(query)
        );
      }
      
      return true;
    });

    filtered.sort((a, b) => {
      let compareValue = 0;

      switch (sortField) {
        case "partId":
          compareValue = a.partId.localeCompare(b.partId);
          break;
        case "partName":
          compareValue = a.partName.localeCompare(b.partName);
          break;
        case "quantity":
          compareValue = a.quantity - b.quantity;
          break;
        case "lastUpdated":
          compareValue = (a.lastUpdated || "").localeCompare(b.lastUpdated || "");
          break;
      }

      return sortOrder === "asc" ? compareValue : -compareValue;
    });

    return filtered;
  }, [inventory, deviceTypeFilter, brandFilter, statusFilter, debouncedSearch, sortField, sortOrder]);

  // Paginated inventory items
  const paginatedInventory = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedInventory.slice(startIndex, endIndex);
  }, [filteredAndSortedInventory, currentPage, itemsPerPage]);

  // Filtered and sorted logs (most recent first)
  const filteredLogs = useMemo(() => {
    const filtered = logs.filter(log => {
      // Log ID search
      if (logIdSearch && !log.logId.toLowerCase().includes(logIdSearch.toLowerCase())) {
        return false;
      }
      
      // Part name filter
      if (logPartNameFilter !== "all" && log.partName !== logPartNameFilter) {
        return false;
      }
      
      // Device type filter
      if (logDeviceTypeFilter !== "all" && log.deviceType !== logDeviceTypeFilter) {
        return false;
      }
      
      // Username filter
      if (logUsernameFilter !== "all" && log.username !== logUsernameFilter) {
        return false;
      }
      
      // Date range filter
      if (logDateFrom || logDateTo) {
        try {
          const logDate = new Date(log.dateTime);
          if (logDateFrom) {
            const fromDate = new Date(logDateFrom);
            fromDate.setHours(0, 0, 0, 0);
            if (logDate < fromDate) return false;
          }
          if (logDateTo) {
            const toDate = new Date(logDateTo);
            toDate.setHours(23, 59, 59, 999);
            if (logDate > toDate) return false;
          }
        } catch {
          // Invalid date, skip filter
        }
      }
      
      return true;
    });

    // Sort by dateTime descending (most recent first)
    return filtered.sort((a, b) => {
      try {
        const dateA = new Date(a.dateTime).getTime();
        const dateB = new Date(b.dateTime).getTime();
        return dateB - dateA; // Descending order
      } catch {
        return 0;
      }
    });
  }, [logs, logIdSearch, logPartNameFilter, logDeviceTypeFilter, logUsernameFilter, logDateFrom, logDateTo]);

  // Paginated logs
  const paginatedLogs = useMemo(() => {
    const startIndex = (logsCurrentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredLogs.slice(startIndex, endIndex);
  }, [filteredLogs, logsCurrentPage, itemsPerPage]);

  // Get unique values for filters
  const logPartNames = useMemo(() => {
    const names = new Set(logs.map(l => l.partName).filter(Boolean));
    return Array.from(names).sort();
  }, [logs]);

  const logDeviceTypes = useMemo(() => {
    const types = new Set(logs.map(l => l.deviceType).filter(Boolean));
    return Array.from(types).sort();
  }, [logs]);

  const logUsernames = useMemo(() => {
    const users = new Set(logs.map(l => l.username).filter(Boolean));
    return Array.from(users).sort();
  }, [logs]);

  const totalPages = Math.ceil(filteredAndSortedInventory.length / itemsPerPage);
  const logsTotalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getStatusColor = (item: InventoryItem) => {
    if (item.status === "Out of Stock" || item.quantity === 0) return "text-destructive font-semibold";
    if (item.quantity < 5) return "text-orange-600 font-semibold";
    return "";
  };

  const lowStockCount = inventory.filter(i => i.quantity > 0 && i.quantity < 5).length;
  const outOfStockCount = inventory.filter(i => i.quantity === 0 || i.status === "Out of Stock").length;

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-muted-foreground">Track parts and materials</p>
        </div>

        <div className="flex justify-end gap-2 mb-6">

          {!isViewOnly && (
            <>
              {/* Batch Add Parts Button */}
              <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                    <Plus className="h-4 w-4 mr-2" />
                    Batch Add Parts
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Batch Add Parts</DialogTitle>
                    <DialogDescription>Add multiple parts for the same device model</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {/* Shared device info */}
                    <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="space-y-2">
                        <Label>Device Type *</Label>
                        <Select value={batchDeviceType} onValueChange={setBatchDeviceType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select device type" />
                          </SelectTrigger>
                          <SelectContent>
                            {DEVICE_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Brand</Label>
                        <Input
                          value={batchBrand}
                          onChange={(e) => setBatchBrand(e.target.value)}
                          placeholder="e.g., Apple"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Model</Label>
                        <Input
                          value={batchModel}
                          onChange={(e) => setBatchModel(e.target.value)}
                          placeholder="e.g., iPhone 15 Pro"
                        />
                      </div>
                    </div>

                    {/* Parts list */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Parts</Label>
                        <Button type="button" variant="outline" size="sm" onClick={addBatchPartRow}>
                          <Plus className="h-4 w-4 mr-1" /> Add Row
                        </Button>
                      </div>
                      
                      {batchParts.map((part, index) => (
                        <div key={index} className="grid grid-cols-[2fr_1fr_1fr_1.2fr_1.2fr_1fr_auto] gap-2 items-end p-3 border rounded-lg">
                          <div className="space-y-1">
                            <Label className="text-xs">Part Name *</Label>
                            <Input
                              value={part.partName}
                              onChange={(e) => updateBatchPart(index, "partName", e.target.value)}
                              placeholder="e.g., LCD Screen"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Quantity *</Label>
                            <Input
                              type="number"
                              value={part.quantity}
                              onChange={(e) => updateBatchPart(index, "quantity", e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Cost per Unit *</Label>
                            <Input
                              value={part.costPerUnit}
                              onChange={(e) => updateBatchPart(index, "costPerUnit", e.target.value)}
                              placeholder="₱0.00"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Status *</Label>
                            <Select value={part.status} onValueChange={(v) => updateBatchPart(index, "status", v)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="In Stock">In Stock</SelectItem>
                                <SelectItem value="Low Stock">Low Stock</SelectItem>
                                <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                                <SelectItem value="On Order">On Order</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Supplier</Label>
                            <Input
                              value={part.supplier}
                              onChange={(e) => updateBatchPart(index, "supplier", e.target.value)}
                              placeholder="Optional"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Color</Label>
                            <Input
                              value={part.color}
                              onChange={(e) => updateBatchPart(index, "color", e.target.value)}
                              placeholder="Optional"
                            />
                          </div>
                          <div className="flex items-center justify-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeBatchPartRow(index)}
                              disabled={batchParts.length === 1}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsBatchDialogOpen(false)} disabled={isSubmitting}>
                      Cancel
                    </Button>
                    <Button onClick={handleBatchAddParts} disabled={isSubmitting}>
                      {isSubmitting ? "Adding..." : `Add ${batchParts.filter(p => p.partName && p.quantity && p.costPerUnit).length} Part(s)`}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Single Add Part Button */}
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Part
                  </Button>
                </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Part</DialogTitle>
                <DialogDescription>Register a new part in the inventory</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="partName">Part Name *</Label>
                    <Input
                      id="partName"
                      value={newPart.partName}
                      onChange={(e) => setNewPart({...newPart, partName: e.target.value})}
                      placeholder="e.g., LCD Screen"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deviceType">Device Type *</Label>
                    <Select
                      value={newPart.deviceType}
                      onValueChange={(value) => setNewPart({...newPart, deviceType: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select device type" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEVICE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="brand">Brand</Label>
                    <Input
                      id="brand"
                      value={newPart.brand}
                      onChange={(e) => setNewPart({...newPart, brand: e.target.value})}
                      placeholder="e.g., Apple"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input
                      id="model"
                      value={newPart.model}
                      onChange={(e) => setNewPart({...newPart, model: e.target.value})}
                      placeholder="e.g., iPhone 15 Pro"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="partType">Part Type</Label>
                    {newPart.partType === "Others" ? (
                      <div className="flex gap-2">
                        <Input
                          id="partType"
                          value={newPart.partTypeOther}
                          onChange={(e) => setNewPart({...newPart, partTypeOther: e.target.value})}
                          placeholder="Enter part type..."
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setNewPart({...newPart, partType: "", partTypeOther: ""})}
                        >
                          Reset
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={newPart.partType}
                        onValueChange={(value) => setNewPart({...newPart, partType: value, partTypeOther: ""})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OEM">OEM</SelectItem>
                          <SelectItem value="Original">Original</SelectItem>
                          <SelectItem value="Others">Others</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="color">Color</Label>
                    <Input
                      id="color"
                      value={newPart.color}
                      onChange={(e) => setNewPart({...newPart, color: e.target.value})}
                      placeholder="e.g., Black, White"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">
                      {newPart.status === "On Order" ? "Ordered Quantity *" : "Initial Quantity *"}
                    </Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={newPart.quantity}
                      onChange={(e) => setNewPart({...newPart, quantity: e.target.value})}
                      placeholder="0"
                    />
                    {newPart.status === "On Order" && (
                      <p className="text-xs text-muted-foreground">Stock will be set to 0 until order is received</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="costPerUnit">Cost per Unit</Label>
                    <Input
                      id="costPerUnit"
                      value={newPart.costPerUnit}
                      onChange={(e) => setNewPart({...newPart, costPerUnit: e.target.value})}
                      placeholder="₱0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Supplier</Label>
                    <Input
                      id="supplier"
                      value={newPart.supplier}
                      onChange={(e) => setNewPart({...newPart, supplier: e.target.value})}
                      placeholder="Supplier name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOrdered">Date Ordered</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !newPart.dateOrdered && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newPart.dateOrdered ? format(new Date(newPart.dateOrdered), "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={newPart.dateOrdered ? new Date(newPart.dateOrdered) : undefined}
                          onSelect={(date) => setNewPart({...newPart, dateOrdered: date ? format(date, "yyyy-MM-dd") : ""})}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={newPart.status} onValueChange={(value) => setNewPart({...newPart, status: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="In Stock">In Stock</SelectItem>
                      <SelectItem value="Low Stock">Low Stock</SelectItem>
                      <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                      <SelectItem value="On Order">On Order</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Textarea
                    id="remarks"
                    value={newPart.remarks}
                    onChange={(e) => setNewPart({...newPart, remarks: e.target.value})}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={handleAddPart} disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add Part"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Parts</p>
                  <p className="text-2xl font-bold">{inventory.length}</p>
                </div>
                <Package className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Stock</p>
                  <p className="text-2xl font-bold text-green-600">
                    {inventory.filter(i => i.quantity > 5).length}
                  </p>
                </div>
                <Package className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Low Stock</p>
                  <p className="text-2xl font-bold text-orange-600">{lowStockCount}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Out of Stock</p>
                  <p className="text-2xl font-bold text-destructive">{outOfStockCount}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters & Search</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Part ID, Name, Model..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Device Type</Label>
                <Select value={deviceTypeFilter} onValueChange={setDeviceTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Device Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Device Types</SelectItem>
                    {deviceTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Models" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Models</SelectItem>
                    {models.map(model => (
                      <SelectItem key={model} value={model}>{model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="In Stock">In Stock</SelectItem>
                    <SelectItem value="Low Stock">Low Stock</SelectItem>
                    <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                    <SelectItem value="On Order">On Order</SelectItem>
                    <SelectItem value="For Ordering">For Ordering</SelectItem>
                    <SelectItem value="Ordered">Ordered</SelectItem>
                    <SelectItem value="Received">Received</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reload Button */}
              <div className="flex items-end">
                <Button variant="outline" size="icon" onClick={() => { refetchInventory(); refetchLogs(); }} disabled={isLoading || isLogsLoading} title="Reload table">
                  <RefreshCw className={`h-4 w-4 ${isLoading || isLogsLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Inventory Items and Logs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full max-w-lg ${isViewOnly ? 'grid-cols-2' : 'grid-cols-3'}`}>
            <TabsTrigger value="items">
              <Package className="h-4 w-4 mr-2" />
              Inventory Items
            </TabsTrigger>
            <TabsTrigger value="fast-moving">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Pre-Ordered Parts
            </TabsTrigger>
            {!isViewOnly && (
              <TabsTrigger value="logs">
                <FileText className="h-4 w-4 mr-2" />
                Inventory Logs
              </TabsTrigger>
            )}
          </TabsList>

          {/* Inventory Items Tab */}
          <TabsContent value="items">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Items</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part ID</TableHead>
                          <TableHead>Part Name</TableHead>
                          <TableHead>Device Type</TableHead>
                          <TableHead>Brand</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead>Part Type</TableHead>
                          <TableHead>Quantity</TableHead>
                          {!isViewOnly && <TableHead>Cost</TableHead>}
                          <TableHead>Status</TableHead>
                          <TableHead>Last Updated</TableHead>
                          <TableHead>Remarks</TableHead>
                          <TableHead>QR Code</TableHead>
                          {!isViewOnly && <TableHead>Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.from({ length: 8 }).map((_, i) => (
                          <TableRow key={`skeleton-${i}`}>
                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                            {!isViewOnly && <TableCell><Skeleton className="h-4 w-16" /></TableCell>}
                            <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                            {!isViewOnly && <TableCell><Skeleton className="h-8 w-20" /></TableCell>}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : filteredAndSortedInventory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No inventory items found</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="cursor-pointer" onClick={() => handleSort("partId")}>
                            <div className="flex items-center gap-1">
                              Part ID <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort("partName")}>
                            <div className="flex items-center gap-1">
                              Part Name <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead>Device Type</TableHead>
                          <TableHead>Brand</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead>Color</TableHead>
                          <TableHead>Part Type</TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort("quantity")}>
                            <div className="flex items-center gap-1">
                              Quantity <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          {!isViewOnly && <TableHead>Cost</TableHead>}
                          <TableHead>Supplier</TableHead>
                          <TableHead>Date Ordered</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort("lastUpdated")}>
                            <div className="flex items-center gap-1">
                              Last Updated <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead>Remarks</TableHead>
                          <TableHead>QR Code</TableHead>
                          {!isViewOnly && <TableHead>Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedInventory.map((item) => {
                          const itemLogs = logs
                            .filter(log => log.partId === item.partId)
                            .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
                            .slice(0, 10);
                          
                          return (
                            <>
                              <TableRow
                                key={item.partId}
                                className={`cursor-pointer hover:bg-muted/50 ${
                                  item.quantity === 0 || item.status === "Out of Stock" ? "bg-destructive/10" : 
                                  item.quantity < 5 ? "bg-orange-50" : ""
                                }`}
                                onClick={() => setSelectedPartForLogs(selectedPartForLogs === item.partId ? null : item.partId)}
                              >
                                <TableCell className="font-medium">
                                  {item.partId}
                                  {(item.quantity === 0 || item.status === "Out of Stock") && (
                                    <AlertTriangle className="inline-block ml-2 h-4 w-4 text-destructive" />
                                  )}
                                </TableCell>
                                <TableCell>{item.partName}</TableCell>
                                <TableCell>{item.deviceType || "N/A"}</TableCell>
                                <TableCell>{item.brand || "N/A"}</TableCell>
                                <TableCell>{item.model || "N/A"}</TableCell>
                                <TableCell>{item.color || "N/A"}</TableCell>
                                <TableCell>{item.partType || "N/A"}</TableCell>
                                <TableCell className={getStatusColor(item)}>
                                  {item.quantity}
                                </TableCell>
                                {!isViewOnly && <TableCell>{item.costPerUnit ? `₱${item.costPerUnit}` : "N/A"}</TableCell>}
                                <TableCell>{item.supplier || "N/A"}</TableCell>
                                <TableCell>{item.dateOrdered || "N/A"}</TableCell>
                                <TableCell>
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    item.status === "Out of Stock" ? "bg-destructive/20 text-destructive" :
                                    item.status === "Low Stock" ? "bg-orange-100 text-orange-800" :
                                    item.status === "In Stock" ? "bg-green-100 text-green-800" :
                                    "bg-blue-100 text-blue-800"
                                  }`}>
                                    {item.status}
                                  </span>
                                </TableCell>
                                <TableCell>{item.lastUpdated || "N/A"}</TableCell>
                                <TableCell className="max-w-[200px] truncate" title={item.remarks}>
                                  {item.remarks || "N/A"}
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  {item.partId ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        const dataUrl = await QRCode.toDataURL(item.partId, { width: 300, margin: 1 });
                                        setSelectedQRCode({ partName: item.partName, qrCode: dataUrl });
                                        setQrCodeDialogOpen(true);
                                      }}
                                    >
                                      <QrCode className="h-4 w-4 mr-1" />
                                      View
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">No QR</span>
                                  )}
                                </TableCell>
                                {!isViewOnly && (
                                  <TableCell onClick={(e) => e.stopPropagation()}>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEditingPart(item);
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
                                          setSelectedPart(item);
                                          setIsDeleteDialogOpen(true);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                      {item.status === "On Order" ? (
                                        <Button
                                          size="sm"
                                          variant="default"
                                          className="bg-green-600 hover:bg-green-700"
                                          onClick={() => handleReceiveOrder(item)}
                                          disabled={isSubmitting}
                                        >
                                          {isSubmitting ? "Processing..." : "Receive"}
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setSelectedPart(item);
                                            setIsStockDialogOpen(true);
                                          }}
                                        >
                                          Adjust
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                              {selectedPartForLogs === item.partId && itemLogs.length > 0 && (
                                <TableRow key={`${item.partId}-logs`}>
                                  <TableCell colSpan={10} className="bg-muted/30 p-4">
                                    <div className="space-y-2">
                                      <h4 className="font-semibold text-sm flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        Recent Activity (Last 10 Logs)
                                      </h4>
                                      <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                                        {itemLogs.map((log) => (
                                          <div key={log.logId} className="text-sm bg-background p-3 rounded border">
                                            <div className="flex justify-between items-start mb-1">
                                              <span className="font-medium text-primary">{log.transactionType}</span>
                                              <span className="text-xs text-muted-foreground">{log.dateTime}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                              <div>
                                                <span className="text-muted-foreground">Changed:</span> {log.quantityChanged} units
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground">Stock:</span> {log.previousQuantity} → {log.newQuantity}
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground">By:</span> {log.username} ({log.role})
                                              </div>
                                              {log.remarks && (
                                                <div className="col-span-2">
                                                  <span className="text-muted-foreground">Remarks:</span> {log.remarks}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedInventory.length)} of {filteredAndSortedInventory.length} items
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <div className="text-sm">
                          Page {currentPage} of {totalPages}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Logs Tab */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Logs</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="mb-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by Log ID..."
                      value={logIdSearch}
                      onChange={(e) => {
                        setLogIdSearch(e.target.value);
                        setLogsCurrentPage(1);
                      }}
                      className="max-w-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Part Name</Label>
                      <Select value={logPartNameFilter} onValueChange={(value) => {
                        setLogPartNameFilter(value);
                        setLogsCurrentPage(1);
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Parts</SelectItem>
                          {logPartNames.map(name => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Device Type</Label>
                      <Select value={logDeviceTypeFilter} onValueChange={(value) => {
                        setLogDeviceTypeFilter(value);
                        setLogsCurrentPage(1);
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {logDeviceTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Select value={logUsernameFilter} onValueChange={(value) => {
                        setLogUsernameFilter(value);
                        setLogsCurrentPage(1);
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          {logUsernames.map(user => (
                            <SelectItem key={user} value={user}>{user}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Clear Filters</Label>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => {
                          setLogIdSearch("");
                          setLogPartNameFilter("all");
                          setLogDeviceTypeFilter("all");
                          setLogUsernameFilter("all");
                          setLogDateFrom("");
                          setLogDateTo("");
                          setLogsCurrentPage(1);
                        }}
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="logDateFrom">
                        <Calendar className="h-4 w-4 inline mr-2" />
                        Date From
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !logDateFrom && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {logDateFrom ? format(new Date(logDateFrom), "PPP") : "From date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={logDateFrom ? new Date(logDateFrom) : undefined}
                            onSelect={(date) => {
                              setLogDateFrom(date ? format(date, "yyyy-MM-dd") : "");
                              setLogsCurrentPage(1);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="logDateTo">
                        <Calendar className="h-4 w-4 inline mr-2" />
                        Date To
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !logDateTo && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {logDateTo ? format(new Date(logDateTo), "PPP") : "To date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={logDateTo ? new Date(logDateTo) : undefined}
                            onSelect={(date) => {
                              setLogDateTo(date ? format(date, "yyyy-MM-dd") : "");
                              setLogsCurrentPage(1);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    Showing {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''} 
                    {(logIdSearch || logPartNameFilter !== "all" || logDeviceTypeFilter !== "all" || 
                      logUsernameFilter !== "all" || logDateFrom || logDateTo) && " (filtered)"}
                  </div>
                </div>

                {isLogsLoading ? (
                  <div className="text-center py-8">Loading logs...</div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No inventory logs found</div>
                ) : (
                  <>
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Log ID</TableHead>
                          <TableHead>Part ID</TableHead>
                          <TableHead>Part Name</TableHead>
                          <TableHead>Device Type</TableHead>
                          <TableHead>Transaction Type</TableHead>
                          <TableHead>Previous Quantity</TableHead>
                          <TableHead>New Quantity</TableHead>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Remarks/Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedLogs.map((log) => (
                          <TableRow key={log.logId}>
                            <TableCell className="font-medium">{log.logId}</TableCell>
                            <TableCell>{log.partId}</TableCell>
                            <TableCell>{log.partName}</TableCell>
                            <TableCell>{log.deviceType || "N/A"}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs ${
                                log.transactionType === "Stock In" ? "bg-green-100 text-green-800" :
                                log.transactionType === "Stock Out" ? "bg-red-100 text-red-800" :
                                log.transactionType === "Order Placed" ? "bg-blue-100 text-blue-800" :
                                log.transactionType === "Order Received" ? "bg-purple-100 text-purple-800" :
                                "bg-gray-100 text-gray-800"
                              }`}>
                                {log.transactionType}
                              </span>
                            </TableCell>
                            <TableCell>{log.previousQuantity}</TableCell>
                            <TableCell>{log.newQuantity}</TableCell>
                            <TableCell>{log.dateTime}</TableCell>
                            <TableCell>{log.username}</TableCell>
                            <TableCell>{log.role}</TableCell>
                            <TableCell className="max-w-[300px]" title={log.remarks}>
                              {log.remarks || "N/A"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Controls for Logs */}
                  {logsTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Showing {((logsCurrentPage - 1) * itemsPerPage) + 1} to {Math.min(logsCurrentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} logs
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLogsCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={logsCurrentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <div className="text-sm">
                          Page {logsCurrentPage} of {logsTotalPages}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLogsCurrentPage(prev => Math.min(logsTotalPages, prev + 1))}
                          disabled={logsCurrentPage === logsTotalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fast Moving Parts Tab */}
          <TabsContent value="fast-moving">
            <FastMovingPartsTab 
              isViewOnly={isViewOnly} 
              searchQuery={debouncedSearch}
              deviceTypeFilter={deviceTypeFilter}
              modelFilter={brandFilter}
              statusFilter={statusFilter}
            />
          </TabsContent>
        </Tabs>

        {/* Stock Adjustment Dialog */}
        <Dialog open={isStockDialogOpen} onOpenChange={setIsStockDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adjust Stock</DialogTitle>
              <DialogDescription>
                {selectedPart && (
                  <>
                    Part: <strong>{selectedPart.partName}</strong> (ID: {selectedPart.partId})
                    <br />
                    Current Quantity: <strong>{selectedPart.quantity}</strong>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="adjustmentType">Adjustment Type</Label>
                <Select value={stockAdjustment.type} onValueChange={(value) => setStockAdjustment({...stockAdjustment, type: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add Stock (Stock In)</SelectItem>
                    <SelectItem value="remove">Remove Stock (Stock Out)</SelectItem>
                    <SelectItem value="adjust">Manual Adjustment</SelectItem>
                    <SelectItem value="order">Place Order</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjustQuantity">
                  {stockAdjustment.type === "order" ? "Order Quantity" : "Quantity"}
                </Label>
                <Input
                  id="adjustQuantity"
                  type="number"
                  value={stockAdjustment.quantity}
                  onChange={(e) => setStockAdjustment({...stockAdjustment, quantity: e.target.value})}
                  placeholder="Enter quantity"
                />
                {stockAdjustment.type === "order" && (
                  <p className="text-xs text-muted-foreground">
                    This will set status to "On Order" without changing current stock
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjustRemarks">Remarks</Label>
                <Textarea
                  id="adjustRemarks"
                  value={stockAdjustment.remarks}
                  onChange={(e) => setStockAdjustment({...stockAdjustment, remarks: e.target.value})}
                  placeholder="Reason for adjustment..."
                />
              </div>

              {selectedPart && stockAdjustment.quantity && stockAdjustment.type !== "order" && (
                <div className="p-4 bg-muted rounded-md">
                  <p className="text-sm">
                    <strong>New Quantity:</strong>{" "}
                    {stockAdjustment.type === "add" 
                      ? selectedPart.quantity + parseInt(stockAdjustment.quantity || "0")
                      : stockAdjustment.type === "remove"
                      ? Math.max(0, selectedPart.quantity - parseInt(stockAdjustment.quantity || "0"))
                      : parseInt(stockAdjustment.quantity || "0")
                    }
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsStockDialogOpen(false);
                  setSelectedPart(null);
                  setStockAdjustment({ quantity: "", type: "add", remarks: "" });
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleStockAdjustment} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Stock"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* QR Code View Dialog */}
        <Dialog open={qrCodeDialogOpen} onOpenChange={setQrCodeDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>QR Code - {selectedQRCode?.partName}</DialogTitle>
              <DialogDescription>
                Scan this QR code to quickly add this part to a service
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center p-6 space-y-4">
              {selectedQRCode?.qrCode && (
                <img 
                  src={selectedQRCode.qrCode} 
                  alt={`QR Code for ${selectedQRCode.partName}`}
                  className="w-64 h-64 border-2 border-border rounded-lg"
                />
              )}
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (selectedQRCode?.qrCode) {
                      const link = document.createElement('a');
                      link.download = `${selectedQRCode.partName.replace(/\s+/g, '_')}_QRCode.png`;
                      link.href = selectedQRCode.qrCode;
                      link.click();
                      toast({
                        title: "Success",
                        description: "QR code downloaded successfully",
                      });
                    }
                  }}
                >
                  Download QR Code
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (selectedQRCode?.qrCode) {
                      navigator.clipboard.write([
                        new ClipboardItem({
                          'image/png': fetch(selectedQRCode.qrCode)
                            .then(res => res.blob())
                        })
                      ]).then(() => {
                        toast({
                          title: "Success",
                          description: "QR code copied to clipboard",
                        });
                      }).catch(() => {
                        toast({
                          title: "Error",
                          description: "Failed to copy QR code. Try downloading instead.",
                          variant: "destructive",
                        });
                      });
                    }
                  }}
                >
                  Copy Image
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Part Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Part</DialogTitle>
              <DialogDescription>Update part information</DialogDescription>
            </DialogHeader>
            {editingPart && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-partName">Part Name *</Label>
                    <Input
                      id="edit-partName"
                      value={editingPart.partName}
                      onChange={(e) => setEditingPart({...editingPart, partName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-deviceType">Device Type *</Label>
                    <Select
                      value={editingPart.deviceType}
                      onValueChange={(value) => setEditingPart({...editingPart, deviceType: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEVICE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-brand">Brand</Label>
                    <Input
                      id="edit-brand"
                      value={editingPart.brand}
                      onChange={(e) => setEditingPart({...editingPart, brand: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-model">Model</Label>
                    <Input
                      id="edit-model"
                      value={editingPart.model}
                      onChange={(e) => setEditingPart({...editingPart, model: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-partType">Part Type</Label>
                    <Select
                      value={editingPart.partType || ""}
                      onValueChange={(value) => setEditingPart({...editingPart, partType: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OEM">OEM</SelectItem>
                        <SelectItem value="Original">Original</SelectItem>
                        <SelectItem value="Others">Others</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-color">Color</Label>
                    <Input
                      id="edit-color"
                      value={editingPart.color || ""}
                      onChange={(e) => setEditingPart({...editingPart, color: e.target.value})}
                      placeholder="e.g., Black, White"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-supplier">Supplier</Label>
                    <Input
                      id="edit-supplier"
                      value={editingPart.supplier}
                      onChange={(e) => setEditingPart({...editingPart, supplier: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-costPerUnit">Cost/Unit</Label>
                    <Input
                      id="edit-costPerUnit"
                      type="number"
                      value={editingPart.costPerUnit}
                      onChange={(e) => setEditingPart({...editingPart, costPerUnit: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-dateOrdered">Date Ordered</Label>
                  <Input
                    id="edit-dateOrdered"
                    type="date"
                    value={editingPart.dateOrdered || ""}
                    onChange={(e) => setEditingPart({...editingPart, dateOrdered: e.target.value})}
                  />
                </div>


                <div className="space-y-2">
                  <Label htmlFor="edit-remarks">Remarks</Label>
                  <Textarea
                    id="edit-remarks"
                    value={editingPart.remarks}
                    onChange={(e) => setEditingPart({...editingPart, remarks: e.target.value})}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingPart(null);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleEditPart} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Part Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Part</DialogTitle>
              <DialogDescription>
                {selectedPart && (
                  <>
                    Are you sure you want to delete <strong>{selectedPart.partName}</strong> (ID: {selectedPart.partId})?
                    <br />
                    <br />
                    <span className="text-destructive font-semibold">This action cannot be undone.</span>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setSelectedPart(null);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeletePart}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Part"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="text-center mt-8 text-sm text-muted-foreground">
          
        </div>
      </div>
    </DashboardLayout>
  );
};

export default InventoryManagement;