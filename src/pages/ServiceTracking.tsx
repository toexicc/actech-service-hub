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
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-5xl w-full min-h-full">
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

        {/* Service Details */}
        {serviceData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Service Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1">Status:</h3>
                <p className="text-lg font-bold text-primary">{serviceData.status || "Pending Diagnosis"}</p>
              </div>

              <Separator />

              {/* Client and Device Info */}
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Client Name:</h3>
                  <p className="text-lg">{serviceData.clientName}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Device:</h3>
                  <p className="text-lg">{serviceData.device}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Serial Number:</h3>
                  <p className="text-lg">
                    {serviceData.serialNumber ? 
                      serviceData.serialNumber.slice(0, -5) + "*****" : 
                      "N/A"
                    }
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Color & Memory:</h3>
                  <p className="text-lg">{serviceData.colorMemory}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Service Date:</h3>
                  <p className="text-lg">{serviceData.timestamp ? displayDate(serviceData.timestamp, "MMM dd, yyyy, hh:mm a") : "N/A"}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Estimated Target Date:</h3>
                  <p className="text-lg">{serviceData.targetDate ? displayDate(serviceData.targetDate, "MMM dd, yyyy") : "N/A"}</p>
                </div>
              </div>

              <Separator />

              {/* AI Diagnosis (above forms) */}
              {showAiDiagnosis && (
                <>
                  <AiReportCard report={serviceData.aiDiagnosis} title="Service Diagnosis" />

                  {/* Diagnosis Photos shown below Service Diagnosis from Waiting to Proceed onward */}
                  {[
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
                  ].includes(serviceData.status) && serviceData.serviceId && (
                    <DiagnosisPhotos serviceId={serviceData.serviceId} title="Device Diagnosis - Photos" />
                  )}

                  {/* Persistent approval record (visible after approve/decline too) */}
                  {approvalRecord && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <p className="text-sm font-medium text-foreground">
                        {approvalRecord.decision} by {approvalRecord.by} on {approvalRecord.at}
                        {approvalRecord.reason ? ` — ${approvalRecord.reason}` : ""}
                      </p>
                    </div>
                  )}

                  {/* Approve / Decline – only on Waiting to Proceed and not yet recorded */}
                  {isWaitingToProceed && !approvalRecord && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
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

                  <Separator />
                </>
              )}

              {/* PDF Documents Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Client Intake Form:</h3>
                  <Button
                    onClick={() => openPdf(serviceData.pdfUrl, serviceData.serviceId, "intake", "Client Intake Form")}
                    className="w-full"
                    disabled={!serviceData.serviceId}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View PDF
                  </Button>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Service Quotation Form:</h3>
                  <Button
                    onClick={() => openPdf(serviceData.quotationPdfUrl, serviceData.serviceId, "quotation", "Service Quotation Form")}
                    className="w-full"
                    disabled={!serviceData.serviceId}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View PDF
                  </Button>
                </div>
              </div>

              <Separator />

              {showAiReport && (
                <>
                  <Separator />
                  <AiReportCard report={serviceData.aiReport} title="Service Report" />

                  {/* Device Report Photos shown BELOW Service Report from Done Repair - Advise Client onward */}
                  {serviceData?.serviceId && [
                    "Done Repair - Advise Client",
                    "Done Repair - Advice Client",
                    "Done Repair - For Release",
                    "Released",
                    "Completed",
                  ].includes(serviceData.status) && (
                    <DeviceReportPhotos serviceId={serviceData.serviceId} title="Device Report - Photos" />
                  )}
                </>
              )}

              <Separator />

              {/* Service Details */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1">Service/s:</h3>
                <p className="text-lg whitespace-pre-wrap">{serviceData.service}</p>
              </div>

              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1">Service Cost:</h3>
                <p className="text-lg font-semibold">Php {serviceData.finalCost || serviceData.serviceCost}</p>
              </div>

              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1">Admin Notes:</h3>
                <p className="text-lg">{serviceData.adminNotes?.trim() ? serviceData.adminNotes : "N/A"}</p>
              </div>
            </CardContent>
          </Card>
        )}

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
