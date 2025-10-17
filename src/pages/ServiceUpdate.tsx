import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { generateServicePDF } from "@/lib/pdfGenerator";
import { FileText, Printer } from "lucide-react";
import logo from "@/assets/ac-tech-logo.jpg";

const ServiceUpdate = () => {
  const navigate = useNavigate();
  const [serviceId, setServiceId] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [showOtherDeviceInput, setShowOtherDeviceInput] = useState(false);
  const [serviceData, setServiceData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  // Update form fields
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateTechnicianDiagnosis, setUpdateTechnicianDiagnosis] = useState("");
  const [updateSuggestedRepair, setUpdateSuggestedRepair] = useState("");
  const [updateTechnicianNotesCustomer, setUpdateTechnicianNotesCustomer] = useState("");
  const [updateTechnicianNotesInternal, setUpdateTechnicianNotesInternal] = useState("");

  const handleViewPDF = () => {
    console.log("PDF URL:", serviceData?.pdfUrl);
    console.log("Service Data:", serviceData);
    
    if (!serviceData?.pdfUrl || serviceData.pdfUrl.trim() === "") {
      toast({
        title: "No PDF Available",
        description: "No PDF file found for this service",
        variant: "destructive",
      });
      return;
    }

    window.open(serviceData.pdfUrl, '_blank');
  };

  const handlePrintPDF = () => {
    if (!serviceData?.pdfUrl) {
      toast({
        title: "No PDF Available",
        description: "No PDF file found for this service",
        variant: "destructive",
      });
      return;
    }

    const printWindow = window.open(serviceData.pdfUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
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
      // Generate updated PDF
      const isYes = (value: any) => {
        if (value === true || value === 1) return true;
        const v = typeof value === "string" ? value.trim().toLowerCase() : value;
        return v === "yes" || v === "true" || v === "y" || v === "✓" || v === "checked";
      };

      const pdfBlob = await generateServicePDF({
        serviceId: serviceId,
        timestamp: serviceData.timestamp ? format(new Date(serviceData.timestamp), "MM/dd/yyyy, HH:mm") : "",
        adminRep: serviceData.adminRep || "N/A",
        technician: serviceData.technician || "N/A",
        clientType: serviceData.clientType || "N/A",
        priority: serviceData.priority || "N/A",
        clientName: serviceData.clientName || "",
        username: serviceData.username || "N/A",
        phone: serviceData.phone || "N/A",
        email: serviceData.email || "N/A",
        deviceType: deviceType,
        serial: serviceData.serialNumber || "N/A",
        brand: serviceData.brand || "N/A",
        color: serviceData.color || serviceData.colorMemory || "N/A",
        model: serviceData.device || "",
        memory: serviceData.memory || serviceData.colorMemory || "N/A",
        chiefComplaint: serviceData.chiefComplaint || "N/A",
        dents: isYes(serviceData.dents),
        scratches: isYes(serviceData.scratches),
        missingParts: isYes(serviceData.missingParts),
        physicalDamage: isYes(serviceData.physicalDamage),
        importantFiles: isYes(serviceData.importantFiles),
        noPower: isYes(serviceData.noPower),
        repairHistory: isYes(serviceData.repairHistory),
        estimatedCost: Number(serviceData.serviceCost) || 0,
        timeFrame: serviceData.timeFrame || "N/A",
      });

      const formData = new FormData();
      formData.append("action", "updateTechnicianService");
      formData.append("serviceId", serviceId);
      formData.append("deviceType", deviceType);
      formData.append("status", updateStatus);
      formData.append("technicianDiagnosis", updateTechnicianDiagnosis);
      formData.append("suggestedRepair", updateSuggestedRepair);
      formData.append("technicianNotesCustomer", updateTechnicianNotesCustomer);
      formData.append("technicianNotesInternal", updateTechnicianNotesInternal);
      formData.append("PDF", pdfBlob, `${serviceId}_updated.pdf`);

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.result === "success") {
        toast({
          title: "Success",
          description: "Service information and PDF updated successfully",
        });
        // Refresh the data
        handleSearch();
      } else {
        toast({
          title: "Error",
          description: "Failed to update service information",
          variant: "destructive",
        });
      }
    } catch (error) {
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
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Target Date:</h3>
                    <p className="text-lg">{serviceData.timeFrame}</p>
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
                    <p className="text-lg">{serviceData.chiefComplaint || "N/A"}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Service/s:</h3>
                    <p className="text-lg">{serviceData.service}</p>
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
