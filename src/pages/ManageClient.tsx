import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { format, parse } from "date-fns";
import { displayDate } from "@/lib/timezone";
import { CalendarIcon, Eye, EyeOff, Loader2, ExternalLink, UserCog, Search, Pencil } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ServiceDetailsEditor } from "@/components/workspace/ServiceDetailsEditor";
import ApprovalRemarkBlock from "@/components/workspace/ApprovalRemarkBlock";
import { useStaffAvailability } from "@/hooks/useStaffAvailability";
import { useServiceLiveWatch } from "@/hooks/useServiceLiveWatch";
import { useIsTabActive } from "@/components/workbench/TabActiveContext";
import { RemoteUpdateBanner } from "@/components/workspace/RemoteUpdateBanner";


import { PageHeader } from "@/components/ui/page-header";
import { TicketWorkspaceHero } from "@/components/TicketWorkspaceHero";
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
import { supabase } from "@/integrations/supabase/client";
import { mapServiceRow } from "@/hooks/useServices";
import { mergeWithSupabase, mergeSupabaseOverSheet, supabaseRowToSheetShape } from "@/lib/serviceRecordShape";
import { formatDiagnosisWithAI, formatReportWithAI } from "@/lib/aiFormatters";
import { generateServicePDF } from "@/lib/pdfGenerator";
import { generateQuotationPDF } from "@/lib/quotationPdfGenerator";
import { uploadServicePdf, getServicePdfSignedUrl } from "@/lib/servicePdfStorage";
import { PdfViewerModal } from "@/components/PdfViewerModal";
import { logActivity } from "@/lib/activityLogger";
import { notifyServiceStatusChange, notifyNewServiceAssignment } from "@/lib/serviceNotifications";
import { createNotification } from "@/lib/notifications";
import { DeviceReportPhotos } from "@/components/DeviceReportPhotos";
import { DiagnosisPhotos } from "@/components/DiagnosisPhotos";
import { FileText, RefreshCw } from "lucide-react";
import logo from "@/assets/S_S_Marketing-2.png";
import { normalizeGoogleDrivePdfUrl, cn } from "@/lib/utils";
import { STATUS_OPTIONS, TIME_FRAME_OPTIONS, PRIORITY_OPTIONS, DEVICE_TYPES_BY_DEPARTMENT, DEVICE_TYPES } from "@/lib/constants";
import { handleError, withErrorHandling } from "@/lib/errorHandling";
import { sanitizeInput, sanitizeNumber, isValidServiceId } from "@/lib/validation";
import { MultiSelect } from "@/components/ui/multi-select";
import { useStaff, useTechnicians } from "@/hooks/useStaff";
import { preloadPdfAssets } from "@/lib/pdfAssets";
import { StatusProgressBar } from "@/components/StatusProgressBar";
import { TicketOverviewRow } from "@/components/workspace/TicketOverviewRow";
import { ActivityTimeline } from "@/components/workspace/ActivityTimeline";
import { getStatusGuidance } from "@/lib/serviceNotifications";



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

// Supabase-authoritative payload builders live in a shared module so
// /manage-client and /service-update behave identically.


const ManageClient = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [serviceId, setServiceId] = useState("");
  const [serviceData, setServiceData] = useState<any>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfModalUrl, setPdfModalUrl] = useState<string | null>(null);
  const [pdfModalTitle, setPdfModalTitle] = useState("Document");
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
  const { data: staffData = [] } = useStaff();
  const userRole = (sessionStorage.getItem("userRole") || "").toLowerCase();
  const canEditAdminRep = userRole === "admin" || userRole === "management";
  
  // Derive technicians list with display names
  const { data: availability } = useStaffAvailability();
  const [showUnavailableTechs, setShowUnavailableTechs] = useState(false);
  // Technicians who are absent (no Time In today) or on leave are hidden so they
  // don't get assigned. When no attendance exists yet for the day we only hide
  // staff on leave, otherwise the list would be empty.
  const technicians = useMemo(() => {
    return technicianData
      .filter((staff) => {
        if (showUnavailableTechs || !availability) return true;
        if (availability.isOnLeave(staff.name)) return false;
        if (!availability.hasAttendanceToday) return true;
        return availability.isAvailable(staff.name);
      })
      .map((staff) => ({
        name: staff.name,
        department: staff.department || "",
        displayName: `${staff.name} - ${staff.department || ""}`,
      }));
  }, [technicianData, availability, showUnavailableTechs]);


  const adminStaffOptions = useMemo(() => staffData
    .filter((staff) => {
      const role = staff.role?.trim().toLowerCase();
      return (role === "admin" || role === "management") && staff.status?.toLowerCase() !== "inactive";
    })
    .sort((a, b) => {
      const rank = (role?: string) => role?.trim().toLowerCase() === "admin" ? 0 : 1;
      const roleDiff = rank(a.role) - rank(b.role);
      return roleDiff || a.name.localeCompare(b.name);
    })
    .map((staff) => ({
      label: staff.name,
      value: staff.name,
      group: staff.role?.trim().toLowerCase() === "management" ? "Management" : "Admin",
    })), [staffData]);

  // Update form fields
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateAdminRep, setUpdateAdminRep] = useState("");
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
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isTogglingAutoApprove, setIsTogglingAutoApprove] = useState(false);
  const [isReopeningApproval, setIsReopeningApproval] = useState(false);

  /** Clear the partial-approval hold so the client can approve again on /track. */
  const handleReopenApproval = async () => {
    if (!serviceData?.serviceId || isReopeningApproval) return;
    setIsReopeningApproval(true);
    try {
      const { error } = await supabase
        .from("services")
        .update({ approval_locked: false, last_updated: new Date().toISOString() } as any)
        .eq("service_id", serviceData.serviceId);
      if (error) throw new Error(error.message);
      setServiceData((prev: any) => (prev ? { ...prev, approvalLocked: false } : prev));
      toast({ title: "Approval re-opened", description: "The client can approve again on the tracking page." });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Could not re-open approval.", variant: "destructive" });
    } finally {
      setIsReopeningApproval(false);
    }
  };

  const handleToggleAutoApprove = async (next: boolean) => {
    if (!serviceData?.serviceId || isTogglingAutoApprove) return;

    if (!next && serviceData.status && serviceData.status !== "Pending Diagnosis" && serviceData.status !== "Confirmed Diagnosis") {
      const confirmed = window.confirm(
        "This ticket is already past diagnosis. Turning pre-approval off means the client will need to approve the diagnosis again on the tracking page. Continue?",
      );
      if (!confirmed) return;
    }

    setIsTogglingAutoApprove(true);
    try {
      const { error } = await supabase
        .from("services")
        .update({
          auto_approve_diagnosis: next,
          ...(next ? {} : { client_approved_at: null }),
          last_updated: new Date().toISOString(),
        } as any)
        .eq("service_id", serviceData.serviceId);
      if (error) throw new Error(error.message);

      setServiceData((prev: any) => (prev ? { ...prev, autoApproveDiagnosis: next } : prev));
      if (!next && updateStatus === "Proceed Repair" && serviceData.status === "Confirmed Diagnosis") {
        setUpdateStatus("Waiting to Proceed");
      }

      await logActivity({
        serviceId: serviceData.serviceId,
        username: sessionStorage.getItem("userFullName") || sessionStorage.getItem("username") || "Admin",
        role: sessionStorage.getItem("userRole") || "admin",
        activity: next
          ? "Diagnosis pre-approval enabled (client approval skipped)"
          : "Diagnosis pre-approval disabled (client approval required)",
      });

      toast({
        title: next ? "Pre-approval enabled" : "Approval required",
        description: next
          ? "This ticket skips the client approval stage."
          : "The client must approve the diagnosis on the tracking page.",
      });
    } catch (e) {
      toast({
        title: "Update failed",
        description: e instanceof Error ? e.message : "Could not change the approval setting.",
        variant: "destructive",
      });
    } finally {
      setIsTogglingAutoApprove(false);
    }
  };


  const fetchApiKey = async () => {
    try {
      const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getApiKey`);
      const data = await response.json();
      if (data.status === "success" && data.apiKey) {
        setOpenAIKey(data.apiKey);
        localStorage.setItem('actech_openai_key', data.apiKey);
      }
    } catch {
      // Error fetching API key - ignore
    }
  };

  const handleViewPDF = async () => {
    const signed = serviceData?.serviceId
      ? await getServicePdfSignedUrl(serviceData.serviceId, "intake")
      : null;
    const url = signed || (serviceData?.pdfUrl ? normalizeGoogleDrivePdfUrl(serviceData.pdfUrl, "preview") : null);
    if (!url) {
      toast({ title: "No PDF Available", description: "PDF not found in storage", variant: "destructive" });
      return;
    }
    setPdfModalUrl(url);
    setPdfModalTitle("Client Intake Form");
    setPdfModalOpen(true);
  };
  
  useEffect(() => {
    fetchApiKey();
    // Preload PDF assets for faster generation
    preloadPdfAssets();
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
          let sheetData: any = {};
          let foundFromSheets = false;
          try {
            const response = await fetch(
              `${GOOGLE_SHEETS_SCRIPT_URL}?action=searchService&serviceId=${urlServiceId}`,
            );
            const data = await response.json();
            if (data.status === "found") {
              sheetData = data.data || {};
              foundFromSheets = true;
            }
          } catch {}

          const merged = await mergeWithSupabase(urlServiceId, sheetData);
          if (!foundFromSheets && (!merged || !merged.serviceId)) {
            toast({ title: "Not Found", description: "No service found with the provided ID", variant: "destructive" });
            return;
          }
          setServiceData(merged);
          setUpdateStatus(merged.status || "");
          setUpdateAdminRep(merged.adminRep || "");
          setUpdateTechnician(merged.technician || "");
          setUpdateClientType(merged.clientType || "");
          setUpdatePriority(merged.priority || "");
          setUpdateChiefComplaint(merged.chiefComplaint || "");
          setUpdateAIDiagnosis(merged.aiDiagnosis || "");
          setUpdateServices(merged.service || "");
          setUpdateServiceCost(merged.serviceCost || "");
          setUpdateTimeFrame(merged.timeFrame || "");
          setUpdateTargetDate(parseDateMMDDYYYY(merged.targetDate));
          setUpdateAdminNotes(merged.adminNotes || "");
          setUpdateAdminNotesInternal(merged.adminNotesInternal || "");
          setUpdateTechDiagnosis(merged.technicianDiagnosis || "");
          setUpdateDeviceType(merged.deviceType || "");
          const deviceType = merged.deviceType || "";
          if (deviceType && !(DEVICE_TYPES as readonly string[]).includes(deviceType)) {
            setOriginalCustomDeviceType(deviceType);
          } else {
            setOriginalCustomDeviceType("");
          }
          setRawDiagnosis(merged.technicianDiagnosis || "");
          setTechnicianReport(merged.technicianReport || "");
          setUpdateServiceReport(merged.aiReport || "");
          setIsEditingAIDiagnosis(false);
          setIsEditingServiceReport(false);

          const serviceCostNum = sanitizeNumber(String(merged.serviceCost ?? "0"));
          const savedDiscountNum = sanitizeNumber(String(merged.discount ?? "0"));
          const savedFinalCost = sanitizeNumber(String(merged.finalCost ?? "0"));
          setDiscountAmount(savedDiscountNum);
          setDiscountValue(savedDiscountNum > 0 ? savedDiscountNum.toString() : "");
          setDiscountType("amount");
          if (savedFinalCost > 0) {
            setFinalCost(savedFinalCost);
          } else {
            setFinalCost(Math.max(0, serviceCostNum - savedDiscountNum));
          }
          toast({ title: "Service Loaded", description: `Service ${urlServiceId} loaded successfully` });
        } catch {
          // Error auto-searching service
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
      let sheetData: any = {};
      let foundFromSheets = false;
      try {
        const response = await fetch(
          `${GOOGLE_SHEETS_SCRIPT_URL}?action=searchService&serviceId=${serviceId}`,
        );
        const data = await response.json();
        if (data.status === "found") {
          sheetData = data.data || {};
          foundFromSheets = true;
        }
      } catch {}

      const merged = await mergeWithSupabase(serviceId, sheetData);
      if (!foundFromSheets && (!merged || !merged.serviceId)) {
        toast({ title: "Not Found", description: "No service found with the provided details", variant: "destructive" });
        setServiceData(null);
        return;
      }
      setServiceData(merged);
      setUpdateStatus(merged.status || "");
      setUpdateAdminRep(merged.adminRep || "");
      setUpdateTechnician(merged.technician || "");
      setUpdateClientType(merged.clientType || "");
      setUpdatePriority(merged.priority || "");
      setUpdateChiefComplaint(merged.chiefComplaint || "");
      setUpdateAIDiagnosis(merged.aiDiagnosis || "");
      setUpdateServices(merged.service || "");
      setUpdateServiceCost(merged.serviceCost || "");
      setUpdateTimeFrame(merged.timeFrame || "");
      setUpdateTargetDate(parseDateMMDDYYYY(merged.targetDate));
      setUpdateAdminNotes(merged.adminNotes || "");
      setUpdateAdminNotesInternal(merged.adminNotesInternal || "");
      setUpdateTechDiagnosis(merged.technicianDiagnosis || "");
      setUpdateDeviceType(merged.deviceType || "");
      const deviceType = merged.deviceType || "";
      if (deviceType && !(DEVICE_TYPES as readonly string[]).includes(deviceType)) {
        setOriginalCustomDeviceType(deviceType);
      } else {
        setOriginalCustomDeviceType("");
      }
      setRawDiagnosis(merged.technicianDiagnosis || "");
      setTechnicianReport(merged.technicianReport || "");
      setUpdateServiceReport(merged.aiReport || "");
      setIsEditingAIDiagnosis(false);
      setIsEditingServiceReport(false);

      const serviceCostNum = sanitizeNumber(String(merged.serviceCost ?? "0"));
      const savedDiscountNum = sanitizeNumber(String(merged.discount ?? "0"));
      const savedFinalCost = sanitizeNumber(String(merged.finalCost ?? "0"));
      setDiscountAmount(savedDiscountNum);
      setDiscountValue(savedDiscountNum > 0 ? savedDiscountNum.toString() : "");
      setDiscountType("amount");
      if (savedFinalCost > 0) {
        setFinalCost(savedFinalCost);
      } else {
        setFinalCost(Math.max(0, serviceCostNum - savedDiscountNum));
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch service data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Live ticket watch: detect updates made elsewhere -------------------
  const isTabActive = useIsTabActive();
  const loadedServiceId = serviceData?.serviceId || null;
  const { change: remoteChange, isLive, dismiss: dismissRemoteChange, syncBaseline } =
    useServiceLiveWatch(loadedServiceId, isTabActive);
  const [isReloadingTicket, setIsReloadingTicket] = useState(false);

  /** True when the form holds edits that a silent refresh would discard. */
  const isFormDirty = (() => {
    if (!serviceData) return false;
    if (isEditingDetails || isEditingAIDiagnosis || isEditingServiceReport) return true;
    const pairs: Array<[any, any]> = [
      [updateStatus, serviceData.status || ""],
      [updateAdminRep, serviceData.adminRep || ""],
      [updateTechnician, serviceData.technician || ""],
      [updateClientType, serviceData.clientType || ""],
      [updatePriority, serviceData.priority || ""],
      [updateChiefComplaint, serviceData.chiefComplaint || ""],
      [updateAIDiagnosis, serviceData.aiDiagnosis || ""],
      [updateServices, serviceData.service || ""],
      [String(updateServiceCost ?? ""), String(serviceData.serviceCost ?? "")],
      [updateTimeFrame, serviceData.timeFrame || ""],
      [updateAdminNotes, serviceData.adminNotes || ""],
      [updateAdminNotesInternal, serviceData.adminNotesInternal || ""],
      [updateTechDiagnosis, serviceData.technicianDiagnosis || ""],
      [technicianReport, serviceData.technicianReport || ""],
      [updateServiceReport, serviceData.aiReport || ""],
    ];
    return pairs.some(([a, b]) => String(a ?? "") !== String(b ?? ""));
  })();

  const reloadTicket = async () => {
    if (!loadedServiceId) return;
    setIsReloadingTicket(true);
    try {
      await handleSearch();
      await syncBaseline();
    } finally {
      setIsReloadingTicket(false);
    }
  };

  // Clean form + remote change -> refresh silently. Dirty form -> show banner.
  useEffect(() => {
    if (!remoteChange || !loadedServiceId || isFormDirty || isReloadingTicket) return;
    (async () => {
      setIsReloadingTicket(true);
      try {
        await handleSearch();
        await syncBaseline();
        toast({
          title: "Ticket refreshed",
          description: remoteChange.newStatus
            ? `Status is now ${remoteChange.newStatus}.`
            : `Updated: ${remoteChange.changedFields.join(", ")}.`,
        });
      } finally {
        setIsReloadingTicket(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteChange]);


  // Fallback: if Sheets didn't return a quotationPdfUrl but Supabase Storage
  // already has a generated quotation for this service, mark it so the button
  // shows "Update Form" instead of "Generate PDF".
  useEffect(() => {
    let cancelled = false;
    const sid = serviceData?.serviceId;
    if (!sid || serviceData?.quotationPdfUrl) return;
    (async () => {
      const url = await getServicePdfSignedUrl(sid, "quotation");
      if (!cancelled && url) {
        setServiceData((prev: any) => (prev && prev.serviceId === sid ? { ...prev, quotationPdfUrl: url } : prev));
      }
    })();
    return () => { cancelled = true; };
  }, [serviceData?.serviceId, serviceData?.quotationPdfUrl]);

  // Fallback: resolve the intake PDF from Supabase Storage when Sheets
  // didn't return a pdfUrl, so the "View PDF" button is enabled.
  useEffect(() => {
    let cancelled = false;
    const sid = serviceData?.serviceId;
    if (!sid || serviceData?.pdfUrl) return;
    (async () => {
      const url = await getServicePdfSignedUrl(sid, "intake");
      if (!cancelled && url) {
        setServiceData((prev: any) => (prev && prev.serviceId === sid ? { ...prev, pdfUrl: url } : prev));
      }
    })();
    return () => { cancelled = true; };
  }, [serviceData?.serviceId, serviceData?.pdfUrl]);

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
      const formattedDiagnosis = await formatDiagnosisWithAI({
        rawDiagnosis,
        customerName: serviceData?.clientName || '',
        deviceType: serviceData?.deviceType || '',
        model: serviceData?.device || '',
        serviceId,
      });

      if (formattedDiagnosis) {
        setUpdateAIDiagnosis(formattedDiagnosis);
        setIsEditingAIDiagnosis(false);
        
        // Create notification in panel for proofread reminder
        const userId = sessionStorage.getItem("staffId") || sessionStorage.getItem("username");
        if (userId) {
          createNotification({
            userId,
            title: "AI Diagnosis Generated",
            message: `⚠️ Please double-check and proofread the AI-generated diagnosis for ${serviceId} before approving.`,
            type: "others",
            serviceId,
          });
        }
        
        toast({
          title: "AI Formatting Complete",
          description: "⚠️ Please double-check and proofread the generated diagnosis before approving.",
        });
      } else {
        throw new Error("No formatted diagnosis received from AI service");
      }
    } catch (error: any) {
      // Error formatting diagnosis
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
      const formattedReport = await formatReportWithAI({
        technicianReport,
        customerName: serviceData?.clientName || '',
        deviceType: serviceData?.deviceType || '',
        model: serviceData?.device || '',
        serviceId,
        finalCost: serviceData?.finalCost || updateServiceCost || serviceData?.serviceCost || '0',
      });

      if (formattedReport) {
        setUpdateServiceReport(formattedReport);
        setIsEditingServiceReport(false);
        
        // Create notification in panel for proofread reminder
        const userId = sessionStorage.getItem("staffId") || sessionStorage.getItem("username");
        if (userId) {
          createNotification({
            userId,
            title: "AI Report Generated",
            message: `⚠️ Please double-check and proofread the AI-generated service report for ${serviceId} before approving.`,
            type: "others",
            serviceId,
          });
        }
        
        toast({
          title: "AI Formatting Complete",
          description: "⚠️ Please double-check and proofread the generated report before approving.",
        });
      } else {
        throw new Error("No formatted report received from AI service");
      }
    } catch (error: any) {
      // Error formatting service report
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

    // Guard: fields can be saved freely while on Confirmed Diagnosis, but the
    // ticket cannot move forward until the Service Quotation Form exists.
    // Moving back to Pending Diagnosis is always allowed (re-diagnosis).
    if (
      serviceData.status === "Confirmed Diagnosis" &&
      updateStatus &&
      updateStatus !== "Confirmed Diagnosis" &&
      updateStatus !== "Pending Diagnosis" &&
      !serviceData.quotationPdfUrl
    ) {
      toast({
        title: "Service Quotation Form Required",
        description:
          "Save your service cost and diagnosis first, generate the Service Quotation Form, then change the status.",
        variant: "destructive",
      });
      return;
    }


    setIsUpdatingClientInfo(true);
    try {
      const formData = new FormData();
      formData.append("action", "updateService");
      formData.append("serviceId", serviceId);
      formData.append("deviceType", updateDeviceType);
      formData.append("Device Type", updateDeviceType);
      formData.append("status", updateStatus);
      formData.append("adminRep", updateAdminRep);
      formData.append("Admin Representative", updateAdminRep);
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
      formData.append("chiefComplaint", updateChiefComplaint);

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

      // Mirror to Supabase so dashboards / search reflect the change immediately
      const saveStamp = new Date().toISOString();
      const { error: sbUpdateError } = await supabase.from("services").update({
        status: updateStatus as any,
        admin_reps: updateAdminRep.split(",").map(s => s.trim()).filter(Boolean),
        technicians: updateTechnician.split(",").map(s => s.trim()).filter(Boolean),
        technician_departments: techDept.split(",").map(s => s.trim()).filter(Boolean),
        device_type: updateDeviceType,
        client_type: updateClientType,
        priority: updatePriority,
        chief_complaint: updateChiefComplaint,
        issue_description: updateChiefComplaint,
        diagnosis: updateAIDiagnosis,

        technician_diagnosis: rawDiagnosis,
        technician_report: technicianReport,
        ai_report: updateServiceReport,
        service: updateServices,
        service_cost: Number(updateServiceCost) || 0,
        discount: discountAmount,
        final_cost: finalCost,
        target_date: updateTargetDate ? format(updateTargetDate, "yyyy-MM-dd") : null,
        internal_admin_notes: updateAdminNotesInternal,
        remarks: updateAdminNotes,
        last_updated: saveStamp,
      }).eq("service_id", serviceId);
      // Don't let our own write raise the "updated elsewhere" banner.
      syncBaseline(saveStamp);


      // Fire-and-forget: keep Sheets in sync if still configured (non-blocking, ignore failures)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        fetch(GOOGLE_SHEETS_SCRIPT_URL, { method: "POST", body: formData, signal: controller.signal })
          .catch(() => {})
          .finally(() => clearTimeout(timeoutId));
      } catch { /* ignore */ }

      let result: any = null;
      // Success is now determined by Supabase, the source of truth
      const isSuccess = !sbUpdateError;

      if (isSuccess) {
        // Log only the fields that actually changed
        const username = (sessionStorage.getItem("userFullName") || sessionStorage.getItem("username")) || "Admin";
        const role = sessionStorage.getItem("userRole") || "admin";
        const changes: string[] = [];

        if (updateStatus !== serviceData.status) changes.push(`Status: ${serviceData.status || "N/A"} → ${updateStatus}`);
        if (updateDeviceType !== (serviceData.deviceType || "")) {
          const originalDeviceType = String(serviceData.deviceType || "");
          const newDeviceType = String(updateDeviceType || "");
          if (originalDeviceType !== newDeviceType) changes.push(`Device Type: ${originalDeviceType} → ${newDeviceType}`);
        }
        if (updateAdminRep !== serviceData.adminRep) changes.push(`Admin Rep: ${serviceData.adminRep || "Unassigned"} → ${updateAdminRep}`);
        if (updateTechnician !== serviceData.technician) changes.push(`Technician: ${serviceData.technician || "Unassigned"} → ${updateTechnician}`);
        if (updateClientType !== serviceData.clientType) changes.push(`Client type: ${serviceData.clientType || "N/A"} → ${updateClientType}`);
        if (updatePriority !== serviceData.priority) changes.push(`Priority: ${serviceData.priority || "N/A"} → ${updatePriority}`);
        if (updateChiefComplaint !== (serviceData.chiefComplaint || "")) changes.push("Chief complaint updated");

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
              adminRep: updateAdminRep,
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
              adminRep: updateAdminRep,
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
      const msg = error instanceof Error ? error.message : String(error);
      const isCorsFetchError = msg.toLowerCase().includes("failed to fetch");
      const isAbortError = error instanceof Error && error.name === 'AbortError';

      if (isCorsFetchError) {
        // Update client info fetch error (likely CORS after successful POST)
        toast({
          title: "Success",
          description: "Client information updated successfully",
        });
        handleSearch();
        return;
      }

      const errorMessage = isAbortError 
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
        adminRep: updateAdminRep || serviceData.adminRep || "Admin",
        technician: updateTechnician,
        receivingStaff: (serviceData as any).receivingStaff || "",
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

      // Mirror the regenerated intake PDF into Supabase Storage.
      uploadServicePdf({
        serviceId,
        clientName: serviceData.clientName || "",
        kind: "intake",
        blob: pdfBlob,
      }).catch(() => {});

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      let result: any = null;
      try {
        result = await response.json();
      } catch {
        // Some Apps Script deployments return an unreadable response even after a successful upload.
      }

      const isSuccess =
        (result && (result.result === "success" || result.status === "success")) ||
        (response.ok && result === null);

      if (isSuccess) {
        const username = (sessionStorage.getItem("userFullName") || sessionStorage.getItem("username")) || "Admin";
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
          description: result?.message || "Failed to update PDF form",
          variant: "destructive",
        });
      }
    } catch (error) {
      // Update form error
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
        adminRep: updateAdminRep || serviceData.adminRep || "Admin",
        technician: updateTechnician,
        receivingStaff: (serviceData as any).receivingStaff || "",
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
        model: serviceData.deviceModel || serviceData.model || "",
        memory: memory?.trim() || "",
        technicianDiagnosis: updateAIDiagnosis || serviceData.aiDiagnosis || "N/A",
        serviceSummary: updateServices || serviceData.service || "N/A",
        serviceCost: updateServiceCost || serviceData.serviceCost || "0.00",
        partsUsed: serviceData.partsUsed || "N/A",
        discount: (discountAmount > 0
          ? discountAmount.toFixed(2)
          : String(serviceData.discount ?? "0.00")),
        totalCost: (() => {
          const costNum = sanitizeNumber(String(updateServiceCost || serviceData.serviceCost || "0"));
          const disc = discountAmount > 0 ? discountAmount : sanitizeNumber(String(serviceData.discount ?? "0"));
          const computed = costNum - disc;
          return computed > 0 || costNum > 0
            ? computed.toFixed(2)
            : String(serviceData.finalCost || serviceData.serviceCost || "0.00");
        })(),

        isUpdated: !!serviceData.quotationPdfUrl,
      };
      
      // Generate PDF (assets are preloaded, so this is fast)
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

      // Convert to base64 while building FormData
      const blobToBase64 = (blob: Blob): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      
      const pdfBase64Promise = blobToBase64(pdfBlob);

      const formData = new FormData();
      formData.append("action", "updateQuotationPDF");
      formData.append("serviceId", serviceId);
      formData.append("deviceType", serviceData.deviceType);
      formData.append("Serial", serviceData.serialNumber || "");
      formData.append("Client Name", serviceData.clientName || "");
      formData.append("Device Type", serviceData.deviceType || "");
      formData.append("ClientFolderUrl", serviceData.clientFolderUrl || "");

      // Wait for base64 conversion
      const pdfBase64 = await pdfBase64Promise;

      formData.append("QuotationPDF", pdfBlob, fileName);
      formData.append("QuotationPDF_Base64", pdfBase64);
      formData.append("QuotationPDF_FileName", fileName);
      formData.append("QuotationPDF_MimeType", "application/pdf");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      // Upload to Supabase Storage in parallel with the legacy bridge call.
      uploadServicePdf({
        serviceId,
        clientName: serviceData.clientName || "",
        kind: "quotation",
        blob: pdfBlob,
      }).catch(() => {});

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      let result: any = null;
      try {
        result = await response.json();
      } catch {
        // CORS may block reading response
      }

      const isSuccess = 
        (result && (result.result === "success" || result.status === "success")) ||
        (response.ok && result === null);

      if (isSuccess) {
        // Immediately swap the button to "Update Form" without waiting for reload
        const wasUpdate = !!serviceData.quotationPdfUrl;
        try {
          const signed = await getServicePdfSignedUrl(serviceId, "quotation");
          setServiceData((prev: any) =>
            prev && prev.serviceId === serviceId
              ? { ...prev, quotationPdfUrl: signed || prev.quotationPdfUrl || "generated" }
              : prev
          );
        } catch {
          setServiceData((prev: any) =>
            prev && prev.serviceId === serviceId
              ? { ...prev, quotationPdfUrl: prev.quotationPdfUrl || "generated" }
              : prev
          );
        }
        toast({
          title: "Success",
          description: wasUpdate
            ? "Service quotation form updated successfully"
            : "Service quotation form generated successfully",
        });
        // Refresh the data in the background
        handleSearch();

        // Fire-and-forget: log activity without blocking
        const username = (sessionStorage.getItem("userFullName") || sessionStorage.getItem("username")) || "Admin";
        const role = sessionStorage.getItem("userRole") || "admin";
        logActivity({
          serviceId: serviceId,
          username: username,
          role: role,
          activity: serviceData.quotationPdfUrl 
            ? "Service quotation form updated" 
            : "Service quotation form generated",
        }).catch(() => {});
      } else {
        toast({
          title: "Error",
          description: result?.message || "Failed to generate quotation form",
          variant: "destructive",
        });
      }
    } catch (error) {
      // Quotation generation error
      const msg = error instanceof Error ? error.message : String(error);
      const isCorsFetchError = msg.toLowerCase().includes("failed to fetch");
      const isAbort = error instanceof Error && error.name === 'AbortError';
      
      if (isCorsFetchError) {
        // CORS error likely means success
        toast({
          title: "Success",
          description: "Service quotation form generated successfully",
        });
        handleSearch();
        return;
      }
      
      const errorMessage = isAbort 
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

  const handleViewQuotationPDF = async () => {
    const signed = serviceData?.serviceId
      ? await getServicePdfSignedUrl(serviceData.serviceId, "quotation")
      : null;
    const url = signed || (serviceData?.quotationPdfUrl ? normalizeGoogleDrivePdfUrl(serviceData.quotationPdfUrl, "preview") : null);
    if (!url) {
      toast({ title: "No Quotation PDF Available", description: "Quotation PDF has not been generated yet", variant: "destructive" });
      return;
    }
    setPdfModalUrl(url);
    setPdfModalTitle("Service Quotation Form");
    setPdfModalOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 animate-fade-in">
        <PageHeader
          title="Manage Client"
          subtitle="View and update client information"
          icon={<UserCog className="h-5 w-5" />}
          actions={
            <Button
              onClick={() => window.open("https://docs.google.com/spreadsheets/d/14aDQwwbLLS7FWNdcx-mChLjC-8pTV73UIScjt8HPnSc/edit?usp=sharing", "_blank")}
              variant="outline"
              className="rounded-xl"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Sheet
            </Button>
          }
        />

        {/* Search Form */}
        <Card className="mb-8 rounded-2xl border-border/60 bg-[hsl(var(--surface-glass))] shadow-[var(--shadow-float)] backdrop-blur">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label htmlFor="serviceId" className="text-sm font-medium">Service ID</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="serviceId"
                  placeholder="Enter service ID (e.g. AC1234)"
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
                  className="pl-9 h-11 rounded-xl bg-background/60"
                />
              </div>
            </div>

            <Button onClick={handleSearch} disabled={isLoading} className="w-full mt-6 h-11 rounded-xl">
              {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching...</>) : "Search Client"}
            </Button>
          </CardContent>
        </Card>

        {/* Service Details and Update Form */}
        {serviceData && (
          <div className="space-y-8">
          {remoteChange && (
            <RemoteUpdateBanner
              changedFields={remoteChange.changedFields}
              newStatus={remoteChange.newStatus}
              isDirty={isFormDirty}
              isReloading={isReloadingTicket}
              onReload={reloadTicket}
              onDismiss={dismissRemoteChange}
            />
          )}
          <TicketWorkspaceHero service={serviceData} showShare isLive={isLive} />

          <StatusProgressBar
            serviceId={serviceData.serviceId || ""}
            clientName={serviceData.clientName || ""}
            technician={serviceData.technician}
            adminRep={serviceData.adminRep}
            device={serviceData.device || serviceData.deviceType}
            currentStatus={serviceData.status || ""}
          />
          <TicketOverviewRow
            status={serviceData.status}
            serviceId={serviceData.serviceId}

            guidance={
              serviceData.autoApproveDiagnosis && serviceData.status === "Confirmed Diagnosis"
                ? "Client pre-approved the diagnosis at intake — generate the quotation, then move straight to Proceed Repair."
                : getStatusGuidance(
                    serviceData.status || "",
                    {
                      serviceId: serviceData.serviceId || "",
                      clientName: serviceData.clientName || "",
                      technician: serviceData.technician ?? "",
                      adminRep: serviceData.adminRep,
                      device: serviceData.device || serviceData.deviceType,
                    },
                    "admin",
                  )
            }

            technician={serviceData.technician}
            adminRep={serviceData.adminRep}
            receivingStaff={(serviceData as any).receivingStaff}
            serviceCost={serviceData.serviceCost}
            discount={serviceData.discount}
            finalCost={serviceData.finalCost}
            initialPayment={serviceData.initialPayment}
            paymentStatus={serviceData.paymentStatus}
            showCharges={serviceData.status !== "Pending Diagnosis"}
            showServiceCost={serviceData.status === "Confirmed Diagnosis" || Number(String(serviceData.finalCost ?? "0").replace(/[^0-9.-]/g, "")) > 0}
            showDiscount={serviceData.status === "Confirmed Diagnosis" || Number(String(serviceData.discount ?? "0").replace(/[^0-9.-]/g, "")) > 0}
            showFinal={serviceData.status !== "Pending Diagnosis"}
          />

          <div className="grid gap-8 grid-cols-1 xl:grid-cols-2">


            {/* Client Information */}
            <Card className="rounded-2xl border-border/60 bg-[hsl(var(--surface-glass))] shadow-[var(--shadow-float)] backdrop-blur">
              <CardHeader className="border-b border-border/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-2xl tracking-tight">Client Information</CardTitle>
                  {canEditAdminRep && !isEditingDetails && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditingDetails(true)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit details
                    </Button>
                  )}
                </div>
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
                      disabled={isUpdatingForm}
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
                    <Button onClick={handleViewPDF} variant="outline" className="flex-1" disabled={!serviceData?.pdfUrl}>
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
                      disabled={isUpdatingQuotation}
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
                    <Button onClick={handleViewQuotationPDF} variant="outline" className="flex-1" disabled={!serviceData?.quotationPdfUrl}>
                      <FileText className="mr-2 h-4 w-4" />
                      View PDF
                    </Button>
                  </div>
                </div>

                {/* Client approval is handled on the public /track page. */}

                <Separator />

                {canEditAdminRep && (
                  <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-background/60 p-3">
                    <div>
                      <p className="text-sm font-semibold">Client pre-approves diagnosis</p>
                      <p className="text-xs text-muted-foreground">
                        {serviceData.autoApproveDiagnosis
                          ? "Approval skipped — ticket moves straight to Proceed Repair."
                          : "Client must approve the diagnosis on the tracking page."}
                      </p>
                    </div>
                    <Switch
                      checked={!!serviceData.autoApproveDiagnosis}
                      disabled={isTogglingAutoApprove}
                      onCheckedChange={handleToggleAutoApprove}
                    />
                  </div>
                )}

                <ApprovalRemarkBlock adminNotes={serviceData.adminNotesInternal} />

                {serviceData.approvalLocked && canEditAdminRep && (
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                    <div>
                      <p className="text-sm font-semibold">Client approval is on hold</p>
                      <p className="text-xs text-muted-foreground">
                        Re-open it so the client can approve the remaining services on the tracking page.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isReopeningApproval}
                      onClick={handleReopenApproval}
                    >
                      Re-open approval
                    </Button>
                  </div>
                )}


                {isEditingDetails && canEditAdminRep ? (
                <ServiceDetailsEditor
                  serviceData={serviceData}
                  onCancel={() => setIsEditingDetails(false)}
                  onSaved={() => {
                    setIsEditingDetails(false);
                    handleSearch();
                  }}
                />
                ) : (
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
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Admin Rep:</h3>
                    <p className="text-lg">{serviceData.adminRep || "Unassigned"}</p>
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
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Storage & Color:</h3>
                    <p className="text-lg break-words whitespace-normal">
                      {(() => {
                        const mem = (serviceData.memory || "").trim();
                        const col = (serviceData.color || "").trim();
                        const combined = [mem, col].filter(Boolean).join(" | ");
                        return combined || (serviceData.colorMemory || "N/A");
                      })()}
                    </p>
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
                    <p className="text-lg">{serviceData.timestamp ? displayDate(serviceData.timestamp, "MMM dd, yyyy, hh:mm a") : "N/A"}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Estimated Time Frame:</h3>
                    <p className="text-lg">{serviceData.timeFrame || "N/A"}</p>
                  </div>

                  {serviceData.status !== "Pending Diagnosis" && (
                    <div>
                      <h3 className="font-semibold text-sm text-muted-foreground mb-1">Estimated Target Date:</h3>
                      <p className="text-lg">{serviceData.targetDate ? displayDate(serviceData.targetDate, "MMM dd, yyyy") : "N/A"}</p>
                    </div>
                  )}

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

                  {serviceData.status === "Confirmed Diagnosis" && (
                    <>
                      <div>
                        <h3 className="font-semibold text-sm text-muted-foreground mb-1">Service Cost:</h3>
                        <p className="text-lg font-semibold">Php {serviceData.serviceCost}</p>
                      </div>

                      <div>
                        <h3 className="font-semibold text-sm text-muted-foreground mb-1">Discount:</h3>
                        <p className="text-lg font-semibold">Php {discountAmount.toFixed(2)}</p>
                      </div>
                    </>
                  )}

                  {serviceData.status !== "Pending Diagnosis" && (
                    <div>
                      <h3 className="font-semibold text-sm text-muted-foreground mb-1">Final Cost:</h3>
                      <p className="text-lg font-semibold text-primary">
                        Php {(finalCost > 0 ? finalCost : sanitizeNumber(String(serviceData.serviceCost ?? "0"))).toFixed(2)}
                      </p>
                    </div>
                  )}

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
                )}

              </CardContent>
            </Card>

            {/* Update Client Information */}
            <Card className="rounded-2xl border-border/60 bg-[hsl(var(--surface-glass))] shadow-[var(--shadow-float)] backdrop-blur">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="text-2xl tracking-tight">Update Client Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status:</Label>
                  <Select value={updateStatus} onValueChange={setUpdateStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.filter(status =>
                        // Pre-approved tickets skip the client approval stage.
                        !(serviceData.autoApproveDiagnosis && status === "Waiting to Proceed"),
                      ).map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}

                    </SelectContent>
                  </Select>
                </div>

                {canEditAdminRep && (
                  <div className="space-y-2">
                    <Label htmlFor="adminRep">Admin Rep:</Label>
                    <MultiSelect
                      options={adminStaffOptions}
                      selected={updateAdminRep ? updateAdminRep.split(", ").filter(Boolean) : []}
                      onChange={(values) => setUpdateAdminRep(values.join(", "))}
                      placeholder="Select Admin Rep"
                      grouped
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="technician">Technician:</Label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-primary"
                        checked={showUnavailableTechs}
                        onChange={(e) => setShowUnavailableTechs(e.target.checked)}
                      />
                      Show unavailable staff
                    </label>
                  </div>

                  <MultiSelect
                    options={(() => {
                      // Filter technicians based on device type
                      const deviceType = serviceData?.deviceType;

                      // Always available for special cases, regardless of device type / department
                      const SPECIAL_CASE_TECH = "John Paul Espedido";
                      const specialOption = {
                        label: SPECIAL_CASE_TECH,
                        value: SPECIAL_CASE_TECH,
                        group: "Special Cases",
                      };
                      const toOption = (tech: { name: string; department: string }) => ({
                        label: tech.name,
                        value: tech.name,
                        group: tech.department,
                      });
                      const withSpecial = (opts: { label: string; value: string; group: string }[]) => [
                        specialOption,
                        ...opts.filter((o) => o.value !== SPECIAL_CASE_TECH),
                      ];

                      // Check if device type is in the predefined list
                      const isPreDefinedDeviceType = deviceType && 
                        (DEVICE_TYPES as readonly string[]).includes(deviceType);
                      
                      // If no device type or custom device (not in predefined list), show all technicians
                      if (!deviceType || !isPreDefinedDeviceType) {
                        return withSpecial(technicians.map(toOption));
                      }
                      
                      // Filter by department only for predefined device types
                      const filteredTechs = technicians.filter(tech => {
                        const deptDeviceTypes = DEVICE_TYPES_BY_DEPARTMENT[tech.department];
                        return deptDeviceTypes && deptDeviceTypes.includes(deviceType);
                      });
                      
                      return withSpecial(filteredTechs.map(toOption));
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
                      <SelectItem value="New Client - Walk In">New Client - Walk In</SelectItem>
                      <SelectItem value="New Client - Pickup">New Client - Pickup</SelectItem>
                      <SelectItem value="Returning Client - Walk In">Returning Client - Walk In</SelectItem>
                      <SelectItem value="Returning Client - Pickup">Returning Client - Pickup</SelectItem>
                      <SelectItem value="Backjob">Backjob</SelectItem>

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

                {/* (Diagnosis photos moved below AI Diagnosis section) */}

                {/* Technician Diagnosis (raw) - same logic as /service-update */}
                {(
                  <div className="space-y-2">
                    <Label htmlFor="technicianDiagnosis">Technician Diagnosis:</Label>
                    <Textarea
                      id="technicianDiagnosis"
                      placeholder="Enter technician diagnosis"
                      value={rawDiagnosis}
                      onChange={(e) => {
                        setRawDiagnosis(e.target.value);
                        setUpdateTechDiagnosis(e.target.value);
                      }}
                      rows={4}
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                )}

                {/* Diagnosis Display - always visible */}
                {(
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
                          <Label htmlFor="aiDiagnosisDisplay">AI Diagnosis:</Label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={isFormattingAI}
                              onClick={() => {
                                const ok = window.confirm(
                                  "AI Diagnosis Formatter\n\nThis reformats the technician's raw diagnosis. AI output may contain mistakes - review every section (especially Service Breakdown amounts and warranty) before saving or sharing with the client.\n\nProceed?"
                                );
                                if (ok) handleFormatWithAI();
                              }}
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
                                const ok = window.confirm(
                                  "Approve this AI Diagnosis?\n\nThe SUMMARY section will be copied into Service/s. AI output may be inaccurate — please review carefully before proceeding."
                                );
                                if (!ok) return;
                                const summaryMatch = (updateAIDiagnosis || "").match(
                                  /SUMMARY:\s*([\s\S]+?)(?=\n\s*\n|\n[A-Z][A-Z ]+:|$)/i
                                );
                                if (summaryMatch && summaryMatch[1]) {
                                  setUpdateServices(summaryMatch[1].trim());
                                  toast({ title: "Summary copied to Service/s" });
                                } else {
                                  toast({
                                    title: "Error",
                                    description: "Could not find 'SUMMARY' section in AI diagnosis",
                                    variant: "destructive",
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
                            placeholder="AI Diagnosis"
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

                {/* Device Diagnosis Photos - shown only on Confirmed Diagnosis, BELOW AI Diagnosis */}
                {serviceData?.status === "Confirmed Diagnosis" && serviceData?.serviceId && (
                  <DiagnosisPhotos serviceId={serviceData.serviceId} title="Device Diagnosis - Photos" />
                )}

                {/* Technician Report (raw) - same logic as /service-update */}
                {(
                  <div className="space-y-2">
                    <Label htmlFor="technicianReport">Technician Report:</Label>
                    <Textarea
                      id="technicianReport"
                      placeholder="Enter technician report"
                      value={technicianReport}
                      onChange={(e) => setTechnicianReport(e.target.value)}
                      rows={4}
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                )}

                {/* Report Display - always visible */}
                {(
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
                          <Label htmlFor="aiReportDisplay">AI Service Report:</Label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={isFormattingReport}
                              onClick={() => {
                                const ok = window.confirm(
                                  "AI Report Formatter\n\nThis reformats the technician's report. AI output may contain mistakes - review it carefully before saving or sharing with the client.\n\nProceed?"
                                );
                                if (ok) handleFormatReportWithAI();
                              }}
                            >
                              {isFormattingReport ? (
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
                            placeholder="AI Service Report"
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

                {/* Device Report Photos - shown only on Done Repair - For Release, BELOW AI Report */}
                {serviceData?.status === "Done Repair - For Release" && serviceData?.serviceId && (
                  <DeviceReportPhotos serviceId={serviceData.serviceId} title="Device Report - Photos" />
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
                  <Label htmlFor="timeFrame">Estimated Time Frame:</Label>
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
                  <Label htmlFor="targetDate">Estimated Target Date:</Label>
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

          <ActivityTimeline serviceId={serviceData.serviceId} />
          </div>
        )}


        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground"></div>
      </div>
      <PdfViewerModal open={pdfModalOpen} onOpenChange={setPdfModalOpen} url={pdfModalUrl} title={pdfModalTitle} />
    </DashboardLayout>
  );
};

export default ManageClient;
