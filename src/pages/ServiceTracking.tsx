import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { displayDate, formatManilaDate } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { normalizeGoogleDrivePdfUrl } from "@/lib/utils";
import { getServicePdfSignedUrl } from "@/lib/servicePdfStorage";
import { Search, User, FileText, Image as ImageIcon, CheckCircle2, XCircle, Globe, Phone } from "lucide-react";
import logo from "@/assets/S_S_Marketing-2.png";
import { AiReportCard } from "@/components/AiReportCard";
import { PdfViewerModal } from "@/components/PdfViewerModal";
import { DiagnosisPhotos } from "@/components/DiagnosisPhotos";
import { DeviceReportPhotos } from "@/components/DeviceReportPhotos";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { fetchStaffList } from "@/lib/staffList";
import { mapServiceRow } from "@/hooks/useServices";
import { StatusChip } from "@/components/ui/status-chip";
import { usePublicServicePayments, derivePaymentTotals } from "@/hooks/useServicePayments";
import { TrackingShareActions } from "@/components/TrackingShareActions";
import { Checkbox } from "@/components/ui/checkbox";
import { parseServiceBreakdownItems, parseApprovalRemark, approvalRemarkText } from "@/lib/serviceApproval";



// Accepted modes of payment shown on the public tracking page.
const MODES_OF_PAYMENT = [
  "Cash",
  "GCash",
  "Maya",
  "Bank Transfer",
  "Credit Card",
  "Debit Card",
  "GCash QR",
  "Installment",
];

// Social and contact links shown on the public tracking page.
// Update the placeholder values (Viber / phone) when the real details are available.
const SOCIAL_LINKS = [
  {
    name: "Facebook",
    href: "https://www.facebook.com/actechrepairph",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/actechrepairph/",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@actechrepairph",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.58-.18 1.24-.07 1.81.37 1.36 1.7 2.33 3.1 2.26 1.49-.06 2.81-1.12 3.24-2.53.13-.44.14-.9.14-1.34-.04-2.73.02-5.46-.02-8.19-.01-.63-.02-1.26-.02-1.89z" />
      </svg>
    ),
  },
  {
    name: "Website",
    href: "https://actechrepairph.com/",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm1.145 21.063c-.668.1-1.357.154-2.062.154-2.395 0-4.62-.733-6.466-1.985.914-2.05 2.55-3.66 4.64-4.43.48 1.62 1.13 3.14 1.93 4.53.58 1.01 1.25 1.97 1.96 2.73zm3.53-.54c-.7-.76-1.37-1.72-1.95-2.73-.8-1.39-1.45-2.91-1.93-4.53 2.09.77 3.73 2.38 4.64 4.43-.64.41-1.32.75-2.04 1.01-.24.09-.48.16-.72.22v.6zm-8.69-1.43c-1.13-1.45-1.93-3.13-2.31-4.95 1.18-.28 2.42-.44 3.69-.47-.38 1.86-.66 3.75-.84 5.65-.18-.08-.36-.16-.54-.23zm10.84-4.95c-.38 1.82-1.18 3.5-2.31 4.95-.18.07-.36.15-.54.23-.18-1.9-.46-3.79-.84-5.65 1.27.03 2.51.19 3.69.47zm-7.2-6.24c.44 1.53 1.02 2.99 1.73 4.34-.92-.04-1.82-.15-2.69-.33-.87.18-1.77.29-2.69.33.71-1.35 1.29-2.81 1.73-4.34.31-1.06.55-2.15.71-3.27.16 1.12.4 2.21.71 3.27.51 1.76 1.18 3.44 2.01 5.01-.83-1.57-1.5-3.25-2.01-5.01zm4.66 4.01c-.72-1.35-1.3-2.81-1.73-4.34-.31-1.06-.55-2.15-.71-3.27-.16 1.12-.4 2.21-.71 3.27-.44 1.53-1.02 2.99-1.73 4.34.92-.04 1.82-.15 2.69-.33.87.18 1.77.29 2.69.33zm-4.66-7.28c-.16 1.12-.4 2.21-.71 3.27-.44 1.53-1.02 2.99-1.73 4.34-.92-.04-1.82-.15-2.69-.33-.87.18-1.77.29-2.69.33.71-1.35 1.29-2.81 1.73-4.34.31-1.06.55-2.15.71-3.27.16 1.12.4 2.21.71 3.27z" />
      </svg>
    ),
  },
  {
    name: "Viber",
    href: "https://viber.com/",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M11.988 0C5.412 0 .008 5.352.008 11.88c0 3.168 1.236 6.096 3.348 8.292l.012 2.628c0 .696.564 1.26 1.26 1.26h.012c.696 0 1.26-.564 1.26-1.26v-2.04c4.392.744 7.596-.84 7.596-.84-.696 1.392-2.58 2.688-5.052 2.976v1.464c0 1.14-.924 2.064-2.064 2.064h-.012c-1.14 0-2.064-.924-2.064-2.064v-1.272C2.028 21.504 0 17.388 0 12.696 0 5.688 5.688 0 12.696 0h-.708zm5.688 5.76c-.42 0-.756.336-.756.756s.336.756.756.756c2.496 0 4.524 2.028 4.524 4.524 0 .42.336.756.756.756s.756-.336.756-.756c0-3.324-2.712-6.036-6.036-6.036zm-1.548 2.352c-.42 0-.756.336-.756.756 0 .42.336.756.756.756 1.14 0 2.064.924 2.064 2.064 0 .42.336.756.756.756s.756-.336.756-.756c0-1.98-1.596-3.576-3.576-3.576zm-1.512 2.4c-.42 0-.756.336-.756.756 0 .42.336.756.756.756.396 0 .72.324.72.72 0 .42.336.756.756.756s.756-.336.756-.756c0-1.248-1.008-2.232-2.232-2.232z" />
      </svg>
    ),
  },
];

const CONTACT_LINKS = {
  facebook: "https://www.facebook.com/actechrepairph",
  email: "mailto:actechrepairph@gmail.com",
  phone: "tel:", // placeholder — add shop number when available
};

const TERMS_PDF_URL = "/AC_Tech_Terms_and_Condition.pdf";



// Merge Supabase migrated fields over sheet data so public tracking shows
// up-to-date info even when fields were updated post-migration.
const mergeWithSupabase = async (serviceId: string, sheetData: any): Promise<any> => {
  try {
    const { data: row } = await supabase
      .from("services")
      .select("*")
      .eq("service_id", serviceId)
      .maybeSingle();
    if (!row) return sheetData;
    const sb: any = mapServiceRow(row);
    const pick = (a: any, b: any) => (a !== undefined && a !== null && a !== "" ? a : b);
    return {
      ...sheetData,
      username: pick(sb.username, sheetData.username),
      colorMemory: pick(sb.colorMemory, sheetData.colorMemory),
      color: pick(sb.color, sheetData.color),
      memory: pick(sb.memory, sheetData.memory),
      email: pick(sb.email, sheetData.email),
      phone: pick(sb.contactNumber, sheetData.phone),
      contactNumber: pick(sb.contactNumber, sheetData.contactNumber),
      chiefComplaint: pick(sb.chiefComplaint, sheetData.chiefComplaint),
      deviceNotes: pick(sb.deviceNotes, sheetData.deviceNotes),
      technicianReport: pick(sb.technicianReport, sheetData.technicianReport),
      finalCost: pick(Number(sb.finalCost) > 0 ? sb.finalCost : null, sheetData.finalCost),
      partsCost: pick(Number(sb.partsCost) > 0 ? sb.partsCost : null, sheetData.partsCost),
      estimatedCost: pick(sb.estimatedCost, sheetData.estimatedCost),
      clientType: pick(sb.clientType, sheetData.clientType),
      priority: pick(sb.priority, sheetData.priority),
      // Intake / scheduling fields must come from the record itself
      serialNumber: pick(sb.serialNumber, sheetData.serialNumber),
      targetDate: pick(sb.targetDate, sheetData.targetDate),
      timeFrame: pick(sb.timeFrame ?? sb.estimatedCompletion, sheetData.timeFrame ?? sheetData.estimatedCompletion),
      initialPayment: pick(sb.initialPayment, sheetData.initialPayment),
      discount: pick(sb.discount, sheetData.discount),
      serviceDate: pick((row as any).client_approved_at, pick((row as any).service_date, sheetData.serviceDate)),
      dateCompleted: pick(sb.dateCompleted, sheetData.dateCompleted),
      conditions: sb.conditions && Object.keys(sb.conditions).length ? sb.conditions : sheetData.conditions,
      // Status, AI diagnosis and the approval trail live in the database.
      status: pick(sb.status, sheetData.status),
      service: pick(sb.service, sheetData.service),
      aiDiagnosis: pick(sb.diagnosis, sheetData.aiDiagnosis),
      adminNotes: pick(sb.internalAdminNotes, sheetData.adminNotes),
      autoApproveDiagnosis: !!(sb as any).autoApproveDiagnosis,
      approvalLocked: !!(row as any).approval_locked,




    };
  } catch {
    return sheetData;
  }
};

interface CustomerData {
  clientId: string;
  clientName: string;
  username: string;
  phone: string;
  email: string;
  serviceIds: string[];
}

interface ServiceRecord {
  serviceId: string;
  status: string;
  service: string;
  targetDate: string;
  serviceCost: string;
  pdfUrl?: string;
}

const ServiceTracking = () => {
  const { serviceId: routeServiceId } = useParams<{ serviceId?: string }>();
  const navigate = useNavigate();
  const [serviceId, setServiceId] = useState(routeServiceId ?? "");
  const [serviceData, setServiceData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<"service" | "client">("service");
  
  // Client ID search states
  const [clientId, setClientId] = useState("");
  const [isLoadingClient, setIsLoadingClient] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  
  // Device report photos
  const [devicePhotos, setDevicePhotos] = useState<string[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // PDF modal viewer
  const [pdfModalUrl, setPdfModalUrl] = useState<string | null>(null);
  const [pdfModalTitle, setPdfModalTitle] = useState("Document");
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  // Approve / Decline flow (Waiting to Proceed)
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [selectedBreakdown, setSelectedBreakdown] = useState<string[]>([]);


  const { toast } = useToast();

  // Actual money received (POS ledger) for accurate deposit/balance display.
  const { data: paymentsSummary } = usePublicServicePayments(serviceData?.serviceId || undefined);


  // Fetch photos from Google Drive folder
  useEffect(() => {
    const fetchDevicePhotos = async () => {
      if (!serviceData?.deviceReportFolderUrl) {
        setDevicePhotos([]);
        return;
      }

      setLoadingPhotos(true);
      try {
        const folderId = extractFolderIdFromUrl(serviceData.deviceReportFolderUrl);
        if (!folderId) {
          // No folderId - folder URL might be invalid
          setDevicePhotos([]);
          return;
        }

        // Fetching device photos from folder
        const response = await fetch(
          `${GOOGLE_SHEETS_SCRIPT_URL}?action=getDeviceReportPhotos&folderId=${folderId}`
        );
        const data = await response.json();
        // Photos response received

        if (data.status === "success" && data.photos) {
          setDevicePhotos(data.photos);
        } else {
          setDevicePhotos([]);
        }
      } catch (error) {
        console.error("Error fetching device photos:", error);
        setDevicePhotos([]);
      } finally {
        setLoadingPhotos(false);
      }
    };

    fetchDevicePhotos();
  }, [serviceData]);

  const extractFolderIdFromUrl = (url: string): string | null => {
    const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const getDisplayPhotoUrl = (url: string): string => {
    if (!url) return url;

    // Try to extract Google Drive file ID from common URL patterns
    const idMatch =
      url.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
      url.match(/\/d\/([a-zA-Z0-9_-]+)/);

    if (idMatch) {
      const id = idMatch[1];
      // Use Google Drive thumbnail endpoint which returns an embeddable image
      return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
    }

    return url;
  };
  const handleSearch = async (overrideId?: string) => {
    const targetId = (overrideId ?? serviceId).trim();
    if (!targetId) {
      toast({
        title: "Missing Information",
        description: "Please enter Service ID",
        variant: "destructive",
      });
      return;
    }

    // Clear previous results first
    setServiceData(null);
    setDevicePhotos([]);

    setIsLoading(true);
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=searchService&serviceId=${encodeURIComponent(targetId)}`,
      );
      const data = await response.json();

      if (data.status === "found") {
        const merged = await mergeWithSupabase(targetId, data.data);
        setServiceData(merged);
        // Sync URL so the result is shareable
        if (routeServiceId !== targetId) {
          navigate(`/track/${encodeURIComponent(targetId)}`, { replace: true });
        }
      } else {
        toast({
          title: "Not Found",
          description: "No service found with the provided Service ID",
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

  // Auto-fetch when arriving via /track/:serviceId
  useEffect(() => {
    if (routeServiceId && !serviceData && !isLoading) {
      handleSearch(routeServiceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeServiceId]);

  const handleClientSearch = async () => {
    if (!clientId.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a Client ID",
        variant: "destructive",
      });
      return;
    }

    // Clear previous results first
    setCustomerData(null);
    setServiceRecords([]);

    setIsLoadingClient(true);
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=searchClient&clientId=${encodeURIComponent(clientId)}`
      );
      const data = await response.json();

      if (data.status === "success" && data.customer) {
        setCustomerData(data.customer);
        setServiceRecords(data.services || []);
        
        if (!data.services || data.services.length === 0) {
          toast({
            title: "Customer Found",
            description: "Customer found but no service records available",
          });
        }
      } else {
        toast({
          title: "Not Found",
          description: "No customer found with this Client ID",
          variant: "destructive",
        });
        setCustomerData(null);
        setServiceRecords([]);
      }
    } catch (error) {
      console.error("Error searching customer:", error);
      toast({
        title: "Error",
        description: "Failed to search for customer",
        variant: "destructive",
      });
      setCustomerData(null);
      setServiceRecords([]);
    } finally {
      setIsLoadingClient(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleClientSearch();
    }
  };

  const getStatusRowColor = (status: string) => {
    const statusUpper = status.toUpperCase();
    
    // Completed statuses - orange
    if (statusUpper === "COMPLETED") return "bg-orange-50 hover:bg-orange-100";
    
    // Green statuses
    if (statusUpper === "PROCEED REPAIR") return "bg-green-50 hover:bg-green-100";
    if (statusUpper === "ONGOING SERVICE") return "bg-green-50 hover:bg-green-100";
    if (statusUpper === "DONE REPAIR - OBSERVATION") return "bg-green-50 hover:bg-green-100";
    if (statusUpper === "DONE REPAIR - ADVISE CLIENT") return "bg-green-50 hover:bg-green-100";
    if (statusUpper === "FOR PAYMENT") return "bg-green-50 hover:bg-green-100";
    
    // Yellow status
    if (statusUpper === "FOR PICKUP") return "bg-yellow-50 hover:bg-yellow-100";
    
    // Blue status
    if (statusUpper === "BACKJOB") return "bg-blue-50 hover:bg-blue-100";
    
    // Red statuses
    if (statusUpper === "RTO") return "bg-red-50 hover:bg-red-100";
    if (statusUpper === "CANCELLED") return "bg-red-50 hover:bg-red-100";
    
    // White/default statuses (Pending Diagnosis, Confirmed Diagnosis, Waiting to Proceed, On Hold)
    return "bg-white hover:bg-gray-50";
  };

  const openPdf = async (
    legacyUrl: string | undefined,
    sid: string | undefined,
    kind: "intake" | "quotation",
    title: string,
  ) => {
    let signed: string | null = null;
    if (sid) {
      // /track is a public page — visitors aren't authenticated, so the
      // private buckets/tables aren't readable from the client. Resolve
      // through the public edge function instead.
      try {
        const base = (import.meta as any).env?.VITE_SUPABASE_URL || "";
        const anon = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || "";
        const r = await fetch(
          `${base}/functions/v1/get-service-pdf?serviceId=${encodeURIComponent(sid)}&kind=${kind}`,
          { headers: { apikey: anon, Authorization: `Bearer ${anon}` } },
        );
        if (r.ok) {
          const j = await r.json();
          signed = j?.url ?? null;
        }
      } catch {
        signed = null;
      }
    }
    const url = signed || (legacyUrl ? normalizeGoogleDrivePdfUrl(legacyUrl, "preview") : null);
    if (!url) {
      toast({ title: "No PDF Available", description: "PDF not found in storage", variant: "destructive" });
      return;
    }
    setPdfModalUrl(url);
    setPdfModalTitle(title);
    setPdfModalOpen(true);
  };

  const handleViewPDF = (pdfUrl: string, sid?: string) => openPdf(pdfUrl, sid, "intake", "Client Intake Form");

  // Pull "Service Breakdown" lines from the AI diagnosis text and return
  // just the service names (everything before " - " on each line).
  const parseServicesFromDiagnosis = (diagnosis: string): string => {
    if (!diagnosis) return "";
    const lines = diagnosis.split(/\r?\n/);
    const startIdx = lines.findIndex((l) => /service\s*breakdown\s*:?/i.test(l));
    if (startIdx === -1) return "";
    const out: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
      const raw = lines[i].trim();
      if (!raw) {
        if (out.length) break;
        continue;
      }
      // Stop when we hit another section heading (e.g., "To proceed", "SUMMARY:")
      if (/^(to proceed|summary|recommendations|writing rules)/i.test(raw)) break;
      // Strip leading bullet/numbering
      const cleaned = raw.replace(/^[-*•\d.\s]+/, "");
      // Take the part before " - " or "—" (price/description separator)
      const name = cleaned.split(/\s[-—]\s/)[0].trim();
      if (name && !/^php\b/i.test(name)) out.push(name);
    }
    return out.join(", ");
  };

  const submitApproval = async (approved: boolean, reason?: string) => {
    if (!serviceData?.serviceId) return;
    setSubmittingApproval(true);
    try {
      // The /track page is anonymous, so the decision is persisted by a
      // service-role edge function (direct writes are blocked by access rules).
      const { data, error } = await supabase.functions.invoke("submit-client-approval", {
        body: {
          serviceId: serviceData.serviceId,
          approved,
          reason: reason || "",
          selectedServices: approved ? selectedBreakdown : [],
        },
      });

      const payloadError = (data as any)?.error;
      if (error || payloadError) {
        toast({
          title: "Could not submit response",
          description: payloadError || error?.message || "Please try again or contact the shop.",
          variant: "destructive",
        });
        return;
      }

      const partial = !!(data as any)?.partial;
      setServiceData({
        ...serviceData,
        adminNotes: (data as any)?.adminNotes ?? serviceData.adminNotes,
        status: (data as any)?.status ?? serviceData.status,
        service: (data as any)?.service || serviceData.service,
        approvalLocked: partial ? true : serviceData.approvalLocked,
      });
      setDeclineOpen(false);
      setDeclineReason("");
      setConfirmApproveOpen(false);
      toast({
        title: approved ? (partial ? "Partial approval recorded" : "Approved") : "Declined",
        description: partial
          ? "The shop will contact you to confirm the remaining services."
          : "Your response has been recorded.",
      });
    } catch (e) {
      toast({ title: "Error", description: "Failed to submit response.", variant: "destructive" });
    } finally {
      setSubmittingApproval(false);
    }
  };


  // Active progress statuses where AI Diagnosis is shown above the forms
  const ACTIVE_STATUSES = [
    "Waiting to Proceed",
    "Proceed Repair",
    "Ongoing Service",
    "Done Repair - Under Observation",
    "Done Repair - For Release",
    "Done Repair - Advise Client",
    "Completed",
  ];
  const showAiDiagnosis = serviceData && ACTIVE_STATUSES.includes(serviceData.status) && (serviceData.aiDiagnosis || "").trim();
  const showAiReport = serviceData && ["Done Repair - Advise Client", "Completed"].includes(serviceData.status) && (serviceData.aiReport || "").trim();
  const isWaitingToProceed = serviceData?.status === "Waiting to Proceed" && !serviceData?.autoApproveDiagnosis;
  const breakdownItems = parseServiceBreakdownItems(serviceData?.aiDiagnosis || "");
  const needsChecklist = breakdownItems.length > 1;
  const remark = parseApprovalRemark(serviceData?.adminNotes);
  const approvalRecord = remark
    ? { decision: remark.decision, by: remark.by, at: remark.at, reason: remark.reason, text: approvalRemarkText(remark) }
    : null;

  const toggleBreakdown = (item: string) =>
    setSelectedBreakdown((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));

  const startApprove = () => {
    if (needsChecklist && selectedBreakdown.length === 0) {
      toast({
        title: "Select at least one service",
        description: "Please tick the services you'd like us to proceed with.",
        variant: "destructive",
      });
      return;
    }
    setConfirmApproveOpen(true);
  };


  return (
    <div className="min-h-screen w-full">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl w-full min-h-full">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-float)] mb-6 sm:mb-8">
          <div
            className="absolute inset-0 opacity-90 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 60% 80% at 0% 0%, hsl(var(--primary) / 0.10) 0%, transparent 60%), radial-gradient(ellipse 50% 70% at 100% 0%, hsl(var(--primary-glow) / 0.12) 0%, transparent 60%)",
            }}
          />
          <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-6 sm:p-8">
            <div className="relative">
              <div className="absolute inset-0 -m-2 rounded-2xl bg-primary/10 blur-xl" />
              <img
                src={logo}
                alt="AC Tech Repair PH"
                className="relative h-16 w-16 rounded-2xl object-contain bg-white/70 p-1.5 border border-border/50 shadow-[var(--shadow-soft)]"
              />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Service Tracker
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                AC Tech Repair PH
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Track your device repair in real time — enter a Service or Client ID.
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <Tabs
          value={searchMode}
          onValueChange={(value) => {
            setSearchMode(value as "service" | "client");
            setServiceId("");
            setClientId("");
            setServiceData(null);
            setCustomerData(null);
            setServiceRecords([]);
            setDevicePhotos([]);
          }}
          className="mb-8"
        >
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 rounded-full bg-muted/60 p-1 h-11">
            <TabsTrigger value="service" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-[var(--shadow-soft)]">
              <Search className="h-4 w-4 mr-2" />
              Service ID
            </TabsTrigger>
            <TabsTrigger value="client" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-[var(--shadow-soft)]">
              <User className="h-4 w-4 mr-2" />
              Client ID
            </TabsTrigger>
          </TabsList>

          {/* Service ID Search Tab */}
          <TabsContent value="service" className="mt-6">
            <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-elegant)] rounded-2xl">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Label htmlFor="serviceId" className="text-sm font-medium">
                    Service ID
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="serviceId"
                        placeholder="e.g. AC12345"
                        value={serviceId}
                        onChange={(e) => setServiceId(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSearch();
                        }}
                        onFocus={(e) => {
                          if (!e.target.value) {
                            setServiceId("AC");
                            setTimeout(() => e.target.setSelectionRange(2, 2), 0);
                          }
                        }}
                        className="pl-9 h-11 rounded-xl bg-background"
                      />
                    </div>
                    <Button
                      onClick={() => handleSearch()}
                      disabled={isLoading}
                      className="h-11 px-6 rounded-xl bg-gradient-to-r from-primary to-primary-glow shadow-[var(--shadow-elegant)]"
                    >
                      {isLoading ? "Searching..." : "Track Service"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Client ID Search Tab */}
          <TabsContent value="client" className="mt-6">
            <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-elegant)] rounded-2xl">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Label htmlFor="clientId" className="text-sm font-medium">
                    Client ID
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="clientId"
                        placeholder="e.g. CL1234567890"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="pl-9 h-11 rounded-xl bg-background"
                      />
                    </div>
                    <Button
                      onClick={handleClientSearch}
                      disabled={isLoadingClient}
                      className="h-11 px-6 rounded-xl bg-gradient-to-r from-primary to-primary-glow shadow-[var(--shadow-elegant)]"
                    >
                      <Search className="h-4 w-4 mr-2" />
                      {isLoadingClient ? "Searching..." : "Search"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Service Details – Fixy two-column layout */}
        {serviceData && (() => {
          const autoApproved = !!serviceData.autoApproveDiagnosis;
          const STEPS = [
            { key: "pending", label: "Pending", full: "Pending Diagnosis" },
            { key: "confirmed", label: "Confirmed", full: "Confirmed Diagnosis" },
            ...(autoApproved ? [] : [{ key: "waiting", label: "Waiting", full: "Waiting to Proceed" }]),
            { key: "repair", label: "Repair", full: "Proceed Repair" },
            { key: "observation", label: "Observation", full: "Done Repair - Under Observation" },
            { key: "release", label: "For Release", full: "Done Repair - For Release" },
            { key: "advise", label: "Advise Client", full: "Done Repair - Advise Client" },
            { key: "completed", label: "Completed", full: "Completed" },
          ];

          const OFF_PATH: Record<string, { label: string; tone: string }> = {
            "Backjob": { label: "Backjob", tone: "bg-destructive/15 text-destructive border-destructive/30" },
            "RTO": { label: "RTO", tone: "bg-muted text-muted-foreground border-border" },
            "On Hold": { label: "On Hold", tone: "bg-warning/15 text-warning border-warning/30" },
            "Cancelled": { label: "Cancelled", tone: "bg-destructive/15 text-destructive border-destructive/30" },
          };
          const currentStatus = serviceData.status || "";
          const offPath = OFF_PATH[currentStatus];
          const statusToStep = (s: string): number => {
            if (!s) return 1;
            // Merge Ongoing Service into the Proceed Repair step
            const target = s === "Ongoing Service" ? "Proceed Repair" : s;
            const idx = STEPS.findIndex((x) => x.full === target);
            return idx >= 0 ? idx + 1 : 1;
          };

          const stepIdx = statusToStep(currentStatus);
          const totalCost = Number(serviceData.finalCost || serviceData.serviceCost || 0);
          const totals = derivePaymentTotals(
            totalCost,
            Number(serviceData.initialPayment || 0),
            paymentsSummary?.transactionsPaid || 0,
          );
          const deposit = totals.paid;
          const balance = totals.balance;
          // Money figures only become meaningful once a quotation exists, i.e.
          // from "Waiting to Proceed" onward.
          const PRE_QUOTE_STATUSES = ["Pending Diagnosis", "Confirmed Diagnosis"];
          const showMoney = !PRE_QUOTE_STATUSES.includes(currentStatus);
          
          // Service date = when the client approved the diagnosis.
          const serviceDateDisplay = approvalRecord?.decision === "Approved"
            ? approvalRecord.at
            : serviceData.serviceDate
            ? displayDate(serviceData.serviceDate, "MMM dd, yyyy")
            : "N/A";

          const shopAddress = "Unit 103, 1st Flr, FBR Arcade Katipunan, Quezon City";
          const shopMapEmbed = `https://www.google.com/maps?q=${encodeURIComponent(shopAddress)}&output=embed`;
          const shopDirections = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(shopAddress)}`;
          const updatedAt = serviceData.lastUpdated || serviceData.timestamp;

          return (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* LEFT COLUMN – main */}
              <div className="lg:col-span-2 space-y-6">
                {/* Repair Ticket card */}
                <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-float)] rounded-2xl overflow-hidden">
                  <CardContent className="p-6 space-y-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Repair Ticket</p>
                        <div className="flex items-center gap-2 mt-1">
                          <h2 className="text-xl font-semibold tracking-tight">{serviceData.serviceId || serviceId}</h2>
                          <TrackingShareActions serviceId={serviceData.serviceId || serviceId || ""} />

                        </div>
                      </div>
                      <StatusChip status={serviceData.status || "Pending Diagnosis"} className="text-sm px-3 py-1.5" />
                    </div>

                    <div>
                      <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                        {serviceData.status || "Pending Diagnosis"}
                      </h3>
                      {updatedAt && (
                        <p className="text-xs text-muted-foreground mt-1">Updated {displayDate(updatedAt, "MMM dd, yyyy · hh:mm a")}</p>
                      )}
                    </div>

                    {/* Mini stats */}
                    <div className={showMoney ? "grid grid-cols-3 gap-3" : "grid grid-cols-1 gap-3"}>
                      {showMoney && (
                        <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Paid</p>
                          <p className="text-lg font-semibold mt-0.5">₱{deposit.toLocaleString()}</p>
                        </div>
                      )}
                      <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Progress</p>
                        <p className="text-lg font-semibold mt-0.5">{stepIdx}/{STEPS.length}</p>
                      </div>
                      {showMoney && (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-primary/80">Balance</p>
                          <p className="text-lg font-semibold mt-0.5 text-primary">₱{balance.toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    {/* Step chips — two rows of 4 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {STEPS.map((s, i) => {
                        const n = i + 1;
                        const done = n < stepIdx;
                        const current = n === stepIdx && !offPath;
                        return (
                          <div
                            key={s.key}
                            title={s.full}
                            className={
                              "flex items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium border text-center " +
                              (current
                                ? "bg-primary text-primary-foreground border-primary shadow-[var(--shadow-elegant)]"
                                : done
                                ? "bg-primary/10 text-primary border-primary/20"
                                : "bg-muted/50 text-muted-foreground border-border/60")
                            }
                          >
                            <span className={"h-1.5 w-1.5 rounded-full " + (current ? "bg-primary-foreground animate-pulse" : done ? "bg-primary" : "bg-muted-foreground/40")} />
                            {s.label}
                          </div>
                        );
                      })}
                    </div>
                    {offPath && (
                      <div
                        title={currentStatus}
                        className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border " + offPath.tone}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                        {offPath.label}
                      </div>
                    )}

                    <Separator />

                    {/* Client + device + complaint */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Client ID</p>
                        <p className="text-base font-medium mt-0.5 font-mono">{serviceData.clientId || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Client Name</p>
                        <p className="text-base font-medium mt-0.5">{serviceData.clientName || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Device</p>
                        <p className="text-base font-medium mt-0.5">{serviceData.device || "N/A"}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{serviceData.colorMemory || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Serial</p>
                        <p className="text-base font-medium mt-0.5 break-all">
                          {serviceData.serialNumber || "N/A"}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Chief Complaint</p>
                        <p className="text-sm mt-0.5 whitespace-pre-wrap">{serviceData.chiefComplaint || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Service Date</p>
                        <p className="text-sm mt-0.5">{serviceDateDisplay}</p>

                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Estimated Time Frame</p>
                        <p className="text-sm mt-0.5">{serviceData.timeFrame || serviceData.estimatedCompletion || "N/A"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Diagnosis */}
                {showAiDiagnosis && (
                  <div className="space-y-6">
                    <AiReportCard report={serviceData.aiDiagnosis} title="Service Diagnosis" />


                    {approvalRecord && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <p className="text-sm font-medium text-foreground">{approvalRecord.text}</p>
                        {serviceData.approvalLocked && (
                          <p className="text-xs text-muted-foreground mt-1">
                            We'll contact you shortly to confirm the remaining services.
                          </p>
                        )}
                      </div>
                    )}

                    {isWaitingToProceed && !approvalRecord && !serviceData.approvalLocked && (
                      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                        {declineOpen ? (
                          <div className="space-y-3">
                            <Label htmlFor="declineReason">Reason for declining</Label>
                            <Textarea
                              id="declineReason"
                              value={declineReason}
                              onChange={(e) => setDeclineReason(e.target.value)}
                              placeholder="Please share why you're declining the diagnosis…"
                              rows={3}
                            />
                            <div className="flex gap-2 justify-end">
                              <Button variant="outline" onClick={() => { setDeclineOpen(false); setDeclineReason(""); }} disabled={submittingApproval}>
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => submitApproval(false, declineReason.trim())}
                                disabled={submittingApproval || !declineReason.trim()}
                              >
                                Submit Decline
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {needsChecklist && (
                              <div className="space-y-2">
                                <p className="text-sm font-semibold">Select the services you approve</p>
                                <p className="text-xs text-muted-foreground">
                                  Please tick at least one. If you don't approve everything, our team will contact you
                                  to confirm before starting the repair.
                                </p>
                                <div className="space-y-2 pt-1">
                                  {breakdownItems.map((item) => (
                                    <label
                                      key={item}
                                      className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-3 cursor-pointer"
                                    >
                                      <Checkbox
                                        checked={selectedBreakdown.includes(item)}
                                        onCheckedChange={() => toggleBreakdown(item)}
                                        className="mt-0.5"
                                      />
                                      <span className="text-sm">{item}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex flex-col sm:flex-row gap-3">
                              <Button
                                className="flex-1 bg-green-600 hover:bg-green-700"
                                onClick={startApprove}
                                disabled={submittingApproval}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                {needsChecklist ? "Approve Selected Services" : "Approve Diagnosis"}
                              </Button>
                              <Button
                                variant="destructive"
                                className="flex-1"
                                onClick={() => setDeclineOpen(true)}
                                disabled={submittingApproval}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Decline
                              </Button>
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                )}

                {/* AI Report + report photos */}
                {showAiReport && (
                  <div className="space-y-6">
                    <AiReportCard report={serviceData.aiReport} title="Service Report" />
                  </div>
                )}

                {/* Quote card */}
                <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-elegant)] rounded-2xl">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Your Quote</p>
                        <h3 className="text-lg font-semibold mt-0.5">Repair estimate</h3>
                      </div>
                      <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {serviceData.service ? "Service" : "Awaiting quote"}
                      </span>
                    </div>

                    {serviceData.service ? (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm whitespace-pre-wrap">
                        {serviceData.service}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">The line items will appear here once we finalize the diagnosis.</p>
                    )}


                    <Separator />

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-semibold">₱{totalCost.toLocaleString()}</span>
                    </div>
                    {showMoney && Number(serviceData.initialPayment || 0) > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Deposit</span>
                        <span>₱{Number(serviceData.initialPayment || 0).toLocaleString()}</span>
                      </div>
                    )}
                    {showMoney && (paymentsSummary?.payments?.length ?? 0) > 0 && (
                      <div className="space-y-1">
                        {paymentsSummary!.payments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{p.type}{p.paymentMethod ? ` · ${p.paymentMethod}` : ""}</span>
                            <span>₱{p.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {showMoney && (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Total Paid</span>
                          <span className="font-medium">₱{deposit.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-base font-semibold text-primary">
                          <span>Balance</span>
                          <span>₱{balance.toLocaleString()}</span>
                        </div>
                      </>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      {MODES_OF_PAYMENT.map((m) => (
                        <span key={m} className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium">
                          {m}
                        </span>
                      ))}
                    </div>

                    <p className="text-xs text-muted-foreground">Settle in person on pickup. No online payments are required through this page.</p>
                  </CardContent>
                </Card>

                {/* Admin notes (kept for continuity) */}
                {serviceData.adminNotes?.trim() && (
                  <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-soft)] rounded-2xl">
                    <CardContent className="p-6">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">Notes from the team</p>
                      <p className="text-sm whitespace-pre-wrap">{serviceData.adminNotes}</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* RIGHT COLUMN – rail */}
              <div className="lg:col-span-1 space-y-6">
                {/* Visit us */}
                <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-elegant)] rounded-2xl overflow-hidden">
                  <CardContent className="p-6 space-y-3">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Visit Us</p>
                    <h3 className="text-lg font-semibold">AC Tech Repair PH</h3>
                    <p className="text-sm text-muted-foreground">{shopAddress}</p>
                    <div className="aspect-video w-full overflow-hidden rounded-xl border border-border/60 bg-muted/40">
                      <iframe
                        title="Shop location map"
                        src={shopMapEmbed}
                        className="h-full w-full"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button asChild variant="outline" className="flex-1 rounded-xl">
                        <a href={shopDirections} target="_blank" rel="noreferrer">Get directions</a>
                      </Button>
                    </div>

                    <Separator />

                    {/* Social links */}
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Follow us</p>
                      <div className="flex flex-wrap gap-2">
                        {SOCIAL_LINKS.map((link) => (
                          <a
                            key={link.name}
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={link.name}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                          >
                            {link.icon}
                          </a>
                        ))}
                      </div>
                    </div>

                    {/* Contact action buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Button asChild variant="outline" className="rounded-xl">
                        <a href={CONTACT_LINKS.facebook} target="_blank" rel="noreferrer">
                          Message us on FB
                        </a>
                      </Button>
                      <Button asChild variant="outline" className="rounded-xl">
                        <a href={CONTACT_LINKS.email}>Email us</a>
                      </Button>
                      <Button asChild variant="outline" className="rounded-xl">
                        <a href={CONTACT_LINKS.phone}>Contact us</a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Documents */}
                <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-elegant)] rounded-2xl">
                  <CardContent className="p-6 space-y-3">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Documents</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 p-3">
                        <div>
                          <p className="text-sm font-medium">Terms and Conditions</p>
                          <p className="text-xs text-muted-foreground">Service policy</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPdfModalUrl(TERMS_PDF_URL);
                            setPdfModalTitle("Terms and Conditions");
                            setPdfModalOpen(true);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 p-3">
                        <div>
                          <p className="text-sm font-medium">Client Intake Form</p>
                          <p className="text-xs text-muted-foreground">Check-in receipt</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPdf(serviceData.pdfUrl, serviceData.serviceId, "intake", "Client Intake Form")}
                          disabled={!serviceData.serviceId}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 p-3">
                        <div>
                          <p className="text-sm font-medium">Service Quotation</p>
                          <p className="text-xs text-muted-foreground">Repair quote</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPdf(serviceData.quotationPdfUrl, serviceData.serviceId, "quotation", "Service Quotation Form")}
                          disabled={!serviceData.serviceId}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Device Photo Gallery - Diagnosis & Report */}
                {serviceData.serviceId && [
                  "Waiting to Proceed",
                  "Proceed Repair",
                  "Ongoing Service",
                  "Done Repair - Under Observation",
                  "Done Repair - Observation",
                  "Done Repair - Advise Client",
                  "Done Repair - Advice Client",
                  "Done Repair - For Release",
                  "Released",
                  "Completed",
                ].includes(serviceData.status) && (
                  <div className="space-y-6">
                    <DiagnosisPhotos serviceId={serviceData.serviceId} title="Device Diagnosis - Photos" />
                    {[
                      "Done Repair - Advise Client",
                      "Done Repair - Advice Client",
                      "Done Repair - For Release",
                      "Released",
                      "Completed",
                    ].includes(serviceData.status) && (
                      <DeviceReportPhotos serviceId={serviceData.serviceId} title="Device Report - Photos" />
                    )}
                  </div>
                )}


                {/* Stay updated */}
                <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-soft)] rounded-2xl">
                  <CardContent className="p-6">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">Stay updated</p>
                    <p className="text-sm text-muted-foreground">
                      Bookmark this page or save the link — the status here updates automatically as our technicians work on your device.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          );
        })()}



        {/* Customer Information and Services (Client ID Search Results) */}
        {customerData && (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Customer Information - 1/3 width */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Client ID:</h3>
                  <p className="text-lg font-bold text-primary">{customerData.clientId}</p>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Client Name:</h3>
                  <p className="text-lg">{customerData.clientName || "N/A"}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Facebook Name/Instagram Username:</h3>
                  <p className="text-lg">{customerData.username || "N/A"}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Contact Number:</h3>
                  <p className="text-lg">{customerData.phone || "N/A"}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Email:</h3>
                  <p className="text-lg break-words">{customerData.email || "N/A"}</p>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Total Services:</h3>
                  <p className="text-2xl font-bold text-primary">{serviceRecords.length}</p>
                </div>
              </CardContent>
            </Card>

            {/* Services Table - 2/3 width */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Services</CardTitle>
              </CardHeader>
              <CardContent>
                {serviceRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No service records found for this customer
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Service/s</TableHead>
                          <TableHead>Expected Date</TableHead>
                          <TableHead>Service Cost</TableHead>
                          <TableHead>Client Form</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {serviceRecords.map((service, index) => (
                          <TableRow key={service.serviceId || index} className={getStatusRowColor(service.status)}>
                            <TableCell className="font-medium">{service.serviceId}</TableCell>
                            <TableCell className="font-medium">
                              {service.status}
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              {service.service || "N/A"}
                            </TableCell>
                            <TableCell>{service.targetDate || "N/A"}</TableCell>
                            <TableCell className="font-semibold">
                              {service.serviceCost ? `Php ${service.serviceCost}` : "N/A"}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewPDF(service.pdfUrl || "", service.serviceId)}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                View PDF
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground"></div>
      </div>

      <PdfViewerModal
        open={pdfModalOpen}
        onOpenChange={setPdfModalOpen}
        url={pdfModalUrl}
        title={pdfModalTitle}
      />

      <AlertDialog open={confirmApproveOpen} onOpenChange={setConfirmApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Approval</AlertDialogTitle>
            <AlertDialogDescription>
              {needsChecklist && selectedBreakdown.length < breakdownItems.length ? (
                <>
                  You are approving only: <strong>{selectedBreakdown.join(", ")}</strong>. The remaining
                  services stay pending — our team will contact you to confirm before the repair starts.
                </>
              ) : (
                <>
                  By confirming, you agree to proceed with the repair of your device based on the
                  diagnosis above. The status will change to <strong>Proceed Repair</strong> and the
                  assigned admin and technician will be notified.
                </>
              )}
            </AlertDialogDescription>

          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submittingApproval}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); submitApproval(true); }}
              disabled={submittingApproval}
            >
              {submittingApproval ? "Submitting…" : "Confirm & Proceed"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ServiceTracking;
