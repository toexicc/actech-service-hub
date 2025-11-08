import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { DEVICE_TYPES } from "@/lib/constants";
import { Package, Plus, ArrowUpDown, AlertTriangle, Search } from "lucide-react";
import logo from "@/assets/ac-tech-logo.jpg";

interface InventoryItem {
  partId: string;
  partName: string;
  deviceType: string;
  brand: string;
  model: string;
  quantity: number;
  status: string;
  lastUpdated: string;
  remarks: string;
}

type SortField = "partId" | "partName" | "quantity" | "lastUpdated";
type SortOrder = "asc" | "desc";

const InventoryManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("lastUpdated");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<InventoryItem | null>(null);

  // Form states for new part
  const [newPart, setNewPart] = useState({
    partName: "",
    deviceType: "",
    brand: "",
    model: "",
    quantity: "",
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
  }, []);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=getInventory`
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

  const handleAddPart = async () => {
    if (!newPart.partName || !newPart.deviceType || !newPart.quantity) {
      toast({
        title: "Validation Error",
        description: "Part Name, Device Type, and Quantity are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("action", "addInventoryItem");
      Object.entries(newPart).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.append("addedBy", sessionStorage.getItem("username") || "Admin");

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.result === "success") {
        toast({
          title: "Success",
          description: "Part added successfully",
        });
        setIsAddDialogOpen(false);
        setNewPart({
          partName: "",
          deviceType: "",
          brand: "",
          model: "",
          quantity: "",
          dateOrdered: "",
          supplier: "",
          costPerUnit: "",
          status: "In Stock",
          remarks: ""
        });
        fetchInventory();
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

    try {
      const formData = new FormData();
      formData.append("action", "adjustStock");
      formData.append("partId", selectedPart.partId);
      formData.append("adjustmentType", stockAdjustment.type);
      formData.append("quantity", stockAdjustment.quantity);
      formData.append("remarks", stockAdjustment.remarks);
      formData.append("previousQuantity", selectedPart.quantity.toString());
      formData.append("adjustedBy", sessionStorage.getItem("username") || "Admin");

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.result === "success") {
        toast({
          title: "Success",
          description: "Stock updated successfully",
        });
        setIsStockDialogOpen(false);
        setSelectedPart(null);
        setStockAdjustment({
          quantity: "",
          type: "add",
          remarks: ""
        });
        fetchInventory();
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
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
                    <Label htmlFor="quantity">Initial Quantity *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={newPart.quantity}
                      onChange={(e) => setNewPart({...newPart, quantity: e.target.value})}
                      placeholder="0"
                    />
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
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddPart}>Add Part</Button>
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

        {/* Inventory Table */}
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
                      <TableHead>Date Ordered</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Cost/Unit</TableHead>
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
                    {filteredAndSortedInventory.map((item) => (
                      <TableRow
                        key={item.partId}
                        className={item.quantity === 0 || item.status === "Out of Stock" ? "bg-destructive/10" : item.quantity < 5 ? "bg-orange-50" : ""}
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
                        <TableCell>
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

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
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjustQuantity">Quantity</Label>
                <Input
                  id="adjustQuantity"
                  type="number"
                  value={stockAdjustment.quantity}
                  onChange={(e) => setStockAdjustment({...stockAdjustment, quantity: e.target.value})}
                  placeholder="Enter quantity"
                />
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

              {selectedPart && stockAdjustment.quantity && (
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
              <Button variant="outline" onClick={() => {
                setIsStockDialogOpen(false);
                setSelectedPart(null);
                setStockAdjustment({ quantity: "", type: "add", remarks: "" });
              }}>
                Cancel
              </Button>
              <Button onClick={handleStockAdjustment}>Update Stock</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          powered by Stack&Scale
        </div>
      </div>
    </div>
  );
};

export default InventoryManagement;
