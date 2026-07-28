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
import { Search, User, FileText, Image as ImageIcon, CheckCircle2, XCircle } from "lucide-react";
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
      conditions: sb.conditions && Object.keys(sb.conditions).length ? sb.conditions : sheetData.conditions,
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

  const { toast } = useToast();

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
      const tsDisplay = formatManilaDate(new Date(), "MMM dd, yyyy hh:mm a");
      const tag = approved
        ? `Approved by ${serviceData.clientName} on ${tsDisplay}`
        : `Declined by ${serviceData.clientName} on ${tsDisplay}: ${reason || ""}`;
      const newAdminNotes = [serviceData.adminNotes, tag].filter(Boolean).join("\n");

      // On approve: also flip status to "Proceed Repair" and populate Service/s
      // from the AI diagnosis service breakdown.
      const newServices = approved ? parseServicesFromDiagnosis(serviceData.aiDiagnosis || "") : "";
      const newStatus = approved ? "Proceed Repair" : serviceData.status;

      // Persist to Google Sheets via updateService action
      const formData = new FormData();
      formData.append("action", "updateService");
      formData.append("serviceId", serviceData.serviceId);
      formData.append("deviceType", serviceData.deviceType || "");
      formData.append("adminNotes", newAdminNotes);
      if (approved) {
        formData.append("status", "Proceed Repair");
        if (newServices) formData.append("services", newServices);
      }
      await fetch(GOOGLE_SHEETS_SCRIPT_URL, { method: "POST", body: formData }).catch(() => {});

      // Mirror status change into Supabase so /manage-client and /service-update reflect it.
      if (approved) {
        try {
          await supabase
            .from("services")
            .update({
              status: "Proceed Repair" as any,
              service: newServices || serviceData.service || "",
              last_updated: new Date().toISOString(),
            })
            .eq("service_id", serviceData.serviceId);
        } catch { /* ignore */ }
      }

      // Notify assigned admins + technicians via service-role edge function
      // (works even when the /track page is anonymous).
      try {
        const adminNames: string[] = (serviceData.adminRep || "")
          .split(",").map((s: string) => s.trim()).filter(Boolean);
        const techNames: string[] = (serviceData.technician || "")
          .split(",").map((s: string) => s.trim()).filter(Boolean);
        const allNames = Array.from(new Set([...adminNames, ...techNames]));
        if (allNames.length) {
          const staff = await fetchStaffList();
          const norm = (n: string) => n.split(" - ")[0].trim().toLowerCase();
          const recipients = allNames
            .map((n) => staff.find((s) => norm(s.name || "") === norm(n)))
            .filter((s) => s?.staffId)
            .map((s) => ({
              userId: s!.staffId,
              title: approved
                ? `Service ${serviceData.serviceId}: Proceed Repair`
                : `Service ${serviceData.serviceId} Declined`,
              message: approved
                ? `${serviceData.clientName} approved the diagnosis for ${serviceData.serviceId}. Service will proceed to repair.`
                : `${serviceData.clientName} declined the diagnosis for ${serviceData.serviceId}. Reason: ${reason || "(none provided)"}.`,
              serviceId: serviceData.serviceId,
            }));
          if (recipients.length) {
            await supabase.functions.invoke("notify-service-event", { body: { recipients } });
          }
        }
      } catch {}

      setServiceData({
        ...serviceData,
        adminNotes: newAdminNotes,
        status: newStatus,
        service: approved && newServices ? newServices : serviceData.service,
      });
      setDeclineOpen(false);
      setDeclineReason("");
      setConfirmApproveOpen(false);
      toast({ title: approved ? "Approved" : "Declined", description: "Your response has been recorded." });
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
  const isWaitingToProceed = serviceData?.status === "Waiting to Proceed";
  const approvalRecord = (() => {
    const notes: string = serviceData?.adminNotes || "";
    // Match "Approved/Declined by <name> on <date>" where the date may contain colons.
    const m = notes.match(/(Approved|Declined) by (.+?) on (.+?)(?:\n|$)/);
    if (!m) return null;
    let at = m[3].trim();
    let reason = "";
    // For declines we appended ": <reason>" — peel that off.
    if (m[1] === "Declined") {
      const idx = at.lastIndexOf(":");
      if (idx > -1) {
        reason = at.slice(idx + 1).trim();
        at = at.slice(0, idx).trim();
      }
    }
    return { decision: m[1], by: m[2].trim(), at, reason };
  })();

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
          const STEPS = [
            { key: "pending", label: "Pending", full: "Pending Diagnosis" },
            { key: "confirmed", label: "Confirmed", full: "Confirmed Diagnosis" },
            { key: "waiting", label: "Waiting", full: "Waiting to Proceed" },
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
            // Merge Ongoing Service into Proceed Repair step
            if (s === "Ongoing Service") return 4;
            const idx = STEPS.findIndex((x) => x.full === s);
            return idx >= 0 ? idx + 1 : 1;
          };
          const stepIdx = statusToStep(currentStatus);
          const totalCost = Number(serviceData.finalCost || serviceData.serviceCost || 0);
          const deposit = Number(serviceData.initialPayment || 0);
          const balance = Math.max(0, totalCost - deposit);
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              try { navigator.clipboard.writeText(serviceData.serviceId || serviceId); toast({ title: "Copied", description: "Ticket ID copied to clipboard." }); } catch {}
                            }}
                          >
                            Copy
                          </Button>
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
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deposit</p>
                        <p className="text-lg font-semibold mt-0.5">₱{deposit.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Progress</p>
                        <p className="text-lg font-semibold mt-0.5">{stepIdx}/{STEPS.length}</p>
                      </div>
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-primary/80">Balance</p>
                        <p className="text-lg font-semibold mt-0.5 text-primary">₱{balance.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Step chips */}
                    <div className="flex flex-wrap gap-2 items-center">
                      {STEPS.map((s, i) => {
                        const n = i + 1;
                        const done = n < stepIdx;
                        const current = n === stepIdx && !offPath;
                        return (
                          <div
                            key={s.key}
                            title={s.full}
                            className={
                              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border " +
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
                      {offPath && (
                        <div
                          title={currentStatus}
                          className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border " + offPath.tone}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                          {offPath.label}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Device + complaint */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Device</p>
                        <p className="text-base font-medium mt-0.5">{serviceData.device || "N/A"}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{serviceData.colorMemory || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Serial</p>
                        <p className="text-base font-medium mt-0.5">
                          {serviceData.serialNumber ? serviceData.serialNumber.slice(0, -5) + "*****" : "N/A"}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Chief Complaint</p>
                        <p className="text-sm mt-0.5 whitespace-pre-wrap">{serviceData.chiefComplaint || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Service Date</p>
                        <p className="text-sm mt-0.5">{serviceData.timestamp ? displayDate(serviceData.timestamp, "MMM dd, yyyy · hh:mm a") : "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Estimated Target</p>
                        <p className="text-sm mt-0.5">{serviceData.targetDate ? displayDate(serviceData.targetDate, "MMM dd, yyyy") : "N/A"}</p>
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
                        <p className="text-sm font-medium text-foreground">
                          {approvalRecord.decision} by {approvalRecord.by} on {approvalRecord.at}
                          {approvalRecord.reason ? ` — ${approvalRecord.reason}` : ""}
                        </p>
                      </div>
                    )}

                    {isWaitingToProceed && !approvalRecord && (
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
                          <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                              className="flex-1 bg-green-600 hover:bg-green-700"
                              onClick={() => setConfirmApproveOpen(true)}
                              disabled={submittingApproval}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Approve Diagnosis
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
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* AI Report + report photos */}
                {showAiReport && (
                  <div className="space-y-6">
                    <AiReportCard report={serviceData.aiReport} title="Service Report" />
                    {serviceData?.serviceId && [
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
                      <div className="rounded-xl border border-border/60 bg-background/60 p-3 text-sm whitespace-pre-wrap">
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
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Deposit</span>
                      <span>₱{deposit.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-base font-semibold text-primary">
                      <span>Balance (pay on pickup)</span>
                      <span>₱{balance.toLocaleString()}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {["Cash", "GCash", "Maya"].map((m) => (
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
                  </CardContent>
                </Card>

                {/* Documents */}
                <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-elegant)] rounded-2xl">
                  <CardContent className="p-6 space-y-3">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Documents</p>
                    <div className="space-y-2">
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
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Username:</h3>
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
              By confirming, you agree to proceed with the repair of your device based on the
              diagnosis above. The status will change to <strong>Proceed Repair</strong> and the
              assigned admin and technician will be notified.
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
