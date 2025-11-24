import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, parse } from "date-fns";
import { CalendarIcon, Eye, EyeOff, Loader2, ExternalLink } from "lucide-react";
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
import { STATUS_OPTIONS } from "@/lib/constants";

const parseDateMMDDYYYY = (value: string | undefined | null): Date | undefined => {
  if (!value) return undefined;
  try {
    const parsed = parse(value, "MM-dd-yyyy", new Date());
    return isNaN(parsed.getTime()) ? undefined : parsed;
  } catch {
    return undefined;
  }
};

const buildFallbackDiagnosis = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [
      "Issue Diagnosis:",
      "- Technician did not provide detailed notes.",
      "",
      "Recommended Service:",
      "- Please review device in person for an accurate estimate.",
      "",
      "Service Report:",
      "- No additional technical notes available.",
    ].join("\n");
  }

  return [
    "Issue Diagnosis:",
    `- ${trimmed}`,
    "",
    "Recommended Service:",
    "- See detailed service report below for specific parts and labor.",
    "",
    "Service Report:",
    `- Technician notes: ${trimmed}`,
  ].join("\n");
};

const ManageClient = () => {
  const navigate = useNavigate();
  const [serviceId, setServiceId] = useState("");
  const [serviceData, setServiceData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [technicians, setTechnicians] = useState<Array<{name: string, department: string, displayName: string}>>([]);
  const [rawDiagnosis, setRawDiagnosis] = useState("");
  const [isFormattingAI, setIsFormattingAI] = useState(false);
  const [isEditingAIDiagnosis, setIsEditingAIDiagnosis] = useState(false);
  const { toast } = useToast();

  // Update form fields
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateTechnician, setUpdateTechnician] = useState("");
  const [updateClientType, setUpdateClientType] = useState("");
  const [updatePriority, setUpdatePriority] = useState("");
  const [updateChiefComplaint, setUpdateChiefComplaint] = useState("");
  const [updateAIDiagnosis, setUpdateAIDiagnosis] = useState("");
  const [updateServices, setUpdateServices] = useState("");
  const [updateServiceCost, setUpdateServiceCost] = useState("");
  const [updateTimeFrame, setUpdateTimeFrame] = useState("");
  const [updateTargetDate, setUpdateTargetDate] = useState<Date | undefined>(undefined);
  const [updateAdminNotes, setUpdateAdminNotes] = useState("");
  const [updateAdminNotesInternal, setUpdateAdminNotesInternal] = useState("");
  const [updateTechDiagnosis, setUpdateTechDiagnosis] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const fetchTechnicianList = async () => {
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
        setUpdateClientType(data.data.clientType || "");
        setUpdatePriority(data.data.priority || "");
        setUpdateChiefComplaint(data.data.chiefComplaint || "");
        setUpdateAIDiagnosis(data.data.aiDiagnosis || "");
        setUpdateServices(data.data.service || "");
        setUpdateServiceCost(data.data.serviceCost || "");
        setUpdateTimeFrame(data.data.timeFrame || "");
        setUpdateTargetDate(parseDateMMDDYYYY(data.data.targetDate));
        setUpdateAdminNotes(data.data.adminNotes || "");
        setUpdateAdminNotesInternal(data.data.adminNotesInternal || "");
        setUpdateTechDiagnosis(data.data.technicianDiagnosis || "");
        setRawDiagnosis(data.data.technicianDiagnosis || ""); // Column AE - raw diagnosis
        setIsEditingAIDiagnosis(false); // Reset edit mode when loading new service
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

  const handleFormatWithAI = async () => {
    if (!rawDiagnosis?.trim()) {
      toast({
        title: "No Raw Diagnosis",
        description: "No raw diagnosis data found from the technician (Column AE)",
        variant: "destructive",
      });
      return;
    }

    // WARNING: Hardcoding API keys in frontend code is a security risk!
    // Anyone can view the source code and steal this key.
    // Consider using environment variables or backend secrets instead.
    const DEFAULT_OPENAI_KEY = "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";
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY || DEFAULT_OPENAI_KEY;

    // If no key is configured, fall back to basic formatter
    if (!apiKey || apiKey === "YOUR_OPENAI_API_KEY_HERE") {
      const fallback = buildFallbackDiagnosis(rawDiagnosis);
      setUpdateAIDiagnosis(fallback);
      setIsEditingAIDiagnosis(false);
      toast({
        title: "Formatted Without AI",
        description: "Using a basic formatter because no OpenAI key is configured.",
      });
      return;
    }

    setIsFormattingAI(true);
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5-mini-2025-08-07",
          messages: [
            {
              role: "system",
              content:
                "You are a technical diagnosis formatter for AC Tech Repair PH.\nFormat the following raw diagnosis from a technician into a clear, professional service report.\n\nStructure your response with these sections:\n1. **Issue Diagnosis**: Brief explanation of what's wrong with the device\n2. **Recommended Service**: List of specific services/repairs needed\n3. **Service Report**: Detailed technical notes and findings\n\nKeep language professional but customer-friendly. Be concise and actionable.\nUse bullet points where appropriate for clarity.",
            },
            {
              role: "user",
              content: `Raw diagnosis from technician:\n\n${rawDiagnosis}`,
            },
          ],
          max_completion_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          // Non-JSON error response
        }

        if (response.status === 429) {
          toast({
            title: "Rate Limit Reached",
            description: "OpenAI rate limit reached. Please wait and try again.",
            variant: "destructive",
          });
          return;
        }

        if (response.status === 401) {
          // Invalid or missing key in a deployed environment
          const fallback = buildFallbackDiagnosis(rawDiagnosis);
          setUpdateAIDiagnosis(fallback);
          setIsEditingAIDiagnosis(false);
          toast({
            title: "Invalid API Key",
            description:
              "OpenAI API key is invalid; using a basic non-AI formatter instead.",
            variant: "destructive",
          });
          return;
        }

        if (response.status === 402) {
          toast({
            title: "API Quota Exceeded",
            description: "OpenAI API quota exceeded. Please check your OpenAI account.",
            variant: "destructive",
          });
          return;
        }

        const message =
          errorData?.error?.message || `OpenAI API error (status ${response.status})`;
        throw new Error(message);
      }

      const data = await response.json();
      const formattedDiagnosis = data.choices?.[0]?.message?.content;

      if (formattedDiagnosis) {
        setUpdateAIDiagnosis(formattedDiagnosis);
        setIsEditingAIDiagnosis(false);
        toast({
          title: "Success",
          description:
            "AI formatting complete! Click 'Edit' to modify or 'Approve' to use.",
        });
      } else {
        throw new Error("No formatted diagnosis received from OpenAI");
      }
    } catch (error: any) {
      console.error("Error formatting diagnosis:", error);
      const fallback = buildFallbackDiagnosis(rawDiagnosis);
      setUpdateAIDiagnosis(fallback);
      setIsEditingAIDiagnosis(false);
      toast({
        title: "Error",
        description:
          error.message ||
          "AI formatting failed; using a basic non-AI formatter instead.",
        variant: "destructive",
      });
    } finally {
      setIsFormattingAI(false);
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
        deviceType: serviceData.deviceType || "",
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
      
      // Get technician department from the selected technician
      const selectedTech = technicians.find(t => t.name === updateTechnician);
      const techDept = selectedTech?.department || "";
      formData.append("technicianDepartment", techDept);
      // Also send as "department" for compatibility with some GAS scripts and alternative header
      formData.append("department", techDept);
      formData.append("Technician Department", techDept);
      formData.append("clientType", updateClientType);
      formData.append("priority", updatePriority);
      formData.append("aiDiagnosis", updateAIDiagnosis);
      formData.append("services", updateServices);
      formData.append("serviceCost", updateServiceCost); // Column AD
      formData.append("targetDate", updateTargetDate ? format(updateTargetDate, "MM-dd-yyyy") : "");
      formData.append("adminNotes", updateAdminNotes);
      formData.append("adminNotesInternal", updateAdminNotesInternal);
      // Provide extra fields some GAS scripts expect for naming
      formData.append("Serial", serviceData.serialNumber || "");
      formData.append("Client Name", serviceData.clientName || "");
      formData.append("Device Type", serviceData.deviceType || "");

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
        // Log only the fields that actually changed
        const username = sessionStorage.getItem("username") || "Admin";
        const role = sessionStorage.getItem("userRole") || "admin";
        const changes: string[] = [];

        if (updateStatus !== serviceData.status) changes.push(`Status: ${serviceData.status || "N/A"} → ${updateStatus}`);
        if (updateTechnician !== serviceData.technician) changes.push(`Technician: ${serviceData.technician || "Unassigned"} → ${updateTechnician}`);
        if (updateClientType !== serviceData.clientType) changes.push(`Client type: ${serviceData.clientType || "N/A"} → ${updateClientType}`);
        if (updatePriority !== serviceData.priority) changes.push(`Priority: ${serviceData.priority || "N/A"} → ${updatePriority}`);
        if (updateAIDiagnosis !== serviceData.aiDiagnosis) changes.push("AI Diagnosis updated");
        if (updateServices !== serviceData.service) changes.push(`Services: ${serviceData.service || "N/A"} → ${updateServices}`);
        const prevCost = String(serviceData.serviceCost || "");
        if (String(updateServiceCost || "") !== prevCost) changes.push(`Cost: ${prevCost || "0"} → ${updateServiceCost || "0"}`);
        const prevTarget = serviceData.targetDate || "";
        const newTarget = updateTargetDate ? format(updateTargetDate, "MM-dd-yyyy") : "";
        if (newTarget !== prevTarget) changes.push(`Target date: ${prevTarget || "N/A"} → ${newTarget || "N/A"}`);
        if (updateAdminNotes !== serviceData.adminNotes) changes.push("Admin notes updated");
        if (updateAdminNotesInternal !== serviceData.adminNotesInternal) changes.push("Internal notes updated");

        if (changes.length > 0) {
          await logActivity({
            serviceId: serviceId,
            username: username,
            role: role,
            activity: `Service updated: ${changes.join(", ")}`,
          });
        }

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
      <div className="container mx-auto p-4 sm:p-6 max-w-6xl w-full">
        {/* Header */}
        <div className="flex items-center justify-center mb-8">
          <img src={logo} alt="AC Tech Repair PH" className="h-16 mr-4" />
          <div>
            <h1 className="text-3xl font-bold">AC Tech Repair PH</h1>
            <p className="text-muted-foreground">Manage Client</p>
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          <Button onClick={() => navigate("/admin-portal")} variant="outline">
            Back to Admin Portal
          </Button>
          <Button 
            onClick={() => window.open("https://docs.google.com/spreadsheets/d/1gpCaFtFu3IrpUfYFTRGHwQQqfghWRki6WHzDU-0ikAg/edit?usp=sharing", "_blank")} 
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View Sheet
          </Button>
        </div>

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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                onFocus={(e) => {
                  if (!e.target.value) {
                    setServiceId("AC");
                    setTimeout(() => e.target.setSelectionRange(2, 2), 0);
                  }
                }}
              />
            </div>

            <Button onClick={handleSearch} disabled={isLoading} className="w-full mt-6">
              {isLoading ? "Searching..." : "Search Client"}
            </Button>
          </CardContent>
        </Card>

        {/* Service Details and Update Form */}
        {serviceData && (
          <div className="grid gap-4 sm:gap-8 grid-cols-1 lg:grid-cols-2">
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


                <Separator />

                <div>
                  <h3 className="font-semibold text-lg mb-3">Client Intake Form</h3>
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

                  {serviceData.devicePassword && (
                    <div>
                      <h3 className="font-semibold text-sm text-muted-foreground mb-1">Device Password:</h3>
                      <div className="flex items-center gap-2">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={serviceData.devicePassword}
                          readOnly
                          className="max-w-xs"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}

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
                      {STATUS_OPTIONS.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="technician">Technician:</Label>
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
                      {technicians.length > 0 ? (
                        Object.entries(
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="aiDiagnosis">AI Diagnosis:</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(updateAIDiagnosis);
                          toast({ title: "Copied to clipboard" });
                        }}
                      >
                        Copy
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleFormatWithAI}
                        disabled={!rawDiagnosis || isFormattingAI}
                      >
                        {isFormattingAI ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Formatting...
                          </>
                        ) : (
                          "Format with AI"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingAIDiagnosis(!isEditingAIDiagnosis)}
                      >
                        {isEditingAIDiagnosis ? "Lock" : "Edit"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUpdateServices(updateAIDiagnosis);
                          toast({ title: "AI Diagnosis approved and copied to Service/s" });
                        }}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="aiDiagnosis"
                    placeholder="AI Diagnosis from Column AF"
                    value={updateAIDiagnosis}
                    onChange={(e) => setUpdateAIDiagnosis(e.target.value)}
                    disabled={!isEditingAIDiagnosis}
                    className={cn(
                      "min-h-[100px] resize-none",
                      !isEditingAIDiagnosis && "bg-muted cursor-not-allowed opacity-75"
                    )}
                    style={{ 
                      minHeight: '100px',
                      height: `${Math.max(100, (updateAIDiagnosis.split('\n').length + 1) * 24)}px`
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="services">Service/s:</Label>
                  <Textarea
                    id="services"
                    placeholder="Enter service(s)"
                    value={updateServices}
                    onChange={(e) => setUpdateServices(e.target.value)}
                    className="min-h-[100px] resize-none"
                    style={{ 
                      minHeight: '100px',
                      height: `${Math.max(100, (updateServices.split('\n').length + 1) * 24)}px`
                    }}
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

export default ManageClient;
