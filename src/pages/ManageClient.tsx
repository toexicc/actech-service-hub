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
import { generateQuotationPDF } from "@/lib/quotationPdfGenerator";
import { logActivity } from "@/lib/activityLogger";
import { FileText, RefreshCw } from "lucide-react";
import logo from "@/assets/ac-tech-logo.jpg";
import { normalizeGoogleDrivePdfUrl, cn } from "@/lib/utils";
import { STATUS_OPTIONS, TIME_FRAME_OPTIONS } from "@/lib/constants";

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
  const [isUpdatingClientInfo, setIsUpdatingClientInfo] = useState(false); // Separate state for client info update
  const [isUpdatingForm, setIsUpdatingForm] = useState(false); // Separate state for form update
  const [isUpdatingQuotation, setIsUpdatingQuotation] = useState(false);
  const [technicians, setTechnicians] = useState<Array<{name: string, department: string, displayName: string}>>([]);
  const [rawDiagnosis, setRawDiagnosis] = useState("");
  const [isFormattingAI, setIsFormattingAI] = useState(false);
  const [isEditingAIDiagnosis, setIsEditingAIDiagnosis] = useState(false);
  const [openAIKey, setOpenAIKey] = useState(() => localStorage.getItem('actech_openai_key') || '');
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
  const [discountType, setDiscountType] = useState<"percentage" | "amount">("amount"); // Default to amount
  const [discountValue, setDiscountValue] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [finalCost, setFinalCost] = useState(0);

  const fetchAPIKeyFromSheet = async () => {
    try {
      const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getApiKey`);
      const data = await response.json();
      if (data.status === "success" && data.apiKey) {
        setOpenAIKey(data.apiKey);
        localStorage.setItem('actech_openai_key', data.apiKey);
      }
    } catch (error) {
      console.error("Error fetching API key from sheet:", error);
    }
  };

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
  
  useEffect(() => {
    fetchAPIKeyFromSheet();
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
        
        // Load discount data from Column AY
        const savedDiscount = parseFloat(data.data.discount || "0");
        if (savedDiscount > 0) {
          setDiscountAmount(savedDiscount);
          setDiscountValue(savedDiscount.toString());
          // Keep default as amount
          setDiscountType("amount");
        } else {
          setDiscountValue("");
          setDiscountAmount(0);
          setDiscountType("amount");
        }
        
        setFinalCost(parseFloat(data.data.finalCost || data.data.serviceCost || "0"));
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

    const apiKey = openAIKey.trim() || import.meta.env.VITE_OPENAI_API_KEY;

    // If no key is configured, fall back to basic formatter
    if (!apiKey) {
      const fallback = buildFallbackDiagnosis(rawDiagnosis);
      setUpdateAIDiagnosis(fallback);
      setIsEditingAIDiagnosis(false);
      toast({
        title: "Formatted Without AI",
        description: "Using a basic formatter because no OpenAI key is configured. Paste your key above to use AI.",
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
                "You are a professional technician at AC Tech Repair PH. Write a clear, concise diagnostic report in a formal quotation style.\n\nFormat your report using this EXACT structure:\n\nAC TECH DEVICE DIAGNOSIS\n\nFindings:\n[1-2 sentences - specific technical issues found]\n\nCause of Issue:\n[1 sentence - why it failed]\n\nSuggested Solution:\n[1-2 sentences - repair needed and outcome]\n\nRecommendations:\n[1 sentence - professional advice]\n\n---\n\nTo proceed with the service, please reply \"YES\" to confirm your approval and kindly review our Terms and Conditions: bit.ly/actech-termsnconditions\n\n---\n\nSUMMARY: [One clear sentence that condenses the Suggested Solution - state exactly what repair/service will be done]\n\nIMPORTANT RULES:\n- Be concise, professional, and customer-friendly\n- Maximum 1-2 sentences per section\n- Use technical terms but keep it understandable\n- NO emojis or special symbols\n- Do NOT include customer name, device, model, service ID, or technician\n- Do NOT include \"Customer Concern Reported\" section\n- Focus on clarity and professionalism\n- The SUMMARY must be a condensed version of the Suggested Solution\n- ALWAYS include the terms/conditions footer and summary exactly as shown above",
            },
            {
              role: "user",
              content: `Raw diagnosis from technician:\n\n${rawDiagnosis}`,
            },
          ],
          max_completion_tokens: 2500,
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
        // Build the complete diagnosis with customer info from serviceData (no emojis)
        const customerInfo = [
          `Customer Name: ${serviceData?.clientName || ''}`,
          `Device Type: ${serviceData?.deviceType || ''}`,
          `Model: ${serviceData?.device || ''}`,
          `Service ID: ${serviceId}`,
          `Technician: ${updateTechnician || 'Not assigned'}`,
          '',
          formattedDiagnosis
        ].join('\n');
        
        setUpdateAIDiagnosis(customerInfo);
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

    setIsUpdatingClientInfo(true);
    try {
      const formData = new FormData();
      formData.append("action", "updateService");
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
      formData.append("clientType", updateClientType);
      formData.append("priority", updatePriority);
      formData.append("aiDiagnosis", updateAIDiagnosis);
      formData.append("services", updateServices);
      formData.append("serviceCost", updateServiceCost);
      formData.append("discount", discountAmount.toString());
      formData.append("finalCost", finalCost.toString());
      formData.append("targetDate", updateTargetDate ? format(updateTargetDate, "MM-dd-yyyy") : "");
      formData.append("adminNotes", updateAdminNotes);
      formData.append("adminNotesInternal", updateAdminNotesInternal);
      formData.append("Serial", serviceData.serialNumber || "");
      formData.append("Client Name", serviceData.clientName || "");
      formData.append("Device Type", serviceData.deviceType || "");

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
      console.log("Quotation PDF Upload - Client Folder URL (Column AQ):", serviceData.clientFolderUrl);
      console.log("Quotation PDF Upload - Device Report Folder (Column AV):", serviceData.deviceReportFolderUrl);
      console.log("Quotation PDF Upload - Service ID:", serviceId);
      console.log("Quotation PDF Upload - File Name:", fileName);

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
                  <Label htmlFor="techDiagnosis">Technician Diagnosis:</Label>
                  <Textarea
                    id="techDiagnosis"
                    placeholder="Raw diagnosis from technician"
                    value={rawDiagnosis}
                    readOnly
                    className="min-h-[80px] resize-none bg-muted cursor-not-allowed opacity-75"
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
                        onClick={() => setIsEditingAIDiagnosis(!isEditingAIDiagnosis)}
                      >
                        {isEditingAIDiagnosis ? "Lock" : "Edit"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleFormatWithAI}
                        disabled={!rawDiagnosis || isFormattingAI}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
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
                        size="sm"
                        onClick={() => {
                          // Extract the SUMMARY line (without emoji)
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
                    onChange={(e) => {
                      const cost = e.target.value;
                      setUpdateServiceCost(cost);
                      const costNum = parseFloat(cost) || 0;
                      
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
                        setFinalCost(parseFloat(updateServiceCost) || 0);
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
                        setFinalCost(parseFloat(updateServiceCost) || 0);
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
                        
                        const costNum = parseFloat(updateServiceCost) || 0;
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
    </div>
  );
};

export default ManageClient;
