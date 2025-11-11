import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { generateServicePDF } from "@/lib/pdfGenerator";
import { logActivity } from "@/lib/activityLogger";
import { FileText, Printer } from "lucide-react";
import logo from "@/assets/ac-tech-logo.jpg";
import { normalizeGoogleDrivePdfUrl, cn } from "@/lib/utils";

const ManageClient = () => {
  const navigate = useNavigate();
  const [serviceId, setServiceId] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [showOtherDeviceInput, setShowOtherDeviceInput] = useState(false);
  const [serviceData, setServiceData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [technicianList, setTechnicianList] = useState<string[]>([]);
  const { toast } = useToast();

  // Update form fields
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateTechnician, setUpdateTechnician] = useState("");
  const [updateClientType, setUpdateClientType] = useState("");
  const [updatePriority, setUpdatePriority] = useState("");
  const [updateChiefComplaint, setUpdateChiefComplaint] = useState("");
  const [updateServices, setUpdateServices] = useState("");
  const [updateServiceCost, setUpdateServiceCost] = useState("");
  const [updateTimeFrame, setUpdateTimeFrame] = useState("");
  const [updateTargetDate, setUpdateTargetDate] = useState<Date | undefined>(undefined);
  const [updateAdminNotes, setUpdateAdminNotes] = useState("");
  const [updateAdminNotesInternal, setUpdateAdminNotesInternal] = useState("");
  const [updateTechDiagnosis, setUpdateTechDiagnosis] = useState("");
  const [updateTechServiceBreakdown, setUpdateTechServiceBreakdown] = useState("");

  const fetchTechnicianList = async () => {
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=getStaffList`
      );
      const data = await response.json();
      
      if (data.status === "success") {
        const technicians = data.data
          .filter((staff: any) => staff.role === "Technician" && staff.status !== "Inactive")
          .map((staff: any) => staff.name);
        
        setTechnicianList(technicians);
      }
    } catch (error) {
      console.error("Error fetching technician list:", error);
    }
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
  
  useEffect(() => {
    fetchTechnicianList();
  }, []);
  
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
        setUpdateClientType(data.data.clientType || "");
        setUpdatePriority(data.data.priority || "");
        setUpdateChiefComplaint(data.data.chiefComplaint || "");
        setUpdateServices(data.data.service || "");
        setUpdateServiceCost(data.data.finalCost || data.data.serviceCost || "");
        setUpdateTimeFrame(data.data.timeFrame || "");
        setUpdateTargetDate(data.data.targetDate ? new Date(data.data.targetDate) : undefined);
        setUpdateAdminNotes(data.data.adminNotes || "");
        setUpdateAdminNotesInternal(data.data.adminNotesInternal || "");
        setUpdateTechDiagnosis(data.data.technicianDiagnosis || "");
        setUpdateTechServiceBreakdown(data.data.suggestedRepair || "");
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
      // Map service data to PDF format with updated fields
      const [color, memory] = (serviceData.colorMemory || " | ").split(" | ");
      
      const pdfData = {
        serviceId: serviceId,
        timestamp: serviceData.timestamp || format(new Date(), "MM-dd-yyyy, HH:mm"),
        adminRep: serviceData.adminRep || "Admin",
        technician: updateTechnician,
        clientType: updateClientType,
        priority: updatePriority,
        clientName: serviceData.clientName || "",
        username: serviceData.username || serviceData.clientName || "",
        phone: String(serviceData.phone || ""),
        email: serviceData.email || "",
        deviceType: serviceData.deviceType || deviceType,
        serial: serviceData.serialNumber || "",
        brand: serviceData.brand || "",
        color: color?.trim() || "",
        model: serviceData.device || "",
        memory: memory?.trim() || "",
        chiefComplaint: serviceData.chiefComplaint || "",
        dents: serviceData.dents === "Yes" || serviceData.dents === true,
        scratches: serviceData.scratches === "Yes" || serviceData.scratches === true,
        missingParts: serviceData.missingParts === "Yes" || serviceData.missingParts === true,
        physicalDamage: serviceData.physicalDamage === "Yes" || serviceData.physicalDamage === true,
        importantFiles: serviceData.importantFiles === "Yes" || serviceData.importantFiles === true,
        noPower: serviceData.noPower === "Yes" || serviceData.noPower === true,
        repairHistory: serviceData.repairHistory === "Yes" || serviceData.repairHistory === true,
        estimatedCost: parseFloat(updateServiceCost) || 0,
        timeFrame: updateTargetDate ? format(updateTargetDate, "MM-dd-yyyy") : "",
        isUpdated: true,
      };
      
      const pdfBlob = await generateServicePDF(pdfData);

      // Build updated filename with timestamp for new PDF version
      const now = new Date();
      const tsForName = format(now, "MM-dd HH.mm");
      const safe = (s: string) => (s || "").replace(/[\\\/:*?"<>|]+/g, "_");
      const safeServiceId = safe(serviceId || "");
      const safeClient = safe(serviceData.clientName || "");
      const safeDevice = safe(serviceData.device || "");
      const updatedFileName = `${safeServiceId}_${safeClient}_${safeDevice} - UPDATED (${tsForName}).pdf`;

      // Provide base64 alongside Blob for GAS compatibility
      const blobToBase64 = (blob: Blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      const pdfBase64 = await blobToBase64(pdfBlob);

      const formData = new FormData();
      formData.append("action", "updateService");
      formData.append("serviceId", serviceId);
      formData.append("deviceType", serviceData.deviceType); // Use actual device type from serviceData
      formData.append("status", updateStatus);
      formData.append("technician", updateTechnician);
      formData.append("clientType", updateClientType);
      formData.append("priority", updatePriority);
      formData.append("services", updateServices);
      formData.append("finalCost", updateServiceCost);
      formData.append("targetDate", updateTargetDate ? format(updateTargetDate, "MM-dd-yyyy") : "");
      formData.append("adminNotes", updateAdminNotes);
      formData.append("adminNotesInternal", updateAdminNotesInternal);
      // Provide extra fields some GAS scripts expect for naming
      formData.append("Serial", serviceData.serialNumber || "");
      formData.append("Client Name", serviceData.clientName || "");
      formData.append("Device Type", serviceData.deviceType || deviceType || "");

      // Attach PDF using both multipart and base64 fallbacks
      formData.append("PDF", pdfBlob, updatedFileName);
      formData.append("PDF_Base64", pdfBase64);
      formData.append("PDF_FileName", updatedFileName);
      formData.append("PDF_MimeType", "application/pdf");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const result = await response.json();

      if (result.result === "success") {
        // Log the activity
        const username = sessionStorage.getItem("username") || "Admin";
        const role = sessionStorage.getItem("userRole") || "admin";
        await logActivity({
          serviceId: serviceId,
          username: username,
          role: role,
          activity: `Updated service - Status: ${updateStatus}, Technician: ${updateTechnician}, Cost: ${updateServiceCost}`,
        });

        toast({
          title: "Success",
          description: "Client information and PDF updated successfully",
        });
        // Refresh the data
        handleSearch();
      } else {
        toast({
          title: "Error",
          description: "Failed to update client information",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Update error:", error);
      const errorMessage = error instanceof Error && error.name === 'AbortError' 
        ? "Request timed out - your Google Script may be taking too long to process the update"
        : "Failed to update client information";
      
      toast({
        title: "Error",
        description: errorMessage,
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
            <p className="text-muted-foreground">Manage Client</p>
          </div>
        </div>

        <Button onClick={() => navigate("/admin-portal")} variant="outline" className="mb-6">
          Back to Admin Portal
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
              {isLoading ? "Searching..." : "Search Client"}
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
                    <p className="text-lg">{serviceData.timestamp || "N/A"}</p>
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
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Tech Diagnosis:</h3>
                    <p className="text-lg whitespace-pre-line">{serviceData.technicianDiagnosis || "N/A"}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Tech Service Breakdown:</h3>
                    <p className="text-lg whitespace-pre-line">{serviceData.suggestedRepair || "N/A"}</p>
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
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Technician Notes (Internal):</h3>
                    <p className="text-lg">{serviceData.technicianNotesInternal?.trim() ? serviceData.technicianNotesInternal : "N/A"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Update Client Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Update Client Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  <Label htmlFor="technician">Technician:</Label>
                  <Select value={updateTechnician} onValueChange={setUpdateTechnician}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select technician" />
                    </SelectTrigger>
                    <SelectContent>
                      {technicianList.length > 0 ? (
                        technicianList.map((tech) => (
                          <SelectItem key={tech} value={tech}>
                            {tech}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="No Technicians" disabled>
                          No Technicians Available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientType">Client Type:</Label>
                  <Select value={updateClientType} onValueChange={setUpdateClientType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select client type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New Client">New Client</SelectItem>
                      <SelectItem value="Returning Client">Returning Client</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority:</Label>
                  <Select value={updatePriority} onValueChange={setUpdatePriority}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Rush (with 10% Rush Fee)">Rush (with 10% Rush Fee)</SelectItem>
                      <SelectItem value="Loyalty">Loyalty</SelectItem>
                      <SelectItem value="Walk-In">Walk-In</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chiefComplaint">Chief Complaint:</Label>
                  <Textarea
                    id="chiefComplaint"
                    placeholder="Enter chief complaint"
                    value={updateChiefComplaint}
                    onChange={(e) => setUpdateChiefComplaint(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="services">Service/s:</Label>
                  <Textarea
                    id="services"
                    placeholder="Enter service(s)"
                    value={updateServices}
                    onChange={(e) => setUpdateServices(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serviceCost">Service Cost:</Label>
                  <Input
                    id="serviceCost"
                    placeholder="Enter service cost"
                    value={updateServiceCost}
                    onChange={(e) => setUpdateServiceCost(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeFrame">Time Frame:</Label>
                  <Input
                    id="timeFrame"
                    placeholder="Enter time frame (e.g., 3-5 days)"
                    value={updateTimeFrame}
                    onChange={(e) => setUpdateTimeFrame(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetDate">Target Date:</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !updateTargetDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {updateTargetDate ? format(updateTargetDate, "MM-dd-yyyy") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={updateTargetDate}
                        onSelect={setUpdateTargetDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminNotes">Admin Notes (Customer):</Label>
                  <Textarea
                    id="adminNotes"
                    placeholder="Enter admin notes"
                    value={updateAdminNotes}
                    onChange={(e) => setUpdateAdminNotes(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminNotesInternal">Admin Notes (Internal):</Label>
                  <Textarea
                    id="adminNotesInternal"
                    placeholder="Enter internal admin notes"
                    value={updateAdminNotesInternal}
                    onChange={(e) => setUpdateAdminNotesInternal(e.target.value)}
                    rows={4}
                  />
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

export default ManageClient;
