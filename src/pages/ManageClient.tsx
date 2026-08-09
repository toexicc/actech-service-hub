import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { format, parse } from "date-fns";
import { displayDate } from "@/lib/timezone";
import { CalendarIcon, Eye, EyeOff, Loader2, ExternalLink, UserCog, Search, Pencil, Lock, LockOpen, AlertTriangle, ChevronDown, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { notifyAdminConcern } from "@/lib/serviceNotifications";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ServiceDetailsEditor } from "@/components/workspace/ServiceDetailsEditor";
import { PartsUsedPanel } from "@/components/workspace/PartsUsedPanel";
import { WorkspaceField } from "@/components/workspace/WorkspaceField";

import ApprovalRemarkBlock from "@/components/workspace/ApprovalRemarkBlock";
import { parseQuotedBreakdown, normalizeQuotedBreakdown, quotedSelectedTotal, lineEffectiveCost, validateQuotedLines, computeFinalCost, vatAmount, type QuotedLine } from "@/lib/serviceApproval";
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
import { DATA_BRIDGE_URL } from "@/lib/dataBridge";
import { supabase } from "@/integrations/supabase/client";
import { mapServiceRow } from "@/hooks/useServices";
import { mergeWithSupabase, mergeSupabaseOverSheet, supabaseRowToSheetShape } from "@/lib/serviceRecordShape";
import { formatDiagnosisWithAI, formatReportWithAI } from "@/lib/aiFormatters";
import { generateServicePDF } from "@/lib/pdfGenerator";
import { generateQuotationPDF } from "@/lib/quotationPdfGenerator";
import { uploadServicePdf, getServicePdfSignedUrl, getServiceImageDataUrl, servicePdfDownloadName } from "@/lib/servicePdfStorage";
import { syncApprovedQuotation, quotedLineItems } from "@/lib/approvedQuotationSync";
import { PdfViewerModal } from "@/components/PdfViewerModal";
import { logActivity, logAiFormatActivity, logTicketActivity, diffFields } from "@/lib/activityLogger";
import { notifyServiceStatusChange, notifyNewServiceAssignment, notifyAiDiagnosisGenerated, notifyAiOutputGenerated } from "@/lib/serviceNotifications";
import { createNotification } from "@/lib/notifications";
import { DeviceReportPhotos } from "@/components/DeviceReportPhotos";
import { DiagnosisPhotos } from "@/components/DiagnosisPhotos";
import { FileText, RefreshCw } from "lucide-react";
import logo from "@/assets/S_S_Marketing-2.png";
import { normalizeGoogleDrivePdfUrl, cn } from "@/lib/utils";
import { STATUS_OPTIONS, TIME_FRAME_OPTIONS, PRIORITY_OPTIONS, DEVICE_TYPES_BY_DEPARTMENT, DEVICE_TYPES } from "@/lib/constants";
import { describeDeviceConditions } from "@/lib/deviceConditions";
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
  const [pdfModalFilename, setPdfModalFilename] = useState("document.pdf");
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
  const [concernOpen, setConcernOpen] = useState(false);
  const [concernMessage, setConcernMessage] = useState("");
  const [concernSending, setConcernSending] = useState(false);

  const concernRecipientLabel = (serviceData?.technician || "").trim() || "Management";

  const handleSendConcern = async () => {
    const body = concernMessage.trim();
    if (!serviceData || !body) return;
    setConcernSending(true);
    try {
      const fromName = (sessionStorage.getItem("userFullName") || sessionStorage.getItem("username")) || "Admin";
      await notifyAdminConcern(
        {
          serviceId: serviceData.serviceId,
          clientName: serviceData.clientName,
          technician: serviceData.technician || "",
          adminRep: serviceData.adminRep,
          receivingStaff: serviceData.receivingStaff,
          deviceType: serviceData.deviceType,
          device: [serviceData.brand, serviceData.model].filter(Boolean).join(" "),
        },
        body,
        fromName,
      );
      logActivity({
        serviceId: serviceData.serviceId,
        username: fromName,
        role: sessionStorage.getItem("userRole") || "admin",
        activity: `Concern raised to technician: ${body}`,
      }).catch(() => {});
      toast({ title: "Concern sent", description: `Notified ${concernRecipientLabel}.` });
      setConcernMessage("");
      setConcernOpen(false);
    } catch (error) {
      toast({
        title: "Could not send concern",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setConcernSending(false);
    }
  };
  const [updateAdminRep, setUpdateAdminRep] = useState("");
  const [updateTechnician, setUpdateTechnician] = useState("");
  const [updateClientType, setUpdateClientType] = useState("");
  const [updatePriority, setUpdatePriority] = useState("");
  const [updateChiefComplaint, setUpdateChiefComplaint] = useState("");
  const [updateAIDiagnosis, setUpdateAIDiagnosis] = useState("");
  const [updateServices, setUpdateServices] = useState("");
  const [updateServiceCost, setUpdateServiceCost] = useState("");
  const [updateTimeFrame, setUpdateTimeFrame] = useState("");
  const [updateRepairTimeFrame, setUpdateRepairTimeFrame] = useState("");
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
  const [vatRequested, setVatRequested] = useState(false);
  // Finalized quotation lines shown to the client on /track.
  const [quotedLines, setQuotedLines] = useState<QuotedLine[]>([]);
  const [quotedProblems, setQuotedProblems] = useState<Record<number, string>>({});

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isPartsUsedOpen, setIsPartsUsedOpen] = useState(false);
  const [isTogglingAutoApprove, setIsTogglingAutoApprove] = useState(false);
  const [isTogglingWaitingParts, setIsTogglingWaitingParts] = useState(false);

  const [isReopeningApproval, setIsReopeningApproval] = useState(false);

  /** Clear the partial-approval hold so the client can approve again on /track. */
  const handleReopenApproval = async () => {
    if (!serviceData?.serviceId || isReopeningApproval) return;
    setIsReopeningApproval(true);
    try {
      // Idempotent: re-opening an already-open approval is a no-op, never an
      // error, so repeated back-and-forth between shop and client is safe.
      const { data: current } = await supabase
        .from("services")
        .select("approval_locked")
        .eq("service_id", serviceData.serviceId)
        .maybeSingle();

      if (current && (current as any).approval_locked === false) {
        setServiceData((prev: any) => (prev ? { ...prev, approvalLocked: false } : prev));
        toast({
          title: "Approval already open",
          description: "The client can select the remaining services on the tracking page.",
        });
        return;
      }

      const { error } = await supabase
        .from("services")
        .update({ approval_locked: false, last_updated: new Date().toISOString() } as any)
        .eq("service_id", serviceData.serviceId);
      if (error) throw new Error(error.message);
      logTicketActivity(serviceData.serviceId, "Client approval re-opened on /track", {
        "Approval lock": { from: "Locked", to: "Open" },
        "Pending approval": (serviceData.pendingServices ?? []).join(", ") || "(none)",
      });
      setServiceData((prev: any) => (prev ? { ...prev, approvalLocked: false } : prev));
      toast({ title: "Approval re-opened", description: "The client can approve again on the tracking page." });

      // Pull the authoritative row back so the remark + pending list stay in sync.
      try {
        await handleSearch();
      } catch {
        /* refresh is best-effort */
      }
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

  /** Waiting for Parts pauses the repair (and the turnaround clock). */
  const handleToggleWaitingForParts = async (next: boolean) => {
    if (!serviceData?.serviceId || isTogglingWaitingParts) return;
    setIsTogglingWaitingParts(true);
    try {
      const { error } = await supabase
        .from("services")
        .update({ waiting_for_parts: next, last_updated: new Date().toISOString() } as any)
        .eq("service_id", serviceData.serviceId);
      if (error) throw new Error(error.message);

      setServiceData((prev: any) => (prev ? { ...prev, waitingForParts: next } : prev));

      await logActivity({
        serviceId: serviceData.serviceId,
        username: sessionStorage.getItem("userFullName") || sessionStorage.getItem("username") || "Admin",
        role: sessionStorage.getItem("userRole") || "admin",
        activity: next ? "Waiting for Parts turned on" : "Waiting for Parts turned off",
      });

      toast({
        title: next ? "Waiting for Parts" : "Waiting for Parts cleared",
        description: next
          ? "The repair is paused while parts are being procured. Turnaround time stops counting."
          : "The repair resumes and turnaround time counts again.",
      });
    } catch (e) {
      toast({
        title: "Update failed",
        description: e instanceof Error ? e.message : "Could not change the Waiting for Parts setting.",
        variant: "destructive",
      });
    } finally {
      setIsTogglingWaitingParts(false);
    }
  };



  const fetchApiKey = async () => {
    try {
      const response = await fetch(`${DATA_BRIDGE_URL}?action=getApiKey`);
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
    setPdfModalFilename(
      servicePdfDownloadName("intake", {
        serviceDate: serviceData?.dateReceived,
        clientName: serviceData?.clientName,
        serviceId: serviceData?.serviceId,
      }),
    );
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
              `${DATA_BRIDGE_URL}?action=searchService&serviceId=${urlServiceId}`,
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
          if (merged?.serviceId) setServiceId(merged.serviceId);
          setUpdateStatus(merged.status || "");
          setUpdateAdminRep(merged.adminRep || "");
          setUpdateTechnician(merged.technician || "");
          setUpdateClientType(merged.clientType || "");
          setUpdatePriority(merged.priority || "");
          setUpdateChiefComplaint(merged.chiefComplaint || "");
          setUpdateAIDiagnosis(merged.aiDiagnosis || "");
          setUpdateServices(merged.service || "");
          setUpdateServiceCost(merged.serviceCost || "");
      setQuotedLines(normalizeQuotedBreakdown(merged.quotedBreakdown));
          setQuotedLines(normalizeQuotedBreakdown(merged.quotedBreakdown));
          setUpdateTimeFrame(merged.timeFrame || "");
          setUpdateRepairTimeFrame(merged.repairTimeFrame || "");
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
          const savedVat = !!(merged as any).vatRequested;
          setVatRequested(savedVat);
          setDiscountAmount(savedDiscountNum);
          setDiscountValue(savedDiscountNum > 0 ? savedDiscountNum.toString() : "");
          setDiscountType("amount");
          if (savedFinalCost > 0) {
            setFinalCost(savedFinalCost);
          } else {
            setFinalCost(computeFinalCost(serviceCostNum, savedDiscountNum, savedVat));
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
          `${DATA_BRIDGE_URL}?action=searchService&serviceId=${serviceId}`,
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
      if (merged?.serviceId) setServiceId(merged.serviceId);
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
      setUpdateRepairTimeFrame(merged.repairTimeFrame || "");
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
      const savedVat = !!(merged as any).vatRequested;
      setVatRequested(savedVat);
      setDiscountAmount(savedDiscountNum);
      setDiscountValue(savedDiscountNum > 0 ? savedDiscountNum.toString() : "");
      setDiscountType("amount");
      if (savedFinalCost > 0) {
        setFinalCost(savedFinalCost);
      } else {
        setFinalCost(computeFinalCost(serviceCostNum, savedDiscountNum, savedVat));
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch service data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  /** The ticket actually loaded in the form — the only id writes may target. */
  const activeServiceId: string = serviceData?.serviceId || "";

  /**
   * Guards every write / AI call so a stale Service ID in the search box can
   * never send one ticket's content to another ticket.
   */
  const requireLoadedTicket = (): string | null => {
    const typed = (serviceId || "").trim().toUpperCase();
    if (!activeServiceId) {
      toast({ title: "Load the ticket first", description: "Search for a Service ID before continuing.", variant: "destructive" });
      return null;
    }
    if (typed && typed !== activeServiceId.trim().toUpperCase()) {
      toast({
        title: "Load the ticket first",
        description: `The Service ID box says ${typed} but ${activeServiceId} is loaded. Search again to load ${typed}.`,
        variant: "destructive",
      });
      return null;
    }
    return activeServiceId;
  };

  /** Off-path / terminal statuses skip the client-approval guards. */
  const isOffPathStatus = (status?: string): boolean =>
    ["RTO", "Cancelled", "On Hold", "Pending Diagnosis"].includes((status || "").trim());

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
      [updateRepairTimeFrame, (serviceData as any).repairTimeFrame || ""],
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

  // Keep the stored quotation form in sync with the client's approval: when a
  // client approves (or re-approves) part of the breakdown, the PDF is rebuilt
  // from the approved lines and their chosen options.
  const syncedQuotationRef = useRef<string>("");
  useEffect(() => {
    const sid = serviceData?.serviceId;
    if (!sid || syncedQuotationRef.current === sid) return;
    syncedQuotationRef.current = sid;
    (async () => {
      const { regenerated } = await syncApprovedQuotation(sid);
      if (!regenerated) return;
      const url = await getServicePdfSignedUrl(sid, "quotation");
      setServiceData((prev: any) =>
        prev && prev.serviceId === sid
          ? { ...prev, quotationPdfUrl: url || prev.quotationPdfUrl || "generated" }
          : prev,
      );
      toast({
        title: "Quotation updated",
        description: "The quotation form now reflects the approved services.",
      });
    })().catch(() => {});
  }, [serviceData?.serviceId]);

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

    const aiSid = requireLoadedTicket();
    if (!aiSid) return;
    setIsFormattingAI(true);
    try {
      const formattedDiagnosis = await formatDiagnosisWithAI({
        rawDiagnosis,
        customerName: serviceData?.clientName || '',
        deviceType: serviceData?.deviceType || '',
        model: serviceData?.device || '',
        serviceId: aiSid,
      });

      if (formattedDiagnosis) {
        setUpdateAIDiagnosis(formattedDiagnosis);
        setIsEditingAIDiagnosis(false);
        logAiFormatActivity(aiSid, "diagnosis", {
          source: "/manage-client",
          before: rawDiagnosis,
          after: formattedDiagnosis,
        });

        await notifyAiDiagnosisGenerated({
          serviceId: aiSid,
          clientName: serviceData?.clientName || "Client",
          technician: serviceData?.technician || "",
          adminRep: serviceData?.adminRep || "",
        });
        
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

    const aiReportSid = requireLoadedTicket();
    if (!aiReportSid) return;
    setIsFormattingReport(true);
    try {
      const formattedReport = await formatReportWithAI({
        technicianReport,
        customerName: serviceData?.clientName || '',
        deviceType: serviceData?.deviceType || '',
        model: serviceData?.device || '',
        serviceId: aiReportSid,
        finalCost: serviceData?.finalCost || updateServiceCost || serviceData?.serviceCost || '0',
      });

      if (formattedReport) {
        setUpdateServiceReport(formattedReport);
        setIsEditingServiceReport(false);
        logAiFormatActivity(aiReportSid, "report", {
          source: "/manage-client",
          before: technicianReport,
          after: formattedReport,
        });

        // Notify the acting staff member plus assigned admins and technicians.
        await notifyAiOutputGenerated({
          serviceId: aiReportSid,
          clientName: serviceData?.clientName || "Client",
          technician: serviceData?.technician || "",
          adminRep: serviceData?.adminRep || "",
        }, 'report');
        
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

    const sid = requireLoadedTicket();
    if (!sid) return;

    // Terminal / off-path moves (RTO, Cancelled, On Hold, back to Pending
    // Diagnosis) must always be possible, so they bypass the client-approval
    // guards below.
    const offPathMove = isOffPathStatus(updateStatus) && updateStatus !== serviceData.status;
    if (offPathMove && (updateStatus === "RTO" || updateStatus === "Cancelled")) {
      const proceed = window.confirm(
        `Set ${sid} to ${updateStatus}?\n\nThis takes the ticket off the repair workflow. Continue?`
      );
      if (!proceed) return;
    }

    // Guard: fields can be saved freely while on Confirmed Diagnosis, but the
    // ticket cannot move forward until the Service Quotation Form exists.
    // Moving back to Pending Diagnosis is always allowed (re-diagnosis).
    if (
      !offPathMove &&
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

    // Every ticked quotation line must carry a real amount (and a chosen option
    // when it has variants) before the client can be asked to approve it.
    if (quotedLines.length && !offPathMove) {
      const check = validateQuotedLines(quotedLines, { requireLock: true });

      if (!check.ok) {
        setQuotedProblems(check.problems);
        toast({
          title: "Service Breakdown needs attention",
          description: check.message || "Please review the highlighted service lines.",
          variant: "destructive",
        });
        return;
      }
      setQuotedProblems({});
    }




    setIsUpdatingClientInfo(true);
    try {
      const formData = new FormData();
      formData.append("action", "updateService");
      formData.append("serviceId", sid);
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
      formData.append("vat", vatAmount(sanitizeNumber(updateServiceCost), discountAmount, vatRequested).toFixed(2));
      formData.append("finalCost", finalCost.toString());
      formData.append("targetDate", updateTargetDate ? format(updateTargetDate, "MM-dd-yyyy") : "");
      formData.append("adminNotes", updateAdminNotes);
      formData.append("adminNotesInternal", updateAdminNotesInternal);
      formData.append("Serial", serviceData.serialNumber || "");
      formData.append("Client Name", serviceData.clientName || "");
      formData.append("Device Type", updateDeviceType || "");

      // A service line added beyond what the client already had/approved must
      // re-open approval — pre-approval cannot cover the new work.
      const approvedNames = ((serviceData?.approvedServices ?? []) as string[]).map((s) =>
        String(s).trim().toLowerCase().replace(/\s*\([^)]*\)\s*$/, ""),
      );
      const savedNames = normalizeQuotedBreakdown((serviceData as any)?.quotedBreakdown).map((l) =>
        l.name.trim().toLowerCase(),
      );
      const additionalLines = quotedLines.filter((l) => {
        const n = l.name.trim().toLowerCase();
        return n && !approvedNames.includes(n) && !savedNames.includes(n);
      });
      // Any prior approval state counts as a baseline: an explicit client
      // approval, a locked approval, or the pre-approve toggle being on.
      const hadApprovalBaseline =
        approvedNames.length > 0 ||
        savedNames.length > 0 ||
        !!(serviceData as any)?.approvalLocked ||
        !!(serviceData as any)?.clientApprovedAt;
      const reopenApproval = additionalLines.length > 0 && hadApprovalBaseline;
      const disableAutoApprove = reopenApproval && !!(serviceData as any)?.autoApproveDiagnosis;


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
        quoted_breakdown: quotedLines as any,
        discount: discountAmount,
        vat_requested: vatRequested,
        final_cost: finalCost,
        target_date: updateTargetDate ? format(updateTargetDate, "yyyy-MM-dd") : null,
        estimated_completion: updateTimeFrame || null,
        repair_time_frame: updateRepairTimeFrame || null,
        internal_admin_notes: updateAdminNotesInternal,
        remarks: updateAdminNotes,
        ...(reopenApproval ? { client_approved_at: null, approval_locked: false } : {}),
        ...(disableAutoApprove ? { auto_approve_diagnosis: false } : {}),

        last_updated: saveStamp,
      } as any).eq("service_id", sid);

      // Don't let our own write raise the "updated elsewhere" banner.
      syncBaseline(saveStamp);


      // Fire-and-forget mirror to the data bridge (non-blocking, ignore failures)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        fetch(DATA_BRIDGE_URL, { method: "POST", body: formData, signal: controller.signal })
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
        const prevTarget = serviceData.targetDate || "";
        const newTarget = updateTargetDate ? format(updateTargetDate, "MM-dd-yyyy") : "";
        const { summaries, details: fieldDetails } = diffFields([
          { label: "Status", before: serviceData.status, after: updateStatus },
          { label: "Device Type", before: serviceData.deviceType, after: updateDeviceType },
          { label: "Admin Rep", before: serviceData.adminRep || "Unassigned", after: updateAdminRep },
          { label: "Technician", before: serviceData.technician || "Unassigned", after: updateTechnician },
          { label: "Client Type", before: serviceData.clientType, after: updateClientType },
          { label: "Priority", before: serviceData.priority, after: updatePriority },
          { label: "Chief Complaint", before: serviceData.chiefComplaint, after: updateChiefComplaint },
          { label: "AI Diagnosis", before: serviceData.aiDiagnosis, after: updateAIDiagnosis },
          { label: "AI Service Report", before: serviceData.aiReport, after: updateServiceReport },
          { label: "Services", before: serviceData.service, after: updateServices },
          { label: "Service Cost", before: serviceData.serviceCost, after: updateServiceCost },
          { label: "Discount", before: sanitizeNumber(String(serviceData.discount ?? "0")), after: discountAmount },
          { label: "VAT Requested", before: (serviceData as any).vatRequested ? "Yes" : "No", after: vatRequested ? "Yes" : "No" },
          { label: "Final Cost", before: sanitizeNumber(String(serviceData.finalCost ?? "0")), after: finalCost },
          { label: "Diagnostic Time Frame", before: serviceData.timeFrame, after: updateTimeFrame },
          { label: "Repair Time Frame", before: (serviceData as any).repairTimeFrame, after: updateRepairTimeFrame },
          { label: "Target Date", before: prevTarget, after: newTarget },
          { label: "Notes from the Team", before: serviceData.adminNotes, after: updateAdminNotes },
          { label: "Internal Notes", before: serviceData.adminNotesInternal, after: updateAdminNotesInternal },
          { label: "Service Breakdown", before: JSON.stringify(serviceData.quotedBreakdown ?? []), after: JSON.stringify(quotedLines ?? []) },
        ]);
        const changes: string[] = [...summaries];

        if (changes.length > 0) {
          await logActivity({
            serviceId: sid,
            username: username,
            role: role,
            activity: `Service updated (/manage-client): ${changes.join(", ")}`,
            details: fieldDetails,
          });
        }

        if (reopenApproval) {
          const names = additionalLines.map((l) => l.name).join(", ");
          await logActivity({
            serviceId: sid,
            username,
            role,
            activity: disableAutoApprove
              ? `Diagnosis pre-approval turned off automatically — additional service(s) added beyond what the client approved: ${names}`
              : `Client approval re-opened automatically — additional service(s) added beyond what the client approved: ${names}`,
            details: { additionalServices: names },
          });
          setServiceData((prev: any) =>
            prev
              ? {
                  ...prev,
                  approvalLocked: false,
                  clientApprovedAt: "",
                  ...(disableAutoApprove ? { autoApproveDiagnosis: false } : {}),
                }
              : prev,
          );
          toast({
            title: disableAutoApprove ? "Pre-approval turned off" : "Approval re-opened",
            description: "Additional services were added, so the client needs to approve again. Resend the approval.",
          });
        }



        // Send notifications for status changes
        const userFullName = sessionStorage.getItem("userFullName") || username;
        const userRole = sessionStorage.getItem("userRole");
        if (updateStatus !== serviceData.status) {
          notifyServiceStatusChange(
            {
              serviceId: sid,
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
              serviceId: sid,
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
        // Keep the intake artifacts on regeneration — they live in storage, not
        // in the form state, so they must be re-loaded before drawing.
        annotationImageUrl: await getServiceImageDataUrl(
          serviceId,
          "annotation",
          (serviceData as any).deviceAnnotationPath || undefined,
        ),
        annotationNotes: (serviceData as any).annotationNotes || "",
        signatureUrl: await getServiceImageDataUrl(
          serviceId,
          "signature",
          (serviceData as any).signaturePath || undefined,
        ),
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

      const response = await fetch(DATA_BRIDGE_URL, {
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

    // A quotation must always ship with at least one required (locked) service.
    if (quotedLines.length) {
      const check = validateQuotedLines(quotedLines, { requireLock: true });
      if (!check.ok) {
        setQuotedProblems(check.problems);
        toast({
          title: "Service Breakdown needs attention",
          description: check.message || "Please review the highlighted service lines.",
          variant: "destructive",
        });
        return;
      }
      setQuotedProblems({});
    }



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
        vat: (() => {
          const costNum = sanitizeNumber(String(updateServiceCost || serviceData.serviceCost || "0"));
          const disc = discountAmount > 0 ? discountAmount : sanitizeNumber(String(serviceData.discount ?? "0"));
          const v = vatAmount(costNum, disc, vatRequested);
          return v > 0 ? v.toFixed(2) : undefined;
        })(),
        totalCost: (() => {
          const costNum = sanitizeNumber(String(updateServiceCost || serviceData.serviceCost || "0"));
          const disc = discountAmount > 0 ? discountAmount : sanitizeNumber(String(serviceData.discount ?? "0"));
          const computed = computeFinalCost(costNum, disc, vatRequested);
          return computed > 0 || costNum > 0
            ? computed.toFixed(2)
            : String(serviceData.finalCost || serviceData.serviceCost || "0.00");
        })(),

        serviceBreakdown: quotedLines.length ? quotedLineItems(quotedLines) : undefined,
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

      const response = await fetch(DATA_BRIDGE_URL, {
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
    setPdfModalFilename(
      servicePdfDownloadName("quotation", {
        serviceDate: serviceData?.dateReceived,
        clientName: serviceData?.clientName,
        serviceId: serviceData?.serviceId,
      }),
    );
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
                    /(^|\n)\s*Declined by /i.test(serviceData.adminNotesInternal || ""),
                  )
            }

            technician={serviceData.technician}
            adminRep={serviceData.adminRep}
            receivingStaff={(serviceData as any).receivingStaff}
            serviceCost={serviceData.serviceCost}
            discount={serviceData.discount}
            finalCost={serviceData.finalCost}
            vatRequested={!!serviceData.vatRequested}
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

                <div className="flex items-start justify-between gap-4 rounded-xl border border-amber-300/60 bg-amber-50/60 p-3">
                  <div>
                    <p className="text-sm font-semibold">Waiting for Parts</p>
                    <p className="text-xs text-muted-foreground">
                      {serviceData.waitingForParts
                        ? "Repair paused — parts/supplies are being procured. Turnaround time is not counting."
                        : "Turn on when the repair is paused while parts/supplies are being procured."}
                    </p>
                  </div>
                  <Switch
                    checked={!!serviceData.waitingForParts}
                    disabled={isTogglingWaitingParts}
                    onCheckedChange={handleToggleWaitingForParts}
                  />
                </div>

                <Collapsible open={isPartsUsedOpen} onOpenChange={setIsPartsUsedOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span>
                        Parts Used
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {Array.isArray(serviceData.partsUsed) && serviceData.partsUsed.length > 0
                            ? `${serviceData.partsUsed.length} item(s)`
                            : "none recorded"}
                        </span>
                      </span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", isPartsUsedOpen && "rotate-180")} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <PartsUsedPanel
                      serviceId={serviceData.serviceId}
                      partsUsed={serviceData.partsUsed}
                      onSaved={handleSearch}
                    />
                  </CollapsibleContent>
                </Collapsible>







                <ApprovalRemarkBlock
                  adminNotes={serviceData.adminNotesInternal}
                  pendingServices={(serviceData as any).pendingServices}
                  approvalLocked={serviceData.approvalLocked}
                  onReopen={canEditAdminRep ? handleReopenApproval : undefined}
                />

                {(() => {
                  const approved = ((serviceData?.approvedServices ?? []) as string[]).map((s) =>
                    String(s).trim().toLowerCase(),
                  );
                  const savedUnapproved = normalizeQuotedBreakdown((serviceData as any)?.quotedBreakdown).filter(
                    (l) => l.name.trim() && !approved.includes(l.name.trim().toLowerCase()),
                  );
                  if (!approved.length || savedUnapproved.length === 0) return null;
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300/60 bg-amber-50/60 p-2">
                      <p className="text-xs text-amber-800">
                        {savedUnapproved.length} saved service line(s) haven't been approved yet. Resend the approval so
                        the client can approve the new items — already approved services stay approved.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isReopeningApproval}
                        onClick={handleReopenApproval}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        {isReopeningApproval ? "Sending…" : "Resend approval to client"}
                      </Button>
                    </div>
                  );
                })()}





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
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</p>
                    <div className="grid gap-x-4 gap-y-3 grid-cols-2 lg:grid-cols-3">
                      <WorkspaceField label="Client Name" value={serviceData.clientName} />
                      <WorkspaceField label="Client ID" value={serviceData.clientId} />
                      <WorkspaceField label="Contact Number" value={serviceData.contactNumber || serviceData.phone} />
                      <WorkspaceField label="Email" value={serviceData.email} />
                      <WorkspaceField label="Client Type" value={serviceData.clientType} />
                      <WorkspaceField label="Priority" value={serviceData.priority} />
                      <WorkspaceField label="Admin Rep" value={serviceData.adminRep || "Unassigned"} />
                      <WorkspaceField label="Technician" value={serviceData.technician} />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Device</p>
                    <div className="grid gap-x-4 gap-y-3 grid-cols-2 lg:grid-cols-3">
                      <WorkspaceField label="Device Type" value={serviceData.deviceType} />
                      <WorkspaceField label="Device Model" value={serviceData.device} />
                      <WorkspaceField label="Serial Number" value={serviceData.serialNumber} />
                      <WorkspaceField
                        label="Storage & Color"
                        value={(() => {
                          const mem = (serviceData.memory || "").trim();
                          const col = (serviceData.color || "").trim();
                          return [mem, col].filter(Boolean).join(" | ") || serviceData.colorMemory || "";
                        })()}
                      />
                      {serviceData.devicePassword && (
                        <div className="space-y-0.5 min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                            Device Password
                          </div>
                          <div className="flex items-center gap-1">
                            <Input
                              type={showPassword ? "text" : "password"}
                              value={serviceData.devicePassword}
                              readOnly
                              className="h-8 text-sm"
                            />
                            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setShowPassword(!showPassword)}>
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      )}
                      <WorkspaceField label="Device Conditions" value={describeDeviceConditions(serviceData)} />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Schedule & Costs</p>
                    <div className="grid gap-x-4 gap-y-3 grid-cols-2 lg:grid-cols-3">
                      <WorkspaceField
                        label="Service Date"
                        value={serviceData.timestamp ? displayDate(serviceData.timestamp, "MMM dd, yyyy, hh:mm a") : ""}
                      />
                      <WorkspaceField label="Diagnostic Time Frame" value={serviceData.timeFrame} />
                      <WorkspaceField label="Repair Time Frame" value={(serviceData as any).repairTimeFrame} />
                      <WorkspaceField
                        label="Estimated Cost"
                        value={`Php ${parseFloat(serviceData.estimatedCost || 0).toFixed(2)}`}
                      />
                      {serviceData.status !== "Pending Diagnosis" && (
                        <WorkspaceField
                          label="Estimated Target Date"
                          value={serviceData.targetDate ? displayDate(serviceData.targetDate, "MMM dd, yyyy") : ""}
                        />
                      )}
                      {serviceData.status === "Confirmed Diagnosis" && (
                        <>
                          <WorkspaceField label="Service Cost" value={`Php ${serviceData.serviceCost}`} />
                          <WorkspaceField label="Discount" value={`Php ${discountAmount.toFixed(2)}`} />
                        </>
                      )}
                      {serviceData.status !== "Pending Diagnosis" && (
                        <WorkspaceField
                          label="Final Cost"
                          value={`Php ${(finalCost > 0 ? finalCost : sanitizeNumber(String(serviceData.serviceCost ?? "0"))).toFixed(2)}`}
                          valueClassName="font-semibold text-primary"
                        />
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-x-4 gap-y-3 grid-cols-1 md:grid-cols-2">
                    <WorkspaceField label="Service/s" value={serviceData.service} valueClassName="whitespace-pre-line" />
                    <WorkspaceField
                      label="Technician Notes (Internal)"
                      value={serviceData.technicianNotesInternal?.trim() ? serviceData.technicianNotesInternal : ""}
                      valueClassName="whitespace-pre-line"
                    />
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
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assignment</p>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5 bg-gradient-destructive text-white border-0 shadow-lg hover:brightness-110"
                    onClick={() => setConcernOpen(true)}
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Raise Concern
                  </Button>
                </div>

                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
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
                </div>

                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Classification</p>
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
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
                                const parsedLines = parseQuotedBreakdown(updateAIDiagnosis || "");
                                if (parsedLines.length) {
                                  setQuotedLines(parsedLines);
                                  const total = quotedSelectedTotal(parsedLines);
                                  if (total > 0) {
                                    setUpdateServiceCost(total.toFixed(2));
                                    const disc =
                                      discountType === "percentage"
                                        ? (total * (parseFloat(discountValue) || 0)) / 100
                                        : parseFloat(discountValue) || 0;
                                    setDiscountAmount(disc);
                                    setFinalCost(computeFinalCost(total, disc, vatRequested));
                                  }
                                }
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

                <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Service Breakdown (shown to the client on /track):</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setQuotedLines((prev) => [...prev, { name: "", cost: 0, selected: true, required: false }])
                      }
                    >
                      Add Line
                    </Button>
                  </div>
                  {quotedLines.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Click Approve on the AI Diagnosis to pull the service breakdown here, or add lines manually.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {quotedLines.map((line, i) => (
                        <div
                          key={i}
                          className={cn(
                            "space-y-2 rounded-lg p-1",
                            quotedProblems[i] && "border border-destructive/50 bg-destructive/5",
                          )}
                        >
                        <div className="grid grid-cols-12 items-center gap-2">
                          <input
                            type="checkbox"
                            className="col-span-1 h-4 w-4 accent-primary"
                            checked={line.selected}
                            onChange={(e) =>
                              setQuotedLines((prev) =>
                                prev.map((l, idx) => (idx === i ? { ...l, selected: e.target.checked } : l)),
                              )
                            }
                          />
                          <Input
                            className="col-span-6"
                            placeholder="Repair / service"
                            value={line.name}
                            onChange={(e) =>
                              setQuotedLines((prev) =>
                                prev.map((l, idx) => (idx === i ? { ...l, name: e.target.value } : l)),
                              )
                            }
                          />
                          {line.options?.length ? (
                            <div className="col-span-3 text-right text-sm font-medium text-muted-foreground">
                              {lineEffectiveCost(line) > 0
                                ? `Php ${lineEffectiveCost(line).toFixed(2)}`
                                : "Choose option"}
                            </div>
                          ) : (
                            <Input
                              className="col-span-3 text-right"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={line.cost ? String(line.cost) : ""}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0;
                                setQuotedLines((prev) =>
                                  prev.map((l, idx) => (idx === i ? { ...l, cost: val } : l)),
                                );
                              }}
                            />
                          )}
                          <Button
                            type="button"
                            size="icon"
                            variant={line.required ? "secondary" : "ghost"}
                            className="col-span-1 h-9 w-9"
                            aria-label={line.required ? "Make service optional" : "Make service required"}
                            title={line.required ? "Required service — click to unlock" : "Optional service — click to require"}
                            onClick={() =>
                              setQuotedLines((prev) =>
                                prev.map((l, idx) => idx === i ? { ...l, required: !l.required, selected: !l.required || l.selected } : l),
                              )
                            }
                          >
                            {line.required ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="col-span-1 text-destructive"
                            onClick={() => setQuotedLines((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            X
                          </Button>
                        </div>

                        {/* Options (e.g. OEM vs Original) */}
                        <div className="pl-8 space-y-1">
                          {(line.options ?? []).map((opt, oi) => (
                            <div key={oi} className="grid grid-cols-12 items-center gap-2">
                              <input
                                type="radio"
                                className="col-span-1 h-4 w-4 accent-primary"
                                checked={line.selectedOption === opt.label}
                                onChange={() =>
                                  setQuotedLines((prev) =>
                                    prev.map((l, idx) => (idx === i ? { ...l, selectedOption: opt.label } : l)),
                                  )
                                }
                              />
                              <Input
                                className="col-span-5 h-8 text-sm"
                                placeholder="Option label (e.g. OEM)"
                                value={opt.label}
                                onChange={(e) =>
                                  setQuotedLines((prev) =>
                                    prev.map((l, idx) => {
                                      if (idx !== i) return l;
                                      const options = (l.options ?? []).map((o, x) =>
                                        x === oi ? { ...o, label: e.target.value } : o,
                                      );
                                      const selectedOption =
                                        l.selectedOption === opt.label ? e.target.value : l.selectedOption;
                                      return { ...l, options, selectedOption };
                                    }),
                                  )
                                }
                              />
                              <Input
                                className="col-span-3 h-8 text-right text-sm"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={opt.cost ? String(opt.cost) : ""}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0;
                                  setQuotedLines((prev) =>
                                    prev.map((l, idx) =>
                                      idx === i
                                        ? {
                                            ...l,
                                            options: (l.options ?? []).map((o, x) =>
                                              x === oi ? { ...o, cost: val } : o,
                                            ),
                                          }
                                        : l,
                                    ),
                                  );
                                }}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="col-span-2 h-8 text-destructive text-xs"
                                onClick={() =>
                                  setQuotedLines((prev) =>
                                    prev.map((l, idx) => {
                                      if (idx !== i) return l;
                                      const options = (l.options ?? []).filter((_, x) => x !== oi);
                                      return {
                                        ...l,
                                        options: options.length ? options : undefined,
                                        selectedOption:
                                          l.selectedOption === opt.label ? "" : l.selectedOption,
                                      };
                                    }),
                                  )
                                }
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() =>
                              setQuotedLines((prev) =>
                                prev.map((l, idx) =>
                                  idx === i
                                    ? {
                                        ...l,
                                        options: [...(l.options ?? []), { label: "", cost: 0 }],
                                      }
                                    : l,
                                ),
                              )
                            }
                          >
                            + Add option (e.g. OEM / Original)
                          </Button>
                        </div>
                        {quotedProblems[i] && (
                          <p className="pl-8 text-xs text-destructive">{quotedProblems[i]}</p>
                        )}
                        </div>
                      ))}

                      {!quotedLines.some((l) => l.required) && (
                        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                          Lock at least one required service (padlock icon). The client's approval of the required
                          service(s) is what moves the ticket to Proceed Repair — optional services left unticked
                          will simply stay pending.
                        </p>
                      )}

                      {(() => {
                        const approved = ((serviceData?.approvedServices ?? []) as string[]).map((s) =>
                          String(s).trim().toLowerCase().replace(/\s*\([^)]*\)\s*$/, ""),
                        );
                        const saved = normalizeQuotedBreakdown((serviceData as any)?.quotedBreakdown).map((l) =>
                          l.name.trim().toLowerCase(),
                        );
                        const unsavedNew = quotedLines.filter((l) => {
                          const n = l.name.trim().toLowerCase();
                          return n && !approved.includes(n) && !saved.includes(n);
                        });
                        const hasBaseline =
                          approved.length > 0 ||
                          saved.length > 0 ||
                          !!(serviceData as any)?.approvalLocked ||
                          !!(serviceData as any)?.clientApprovedAt;
                        if (!hasBaseline || unsavedNew.length === 0) return null;

                        return (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50/60 px-2.5 py-1 text-xs font-medium text-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {unsavedNew.length} unsaved new service line(s) — save to resend approval
                          </span>
                        );
                      })()}


                      <div className="flex items-center justify-between pt-1 text-sm">

                        <span className="font-semibold">
                          Selected total: Php {quotedSelectedTotal(quotedLines).toFixed(2)}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const total = quotedSelectedTotal(quotedLines);
                            setUpdateServiceCost(total.toFixed(2));
                            const disc =
                              discountType === "percentage"
                                ? (total * (parseFloat(discountValue) || 0)) / 100
                                : parseFloat(discountValue) || 0;
                            setDiscountAmount(disc);
                            setFinalCost(computeFinalCost(total, disc, vatRequested));
                          }}
                        >
                          Apply to Service Cost
                        </Button>
                      </div>

                    </div>
                  )}
                </div>

                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pricing</p>
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
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
                      setFinalCost(computeFinalCost(costNum, discount, vatRequested));
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
                        setFinalCost(computeFinalCost(sanitizeNumber(updateServiceCost), 0, vatRequested));
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
                        setFinalCost(computeFinalCost(sanitizeNumber(updateServiceCost), 0, vatRequested));
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
                        setFinalCost(computeFinalCost(costNum, discount, vatRequested));
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

                <div className="space-y-2 rounded-md border border-border/60 p-3">
                  <label className="flex items-start gap-2 text-sm font-medium cursor-pointer">
                    <Checkbox
                      checked={vatRequested}
                      onCheckedChange={(checked) => {
                        const next = checked === true;
                        setVatRequested(next);
                        setFinalCost(computeFinalCost(sanitizeNumber(updateServiceCost), discountAmount, next));
                      }}
                    />
                    <span>Requesting Invoice (Add VAT to Total Cost)</span>
                  </label>
                  {vatRequested && (
                    <p className="pl-6 text-sm font-semibold text-muted-foreground">
                      VAT (12%): Php {vatAmount(sanitizeNumber(updateServiceCost), discountAmount, true).toFixed(2)}
                    </p>
                  )}
                </div>



                <div className="space-y-2">
                  <Label>Final Cost:</Label>
                  <div className="text-2xl font-bold text-primary">
                    Php {finalCost.toFixed(2)}
                  </div>
                </div>
                </div>

                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Schedule</p>
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                <div className="space-y-2">

                  <Label htmlFor="timeFrame">Diagnostic Time Frame:</Label>
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
                  <Label htmlFor="repairTimeFrame">Repair Time Frame:</Label>
                  <Select value={updateRepairTimeFrame} onValueChange={setUpdateRepairTimeFrame}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time frame" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_FRAME_OPTIONS.map(tf => (
                        <SelectItem key={tf} value={tf}>{tf}</SelectItem>
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
      <PdfViewerModal open={pdfModalOpen} onOpenChange={setPdfModalOpen} url={pdfModalUrl} title={pdfModalTitle} filename={pdfModalFilename} />

      <Dialog open={concernOpen} onOpenChange={(o) => { if (!concernSending) setConcernOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Raise a Concern</DialogTitle>
            <DialogDescription>
              {serviceData
                ? `${serviceData.serviceId} — ${serviceData.clientName}. This will notify: ${concernRecipientLabel}.`
                : "Search a service first."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={concernMessage}
            onChange={(e) => setConcernMessage(e.target.value.slice(0, 500))}
            placeholder="Describe your concern for the assigned technician..."
            rows={5}
          />
          <p className="text-xs text-muted-foreground">{concernMessage.length}/500</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConcernOpen(false)} disabled={concernSending}>
              Cancel
            </Button>
            <Button onClick={handleSendConcern} disabled={concernSending || !concernMessage.trim() || !serviceData}>
              {concernSending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>) : "Send Concern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ManageClient;
