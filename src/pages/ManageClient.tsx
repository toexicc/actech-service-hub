import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
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
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { generateServicePDF } from "@/lib/pdfGenerator";
import { generateQuotationPDF } from "@/lib/quotationPdfGenerator";
import { logActivity } from "@/lib/activityLogger";
import { notifyServiceStatusChange, notifyNewServiceAssignment } from "@/lib/serviceNotifications";
import { DeviceReportViewer } from "@/components/DeviceReportViewer";
import { FileText, RefreshCw } from "lucide-react";
import logo from "@/assets/S_S_Marketing-2.png";
import { normalizeGoogleDrivePdfUrl, cn } from "@/lib/utils";
import { STATUS_OPTIONS, TIME_FRAME_OPTIONS, PRIORITY_OPTIONS, DEVICE_TYPES_BY_DEPARTMENT, DEVICE_TYPES } from "@/lib/constants";
import { handleError, withErrorHandling } from "@/lib/errorHandling";
import { sanitizeInput, sanitizeNumber, isValidServiceId } from "@/lib/validation";
import { MultiSelect } from "@/components/ui/multi-select";
import { useTechnicians } from "@/hooks/useStaff";

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
  const [searchParams] = useSearchParams();
  const [serviceId, setServiceId] = useState("");
  const [serviceData, setServiceData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingClientInfo, setIsUpdatingClientInfo] = useState(false);
  const [isUpdatingForm, setIsUpdatingForm] = useState(false);
  const [isUpdatingQuotation, setIsUpdatingQuotation] = useState(false);
  const [rawDiagnosis, setRawDiagnosis] = useState("");
  const [isFormattingAI, setIsFormattingAI] = useState(false);
  const [isEditingAIDiagnosis, setIsEditingAIDiagnosis] = useState(false);
  const [openAIKey, setOpenAIKey] = useState(() => localStorage.getItem('actech_openai_key') || '');
  const [technicianReport, setTechnicianReport] = useState("");
  const [updateServiceReport, setUpdateServiceReport] = useState("");
  const [isFormattingReport, setIsFormattingReport] = useState(false);
  const [isEditingServiceReport, setIsEditingServiceReport] = useState(false);
  const [isDiagnosisOpen, setIsDiagnosisOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [showOtherDeviceInput, setShowOtherDeviceInput] = useState(false);
  const [originalCustomDeviceType, setOriginalCustomDeviceType] = useState("");
  const { toast } = useToast();

  // Use React Query for technicians
  const { data: technicianData = [] } = useTechnicians();
  
  // Derive technicians list with display names
  const technicians = useMemo(() => {
    return technicianData.map((staff) => ({
      name: staff.name,
      department: staff.department || "",
      displayName: `${staff.name} - ${staff.department || ""}`,
    }));
  }, [technicianData]);

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
  const [updateDeviceType, setUpdateDeviceType] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [discountType, setDiscountType] = useState<"percentage" | "amount">("amount"); // Default to amount
  const [discountValue, setDiscountValue] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [finalCost, setFinalCost] = useState(0);

  const fetchApiKey = async () => {
    try {
      const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getApiKey`);
      const data = await response.json();
      if (data.status === "success" && data.apiKey) {
        setOpenAIKey(data.apiKey);
        localStorage.setItem('actech_openai_key', data.apiKey);
      }
    } catch (error) {
      console.error("Error fetching API key:", error);
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
  
  useEffect(() => {
    fetchApiKey();
  }, []);

  // Handle serviceId from URL params (from Service Tracker redirect)
  useEffect(() => {
    const urlServiceId = searchParams.get("serviceId");
    if (urlServiceId) {
      setServiceId(urlServiceId);
      // Auto-search after setting the service ID
      const autoSearch = async () => {
        setIsLoading(true);
        try {
          const response = await fetch(
            `${GOOGLE_SHEETS_SCRIPT_URL}?action=searchService&serviceId=${urlServiceId}`,
          );
          const data = await response.json();

          if (data.status === "found") {
            setServiceData(data.data);
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
            setUpdateDeviceType(data.data.deviceType || "");
            const deviceType = data.data.deviceType || "";
            if (deviceType && !(DEVICE_TYPES as readonly string[]).includes(deviceType)) {
              setOriginalCustomDeviceType(deviceType);
            } else {
              setOriginalCustomDeviceType("");
            }
            setRawDiagnosis(data.data.technicianDiagnosis || "");
            setTechnicianReport(data.data.technicianReport || "");
            setUpdateServiceReport(data.data.aiReport || "");
            setIsEditingAIDiagnosis(false);
            setIsEditingServiceReport(false);
            
            const serviceCostNum = sanitizeNumber(String(data.data.serviceCost ?? "0"));
            const savedDiscountNum = sanitizeNumber(String(data.data.discount ?? "0"));
            const savedFinalCost = sanitizeNumber(String(data.data.finalCost ?? "0"));
            
            setDiscountAmount(savedDiscountNum);
            setDiscountValue(savedDiscountNum > 0 ? savedDiscountNum.toString() : "");
            setDiscountType("amount");
            
            if (savedFinalCost > 0) {
              setFinalCost(savedFinalCost);
            } else {
              setFinalCost(Math.max(0, serviceCostNum - savedDiscountNum));
            }
            
            toast({
              title: "Service Loaded",
              description: `Service ${urlServiceId} loaded successfully`,
            });
          } else {
            toast({
              title: "Not Found",
              description: "No service found with the provided ID",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Error auto-searching service:", error);
        } finally {
          setIsLoading(false);
        }
      };
      autoSearch();
    }
  }, [searchParams]);
  
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
        // Service data loaded successfully
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
        setUpdateDeviceType(data.data.deviceType || "");
        // Store original custom device type if it's not in the predefined list
        const deviceType = data.data.deviceType || "";
        if (deviceType && !(DEVICE_TYPES as readonly string[]).includes(deviceType)) {
          setOriginalCustomDeviceType(deviceType);
        } else {
          setOriginalCustomDeviceType("");
        }
        setRawDiagnosis(data.data.technicianDiagnosis || ""); // Column AE - raw diagnosis
        setTechnicianReport(data.data.technicianReport || ""); // Column BA - technician report
        setUpdateServiceReport(data.data.aiReport || ""); // Column BB - AI formatted service report
        setIsEditingAIDiagnosis(false); // Reset edit mode when loading new service
        setIsEditingServiceReport(false);
        
        // Load discount and final cost data from sheet (values may be formatted like 25,000.00)
        const serviceCostNum = sanitizeNumber(String(data.data.serviceCost ?? "0"));
        const savedDiscountNum = sanitizeNumber(String(data.data.discount ?? "0"));
        const savedFinalCost = sanitizeNumber(String(data.data.finalCost ?? "0"));
        
        // Cost values parsed successfully
        
        // Set discount values
        setDiscountAmount(savedDiscountNum);
        setDiscountValue(savedDiscountNum > 0 ? savedDiscountNum.toString() : "");
        setDiscountType("amount");
        
        // Use final cost from sheet if available, otherwise calculate
        if (savedFinalCost > 0) {
          setFinalCost(savedFinalCost);
        } else {
          setFinalCost(Math.max(0, serviceCostNum - savedDiscountNum));
        }
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

    setIsFormattingAI(true);
    try {
      const params = new URLSearchParams({
        action: 'formatDiagnosis',
        rawDiagnosis,
        customerName: serviceData?.clientName || '',
        deviceType: serviceData?.deviceType || '',
        model: serviceData?.device || '',
        serviceId: serviceId,
        technician: updateTechnician || serviceData?.technician || '',
        finalCost: serviceData?.finalCost || updateServiceCost || serviceData?.serviceCost || '0',
      });

      const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to format diagnosis (status ${response.status})`);
      }

      const data = await response.json();
      
      if (data.error) {
        if (data.error.includes("rate limit")) {
          toast({
            title: "Rate Limit Reached",
            description: "AI service rate limit reached. Please wait and try again.",
            variant: "destructive",
          });
          return;
        }
        if (data.error.includes("API key")) {
          toast({
            title: "Invalid API Key",
            description: "OpenAI API key is invalid or missing. Please contact admin.",
            variant: "destructive",
          });
          return;
        }
        if (data.error.includes("quota")) {
          toast({
            title: "API Quota Exceeded",
            description: "AI service quota exceeded. Please contact admin.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(data.error);
      }

      const formattedDiagnosis = data.formattedDiagnosis;

      if (formattedDiagnosis) {
        setUpdateAIDiagnosis(formattedDiagnosis);
        setIsEditingAIDiagnosis(false);
        toast({
          title: "Success",
          description: "AI formatting complete! Click 'Edit' to modify or 'Approve' to use.",
        });
      } else {
        throw new Error("No formatted diagnosis received from AI service");
      }
    } catch (error: any) {
      console.error("Error formatting diagnosis:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to format diagnosis with AI.",
        variant: "destructive",
      });
    } finally {
      setIsFormattingAI(false);
    }
  };

  const handleFormatReportWithAI = async () => {
    if (!technicianReport?.trim()) {
      toast({
        title: "No Technician Report",
        description: "No technician report data found (Column BA)",
        variant: "destructive",
      });
      return;
    }

    setIsFormattingReport(true);
    try {
      const params = new URLSearchParams({
        action: 'formatReport',
        technicianReport,
        customerName: serviceData?.clientName || '',
        deviceType: serviceData?.deviceType || '',
        model: serviceData?.device || '',
        serviceId: serviceId,
        technician: serviceData?.technician || updateTechnician || '',
        finalCost: serviceData?.finalCost || updateServiceCost || serviceData?.serviceCost || '0',
      });

      const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to format report (status ${response.status})`);
      }

      const data = await response.json();
      
      if (data.error) {
        if (data.error.includes("rate limit")) {
          toast({
            title: "Rate Limit Reached",
            description: "AI service rate limit reached. Please wait and try again.",
            variant: "destructive",
          });
          return;
        }
        if (data.error.includes("API key")) {
          toast({
            title: "Invalid API Key",
            description: "OpenAI API key is invalid or missing. Please contact admin.",
            variant: "destructive",
          });
          return;
        }
        if (data.error.includes("quota")) {
          toast({
            title: "API Quota Exceeded",
            description: "AI service quota exceeded. Please contact admin.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(data.error);
      }

      const formattedReport = data.formattedReport;

      if (formattedReport) {
        setUpdateServiceReport(formattedReport);
        setIsEditingServiceReport(false);
        toast({
          title: "Success",
          description: "Service report formatted successfully!",
        });
      } else {
        throw new Error("No formatted report received from AI service");
      }
    } catch (error: any) {
      console.error("Error formatting service report:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to format service report with AI.",
        variant: "destructive",
      });
    } finally {
      setIsFormattingReport(false);
    }
  };

  const handleUpdate = async () => {
    if (!serviceData) return;

    // Prevent multiple simultaneous updates
    if (isUpdatingClientInfo) return;

    setIsUpdatingClientInfo(true);
    try {
      const formData = new FormData();
      formData.append("action", "updateService");
      formData.append("serviceId", serviceId);
      formData.append("deviceType", updateDeviceType);
      formData.append("Device Type", updateDeviceType);
      formData.append("status", updateStatus);
      formData.append("technician", updateTechnician);
      
      // Get ALL technicians' departments (keep duplicates so each technician's department is visible)
      const techNames = updateTechnician.split(", ").filter(Boolean);
      const techDept = techNames
        .map(name => technicians.find(t => t.name === name)?.department)
        .filter(Boolean)
        .join(", ");
      formData.append("technicianDepartment", techDept);
      formData.append("department", techDept);
      formData.append("Technician Department", techDept);
      formData.append("clientType", updateClientType);
      formData.append("priority", updatePriority);
      formData.append("aiDiagnosis", updateAIDiagnosis);
      formData.append("aiReport", updateServiceReport);
      formData.append("services", updateServices);
      formData.append("serviceCost", updateServiceCost);
      formData.append("discount", discountAmount.toString());
      formData.append("finalCost", finalCost.toString());
      formData.append("targetDate", updateTargetDate ? format(updateTargetDate, "MM-dd-yyyy") : "");
      formData.append("adminNotes", updateAdminNotes);
      formData.append("adminNotesInternal", updateAdminNotesInternal);
      formData.append("Serial", serviceData.serialNumber || "");
      formData.append("Client Name", serviceData.clientName || "");
      formData.append("Device Type", updateDeviceType || "");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

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
        if (serviceData.deviceType !== (serviceData.deviceType || "")) {
          const originalDeviceType = String(serviceData.deviceType || "");
          const newDeviceType = String(serviceData.deviceType || "");
          if (originalDeviceType !== newDeviceType) changes.push(`Device Type: ${originalDeviceType} → ${newDeviceType}`);
        }
        if (updateTechnician !== serviceData.technician) changes.push(`Technician: ${serviceData.technician || "Unassigned"} → ${updateTechnician}`);
        if (updateClientType !== serviceData.clientType) changes.push(`Client type: ${serviceData.clientType || "N/A"} → ${updateClientType}`);
        if (updatePriority !== serviceData.priority) changes.push(`Priority: ${serviceData.priority || "N/A"} → ${updatePriority}`);
        if (updateAIDiagnosis !== serviceData.aiDiagnosis) changes.push("AI Diagnosis updated");
        if (updateServiceReport !== serviceData.aiReport) changes.push("AI Service Report updated");
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

        // Send notifications for status changes
        const userFullName = sessionStorage.getItem("userFullName") || username;
        const userRole = sessionStorage.getItem("userRole");
        if (updateStatus !== serviceData.status) {
          notifyServiceStatusChange(
            {
              serviceId,
              clientName: serviceData.clientName,
              technician: updateTechnician,
              adminRep: serviceData.adminRep,
              deviceType: updateDeviceType,
              device: serviceData.device,
            },
            serviceData.status,
            updateStatus,
            userFullName,
            userRole || undefined
          );
        }

        // Notify if technician changed
        if (updateTechnician !== serviceData.technician) {
          notifyNewServiceAssignment(
            {
              serviceId,
              clientName: serviceData.clientName,
              technician: updateTechnician,
              adminRep: serviceData.adminRep,
              deviceType: updateDeviceType,
              device: serviceData.device,
            },
            updateTechnician,
            userFullName
          );
        }

        toast({
          title: "Success",
          description: "Client information updated successfully",
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
      // Update failed - handle error
      const errorMessage = error instanceof Error && error.name === 'AbortError' 
        ? "Request timed out - your Google Script may be taking too long to process the update"
        : "Failed to update client information";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingClientInfo(false);
    }
  };

  const handleUpdateForm = async () => {
    if (!serviceData) return;

    setIsUpdatingForm(true);
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
      formData.append("action", "updateServicePDF");
      formData.append("serviceId", serviceId);
      formData.append("deviceType", serviceData.deviceType);
      formData.append("Serial", serviceData.serialNumber || "");
      formData.append("Client Name", serviceData.clientName || "");
      formData.append("Device Type", serviceData.deviceType || "");

      // Attach PDF using both multipart and base64 fallbacks
      formData.append("PDF", pdfBlob, updatedFileName);
      formData.append("PDF_Base64", pdfBase64);
      formData.append("PDF_FileName", updatedFileName);
      formData.append("PDF_MimeType", "application/pdf");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout for large PDF uploads

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const result = await response.json();

      if (result.result === "success") {
        const username = sessionStorage.getItem("username") || "Admin";
        const role = sessionStorage.getItem("userRole") || "admin";

        await logActivity({
          serviceId: serviceId,
          username: username,
          role: role,
          activity: "Client intake form regenerated with updated information",
        });

        toast({
          title: "Success",
          description: "Client intake form updated successfully",
        });
        // Refresh the data
        handleSearch();
      } else {
        toast({
          title: "Error",
          description: "Failed to update PDF form",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Update form error:", error);
      const errorMessage = error instanceof Error && error.name === 'AbortError' 
        ? "Request timed out - PDF generation may be taking too long"
        : "Failed to update PDF form";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingForm(false);
    }
  };

  const handleGenerateQuotation = async () => {
    if (!serviceData) return;

    setIsUpdatingQuotation(true);
    try {
      const [color, memory] = (serviceData.colorMemory || "").split("|").map((s) => s.trim());
      
      const quotationData = {
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
        technicianDiagnosis: updateAIDiagnosis || serviceData.aiDiagnosis || "N/A",
        serviceSummary: updateServices || serviceData.service || "N/A",
        serviceCost: updateServiceCost || serviceData.serviceCost || "0.00",
        partsUsed: serviceData.partsUsed || "N/A",
        discount: serviceData.discount || "0.00",
        totalCost: serviceData.finalCost || serviceData.serviceCost || "0.00",
        isUpdated: !!serviceData.quotationPdfUrl,
      };
      
      const pdfBlob = await generateQuotationPDF(quotationData);

      // Build filename with timestamp if updated
      const now = new Date();
      const tsForName = format(now, "MM-dd HH.mm");
      const safe = (s: string) => (s || "").replace(/[\\\/:*?"<>|]+/g, "_");
      const safeServiceId = safe(serviceId || "");
      const safeClient = safe(serviceData.clientName || "");
      const safeDevice = safe(serviceData.device || "");
      const fileName = serviceData.quotationPdfUrl 
        ? `${safeServiceId}_${safeClient}_${safeDevice} - QUOTATION UPDATED (${tsForName}).pdf`
        : `${safeServiceId}_${safeClient}_${safeDevice} - QUOTATION.pdf`;

      // Convert to base64
      const blobToBase64 = (blob: Blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      const pdfBase64 = await blobToBase64(pdfBlob);

      // Use Column AQ (clientFolderUrl) for quotation PDFs, NOT Column AV (deviceReportFolderUrl)
      // Using Column AQ (clientFolderUrl) for quotation PDFs

      const formData = new FormData();
      formData.append("action", "updateQuotationPDF");
      formData.append("serviceId", serviceId);
      formData.append("deviceType", serviceData.deviceType);
      formData.append("Serial", serviceData.serialNumber || "");
      formData.append("Client Name", serviceData.clientName || "");
      formData.append("Device Type", serviceData.deviceType || "");
      formData.append("ClientFolderUrl", serviceData.clientFolderUrl || ""); // Column AQ - folder location

      // Attach PDF - will be uploaded to client folder (AQ) and link stored in AG
      formData.append("QuotationPDF", pdfBlob, fileName);
      formData.append("QuotationPDF_Base64", pdfBase64);
      formData.append("QuotationPDF_FileName", fileName);
      formData.append("QuotationPDF_MimeType", "application/pdf");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const result = await response.json();

      if (result.result === "success") {
        const username = sessionStorage.getItem("username") || "Admin";
        const role = sessionStorage.getItem("userRole") || "admin";

        await logActivity({
          serviceId: serviceId,
          username: username,
          role: role,
          activity: serviceData.quotationPdfUrl 
            ? "Service quotation form updated" 
            : "Service quotation form generated",
        });

        toast({
          title: "Success",
          description: serviceData.quotationPdfUrl 
            ? "Service quotation form updated successfully" 
            : "Service quotation form generated successfully",
        });
        // Refresh the data
        handleSearch();
      } else {
        toast({
          title: "Error",
          description: "Failed to generate quotation form",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Quotation generation error:", error);
      const errorMessage = error instanceof Error && error.name === 'AbortError' 
        ? "Request timed out - PDF generation may be taking too long"
        : "Failed to generate quotation form";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingQuotation(false);
    }
  };

  const handleViewQuotationPDF = () => {
    if (!serviceData?.quotationPdfUrl) {
      toast({
        title: "No Quotation PDF Available",
        description: "Quotation PDF has not been generated yet",
        variant: "destructive",
      });
      return;
    }
    const url = normalizeGoogleDrivePdfUrl(serviceData.quotationPdfUrl, "preview");
    window.open(url, "_blank");
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 animate-fade-in">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Manage Client</h1>
          <p className="text-muted-foreground">View and update client information</p>
        </div>

        <div className="flex gap-3 mb-6">
          <Button 
            onClick={() => window.open("https://docs.google.com/spreadsheets/d/14aDQwwbLLS7FWNdcx-mChLjC-8pTV73UIScjt8HPnSc/edit?usp=sharing", "_blank")} 
            variant="outline"
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
                  <p className="text-lg font-bold text-primary">{serviceData.status || "Pending Diagnosis"}</p>
                </div>


                <Separator />

                <div>
                  <h3 className="font-semibold text-lg mb-3">Client Intake Form</h3>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleUpdateForm} 
                      variant="outline" 
                      className="flex-1" 
                      disabled={isUpdatingForm || serviceData.status !== "Pending Diagnosis"}
                    >
                      {isUpdatingForm ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Update Form
                        </>
                      )}
                    </Button>
                    <Button onClick={handleViewPDF} variant="outline" className="flex-1">
                      <FileText className="mr-2 h-4 w-4" />
                      View PDF
                    </Button>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-lg mb-3">Service Quotation Form</h3>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleGenerateQuotation} 
                      variant="outline" 
                      className="flex-1" 
                      disabled={isUpdatingQuotation || serviceData.status !== "Confirmed Diagnosis"}
                    >
                      {isUpdatingQuotation ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {serviceData.quotationPdfUrl ? "Updating..." : "Generating..."}
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          {serviceData.quotationPdfUrl ? "Update Form" : "Generate PDF"}
                        </>
                      )}
                    </Button>
                    <Button onClick={handleViewQuotationPDF} variant="outline" className="flex-1">
                      <FileText className="mr-2 h-4 w-4" />
                      View PDF
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
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Client ID:</h3>
                    <p className="text-lg">{serviceData.clientId || "N/A"}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Device Type:</h3>
                    <p className="text-lg">{serviceData.deviceType || "N/A"}</p>
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
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Service/s:</h3>
                    <p className="text-lg whitespace-pre-line">{serviceData.service}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Service Cost:</h3>
                    <p className="text-lg font-semibold">Php {serviceData.serviceCost}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Discount:</h3>
                    <p className="text-lg font-semibold">Php {serviceData.discount || "0.00"}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Final Cost:</h3>
                    <p className="text-lg font-semibold text-primary">Php {serviceData.finalCost || serviceData.serviceCost || "0.00"}</p>
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
                  <MultiSelect
                    options={(() => {
                      // Filter technicians based on device type
                      const deviceType = serviceData?.deviceType;
                      
                      // Check if device type is in the predefined list
                      const isPreDefinedDeviceType = deviceType && 
                        (DEVICE_TYPES as readonly string[]).includes(deviceType);
                      
                      // If no device type or custom device (not in predefined list), show all technicians
                      if (!deviceType || !isPreDefinedDeviceType) {
                        return technicians.map(tech => ({
                          label: tech.name,
                          value: tech.name,
                          group: tech.department
                        }));
                      }
                      
                      // Filter by department only for predefined device types
                      const filteredTechs = technicians.filter(tech => {
                        const deptDeviceTypes = DEVICE_TYPES_BY_DEPARTMENT[tech.department];
                        return deptDeviceTypes && deptDeviceTypes.includes(deviceType);
                      });
                      
                      return filteredTechs.map(tech => ({
                        label: tech.name,
                        value: tech.name,
                        group: tech.department
                      }));
                    })()}
                    selected={updateTechnician ? updateTechnician.split(", ") : []}
                    onChange={(values) => setUpdateTechnician(values.join(", "))}
                    placeholder="Select Technicians"
                    grouped
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deviceType">Device Type:</Label>
                  {showOtherDeviceInput ? (
                    <Input
                      value={updateDeviceType}
                      onChange={(e) => {
                        setUpdateDeviceType(e.target.value);
                      }}
                      placeholder="Enter custom device type"
                      onBlur={() => {
                        if (!updateDeviceType) {
                          setShowOtherDeviceInput(false);
                        }
                      }}
                    />
                  ) : (
                    <Select
                      value={updateDeviceType}
                      onValueChange={(value) => {
                        if (value === "Others") {
                          setShowOtherDeviceInput(true);
                          setUpdateDeviceType("");
                        } else {
                          setUpdateDeviceType(value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select device type" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const currentDeviceType = updateDeviceType.trim();

                          // Get selected technicians' departments
                          const selectedTechNames = updateTechnician?.split(", ").filter(Boolean) || [];
                          const selectedTechDepartments = selectedTechNames
                            .map((name) => technicians.find((t) => t.name === name)?.department)
                            .filter(Boolean) as string[];

                          // If no technicians selected, still show the saved device type (including custom ones)
                          if (selectedTechDepartments.length === 0) {
                            if (currentDeviceType) {
                              return (
                                <>
                                  <SelectItem value={currentDeviceType}>{currentDeviceType}</SelectItem>
                                  <SelectItem value="Others">Others</SelectItem>
                                  <SelectItem value="_disabled_hint" disabled>
                                    Select technician first to change device type
                                  </SelectItem>
                                </>
                              );
                            }

                            return (
                              <>
                                <SelectItem value="Others">Others</SelectItem>
                                <SelectItem value="_disabled_hint" disabled>
                                  Select technician first
                                </SelectItem>
                              </>
                            );
                          }

                          // Get available device types based on selected departments
                          let availableDeviceTypes = Array.from(
                            new Set(
                              selectedTechDepartments.flatMap((dept) =>
                                DEVICE_TYPES_BY_DEPARTMENT[dept] || []
                              )
                            )
                          );

                          // Remove "Others" from the list if it exists (we'll add it at the end)
                          availableDeviceTypes = availableDeviceTypes.filter(type => type !== "Others");

                          // Ensure the currently saved device type is visible, even if it's custom
                          if (
                            currentDeviceType &&
                            !availableDeviceTypes.includes(currentDeviceType) &&
                            currentDeviceType !== "Others"
                          ) {
                            availableDeviceTypes = [currentDeviceType, ...availableDeviceTypes];
                          }
                          
                          // Also ensure the original custom device type is always available
                          if (
                            originalCustomDeviceType &&
                            !availableDeviceTypes.includes(originalCustomDeviceType) &&
                            originalCustomDeviceType !== "Others"
                          ) {
                            availableDeviceTypes = [originalCustomDeviceType, ...availableDeviceTypes];
                          }

                          if (availableDeviceTypes.length === 0) {
                            return (
                              <>
                                <SelectItem value="Others">Others</SelectItem>
                                <SelectItem value="_disabled_hint" disabled>
                                  No device types available for selected technicians
                                </SelectItem>
                              </>
                            );
                          }

                          return (
                            <>
                              {availableDeviceTypes.map((deviceType) => (
                                <SelectItem key={deviceType} value={deviceType}>
                                  {deviceType}
                                </SelectItem>
                              ))}
                              <SelectItem value="Others">Others</SelectItem>
                            </>
                          );
                        })()}
                      </SelectContent>
                    </Select>
                  )}
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
                      {PRIORITY_OPTIONS.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
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

                {/* Diagnosis Display - Only visible when status is "Confirmed Diagnosis" */}
                {serviceData?.status === "Confirmed Diagnosis" && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Collapsible open={isDiagnosisOpen} onOpenChange={setIsDiagnosisOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <span className="font-semibold">AI Diagnosis</span>
                          <span className="text-xs">{isDiagnosisOpen ? "▼" : "▶"}</span>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label htmlFor="aiDiagnosisDisplay">AI Diagnosis (Column AF):</Label>
                          <div className="flex gap-2 mb-2">
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
                              onClick={() => setIsEditingAIDiagnosis(!isEditingAIDiagnosis)}
                            >
                              {isEditingAIDiagnosis ? "Lock" : "Edit"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                const summaryMatch = updateAIDiagnosis.match(
                                  /SUMMARY:\s*(.+?)(?=\n|$)/i
                                );
                                
                                if (summaryMatch && summaryMatch[1]) {
                                  setUpdateServices(summaryMatch[1].trim());
                                  toast({ title: "Summary copied to Service/s" });
                                } else {
                                  toast({ 
                                    title: "Error", 
                                    description: "Could not find 'SUMMARY' section in AI diagnosis",
                                    variant: "destructive"
                                  });
                                }
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              Approve
                            </Button>
                          </div>
                          <Textarea
                            id="aiDiagnosisDisplay"
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
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}

                {/* Report Display - Only visible when status is "Done Repair - For Release" */}
                {serviceData?.status === "Done Repair - For Release" && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Collapsible open={isReportOpen} onOpenChange={setIsReportOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <span className="font-semibold">AI Report</span>
                          <span className="text-xs">{isReportOpen ? "▼" : "▶"}</span>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label htmlFor="aiReportDisplay">AI Service Report (Column BB):</Label>
                          <div className="flex gap-2 mb-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(updateServiceReport);
                                toast({ title: "Copied to clipboard" });
                              }}
                            >
                              Copy
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setIsEditingServiceReport(!isEditingServiceReport)}
                            >
                              {isEditingServiceReport ? "Lock" : "Edit"}
                            </Button>
                          </div>
                          <Textarea
                            id="aiReportDisplay"
                            placeholder="AI Service Report from Column BB"
                            value={updateServiceReport}
                            onChange={(e) => setUpdateServiceReport(e.target.value)}
                            disabled={!isEditingServiceReport}
                            className={cn(
                              "min-h-[100px] resize-none",
                              !isEditingServiceReport && "bg-muted cursor-not-allowed opacity-75"
                            )}
                            style={{ 
                              minHeight: '100px',
                              height: `${Math.max(100, (updateServiceReport.split('\n').length + 1) * 24)}px`
                            }}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}

                {/* Device Report - Proof (Google Drive Folder with photo previews) */}
                {serviceData?.status === "Done Repair - For Release" && serviceData?.deviceReportFolderUrl && (
                  <DeviceReportViewer 
                    folderUrl={serviceData.deviceReportFolderUrl}
                    serviceId={serviceId}
                  />
                )}

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
                    onChange={(e) => {
                      const cost = e.target.value;
                      setUpdateServiceCost(cost);
                      const costNum = sanitizeNumber(cost);
                      
                      // Recalculate discount and final cost
                      let discount = 0;
                      if (discountType === "percentage") {
                        const percent = parseFloat(discountValue) || 0;
                        discount = (costNum * percent) / 100;
                      } else {
                        discount = parseFloat(discountValue) || 0;
                      }
                      setDiscountAmount(discount);
                      setFinalCost(costNum - discount);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Discount (Optional):</Label>
                  <div className="flex gap-2 mb-2">
                    <Button
                      type="button"
                      variant={discountType === "amount" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setDiscountType("amount");
                        setDiscountValue("");
                        setDiscountAmount(0);
                        setFinalCost(sanitizeNumber(updateServiceCost));
                      }}
                      className="flex-1"
                    >
                      Amount
                    </Button>
                    <Button
                      type="button"
                      variant={discountType === "percentage" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setDiscountType("percentage");
                        setDiscountValue("");
                        setDiscountAmount(0);
                        setFinalCost(sanitizeNumber(updateServiceCost));
                      }}
                      className="flex-1"
                    >
                      Percentage
                    </Button>
                  </div>
                  
                  <div className="flex gap-2 items-center">
                    <Input
                      placeholder={discountType === "percentage" ? "Enter %" : "Enter Amount"}
                      value={discountValue}
                      type="number"
                      min="0"
                      step={discountType === "percentage" ? "0.01" : "1"}
                      max={discountType === "percentage" ? "100" : undefined}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDiscountValue(value);
                        
                        const costNum = sanitizeNumber(updateServiceCost);
                        let discount = 0;
                        
                        if (discountType === "percentage") {
                          const percent = parseFloat(value) || 0;
                          discount = (costNum * percent) / 100;
                        } else {
                          discount = parseFloat(value) || 0;
                        }
                        
                        setDiscountAmount(discount);
                        setFinalCost(costNum - discount);
                      }}
                      className="flex-1"
                    />
                    {discountType === "percentage" && discountValue && (
                      <div className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                        = Php {discountAmount.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Final Cost:</Label>
                  <div className="text-2xl font-bold text-primary">
                    Php {finalCost.toFixed(2)}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeFrame">Time Frame:</Label>
                  <Select value={updateTimeFrame} onValueChange={setUpdateTimeFrame}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time frame" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_FRAME_OPTIONS.map(timeFrame => (
                        <SelectItem key={timeFrame} value={timeFrame}>{timeFrame}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

                <Button onClick={handleUpdate} disabled={isUpdatingClientInfo} className="w-full">
                  {isUpdatingClientInfo ? (
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
    </DashboardLayout>
  );
};

export default ManageClient;
