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
import { FileText, Printer, Package, Camera, Loader2 } from "lucide-react";
import { DeviceReportUpload } from "@/components/DeviceReportUpload";
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
  const [serviceData, setServiceData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [technicians, setTechnicians] = useState<Array<{name: string, department: string, displayName: string}>>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedParts, setSelectedParts] = useState<{[key: string]: number}>({});
  const [unmatchedParts, setUnmatchedParts] = useState<{[name: string]: number}>({});
  const [deviceReportPhotos, setDeviceReportPhotos] = useState<File[]>([]);
  const [existingDeviceReportPhotoUrls, setExistingDeviceReportPhotoUrls] = useState<string[]>([]);
  const { toast } = useToast();

  const username = sessionStorage.getItem("username") || "Unknown";
  const userRole = sessionStorage.getItem("userRole") || "Unknown";

  // Update form fields
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateTechnician, setUpdateTechnician] = useState("");
  const [updateTechnicianDiagnosis, setUpdateTechnicianDiagnosis] = useState("");
  const [updateSuggestedRepair, setUpdateSuggestedRepair] = useState("");
  const [updateTechnicianNotesInternal, setUpdateTechnicianNotesInternal] = useState("");

  useEffect(() => {
    fetchTechnicians();
    fetchInventory();
  }, []);

  // Parse existing parts when both service data and inventory are available
  useEffect(() => {
    if (serviceData && serviceData.partsUsed) {
      const partsMapById: {[key: string]: number} = {};
      const unmatched: {[name: string]: number} = {};
      
      const raw = String(serviceData.partsUsed);
      const items = raw.split(',').map((p: string) => p.trim()).filter(Boolean);
      items.forEach((partStr: string) => {
        const match = partStr.match(/^(.+?)\s*\((\d+)\)$/);
        if (!match) return;
        const partNameRaw = match[1].trim();
        const partName = partNameRaw.replace(/\s+/g, ' ').toLowerCase();
        const qty = parseInt(match[2]);
        
        // Try to find in inventory by case-insensitive name match
        const found = inventory.find(i => i.name.trim().toLowerCase() === partName);
        if (found) {
          partsMapById[found.id] = qty;
        } else {
          unmatched[partNameRaw] = qty;
        }
      });
      setSelectedParts(partsMapById);
      setUnmatchedParts(unmatched);
    } else {
      setSelectedParts({});
      setUnmatchedParts({});
    }
  }, [serviceData, inventory]);

  // Fallback: derive parts from recent activity logs if not present in record
  useEffect(() => {
    const run = async () => {
      if (!serviceData || serviceData.partsUsed) return;
      if (!serviceId) return;
      try {
        const res = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getServiceLogs&serviceId=${serviceId}&limit=50`);
        const json = await res.json();
        if (json.status === 'success' && Array.isArray(json.logs)) {
          const entry = json.logs.find((l: any) => typeof l.activity === 'string' && l.activity.includes('Parts used:'));
          if (entry) {
            const idx = entry.activity.indexOf('Parts used:');
            const raw = entry.activity.substring(idx + 'Parts used:'.length).trim();
            const items = raw.split(',').map((p: string) => p.trim()).filter(Boolean);
            const byId: {[k:string]:number} = {};
            const unmatched: {[k:string]:number} = {};
            items.forEach((partStr: string) => {
              const m = partStr.match(/^(.+?)\s*\((\d+)\)$/);
              if (!m) return;
              const nameRaw = m[1].trim();
              const qty = parseInt(m[2]);
              const item = inventory.find(i => i.name.trim().toLowerCase() === nameRaw.toLowerCase());
              if (item) byId[item.id] = qty; else unmatched[nameRaw] = qty;
            });
            setSelectedParts(byId);
            setUnmatchedParts(unmatched);
          }
        }
      } catch (e) {
        console.warn('Failed to derive parts from logs', e);
      }
    };
    run();
  }, [serviceData, serviceId, inventory]);

  const fetchTechnicians = async () => {
    try {
      const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getStaffList`);
      const data = await response.json();
      if (data.status === "success" && data.data) {
        const techList = data.data
          .filter((staff: any) => {
            const role = (staff.role ?? staff["Role"] ?? "").toString().trim();
            const status = (staff.status ?? staff["Status"] ?? "").toString().trim();
            return role === "Technician" && status === "Active";
          })
          .map((staff: any) => ({
            name: staff.name ?? staff["Name"] ?? "",
            department: staff.department ?? staff["Department"] ?? "",
            displayName: `${staff.name ?? staff["Name"] ?? ""} - ${staff.department ?? staff["Department"] ?? ""}`,
          }));
        setTechnicians(techList);
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
    const win = window.open(url, "_blank");
    if (win) {
      win.document.title = "Client Intake Form";
    }
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
      const html = `<!doctype html><html><head><title>Client Intake Form - Print</title><meta name="referrer" content="no-referrer"><style>html,body{margin:0;height:100%} iframe{border:0;width:100%;height:100%}</style></head><body><iframe src="${rawUrl}" onload="setTimeout(function(){ window.focus(); window.print(); }, 500)"></iframe></body></html>`;
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
    if (!serviceId) {
      toast({
        title: "Service ID Required",
        description: "Please enter a service ID",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=searchService&serviceId=${serviceId}`,
      );
      const data = await response.json();

      if (data.status === "found") {
        setServiceData(data.data);
        // Initialize update fields with current values
        setUpdateStatus(data.data.status || "");
        setUpdateTechnician(data.data.technician || "");
        setUpdateTechnicianDiagnosis(data.data.technicianDiagnosis || "");
        setUpdateSuggestedRepair(data.data.suggestedRepair || "");
        setUpdateTechnicianNotesInternal(data.data.technicianNotesInternal || "");
        
        // Load existing photos from Google Drive folder
        if (data.data.deviceReportFolderUrl) {
          await loadExistingPhotos(data.data.deviceReportFolderUrl);
        } else {
          setDeviceReportPhotos([]);
        }
      } else {
        toast({
          title: "Not Found",
          description: "No service found with the provided details",
          variant: "destructive",
        });
        setServiceData(null);
        setDeviceReportPhotos([]);
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

  const loadExistingPhotos = async (folderUrl: string) => {
    try {
      const folderId = extractFolderIdFromUrl(folderUrl);
      if (!folderId) {
        console.log("[UPDATE] No folderId extracted from URL", folderUrl);
        return;
      }

      console.log("[UPDATE] Fetching existing photos", { folderId, url: folderUrl });
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=getDeviceReportPhotos&folderId=${folderId}`
      );
      const data = await response.json();
      console.log("[UPDATE] Existing photos response", data);

      if (data.status === "success" && data.photos && data.photos.length > 0) {
        setExistingDeviceReportPhotoUrls(data.photos);
      }

    } catch (error) {
      console.error("Error loading existing photos:", error);
    }
  };

  const extractFolderIdFromUrl = (url: string): string | null => {
    const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const handleUpdate = async () => {
    if (!serviceData) return;

    setIsUpdating(true);
    try {
      const actualCost = calculateActualCost();
      const partsUsedArray = Object.entries(selectedParts)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, qty]) => {
          const item = inventory.find(i => i.id === itemId);
          return {
            id: itemId,
            name: item?.name || "Unknown",
            quantity: qty
          };
        });
      const unmatchedArray = Object.entries(unmatchedParts).map(([name, qty]) => ({ id: null as any, name, quantity: qty }));
      
      const partsUsed = [...partsUsedArray, ...unmatchedArray]
        .map(part => `${part.name} (${part.quantity})`)
        .join(", ");

      const formData = new FormData();
      formData.append("action", "updateTechnicianService");
      formData.append("serviceId", serviceId);
      formData.append("deviceType", serviceData.deviceType);
      formData.append("status", updateStatus);
      formData.append("technician", updateTechnician);
      
      // Get technician department from the selected technician
      const selectedTech = technicians.find(t => t.name === updateTechnician);
      const techDept = selectedTech?.department || "";
      formData.append("technicianDepartment", techDept);
      formData.append("department", techDept);
      formData.append("Technician Department", techDept);
      formData.append("technicianDiagnosis", updateTechnicianDiagnosis);
      formData.append("suggestedRepair", updateSuggestedRepair);
      formData.append("technicianNotesInternal", updateTechnicianNotesInternal);
      formData.append("actualCost", actualCost.toString());
      formData.append("partsUsed", partsUsed);
      formData.append("partsUsedData", JSON.stringify(partsUsedArray));
      formData.append("username", username);
      formData.append("userRole", userRole);

      // Convert Device Report photos to base64 (Google Apps Script doesn't support direct file uploads)
      const photoPromises = deviceReportPhotos.map(async (photo, index) => {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.readAsDataURL(photo);
        });
        formData.append(`DeviceReportPhoto${index + 1}`, base64);
        formData.append(`DeviceReportPhoto${index + 1}_Name`, photo.name);
      });
      
      await Promise.all(photoPromises);
      formData.append("DeviceReportPhotoCount", deviceReportPhotos.length.toString());

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
        if (deviceReportPhotos.length > 0) changes.push(`Added ${deviceReportPhotos.length} device report photo${deviceReportPhotos.length > 1 ? 's' : ''}`);
        
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
        // Clear selected parts and new photos
        setSelectedParts({});
        setDeviceReportPhotos([]);
        // Refresh the data to show updated photos
        handleSearch();
        fetchInventory();
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
            <div className="space-y-2">
              <Label htmlFor="serviceId">Enter Service ID:</Label>
              <Input
                id="serviceId"
                placeholder="Enter service ID"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
              />
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

                  {serviceData.annotationImageUrl && (
                    <div>
                      <h3 className="font-semibold text-sm text-muted-foreground mb-1">Device Annotation Photo:</h3>
                      <img 
                        src={serviceData.annotationImageUrl} 
                        alt="Device annotation" 
                        className="w-full rounded-lg border border-border mt-2"
                      />
                    </div>
                  )}

                  {serviceData.annotationNotes && (
                    <div>
                      <h3 className="font-semibold text-sm text-muted-foreground mb-1">Annotation Comment:</h3>
                      <p className="text-lg whitespace-pre-line">{serviceData.annotationNotes}</p>
                    </div>
                  )}

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
                  <Select value={updateTechnician} onValueChange={(value) => {
                    setUpdateTechnician(value);
                    // Auto-update department when technician changes
                    const selectedTech = technicians.find(t => t.name === value);
                    if (selectedTech?.department) {
                      // Department will be sent in the update
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select technician">
                        {updateTechnician && technicians.find(t => t.name === updateTechnician) && (
                          <div className="flex flex-col items-start">
                            <span>{updateTechnician}</span>
                            <span className="text-xs text-muted-foreground">
                              {technicians.find(t => t.name === updateTechnician)?.department}
                            </span>
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {Object.entries(
                        technicians.reduce((acc, tech) => {
                          if (!acc[tech.department]) acc[tech.department] = [];
                          acc[tech.department].push(tech);
                          return acc;
                        }, {} as Record<string, typeof technicians>)
                      ).map(([dept, techs]) => (
                        <div key={dept}>
                          <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground bg-muted/50">
                            {dept}
                          </div>
                          {techs.map((tech) => (
                            <SelectItem key={tech.name} value={tech.name}>
                              {tech.name}
                            </SelectItem>
                          ))}
                        </div>
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

                {/* Device Report Photo Upload */}
                <DeviceReportUpload 
                  photos={deviceReportPhotos}
                  onPhotosChange={setDeviceReportPhotos}
                  existingPhotoUrls={existingDeviceReportPhotoUrls}
                  onRemoveExistingPhoto={async (index) => {
                    const photoUrl = existingDeviceReportPhotoUrls[index];
                    try {
                      // Extract file ID from Google Drive URL
                      const idMatch =
                        photoUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
                        photoUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                      if (idMatch && serviceId) {
                        const fileId = idMatch[1];
                        const formData = new FormData();
                        formData.append("action", "deleteDeviceReportPhoto");
                        formData.append("serviceId", serviceId);
                        formData.append("fileId", fileId);

                        const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
                          method: "POST",
                          body: formData,
                        });

                        if (!response.ok) {
                          throw new Error("Failed to delete photo");
                        }
                      }
                      // Remove from local state
                      setExistingDeviceReportPhotoUrls((prev) =>
                        prev.filter((_, i) => i !== index)
                      );
                      
                      // Log photo removal activity
                      await logActivity({
                        serviceId: serviceId,
                        username: username,
                        role: userRole,
                        activity: "Device report photo removed"
                      });
                      
                      toast({
                        title: "Photo Deleted",
                        description: "Photo removed successfully",
                      });
                    } catch (error) {
                      console.error("Error deleting photo:", error);
                      toast({
                        title: "Error",
                        description: "Failed to delete photo",
                        variant: "destructive",
                      });
                    }
                  }}
                />

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    <Label className="text-lg font-semibold">Parts Used from Inventory</Label>
                  </div>
                  
                  {inventory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No inventory items available</p>
                  ) : (
                    <div className="space-y-3">
                      <Input
                        type="text"
                        placeholder="Search by Part ID or Name..."
                        className="w-full"
                        onChange={(e) => {
                          const search = e.target.value.toLowerCase();
                          const filtered = inventory.filter(item => 
                            item.id.toLowerCase().includes(search) || 
                            item.name.toLowerCase().includes(search)
                          );
                          // Just update display - we'll filter in the map below
                        }}
                      />
                      <div className="space-y-2 border rounded-md p-3 max-h-64 overflow-y-auto">
                        {inventory.map((item) => {
                          const qty = selectedParts[item.id] || 0;
                          if (qty === 0) return null; // Only show selected parts
                          return (
                            <div key={item.id} className="flex items-center justify-between gap-2 p-2 bg-muted rounded">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  ID: {item.id} • ₱{item.cost} • Stock: {item.quantity}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="1"
                                  max={item.quantity + qty}
                                  value={qty}
                                  onChange={(e) => {
                                    const newQty = Math.min(parseInt(e.target.value) || 0, item.quantity + qty);
                                    if (newQty > 0) {
                                      setSelectedParts(prev => ({
                                        ...prev,
                                        [item.id]: newQty
                                      }));
                                    }
                                  }}
                                  className="w-20"
                                  placeholder="Qty"
                                />
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedParts(prev => {
                                      const newParts = { ...prev };
                                      delete newParts[item.id];
                                      return newParts;
                                    });
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        {Object.keys(selectedParts).filter(id => selectedParts[id] > 0).length === 0 && Object.keys(unmatchedParts).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-2">No parts selected yet</p>
                        )}
                      </div>
                      
                      {Object.keys(unmatchedParts).length > 0 && (
                        <div className="space-y-2 border rounded-md p-3">
                          <Label className="text-sm">Unmatched parts from record:</Label>
                          <div className="space-y-2">
                            {Object.entries(unmatchedParts).map(([name, qty]) => (
                              <div key={name} className="flex items-center justify-between gap-2 p-2 bg-muted/40 rounded">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{name}</p>
                                  <p className="text-xs text-muted-foreground">Not found in current inventory</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min="1"
                                    value={qty}
                                    onChange={(e) => {
                                      const newQty = Math.max(1, parseInt(e.target.value) || 1);
                                      setUnmatchedParts(prev => ({ ...prev, [name]: newQty }));
                                    }}
                                    className="w-20"
                                  />
                                  <Select
                                    value=""
                                    onValueChange={(partId) => {
                                      setSelectedParts(prev => ({ ...prev, [partId]: qty }));
                                      setUnmatchedParts(prev => { const p = { ...prev }; delete p[name]; return p; });
                                    }}
                                  >
                                    <SelectTrigger className="min-w-[220px]">
                                      <SelectValue placeholder="Map to inventory item..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-background z-50">
                                      {inventory.map((item) => (
                                        <SelectItem key={item.id} value={item.id}>
                                          {item.name} (Stock: {item.quantity})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setUnmatchedParts(prev => { const p = { ...prev }; delete p[name]; return p; });
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label className="text-sm">Add Part:</Label>
                        <Select
                          value=""
                          onValueChange={(partId) => {
                            setSelectedParts(prev => ({
                              ...prev,
                              [partId]: 1
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select part to add..." />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            {inventory.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.id} - {item.name} (₱{item.cost}, Stock: {item.quantity})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                    <span className="font-semibold">Total Actual Cost:</span>
                    <span className="text-lg font-bold">₱{calculateActualCost().toLocaleString()}</span>
                  </div>
                </div>

                <Button onClick={handleUpdate} disabled={isUpdating} className="w-full">
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update"
                  )}
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
