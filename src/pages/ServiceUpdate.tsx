import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { generateServicePDF } from "@/lib/pdfGenerator";
import { FileText, Printer, Package } from "lucide-react";
import logo from "@/assets/ac-tech-logo.jpg";
import { normalizeGoogleDrivePdfUrl } from "@/lib/utils";
import { logActivity } from "@/lib/activityLogger";

interface InventoryItem {
  id: string;
  name: string;
  cost: number;
  quantity: number;
}

const ServiceUpdate = () => {
  const navigate = useNavigate();
  const [serviceId, setServiceId] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [showOtherDeviceInput, setShowOtherDeviceInput] = useState(false);
  const [serviceData, setServiceData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [technicians, setTechnicians] = useState<Array<{name: string, department: string, displayName: string}>>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedParts, setSelectedParts] = useState<{[key: string]: number}>({});
  const { toast } = useToast();

  const username = sessionStorage.getItem("username") || "Unknown";
  const userRole = sessionStorage.getItem("userRole") || "Unknown";

  // Update form fields
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateTechnician, setUpdateTechnician] = useState("");
  const [updateTechnicianDiagnosis, setUpdateTechnicianDiagnosis] = useState("");
  const [updateSuggestedRepair, setUpdateSuggestedRepair] = useState("");
  const [updateTechnicianNotesCustomer, setUpdateTechnicianNotesCustomer] = useState("");
  const [updateTechnicianNotesInternal, setUpdateTechnicianNotesInternal] = useState("");

  useEffect(() => {
    fetchTechnicians();
    fetchInventory();
  }, []);

  const fetchTechnicians = async () => {
    try {
      const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getTechnicians`);
      const data = await response.json();
      if (data.status === "success") {
        setTechnicians(data.technicians);
      }
    } catch (error) {
      console.error("Error fetching technicians:", error);
    }
  };

  const fetchInventory = async () => {
    try {
      const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getInventory`);
      const data = await response.json();
      if (data.status === "success") {
        setInventory(data.inventory || []);
      }
    } catch (error) {
      console.error("Error fetching inventory:", error);
    }
  };

  const calculateActualCost = () => {
    return Object.entries(selectedParts).reduce((total, [itemId, qty]) => {
      const item = inventory.find(i => i.id === itemId);
      return total + (item ? item.cost * qty : 0);
    }, 0);
  };

  const handleViewPDF = () => {
    if (!serviceData?.pdfUrl) {
      toast({
        title: "No PDF Available",
        description: "PDF link not found in database",
        variant: "destructive",
      });
      return;
    }
    const url = normalizeGoogleDrivePdfUrl(serviceData.pdfUrl, "preview");
    window.open(url, "_blank");
  };
  const handlePrintPDF = () => {
    if (!serviceData?.pdfUrl) {
      toast({
        title: "No PDF Available",
        description: "PDF link not found in database",
        variant: "destructive",
      });
      return;
    }
    const rawUrl = normalizeGoogleDrivePdfUrl(serviceData.pdfUrl, "download");
    const win = window.open("", "_blank");
    if (win) {
      const html = `<!doctype html><html><head><title>Print</title><meta name="referrer" content="no-referrer"><style>html,body{margin:0;height:100%} iframe{border:0;width:100%;height:100%}</style></head><body><iframe src="${rawUrl}" onload="setTimeout(function(){ window.focus(); window.print(); }, 500)"></iframe></body></html>`;
      win.document.open();
      win.document.write(html);
      win.document.close();
    } else {
      window.open(rawUrl, '_blank');
      toast({
        title: "Popup Blocked",
        description: "Allow popups to auto-print, PDF opened in a new tab.",
        variant: "destructive",
      });
    }
  };
  const handleSearch = async () => {
    if (!serviceId || !deviceType) {
      toast({
        title: "Missing Information",
        description: "Please enter both Service ID and Device Type",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=searchService&serviceId=${serviceId}&deviceType=${deviceType}`,
      );
      const data = await response.json();

      if (data.status === "found") {
        setServiceData(data.data);
        // Initialize update fields with current values
        setUpdateStatus(data.data.status || "");
        setUpdateTechnician(data.data.technician || "");
        setUpdateTechnicianDiagnosis(data.data.technicianDiagnosis || "");
        setUpdateSuggestedRepair(data.data.suggestedRepair || "");
        setUpdateTechnicianNotesCustomer(data.data.technicianNotesCustomer || "");
        setUpdateTechnicianNotesInternal(data.data.technicianNotesInternal || "");
      } else {
        toast({
          title: "Not Found",
          description: "No service found with the provided details",
          variant: "destructive",
        });
        setServiceData(null);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch service data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!serviceData) return;

    setIsUpdating(true);
    try {
      const actualCost = calculateActualCost();
      const partsUsed = Object.entries(selectedParts)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, qty]) => {
          const item = inventory.find(i => i.id === itemId);
          return `${item?.name} (${qty})`;
        })
        .join(", ");

      const formData = new FormData();
      formData.append("action", "updateTechnicianService");
      formData.append("serviceId", serviceId);
      formData.append("deviceType", deviceType);
      formData.append("status", updateStatus);
      formData.append("technician", updateTechnician);
      formData.append("technicianDiagnosis", updateTechnicianDiagnosis);
      formData.append("suggestedRepair", updateSuggestedRepair);
      formData.append("technicianNotesCustomer", updateTechnicianNotesCustomer);
      formData.append("technicianNotesInternal", updateTechnicianNotesInternal);
      formData.append("actualCost", actualCost.toString());
      formData.append("partsUsed", partsUsed);

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.result === "success") {
        // Log the activity
        const changes = [];
        if (updateStatus !== serviceData.status) changes.push(`Status: ${serviceData.status} → ${updateStatus}`);
        if (updateTechnician !== serviceData.technician) changes.push(`Technician: ${serviceData.technician || "Unassigned"} → ${updateTechnician}`);
        if (updateTechnicianDiagnosis !== serviceData.technicianDiagnosis) changes.push("Updated diagnosis");
        if (updateSuggestedRepair !== serviceData.suggestedRepair) changes.push("Updated suggested repair");
        if (partsUsed) changes.push(`Parts used: ${partsUsed}`);
        if (actualCost > 0) changes.push(`Actual cost: ₱${actualCost}`);
        
        if (changes.length > 0) {
          const logResult = await logActivity({
            serviceId: serviceId,
            username: username,
            role: userRole,
            activity: `Service updated: ${changes.join(", ")}`
          });
          console.log("Activity log result:", logResult);
        }

        toast({
          title: "Success",
          description: "Service information updated successfully",
        });
        // Refresh the data
        handleSearch();
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to update service information",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Update error:", error);
      toast({
        title: "Error",
        description: "Failed to update service information",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-center mb-8">
          <img src={logo} alt="AC Tech Repair PH" className="h-16 mr-4" />
          <div>
            <h1 className="text-3xl font-bold">AC Tech Repair PH</h1>
            <p className="text-muted-foreground">Service Update</p>
          </div>
        </div>

        <Button onClick={() => navigate("/technician-portal")} variant="outline" className="mb-6">
          Back to Technician Portal
        </Button>

        {/* Search Form */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="serviceId">Enter Service ID:</Label>
                <Input
                  id="serviceId"
                  placeholder="Enter service ID"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deviceType">Select Device Type:</Label>
                {!showOtherDeviceInput ? (
                  <Select
                    value={deviceType}
                    onValueChange={(value) => {
                      if (value === "Others") {
                        setShowOtherDeviceInput(true);
                        setDeviceType("");
                      } else {
                        setDeviceType(value);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select device type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mobile (iPhone)">Mobile (iPhone)</SelectItem>
                      <SelectItem value="Laptop (Mac)">Laptop (Mac)</SelectItem>
                      <SelectItem value="iPad">iPad</SelectItem>
                      <SelectItem value="Apple Watch">Apple Watch</SelectItem>
                      <SelectItem value="Mobile (Android)">Mobile (Android)</SelectItem>
                      <SelectItem value="Tablet (Android)">Tablet (Android)</SelectItem>
                      <SelectItem value="Laptop (Windows)">Laptop (Windows)</SelectItem>
                      <SelectItem value="Computer (iMac)">Computer (iMac)</SelectItem>
                      <SelectItem value="Desktop Computer (Windows)">Desktop Computer (Windows)</SelectItem>
                      <SelectItem value="Computer (Mac Mini)">Computer (Mac Mini)</SelectItem>
                      <SelectItem value="Drone">Drone</SelectItem>
                      <SelectItem value="Speakers">Speakers</SelectItem>
                      <SelectItem value="Gaming Consoles">Gaming Consoles</SelectItem>
                      <SelectItem value="Gaming Controllers">Gaming Controllers</SelectItem>
                      <SelectItem value="Headphones">Headphones</SelectItem>
                      <SelectItem value="Others">Others</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="deviceType"
                    placeholder="Enter device type"
                    value={deviceType}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDeviceType(value);
                      if (value === "") {
                        setShowOtherDeviceInput(false);
                      }
                    }}
                  />
                )}
              </div>
            </div>

            <Button onClick={handleSearch} disabled={isLoading} className="w-full mt-6">
              {isLoading ? "Searching..." : "Search Service"}
            </Button>
          </CardContent>
        </Card>

        {/* Service Details and Update Form */}
        {serviceData && (
          <div className="grid gap-8 md:grid-cols-2">
            {/* Client Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Client Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Status:</h3>
                  <p className="text-lg font-bold text-primary">{serviceData.status || "PENDING - APPROVAL"}</p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleViewPDF} variant="outline" className="flex-1">
                    <FileText className="mr-2 h-4 w-4" />
                    View PDF
                  </Button>
                  <Button onClick={handlePrintPDF} variant="outline" className="flex-1">
                    <Printer className="mr-2 h-4 w-4" />
                    Print PDF
                  </Button>
                </div>

                <Separator />

                <div className="grid gap-4">
                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Client Type:</h3>
                    <p className="text-lg">{serviceData.clientType || "N/A"}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Priority:</h3>
                    <p className="text-lg">{serviceData.priority || "N/A"}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Client Name:</h3>
                    <p className="text-lg">{serviceData.clientName}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Device Model:</h3>
                    <p className="text-lg">{serviceData.device}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Serial Number:</h3>
                    <p className="text-lg">{serviceData.serialNumber || "N/A"}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Memory & Color:</h3>
                    <p className="text-lg">{serviceData.colorMemory}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Service Date:</h3>
                    <p className="text-lg">
                      {serviceData.timestamp ? format(new Date(serviceData.timestamp), "MM/dd/yyyy, HH:mm") : "N/A"}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Time Frame:</h3>
                    <p className="text-lg">{serviceData.timeFrame || "N/A"}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Target Date:</h3>
                    <p className="text-lg">{serviceData.targetDate || "N/A"}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Device Notes:</h3>
                    <p className="text-lg">
                      {(() => {
                        const conditions: string[] = [];
                        const isYes = (value: any) => {
                          if (value === true || value === 1) return true;
                          const v = typeof value === "string" ? value.trim().toLowerCase() : value;
                          return v === "yes" || v === "true" || v === "y" || v === "✓" || v === "checked";
                        };
                        if (isYes(serviceData.dents)) conditions.push("Dents");
                        if (isYes(serviceData.scratches)) conditions.push("Scratches");
                        if (isYes(serviceData.missingParts)) conditions.push("Missing Parts");
                        if (isYes(serviceData.physicalDamage)) conditions.push("Physical Damage");
                        if (isYes(serviceData.importantFiles)) conditions.push("Important Files");
                        if (isYes(serviceData.noPower)) conditions.push("No Power");
                        if (isYes(serviceData.repairHistory)) conditions.push("Repair History");
                        return conditions.length > 0 ? conditions.join(", ") : "N/A";
                      })()}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Chief Complaint:</h3>
                    <p className="text-lg whitespace-pre-line">{serviceData.chiefComplaint || "N/A"}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Service/s:</h3>
                    <p className="text-lg whitespace-pre-line">{serviceData.service}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Service Cost:</h3>
                    <p className="text-lg font-semibold">Php {serviceData.serviceCost}</p>
                  </div>

                  {serviceData.technician && (
                    <div>
                      <h3 className="font-semibold text-sm text-muted-foreground mb-1">Technician:</h3>
                      <p className="text-lg">{serviceData.technician}</p>
                    </div>
                  )}

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Admin Notes (Internal):</h3>
                    <p className="text-lg">{serviceData.adminNotesInternal?.trim() ? serviceData.adminNotesInternal : "N/A"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Service Update */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Service Update</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="technician">Assigned Technician:</Label>
                  <Select value={updateTechnician} onValueChange={setUpdateTechnician}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select technician" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {technicians.map((tech) => (
                        <SelectItem key={tech.name} value={tech.name}>
                          {tech.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status:</Label>
                  <Select value={updateStatus} onValueChange={setUpdateStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending Diagnosis">Pending Diagnosis</SelectItem>
                      <SelectItem value="Pending - Approval">Pending - Approval</SelectItem>
                      <SelectItem value="Ongoing Service">Ongoing Service</SelectItem>
                      <SelectItem value="Complete - Approval">Complete - Approval</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="On Hold">On Hold</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="technicianDiagnosis">Technician Diagnosis:</Label>
                  <Textarea
                    id="technicianDiagnosis"
                    placeholder="Enter technician diagnosis"
                    value={updateTechnicianDiagnosis}
                    onChange={(e) => setUpdateTechnicianDiagnosis(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="suggestedRepair">Suggested Repair:</Label>
                  <Textarea
                    id="suggestedRepair"
                    placeholder="Enter suggested repair"
                    value={updateSuggestedRepair}
                    onChange={(e) => setUpdateSuggestedRepair(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="technicianNotesCustomer">Technician Notes (Customer):</Label>
                  <Textarea
                    id="technicianNotesCustomer"
                    placeholder="Enter technician notes for customer"
                    value={updateTechnicianNotesCustomer}
                    onChange={(e) => setUpdateTechnicianNotesCustomer(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="technicianNotesInternal">Technician Notes (Internal):</Label>
                  <Textarea
                    id="technicianNotesInternal"
                    placeholder="Enter internal technician notes"
                    value={updateTechnicianNotesInternal}
                    onChange={(e) => setUpdateTechnicianNotesInternal(e.target.value)}
                    rows={4}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    <Label className="text-lg font-semibold">Parts Used from Inventory</Label>
                  </div>
                  
                  {inventory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No inventory items available</p>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto border rounded-md p-3">
                      {inventory.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                          <div className="flex-1">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">
                              ₱{item.cost} • Stock: {item.quantity}
                            </p>
                          </div>
                          <Input
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={selectedParts[item.id] || 0}
                            onChange={(e) => {
                              const qty = Math.min(parseInt(e.target.value) || 0, item.quantity);
                              setSelectedParts(prev => ({
                                ...prev,
                                [item.id]: qty
                              }));
                            }}
                            className="w-20"
                            placeholder="Qty"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                    <span className="font-semibold">Total Actual Cost:</span>
                    <span className="text-lg font-bold">₱{calculateActualCost().toLocaleString()}</span>
                  </div>
                </div>

                <Button onClick={handleUpdate} disabled={isUpdating} className="w-full">
                  {isUpdating ? "Updating..." : "Update"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">powered by Stack&Scale</div>
      </div>
    </div>
  );
};

export default ServiceUpdate;
