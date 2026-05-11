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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { fetchStaffList } from "@/lib/staffList";

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
        setServiceData(data.data);
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
    const signed = sid ? await getServicePdfSignedUrl(sid, kind) : null;
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
        if (newServices) formData.append("service", newServices);
      }
      await fetch(GOOGLE_SHEETS_SCRIPT_URL, { method: "POST", body: formData });

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
    <div className="min-h-screen w-full bg-background">
      <div className="container mx-auto p-4 sm:p-6 max-w-4xl w-full min-h-full">
        {/* Header */}
        <div className="flex items-center justify-center mb-8">
          <img src={logo} alt="AC Tech Repair PH" className="h-16 mr-4" />
          <div>
            <h1 className="text-3xl font-bold">AC Tech Repair PH</h1>
            <p className="text-muted-foreground">Service - Track your Device</p>
          </div>
        </div>

        {/* Tabs for Search Modes */}
        <Tabs 
          value={searchMode} 
          onValueChange={(value) => {
            setSearchMode(value as "service" | "client");
            // Clear ALL results and inputs when switching modes
            setServiceId("");
            setClientId("");
            setServiceData(null);
            setCustomerData(null);
            setServiceRecords([]);
            setDevicePhotos([]);
          }} 
          className="mb-8"
        >
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="service">
              <Search className="h-4 w-4 mr-2" />
              Service ID
            </TabsTrigger>
            <TabsTrigger value="client">
              <User className="h-4 w-4 mr-2" />
              Client ID
            </TabsTrigger>
          </TabsList>

          {/* Service ID Search Tab */}
          <TabsContent value="service">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
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
                </div>

                <Button onClick={() => handleSearch()} disabled={isLoading} className="w-full mt-6">
                  {isLoading ? "Searching..." : "Track Service"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Client ID Search Tab */}
          <TabsContent value="client">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search by Client ID
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="clientId">Client ID</Label>
                    <Input
                      id="clientId"
                      placeholder="Enter Client ID (e.g., CL1234567890)"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      onKeyPress={handleKeyPress}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleClientSearch} disabled={isLoadingClient} className="bg-blue-600 hover:bg-blue-700">
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
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Target Date:</h3>
                  <p className="text-lg">{serviceData.targetDate ? displayDate(serviceData.targetDate, "MMM dd, yyyy") : "N/A"}</p>
                </div>
              </div>

              <Separator />

              {/* AI Diagnosis (above forms) */}
              {showAiDiagnosis && (
                <>
                  <AiReportCard report={serviceData.aiDiagnosis} title="Service Diagnosis" />

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
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View PDF
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Device Report Gallery */}
              {serviceData.deviceReportFolderUrl && (
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Device Report Photos
                  </h3>

                  {loadingPhotos ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading photos...
                    </div>
                  ) : devicePhotos.length > 0 ? (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                      {devicePhotos.map((photoUrl, index) => (
                        <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border">
                          <img
                            src={getDisplayPhotoUrl(photoUrl)}
                            alt={`Device report ${index + 1}`}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(getDisplayPhotoUrl(photoUrl), '_blank')}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                      No photos available
                    </div>
                  )}
                </div>
              )}

              {showAiReport && (
                <>
                  <Separator />
                  <AiReportCard report={serviceData.aiReport} title="Service Report" />
                </>
              )}

              <Separator />

              {/* Personnel */}
              <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Admin Representative/s:</h3>
                  <p className="text-base whitespace-pre-wrap break-words">{serviceData.adminRep || "N/A"}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Handling Staff:</h3>
                  <p className="text-base whitespace-pre-wrap break-words">{serviceData.receivingStaff || "N/A"}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Technician/s:</h3>
                  <p className="text-base whitespace-pre-wrap break-words">{serviceData.technician || "N/A"}</p>
                </div>
              </div>

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
        <div className="text-center mt-8 text-sm text-muted-foreground">powered by Stack&Scale</div>
      </div>

      <PdfViewerModal
        open={pdfModalOpen}
        onOpenChange={setPdfModalOpen}
        url={pdfModalUrl}
        title={pdfModalTitle}
      />
    </div>
  );
};

export default ServiceTracking;
