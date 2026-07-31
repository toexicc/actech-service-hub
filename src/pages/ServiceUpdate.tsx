import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { format, parse } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { supabase } from "@/integrations/supabase/client";
import { mapServiceRow } from "@/hooks/useServices";
import { generateServicePDF } from "@/lib/pdfGenerator";
import { getServicePdfSignedUrl } from "@/lib/servicePdfStorage";
import { PdfViewerModal } from "@/components/PdfViewerModal";
import { FileText, Package, Camera, Loader2, QrCode, Eye, EyeOff, Wrench, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { TicketWorkspaceHero } from "@/components/TicketWorkspaceHero";
import { DeviceReportPhotos } from "@/components/DeviceReportPhotos";
import { DiagnosisPhotos } from "@/components/DiagnosisPhotos";
import { QRScanner } from "@/components/QRScanner";
import logo from "@/assets/S_S_Marketing-2.png";
import { normalizeGoogleDrivePdfUrl, cn } from "@/lib/utils";
import { logActivity } from "@/lib/activityLogger";
import { notifyServiceStatusChange, notifyNewServiceAssignment } from "@/lib/serviceNotifications";
import { createNotification } from "@/lib/notifications";
import { STATUS_OPTIONS, DEVICE_TYPES_BY_DEPARTMENT, DEVICE_TYPES } from "@/lib/constants";
import { sanitizeNumber } from "@/lib/validation";
import { MultiSelect } from "@/components/ui/multi-select";
import { useTechnicians, useStaff } from "@/hooks/useStaff";
import { useInventory } from "@/hooks/useInventory";
import { useFastMovingParts } from "@/hooks/useFastMovingParts";
import { preloadPdfAssets } from "@/lib/pdfAssets";
import { StatusProgressBar } from "@/components/StatusProgressBar";
import { TicketOverviewRow } from "@/components/workspace/TicketOverviewRow";
import { ActivityTimeline } from "@/components/workspace/ActivityTimeline";
import { getStatusGuidance } from "@/lib/serviceNotifications";

import { applyPartsDelta } from "@/lib/inventoryDelta";


// Normalize Google Drive image URLs (same behavior as DeviceReportUpload)
const getAnnotationImageUrl = (url: string): string => {
  if (!url) return url;
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    const id = idMatch[1];
    return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
  }
  return url;
};

const parseServiceTimestamp = (ts: string | undefined | null): Date | null => {
  if (!ts) return null;
  try {
    const parsed = parse(ts, "MM-dd-yyyy, H:mm", new Date());
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
};

interface InventoryItem {
  id: string;
  name: string;
  deviceType?: string;
  model?: string;
  brand?: string;
  partType?: string;
  color?: string;
  supplier?: string;
  cost: number;
  quantity: number;
}

/** Token-based match across every useful part field. */
const matchesPartSearch = (item: InventoryItem, search: string) => {
  const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = [
    item.id,
    item.name,
    item.brand,
    item.deviceType,
    item.model,
    item.partType,
    item.color,
    item.supplier,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return tokens.every((t) => haystack.includes(t));
};

/** Compact label with the identifying attributes of a part. */
const partLabel = (item: InventoryItem) =>
  [item.brand, item.deviceType, item.model, item.color, item.partType]
    .filter(Boolean)
    .join(" • ");


const ServiceUpdate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [serviceId, setServiceId] = useState("");
  const [serviceData, setServiceData] = useState<any>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfModalUrl, setPdfModalUrl] = useState<string | null>(null);
  const [pdfModalTitle, setPdfModalTitle] = useState("Document");
  const openPdfModal = async (
    legacy: string | undefined,
    sid: string | undefined,
    kind: "intake" | "quotation",
    title: string,
  ) => {
    const signed = sid ? await getServicePdfSignedUrl(sid, kind) : null;
    const url = signed || (legacy ? normalizeGoogleDrivePdfUrl(legacy, "preview") : null);
    if (!url) {
      toast({ title: "No PDF Available", description: "PDF not found in storage", variant: "destructive" });
      return;
    }
    setPdfModalUrl(url);
    setPdfModalTitle(title);
    setPdfModalOpen(true);
  };
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedParts, setSelectedParts] = useState<{[key: string]: number}>({});
  const [unmatchedParts, setUnmatchedParts] = useState<{[name: string]: number}>({});
  const [deviceReportPhotos, setDeviceReportPhotos] = useState<File[]>([]);
  const [existingDeviceReportPhotoUrls, setExistingDeviceReportPhotoUrls] = useState<string[]>([]);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  // Use React Query for staff and inventory
  const { data: staffData = [] } = useStaff();
  const { data: technicianData = [] } = useTechnicians();
  const { data: inventoryData = [] } = useInventory();
  const { data: fastMovingData = [] } = useFastMovingParts();

  const username = (sessionStorage.getItem("userFullName") || sessionStorage.getItem("username")) || "Unknown";
  const userRole = sessionStorage.getItem("userRole") || "Unknown";
  
  // Get current user's full name if they're a technician
  const currentUserFullName = useMemo(() => {
    if (userRole !== "technician") return "";
    const currentUser = staffData.find(s => s.username === username);
    return currentUser?.name || "";
  }, [staffData, username, userRole]);

  // Derive technicians list with display names
  const technicians = useMemo(() => {
    return technicianData.map((staff) => ({
      name: staff.name,
      department: staff.department || "",
      displayName: `${staff.name} - ${staff.department || ""}`,
    }));
  }, [technicianData]);

  // Combine regular inventory with received fast moving parts
  const inventory = useMemo(() => {
    const allInventory: InventoryItem[] = inventoryData.map((item) => ({
      id: item.partId,
      name: item.partName,
      deviceType: item.deviceType || "",
      model: item.model || "",
      brand: item.brand || "",
      partType: item.partType || "",
      color: item.color || "",
      supplier: item.supplier || "",
      cost: typeof item.costPerUnit === 'string' ? parseFloat(item.costPerUnit.replace(/[^0-9.]/g, "")) || 0 : 0,
      quantity: item.quantity || 0
    }));

    const receivedParts: InventoryItem[] = fastMovingData
      .filter((part) => part.status === "Received")
      .map((part) => ({
        id: part.partId,
        name: part.partName,
        deviceType: part.deviceType || "",
        model: part.model || "",
        brand: part.brand || "",
        partType: part.partType || "",
        color: "",
        supplier: part.supplier || "",
        cost: parseFloat(String(part.cost || "0").replace(/[^0-9.]/g, "")) || 0,
        quantity: parseInt(String(part.quantity || "0").replace(/[^0-9]/g, "")) || 0
      }));

    return [...allInventory, ...receivedParts];
  }, [inventoryData, fastMovingData]);

  const [partSearch, setPartSearch] = useState("");
  const filteredInventory = useMemo(
    () => inventory.filter((item) => matchesPartSearch(item, partSearch)),
    [inventory, partSearch],
  );


  // Update form fields
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateTechnician, setUpdateTechnician] = useState("");
  const [updateTechnicianDiagnosis, setUpdateTechnicianDiagnosis] = useState("");
  const [updateTechnicianNotesInternal, setUpdateTechnicianNotesInternal] = useState("");
  const [updateTechnicianReport, setUpdateTechnicianReport] = useState("");
  const [isDiagnosisOpen, setIsDiagnosisOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [rawDiagnosis, setRawDiagnosis] = useState("");
  const [updateAIDiagnosis, setUpdateAIDiagnosis] = useState("");
  const [isFormattingAI, setIsFormattingAI] = useState(false);
  const [updateServiceReport, setUpdateServiceReport] = useState("");
  const [isFormattingReport, setIsFormattingReport] = useState(false);
  
  // Discount and final cost states
  const [discountType, setDiscountType] = useState<"amount" | "percentage">("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [finalCost, setFinalCost] = useState(0);

  // Auto-load when arriving from notifications (/service-update?serviceId=...)
  useEffect(() => {
    // Preload PDF assets for faster generation
    preloadPdfAssets();
    
    const urlServiceId = searchParams.get("serviceId");
    if (urlServiceId) {
      setServiceId(urlServiceId);
      searchService(urlServiceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Parse existing parts when both service data and inventory are available
  useEffect(() => {
    if (serviceData && serviceData.partsUsed) {
      const partsMapById: {[key: string]: number} = {};
      const unmatched: {[name: string]: number} = {};
      
      const raw = String(serviceData.partsUsed);
      const items = raw.split(',').map((p: string) => p.trim()).filter(Boolean);
      items.forEach((partStr: string) => {
        const match = partStr.match(/^(.+?)\s*\((?:x\s*)?(\d+)\)$/i);
        if (!match) return;
        const tokenRaw = match[1].trim();
        const token = tokenRaw.toLowerCase();
        const qty = parseInt(match[2]);

        // Match by Part ID (exact match, case-insensitive) - handles FM prefix parts from Fast Moving Inventory
        // Fallback to name match for legacy rows that stored part names instead of IDs
        const found =
          inventory.find(i => i.id?.toLowerCase() === token) ||
          inventory.find(i => i.name?.toLowerCase() === token);

        if (found) {
          partsMapById[found.id] = qty;
        } else {
          unmatched[tokenRaw] = qty;
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
              const m = partStr.match(/^(.+?)\s*\((?:x\s*)?(\d+)\)$/i);
              if (!m) return;
              const tokenRaw = m[1].trim();
              const token = tokenRaw.toLowerCase();
              const qty = parseInt(m[2]);

              // Match by Part ID (exact match, case-insensitive) - handles FM prefix parts
              const item =
                inventory.find(i => i.id?.toLowerCase() === token) ||
                inventory.find(i => i.name?.toLowerCase() === token);

              if (item) byId[item.id] = qty;
              else unmatched[tokenRaw] = qty;
            });
            setSelectedParts(byId);
            setUnmatchedParts(unmatched);
          }
        }
      } catch (e) {
        // Failed to derive parts from logs
      }
    };
    run();
  }, [serviceData, serviceId, inventory]);

  // ---- Status-first flow ----------------------------------------------------
  // Picking a new status is always step 1 (nothing is revealed before that), but
  // the fields that appear belong to the ticket's CURRENT (saved) stage — the
  // work for a stage is recorded while the ticket is actually in that stage.
  const savedStatus = serviceData?.status || "";
  const statusChanged = !!updateStatus && updateStatus !== savedStatus;
  // Nothing is revealed until the technician picks a NEW status.
  const stageStatus = statusChanged ? savedStatus : "";


  const DONE_REPAIR_STAGES = [
    "Done Repair - Under Observation",
    "Done Repair - Observation",
    "Done Repair - For Release",
    "Done Repair - Advise Client",
    "Released",
    "Completed",
    "Backjob",
    "RTO",
  ];

  const showDiagnosisStage =
    stageStatus === "Pending Diagnosis" || stageStatus === "Confirmed Diagnosis";
  const showReportStage = DONE_REPAIR_STAGES.includes(stageStatus);
  const showReportEditors =
    stageStatus === "Done Repair - Under Observation" ||
    stageStatus === "Done Repair - Observation" ||
    stageStatus === "Done Repair - For Release";
  const showPartsStage = stageStatus === "Ongoing Service";

  const stageHint = (() => {
    if (showDiagnosisStage)
      return "Enter the technician diagnosis and run the AI formatter, then click Update to save it with this status.";
    if (showPartsStage) return "Select the parts used from inventory, then click Update.";
    if (showReportStage)
      return "Enter the technician report and run the AI formatter, then click Update.";
    return "Add any remarks or notes for this stage, then click Update.";
  })();

  const NEXT_STATUS: Record<string, string> = {
    "Pending Diagnosis": "Confirmed Diagnosis",
    "Confirmed Diagnosis": "Ongoing Service",
    "Proceed Repair": "Ongoing Service",
    "Waiting to Proceed": "Ongoing Service",
    "Ongoing Service": "Done Repair - Under Observation",
    "Done Repair - Under Observation": "Done Repair - For Release",
  };
  const suggestedNext = NEXT_STATUS[savedStatus];


  const calculateActualCost = () => {
    return Object.entries(selectedParts).reduce((total, [itemId, qty]) => {
      const item = inventory.find(i => i.id === itemId);
      return total + (item ? item.cost * qty : 0);
    }, 0);
  };

  const handleQRScan = (decodedText: string) => {
    try {
      // The QR code contains the part ID directly
      const partId = decodedText.trim();
      
      // Find matching part in inventory by ID
      const foundPart = inventory.find(item => item.id === partId);

      if (foundPart) {
        setSelectedParts(prev => ({
          ...prev,
          [foundPart.id]: (prev[foundPart.id] || 0) + 1
        }));
        toast({
          title: "Part Added",
          description: `${foundPart.name} has been added to the service`,
        });
      } else {
        toast({
          title: "Part Not Found",
          description: `Could not find part with ID: ${partId}`,
          variant: "destructive",
        });
      }
      
      setShowQRScanner(false);
    } catch (error) {
      toast({
        title: "Scan Error",
        description: "Failed to process the scanned QR code",
        variant: "destructive",
      });
      setShowQRScanner(false);
    }
  };

  const handleViewPDF = () =>
    openPdfModal(serviceData?.pdfUrl, serviceData?.serviceId, "intake", "Client Intake Form");

  // Fallback: resolve intake & quotation PDFs from Supabase Storage so the View PDF buttons enable
  useEffect(() => {
    let cancelled = false;
    const sid = serviceData?.serviceId;
    if (!sid) return;
    (async () => {
      if (!serviceData?.pdfUrl) {
        const url = await getServicePdfSignedUrl(sid, "intake");
        if (!cancelled && url) {
          setServiceData((prev: any) => (prev && prev.serviceId === sid ? { ...prev, pdfUrl: url } : prev));
        }
      }
      if (!serviceData?.quotationPdfUrl) {
        const url = await getServicePdfSignedUrl(sid, "quotation");
        if (!cancelled && url) {
          setServiceData((prev: any) => (prev && prev.serviceId === sid ? { ...prev, quotationPdfUrl: url } : prev));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [serviceData?.serviceId, serviceData?.pdfUrl, serviceData?.quotationPdfUrl]);

  async function searchService(id: string) {
    if (!id) {
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
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=searchService&serviceId=${id}`,
      );
      const data = await response.json();

      if (data.status === "found") {
        // Check if technician user is assigned to this service
        if (userRole === "technician" && currentUserFullName) {
          // Parse technician field - can be comma-separated list of full names
          const assignedTechnicians = (data.data.technician || "")
            .split(",")
            .map((t: string) => t.trim().toLowerCase())
            .filter(Boolean);
          
          // Current user's name (lowercase for comparison)
          const currentUserName = currentUserFullName.toLowerCase().trim();
          
          // Check if current technician's exact name matches any assigned technician
          const isAssigned = assignedTechnicians.some((assignedName: string) => {
            // Exact match check
            if (assignedName === currentUserName) return true;
            // Check if the assigned name contains the full name (for cases like "John Doe - Department")
            if (assignedName.includes(currentUserName)) return true;
            // Check if the current user's name contains the assigned name
            if (currentUserName.includes(assignedName) && assignedName.length > 3) return true;
            return false;
          });
          
          if (!isAssigned) {
            toast({
              title: "Access Denied",
              description: "You are not assigned to this service",
              variant: "destructive",
            });
            setServiceData(null);
            setDeviceReportPhotos([]);
            setIsLoading(false);
            return;
          }
        }
        
        try {
          const { data: row } = await supabase.from("services").select("*").eq("service_id", id).maybeSingle();
          if (row) {
            const sb = mapServiceRow(row);
            const pick = (a: any, b: any) => (a !== undefined && a !== null && a !== "" ? a : b);
            data.data = {
              ...data.data,
              username: pick(sb.username, data.data.username),
              devicePassword: pick(sb.devicePassword, data.data.devicePassword),
              colorMemory: pick(sb.colorMemory, data.data.colorMemory),
              color: pick(sb.color, data.data.color),
              memory: pick(sb.memory, data.data.memory),
              email: pick(sb.email, data.data.email),
              phone: pick(sb.contactNumber, data.data.phone),
              contactNumber: pick(sb.contactNumber, data.data.contactNumber),
              chiefComplaint: pick(sb.chiefComplaint, data.data.chiefComplaint),
              deviceNotes: pick(sb.deviceNotes, data.data.deviceNotes),
              technicianReport: pick(sb.technicianReport, data.data.technicianReport),
              finalCost: pick(Number(sb.finalCost) > 0 ? sb.finalCost : null, data.data.finalCost),
              partsCost: pick(Number(sb.partsCost) > 0 ? sb.partsCost : null, data.data.partsCost),
              estimatedCost: pick(sb.estimatedCost, data.data.estimatedCost),
              discount: pick(Number(sb.discount) > 0 ? sb.discount : null, data.data.discount),
              serviceCost: pick(Number(sb.serviceCost) > 0 ? sb.serviceCost : null, data.data.serviceCost),
              clientType: pick(sb.clientType, data.data.clientType),
              priority: pick(sb.priority, data.data.priority),
              conditions: sb.conditions && Object.keys(sb.conditions).length ? sb.conditions : data.data.conditions,
              technicianNotesInternal: pick(sb.internalTechnicianNotes, data.data.technicianNotesInternal),
              adminNotesInternal: pick(sb.internalAdminNotes, data.data.adminNotesInternal),
              targetDate: pick(sb.targetDate, data.data.targetDate),
              status: pick(sb.status, data.data.status),
              // Raw technician notes and the AI-formatted diagnosis are stored
              // in separate columns so they no longer overwrite each other.
              technicianDiagnosis: pick(sb.technicianDiagnosis, data.data.technicianDiagnosis),
              aiDiagnosis: pick(sb.diagnosis, data.data.aiDiagnosis),
              aiReport: pick(sb.aiReport, data.data.aiReport),
            };
          }
        } catch { /* ignore */ }
        setServiceData(data.data);
        // Initialize update fields with current values
        setUpdateStatus(data.data.status || "");
        setUpdateTechnician(data.data.technician || "");
        setUpdateTechnicianDiagnosis(data.data.technicianDiagnosis || "");
        setUpdateTechnicianNotesInternal(data.data.technicianNotesInternal || "");
        setUpdateTechnicianReport(data.data.technicianReport || "");
        setRawDiagnosis(data.data.technicianDiagnosis || ""); // Column AE - raw diagnosis
        setUpdateAIDiagnosis(data.data.aiDiagnosis || ""); // Column AF - AI formatted diagnosis
        setUpdateServiceReport(data.data.aiReport || ""); // Column BB - AI formatted service report

        // Initialize discount and final cost
        const serviceCostNum = sanitizeNumber(data.data.serviceCost || "0");
        const savedDiscountNum = sanitizeNumber(data.data.discount || "0");
        const savedFinalCost = sanitizeNumber(data.data.finalCost || "0");

        setDiscountAmount(savedDiscountNum);
        setFinalCost(savedFinalCost > 0 ? savedFinalCost : serviceCostNum);

        // Determine discount type from saved data
        if (savedDiscountNum > 0) {
          const isPercentage = savedDiscountNum < serviceCostNum && savedDiscountNum <= 100;
          if (isPercentage && (serviceCostNum - (serviceCostNum * savedDiscountNum / 100)).toFixed(2) === savedFinalCost.toFixed(2)) {
            setDiscountType("percentage");
            setDiscountValue(savedDiscountNum.toString());
          } else {
            setDiscountType("amount");
            setDiscountValue(savedDiscountNum.toString());
          }
        } else {
          setDiscountType("amount");
          setDiscountValue("");
        }

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
  }

  const handleSearch = async () => {
    await searchService(serviceId);
  };

  const loadExistingPhotos = async (folderUrl: string) => {
    try {
      const folderId = extractFolderIdFromUrl(folderUrl);
      if (!folderId) {
        // No folderId - folder URL might be invalid
        return;
      }

      // Fetching existing photos from folder
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=getDeviceReportPhotos&folderId=${folderId}`
      );
      const data = await response.json();
      // Photos response received

      if (data.status === "success" && data.photos && data.photos.length > 0) {
        setExistingDeviceReportPhotoUrls(data.photos);
      }

    } catch (error) {
      // Failed to load existing photos
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
      const unmatchedArray = Object.entries(unmatchedParts)
        .filter(([_, qty]) => qty > 0)
        .map(([name, qty]) => ({ id: null as any, name, quantity: qty }));
      
      // Store Part ID instead of Part Name in Column AU (Parts Used)
      const partsUsedString = [...partsUsedArray, ...unmatchedArray]
        .map(part => part.id ? `${part.id} (${part.quantity})` : `${part.name} (${part.quantity})`)
        .join(", ");
      
      const noParts = partsUsedString.trim() === "";
      // For Google Sheets: send a single space when no parts so Apps Script updates the cell and clears previous value
      const partsUsedForSheet = noParts ? " " : partsUsedString;
      
      // Parts data prepared for update

      const formData = new FormData();
      formData.append("action", "updateTechnicianService");
      formData.append("serviceId", serviceId);
      formData.append("deviceType", serviceData.deviceType);
      formData.append("status", updateStatus);
      formData.append("technician", updateTechnician);
      
      // Get ALL technicians' departments (keep duplicates so each technician's department is visible)
      const techNames = updateTechnician.split(", ").filter(Boolean);
      const departments = techNames
        .map(name => technicians.find(t => t.name === name)?.department)
        .filter(Boolean)
        .join(", ");
      formData.append("technicianDepartment", departments);
      formData.append("department", departments);
      formData.append("Technician Department", departments);
      formData.append("technicianDiagnosis", updateTechnicianDiagnosis);
      formData.append("suggestedRepair", "");
      formData.append("technicianNotesInternal", updateTechnicianNotesInternal);
      formData.append("technicianReport", updateTechnicianReport);
      formData.append("aiDiagnosis", updateAIDiagnosis);
      formData.append("aiReport", updateServiceReport);
      formData.append("actualCost", actualCost.toString());
      formData.append("partsUsed", partsUsedForSheet); // Single space if no parts so Apps Script clears cell
      formData.append("partsUsedData", JSON.stringify([...partsUsedArray, ...unmatchedArray])); // Empty array if no parts
      formData.append("discount", discountAmount.toString());
      formData.append("finalCost", finalCost.toString());
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

      // When transitioning into "Done Repair - For Release" the AI Report is
      // promoted into the persisted Technician Report field so it stays visible
      // through release/completion.
      const promotingToForRelease =
        updateStatus === "Done Repair - For Release" &&
        serviceData?.status !== "Done Repair - For Release";
      const technicianReportToPersist = promotingToForRelease && (updateServiceReport || "").trim()
        ? updateServiceReport
        : updateTechnicianReport;
      if (promotingToForRelease) {
        setUpdateTechnicianReport(technicianReportToPersist);
      }

      // Mirror critical updates to Supabase (source of truth)
      const { data: updatedRows, error: sbUpdateError } = await supabase.from("services").update({
        status: updateStatus as any,
        technicians: updateTechnician.split(",").map(s => s.trim()).filter(Boolean),
        technician_departments: departments.split(",").map(s => s.trim()).filter(Boolean),
        // Raw technician notes stay separate from the AI-formatted diagnosis,
        // which shares the `diagnosis` field with /manage-client and /track.
        technician_diagnosis: updateTechnicianDiagnosis,
        diagnosis: (updateAIDiagnosis || "").trim() ? updateAIDiagnosis : updateTechnicianDiagnosis,
        ai_report: updateServiceReport,
        internal_technician_notes: updateTechnicianNotesInternal,
        technician_report: technicianReportToPersist,
        parts_used: partsUsedArray.map((p: any) => p.partId || p.partName || p),
        parts_cost: actualCost,
        discount: discountAmount,
        final_cost: finalCost,
        last_updated: new Date().toISOString(),
      }).eq("service_id", serviceId).select("service_id");

      // A policy mismatch returns no error but affects zero rows — treat as failure.
      const noRowsUpdated = !sbUpdateError && (updatedRows?.length ?? 0) === 0;

      if (sbUpdateError || noRowsUpdated) {
        toast({
          title: "Update failed",
          description: sbUpdateError
            ? sbUpdateError.message
            : "You don't have permission to update this service, or it no longer exists. Ask an admin to confirm you're assigned to it.",
          variant: "destructive",
        });
        setIsUpdating(false);
        return;
      }

      // Fire-and-forget Sheets sync (non-blocking) — only after a confirmed save
      try {
        fetch(GOOGLE_SHEETS_SCRIPT_URL, { method: "POST", body: formData }).catch(() => {});
      } catch { /* ignore */ }

      const isSuccess = true;


      if (isSuccess) {
        // Show success immediately - don't wait for background tasks
        toast({
          title: "Success",
          description: "Service information updated successfully",
        });
        
        // Clear selected parts and new photos
        setSelectedParts({});
        setDeviceReportPhotos([]);
        // Refresh the data to show updated photos
        handleSearch();

        // Fire-and-forget: AI fields, logging, and notifications (don't block UI)
        const userFullName = sessionStorage.getItem("userFullName") || username;
        const changes: string[] = [];
        if (updateStatus !== serviceData.status) changes.push(`Status: ${serviceData.status} → ${updateStatus}`);
        if (updateTechnician !== serviceData.technician) changes.push(`Technician: ${serviceData.technician || "Unassigned"} → ${updateTechnician}`);
        if (updateTechnicianDiagnosis !== serviceData.technicianDiagnosis) changes.push("Updated diagnosis");
        
        const prevParts = (serviceData.partsUsed || "").trim();
        const newPartsDisplay = partsUsedString.trim();
        if (newPartsDisplay !== prevParts) {
          if (newPartsDisplay) {
            changes.push(`Parts used: ${newPartsDisplay}, Actual cost: ₱${actualCost}`);
          } else {
            changes.push("Parts removed");
          }
        }
        
        if (deviceReportPhotos.length > 0) changes.push(`Added ${deviceReportPhotos.length} device report photo${deviceReportPhotos.length > 1 ? 's' : ''}`);

        // Run all background tasks in parallel, non-blocking
        const backgroundTasks: Promise<any>[] = [];

        // Inventory deduction / restock from parts_used diff
        const performerId = sessionStorage.getItem("authUserId");
        backgroundTasks.push(
          applyPartsDelta({
            serviceId,
            prevPartsString: String(serviceData.partsUsed || ""),
            newParts: [...partsUsedArray, ...unmatchedArray].map((p: any) => ({
              id: p.id, name: p.name, quantity: p.quantity,
            })),
            performerId,
            performerName: userFullName,
          }).catch(() => {})
        );

        // AI fields update
        if (updateAIDiagnosis || updateServiceReport) {
          const aiFormData = new FormData();
          aiFormData.append("action", "updateService");
          aiFormData.append("serviceId", serviceId);
          aiFormData.append("deviceType", serviceData.deviceType);
          aiFormData.append("aiDiagnosis", updateAIDiagnosis);
          aiFormData.append("aiReport", updateServiceReport);
          backgroundTasks.push(
            fetch(GOOGLE_SHEETS_SCRIPT_URL, { method: "POST", body: aiFormData }).catch(() => {})
          );
        }

        // Activity logging
        if (changes.length > 0) {
          backgroundTasks.push(
            logActivity({
              serviceId: serviceId,
              username: username,
              role: userRole,
              activity: `Service updated: ${changes.join(", ")}`
            }).catch(() => {})
          );
        }

        // Status change notification
        if (updateStatus !== serviceData.status) {
          backgroundTasks.push(
            Promise.resolve(notifyServiceStatusChange(
              {
                serviceId,
                clientName: serviceData.clientName,
                technician: updateTechnician,
                adminRep: serviceData.adminRep,
                deviceType: serviceData.deviceType,
                device: serviceData.device,
              },
              serviceData.status,
              updateStatus,
              userFullName,
              userRole || undefined
            )).catch(() => {})
          );
        }

        // Technician change notification
        if (updateTechnician !== serviceData.technician) {
          backgroundTasks.push(
            Promise.resolve(notifyNewServiceAssignment(
              {
                serviceId,
                clientName: serviceData.clientName,
                technician: updateTechnician,
                adminRep: serviceData.adminRep,
                deviceType: serviceData.deviceType,
                device: serviceData.device,
              },
              updateTechnician,
              userFullName
            )).catch(() => {})
          );
        }

        // Execute all background tasks without blocking
        Promise.allSettled(backgroundTasks).catch(() => {});
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast({
        title: "Update failed",
        description: msg || "Failed to update service information",
        variant: "destructive",
      });
    } finally {

      setIsUpdating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 animate-fade-in">
        <PageHeader
          title="Service Update"
          subtitle="Update service status and progress"
          icon={<Wrench className="h-5 w-5" />}
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
              {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching...</>) : "Search Service"}
            </Button>
          </CardContent>
        </Card>

        {/* Service Details and Update Form */}
        {serviceData && (
          <div className="space-y-8">
          <TicketWorkspaceHero service={serviceData} />
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

            guidance={getStatusGuidance(
              serviceData.status || "",
              {
                serviceId: serviceData.serviceId || "",
                clientName: serviceData.clientName || "",
                technician: serviceData.technician ?? "",
                adminRep: serviceData.adminRep,
                device: serviceData.device || serviceData.deviceType,
              },
              "technician",
            )}
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
                <CardTitle className="text-2xl tracking-tight">Client Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Status:</h3>
                  <p className="text-lg font-bold text-primary">{serviceData.status || "Pending Diagnosis"}</p>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-lg mb-3">Client Intake Form</h3>
                  <Button onClick={handleViewPDF} variant="outline" className="w-full" disabled={!serviceData?.pdfUrl}>
                    <FileText className="mr-2 h-4 w-4" />
                    {serviceData?.pdfUrl ? "View PDF" : "Not Available"}
                  </Button>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-lg mb-3">Service Quotation Form</h3>
                  <Button
                    onClick={() => openPdfModal(serviceData?.quotationPdfUrl, serviceData?.serviceId, "quotation", "Service Quotation Form")}
                    variant="outline"
                    className="w-full"
                    disabled={!serviceData?.quotationPdfUrl}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {serviceData?.quotationPdfUrl ? "View PDF" : "Not Available"}
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

                  {serviceData.annotationImageUrl && (
                    <div>
                      <h3 className="font-semibold text-sm text-muted-foreground mb-1">Device Annotation Photo:</h3>
                      <img
                        src={getAnnotationImageUrl(serviceData.annotationImageUrl)}
                        alt="Device annotation"
                        className="w-full rounded-lg border border-border mt-2"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <a
                        href={serviceData.annotationImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs text-primary underline break-all"
                      >
                        Open in Google Drive
                      </a>
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
                      {(() => {
                        const parsed = parseServiceTimestamp(serviceData.timestamp);
                        return parsed
                          ? format(parsed, "MM/dd/yyyy, HH:mm")
                          : (serviceData.timestamp || "N/A");
                      })()}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Estimated Time Frame:</h3>
                    <p className="text-lg">{serviceData.timeFrame || "N/A"}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Estimated Target Date:</h3>
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

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Discount:</h3>
                    <p className="text-lg">
                      {discountAmount > 0 ? `Php ${discountAmount.toFixed(2)}` : "Php 0.00"}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-1">Final Cost:</h3>
                    <p className="text-lg font-semibold text-primary">Php {finalCost.toFixed(2)}</p>
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
            <Card className="rounded-2xl border-border/60 bg-[hsl(var(--surface-glass))] shadow-[var(--shadow-float)] backdrop-blur">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="text-2xl tracking-tight">Service Update</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="status">
                    Step 1 — Set Status: <span className="text-xs font-normal text-muted-foreground">(currently {savedStatus || "—"})</span>
                  </Label>
                  {suggestedNext && !statusChanged && (
                    <p className="text-xs text-muted-foreground">
                      Next step is usually <span className="font-medium">{suggestedNext}</span>. Choose it first — the fields for that stage will appear below.
                    </p>
                  )}
                  <Select 
                    value={updateStatus} 
                    onValueChange={(value) => {
                      const allowRevertToPending = serviceData?.status === "Confirmed Diagnosis";
                      const restrictedStatuses = [
                        ...(allowRevertToPending ? [] : ["Pending Diagnosis"]),
                        "Waiting to Proceed",
                        "Proceed Repair",
                        "Done Repair - Advise Client",
                        "Completed",
                        "Backjob",
                        "RTO",
                        "Cancelled"
                      ];
                      
                      // Prevent selection of restricted statuses
                      if (restrictedStatuses.includes(value)) {
                        toast({
                          title: "Status Restricted",
                          description: "This status cannot be selected from Service Update",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      setUpdateStatus(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(status => {
                        const allowRevertToPending = serviceData?.status === "Confirmed Diagnosis";
                        const restrictedStatuses = [
                          ...(allowRevertToPending ? [] : ["Pending Diagnosis"]),
                          "Waiting to Proceed",
                          "Proceed Repair",
                          "Done Repair - Advise Client",
                          "Completed",
                          "Backjob",
                          "RTO",
                          "Cancelled"
                        ];
                        const isRestricted = restrictedStatuses.includes(status);
                        
                        return (
                          <SelectItem 
                            key={status} 
                            value={status}
                            disabled={isRestricted}
                          >
                            {status}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {!statusChanged ? (
                  <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-center">
                    <p className="text-sm font-semibold text-primary">Set the status first</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Choose the next status above{suggestedNext ? ` (usually ${suggestedNext})` : ""} and the fields for that stage will appear here.
                    </p>
                  </div>
                ) : (
                <>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Step 2 — {stageStatus || "Update"}
                  </p>
                  <p className="text-sm text-muted-foreground">{stageHint}</p>
                </div>


                <div className="space-y-2">
                  <Label htmlFor="technician">Assigned Technician:</Label>
                  <MultiSelect
                    options={(() => {
                      // Filter technicians based on device type
                      const deviceType = serviceData?.deviceType;
                      
                      const unassignedOption = { label: "Unassigned", value: "unassigned", group: "Status" };
                      
                      // Check if device type is in the predefined list
                      const isPreDefinedDeviceType = deviceType && 
                        (DEVICE_TYPES as readonly string[]).includes(deviceType);
                      
                      // If no device type or custom device (not in predefined list), show all technicians
                      if (!deviceType || !isPreDefinedDeviceType) {
                        return [
                          unassignedOption,
                          ...technicians.map(tech => ({
                            label: tech.name,
                            value: tech.name,
                            group: tech.department
                          }))
                        ];
                      }
                      
                      // Filter by department only for predefined device types
                      const filteredTechs = technicians.filter(tech => {
                        const deptDeviceTypes = DEVICE_TYPES_BY_DEPARTMENT[tech.department];
                        return deptDeviceTypes && deptDeviceTypes.includes(deviceType);
                      });
                      
                      return [
                        unassignedOption,
                        ...filteredTechs.map(tech => ({
                          label: tech.name,
                          value: tech.name,
                          group: tech.department
                        }))
                      ];
                    })()}
                    selected={updateTechnician ? updateTechnician.split(", ") : []}
                    onChange={(values) => setUpdateTechnician(values.join(", "))}
                    placeholder="Select Technicians"
                    grouped
                  />
                </div>

                {showDiagnosisStage && (
                  <div className="space-y-2">
                    <Label htmlFor="technicianDiagnosis">Technician Diagnosis:</Label>
                    <Textarea
                      id="technicianDiagnosis"
                      placeholder="Enter technician diagnosis"
                      value={updateTechnicianDiagnosis}
                      onChange={(e) => {
                        setUpdateTechnicianDiagnosis(e.target.value);
                        setRawDiagnosis(e.target.value);
                      }}
                      rows={4}
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                )}

                {/* Diagnosis Toggle - based on the selected (next) status */}
                {showDiagnosisStage && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Collapsible open={isDiagnosisOpen} onOpenChange={setIsDiagnosisOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <span className="font-semibold">AI Diagnosis Formatter</span>
                          <span className="text-xs">{isDiagnosisOpen ? "▼" : "▶"}</span>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <div className="flex gap-2 mb-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                 if (!rawDiagnosis?.trim()) {
                                   toast({
                                     title: "No Raw Diagnosis",
                                     description: "No raw diagnosis data found from the technician (Column AE)",
                                     variant: "destructive",
                                   });
                                   return;
                                 }
                                 const ok = window.confirm(
                                   "AI Diagnosis Formatter\n\nThis uses AI to reformat your raw diagnosis. AI output may contain mistakes — review every section (especially Service Breakdown costs) before saving or sharing with the client.\n\nProceed?"
                                 );
                                 if (!ok) return;

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
                                    finalCost: serviceData?.finalCost || serviceData?.serviceCost || '0',
                                  });

                                  const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?${params}`);

                                  if (!response.ok) {
                                    throw new Error(`Failed to format diagnosis (status ${response.status})`);
                                  }

                                  const data = await response.json();
                                  
                                  if (data.error) {
                                    throw new Error(data.error);
                                  }

                                  const formattedDiagnosis = data.formattedDiagnosis;

                                  if (formattedDiagnosis) {
                                    setUpdateAIDiagnosis(formattedDiagnosis);
                                    
                                    // Create notification in panel for proofread reminder
                                    const notifyUserId = sessionStorage.getItem("staffId") || sessionStorage.getItem("username");
                                    if (notifyUserId) {
                                      createNotification({
                                        userId: notifyUserId,
                                        title: "AI Diagnosis Generated",
                                        message: `⚠️ Please double-check and proofread the AI-generated diagnosis for ${serviceId} before saving.`,
                                        type: "others",
                                        serviceId,
                                      });
                                    }
                                    
                                    toast({
                                      title: "AI Formatting Complete",
                                      description: "⚠️ Please double-check and proofread the generated diagnosis before saving.",
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
                              }}
                              disabled={isFormattingAI}
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
                          </div>
                          <Label htmlFor="aiDiagnosis">AI Diagnosis (Editable):</Label>
                          <Textarea
                            id="aiDiagnosis"
                            placeholder="AI formatted diagnosis"
                            value={updateAIDiagnosis}
                            onChange={(e) => setUpdateAIDiagnosis(e.target.value)}
                            className="min-h-[100px] resize-none"
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

                {/* Device Diagnosis Photos uploader (technician) - BELOW AI Diagnosis Formatter */}
                {showDiagnosisStage && serviceData?.serviceId && (
                  <DiagnosisPhotos serviceId={serviceData.serviceId} editable title="Device Diagnosis - Photos" />
                )}

                {showReportStage && (
                  <div className="space-y-2">
                    <Label htmlFor="technicianReport">Technician Report:</Label>
                    <Textarea
                      id="technicianReport"
                      placeholder="Enter technician report"
                      value={updateTechnicianReport}
                      onChange={(e) => setUpdateTechnicianReport(e.target.value)}
                      rows={4}
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                )}


                {/* Report Toggle - Only visible when actual sheet status is "Done Repair - Under Observation" */}
                {showReportEditors && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Collapsible open={isReportOpen} onOpenChange={setIsReportOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <span className="font-semibold">AI Report Formatter</span>
                          <span className="text-xs">{isReportOpen ? "▼" : "▶"}</span>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <div className="flex gap-2 mb-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                 if (!updateTechnicianReport?.trim()) {
                                   toast({
                                     title: "No Technician Report",
                                     description: "No technician report data found (Column BA)",
                                     variant: "destructive",
                                   });
                                   return;
                                 }
                                 const ok = window.confirm(
                                   "AI Report Formatter\n\nThis uses AI to reformat your technician report. AI output may contain mistakes — review the generated report carefully before saving.\n\nProceed?"
                                 );
                                 if (!ok) return;

                                setIsFormattingReport(true);
                                try {
                                  const params = new URLSearchParams({
                                    action: 'formatReport',
                                    technicianReport: updateTechnicianReport,
                                    customerName: serviceData?.clientName || '',
                                    deviceType: serviceData?.deviceType || '',
                                    model: serviceData?.device || '',
                                    serviceId: serviceId,
                                    technician: serviceData?.technician || updateTechnician || '',
                                    finalCost: serviceData?.finalCost || serviceData?.serviceCost || '0',
                                  });

                                  const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?${params}`);

                                  if (!response.ok) {
                                    throw new Error(`Failed to format report (status ${response.status})`);
                                  }

                                  const data = await response.json();
                                  
                                  if (data.error) {
                                    throw new Error(data.error);
                                  }

                                  const formattedReport = data.formattedReport;

                                  if (formattedReport) {
                                    setUpdateServiceReport(formattedReport);
                                    
                                    // Create notification in panel for proofread reminder
                                    const notifyUserId = sessionStorage.getItem("staffId") || sessionStorage.getItem("username");
                                    if (notifyUserId) {
                                      createNotification({
                                        userId: notifyUserId,
                                        title: "AI Report Generated",
                                        message: `⚠️ Please double-check and proofread the AI-generated service report for ${serviceId} before saving.`,
                                        type: "others",
                                        serviceId,
                                      });
                                    }
                                    
                                    toast({
                                      title: "AI Formatting Complete",
                                      description: "⚠️ Please double-check and proofread the generated report before saving.",
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
                              }}
                              disabled={isFormattingReport}
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
                          </div>
                          <Label htmlFor="aiReport">AI Report (Editable):</Label>
                          <Textarea
                            id="aiReport"
                            placeholder="AI formatted service report"
                            value={updateServiceReport}
                            onChange={(e) => setUpdateServiceReport(e.target.value)}
                            className="min-h-[100px] resize-none"
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

                {/* Device Report Photos - placed BELOW AI Report Formatter; uploads save to Supabase */}
                {serviceData?.serviceId && showReportStage && (
                  <DeviceReportPhotos
                    serviceId={serviceData.serviceId}
                    editable={showReportEditors}
                  />
                )}

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

                {/* Parts Used from Inventory - Only shown when actual sheet status is "Ongoing Service" */}
                {showPartsStage && (
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
                        placeholder="Search by Part ID, name, brand, device type, model, color, supplier..."
                        className="w-full"
                        value={partSearch}
                        onChange={(e) => setPartSearch(e.target.value)}
                      />

                      {partSearch.trim() !== "" && (
                        <div className="space-y-2 border rounded-md p-3 max-h-64 overflow-y-auto">
                          {filteredInventory.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              No parts match "{partSearch}"
                            </p>
                          ) : (
                            filteredInventory.map((item) => (
                              <div key={`search-${item.id}`} className="flex items-center justify-between gap-2 p-2 rounded border">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{item.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    ID: {item.id}
                                    {partLabel(item) ? ` • ${partLabel(item)}` : ""} • Stock: {item.quantity}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!!selectedParts[item.id]}
                                  onClick={() =>
                                    setSelectedParts((prev) => ({
                                      ...prev,
                                      [item.id]: (prev[item.id] || 0) + 1,
                                    }))
                                  }
                                >
                                  {selectedParts[item.id] ? "Added" : "Add"}
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      <div className="space-y-2 border rounded-md p-3 max-h-64 overflow-y-auto">
                        {inventory.map((item) => {
                          const qty = selectedParts[item.id] || 0;
                          if (qty === 0) return null; // Only show selected parts
                          return (
                            <div key={item.id} className="flex items-center justify-between gap-2 p-2 bg-muted rounded">
                               <div className="flex-1 min-w-0">
                                 <p className="font-medium truncate">{item.name}</p>
                                 <p className="text-xs text-muted-foreground truncate">
                                   ID: {item.id}
                                   {partLabel(item) ? ` • ${partLabel(item)}` : ""} • Stock: {item.quantity}
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
                                          {item.name}{item.deviceType && item.model ? ` [${item.deviceType} - ${item.model}]` : ''} (Stock: {item.quantity})
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
                        <div className="flex gap-2">
                          <div className="flex-1">
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
                                {filteredInventory.map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.id} - {item.name}{partLabel(item) ? ` [${partLabel(item)}]` : ''} (Stock: {item.quantity})
                                  </SelectItem>
                                ))}
                                {filteredInventory.length === 0 && (
                                  <div className="px-2 py-2 text-sm text-muted-foreground">No parts match the search</div>
                                )}

                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm">Scan QR:</Label>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setShowQRScanner(true)}
                              className="w-full"
                            >
                              <QrCode className="h-4 w-4 mr-2" />
                              Scan Part
                            </Button>
                          </div>
                        </div>
                      </div>

                      {showQRScanner && (
                        <div className="mt-4">
                          <QRScanner
                            onScan={handleQRScan}
                            onClose={() => setShowQRScanner(false)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )}

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
                </>
                )}
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

export default ServiceUpdate;
