import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { DEVICE_TYPES } from "@/lib/constants";
import { Package, Plus, ArrowUpDown, AlertTriangle, Search, FileText, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import logo from "@/assets/ac-tech-logo.jpg";

interface InventoryItem {
  partId: string;
  partName: string;
  deviceType: string;
  brand: string;
  model: string;
  quantity: number;
  dateOrdered?: string;
  supplier?: string;
  costPerUnit?: string;
  status: string;
  lastUpdated: string;
  remarks: string;
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
  const { toast } = useToast();
  const userRole = sessionStorage.getItem("userRole");
  
  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
    // Only management can access inventory
    if (userRole !== "management") {
      navigate("/admin-portal");
    }
  }, [navigate, userRole]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLogsLoading, setIsLogsLoading] = useState(true);
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("lastUpdated");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [selectedPartForLogs, setSelectedPartForLogs] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<InventoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
  const itemsPerPage = 20;

  // Form states for new part
  const [newPart, setNewPart] = useState({
    partName: "",
    deviceType: "",
    brand: "",
    model: "",
    quantity: "",
    orderedQuantity: "", // Track ordered quantity separately
    dateOrdered: "",
    supplier: "",
    costPerUnit: "",
    status: "In Stock",
    remarks: ""
  });

  // Form states for stock adjustment
  const [stockAdjustment, setStockAdjustment] = useState({
    quantity: "",
    type: "add",
    remarks: ""
  });

  useEffect(() => {
    fetchInventory();
    fetchInventoryLogs();
  }, []);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=getInventoryFull`
      );
      const data = await response.json();

      if (data.status === "success" && data.inventory) {
        setInventory(data.inventory);
      } else {
        toast({
          title: "Error",
          description: "Failed to load inventory",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching inventory:", error);
      toast({
        title: "Error",
        description: "Failed to load inventory",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInventoryLogs = async () => {
    setIsLogsLoading(true);
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=getInventoryLogs`
      );
      const data = await response.json();

      if (data.status === "success" && data.logs) {
        setLogs(data.logs);
      } else {
        toast({
          title: "Error",
          description: "Failed to load inventory logs",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching inventory logs:", error);
      toast({
        title: "Error",
        description: "Failed to load inventory logs",
        variant: "destructive",
      });
    } finally {
      setIsLogsLoading(false);
    }
  };

  const handleAddPart = async () => {
    if (!newPart.partName || !newPart.deviceType || !newPart.quantity) {
      toast({
        title: "Validation Error",
        description: "Part Name, Device Type, and Quantity are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("action", "addInventoryItem");
      
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
      formData.append("quantity", actualQuantity);
      formData.append("dateOrdered", newPart.dateOrdered);
      formData.append("supplier", newPart.supplier);
      formData.append("costPerUnit", newPart.costPerUnit);
      formData.append("status", newPart.status);
      formData.append("remarks", remarksWithOrder);
      formData.append("addedBy", sessionStorage.getItem("username") || "Admin");

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.result === "success") {
        toast({
          title: "Success",
          description: isOnOrder 
            ? `Part added with "On Order" status. Click "Receive Order" when stock arrives.`
            : "Part added successfully",
        });
        setIsAddDialogOpen(false);
        setNewPart({
          partName: "",
          deviceType: "",
          brand: "",
          model: "",
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
          description: "Failed to add part",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding part:", error);
      toast({
        title: "Error",
        description: "Failed to add part",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
      
      formData.append("adjustedBy", sessionStorage.getItem("username") || "Admin");
      formData.append("userRole", sessionStorage.getItem("userRole") || "Management");

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.result === "success") {
        toast({
          title: "Success",
          description: stockAdjustment.type === "order" 
            ? "Order placed successfully. Click 'Receive Order' when stock arrives."
            : "Stock updated successfully",
        });
        setIsStockDialogOpen(false);
        setSelectedPart(null);
        setStockAdjustment({
          quantity: "",
          type: "add",
          remarks: ""
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

  const handleReceiveOrder = async (item: InventoryItem) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("action", "receiveOrder");
      formData.append("partId", item.partId);
      formData.append("receivedBy", sessionStorage.getItem("username") || "Admin");
      formData.append("userRole", sessionStorage.getItem("userRole") || "Management");
      formData.append("remarks", "Order received and confirmed");

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.result === "success") {
        toast({
          title: "Success",
          description: `Order received! Status updated to: ${result.newStatus}`,
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

  const brands = useMemo(() => {
    const brandSet = new Set(inventory.map(i => i.brand).filter(Boolean));
    return Array.from(brandSet).sort();
  }, [inventory]);

  const filteredAndSortedInventory = useMemo(() => {
    let filtered = inventory.filter(item => {
      if (deviceTypeFilter !== "all" && item.deviceType !== deviceTypeFilter) return false;
      if (brandFilter !== "all" && item.brand !== brandFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
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
  }, [inventory, deviceTypeFilter, brandFilter, statusFilter, searchQuery, sortField, sortOrder]);

  // Paginated inventory items
  const paginatedInventory = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedInventory.slice(startIndex, endIndex);
  }, [filteredAndSortedInventory, currentPage, itemsPerPage]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
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
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container mx-auto p-6 max-w-7xl flex-grow">
        {/* Header */}
        <div className="flex items-center justify-center mb-8">
          <img src={logo} alt="AC Tech Repair PH" className="h-16 mr-4" />
          <div>
            <h1 className="text-3xl font-bold">AC Tech Repair PH</h1>
            <p className="text-muted-foreground">Inventory Management</p>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <Button onClick={() => navigate("/admin-portal")} variant="outline">
            Back to Admin Portal
          </Button>

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
                    <Input
                      id="dateOrdered"
                      type="date"
                      value={newPart.dateOrdered}
                      onChange={(e) => setNewPart({...newPart, dateOrdered: e.target.value})}
                    />
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
            <div className="grid gap-4 md:grid-cols-4">
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
                <Label>Brand</Label>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Brands" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Brands</SelectItem>
                    {brands.map(brand => (
                      <SelectItem key={brand} value={brand}>{brand}</SelectItem>
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
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Inventory Items and Logs */}
        <Tabs defaultValue="items" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="items">
              <Package className="h-4 w-4 mr-2" />
              Inventory Items
            </TabsTrigger>
            <TabsTrigger value="logs">
              <FileText className="h-4 w-4 mr-2" />
              Inventory Logs
            </TabsTrigger>
          </TabsList>

          {/* Inventory Items Tab */}
          <TabsContent value="items">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Items</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading inventory...</div>
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
                          <TableHead className="cursor-pointer" onClick={() => handleSort("quantity")}>
                            <div className="flex items-center gap-1">
                              Quantity <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort("lastUpdated")}>
                            <div className="flex items-center gap-1">
                              Last Updated <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead>Remarks</TableHead>
                          <TableHead>Actions</TableHead>
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
                                <TableCell className={getStatusColor(item)}>
                                  {item.quantity}
                                </TableCell>
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
                                  <div className="flex gap-2">
                                    {item.status === "On Order" ? (
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="bg-green-600 hover:bg-green-700"
                                        onClick={() => handleReceiveOrder(item)}
                                        disabled={isSubmitting}
                                      >
                                        {isSubmitting ? "Processing..." : "Receive Order"}
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
                                        Adjust Stock
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                              {selectedPartForLogs === item.partId && itemLogs.length > 0 && (
                                <TableRow key={`${item.partId}-logs`}>
                                  <TableCell colSpan={10} className="bg-muted/30 p-4">
                                    <div className="space-y-2">
                                      <h4 className="font-semibold text-sm flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        Recent Activity (Last 10 Logs)
                                      </h4>
                                      <div className="space-y-2">
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
                      <Input
                        id="logDateFrom"
                        type="date"
                        value={logDateFrom}
                        onChange={(e) => {
                          setLogDateFrom(e.target.value);
                          setLogsCurrentPage(1);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="logDateTo">
                        <Calendar className="h-4 w-4 inline mr-2" />
                        Date To
                      </Label>
                      <Input
                        id="logDateTo"
                        type="date"
                        value={logDateTo}
                        onChange={(e) => {
                          setLogDateTo(e.target.value);
                          setLogsCurrentPage(1);
                        }}
                      />
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
                {isSubmitting ? "Updating..." : "Update Stock"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          Powered by Stack&Scale
        </div>
      </div>
    </div>
  );
};

export default InventoryManagement;
