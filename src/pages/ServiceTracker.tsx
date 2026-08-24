import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, differenceInDays, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { displayDate, getManilaDate } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { DATA_BRIDGE_URL } from "@/lib/dataBridge";
import { STATUS_OPTIONS } from "@/lib/constants";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowUpDown, Calendar, Clock, AlertCircle, CalendarIcon, X, Search, ExternalLink, Bell, Forward, Send, RefreshCw, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import logo from "@/assets/S_S_Marketing-2.png";
import ActivityLogRow from "@/components/ActivityLogRow";
import { useAuth } from "@/hooks/useAuth";

import { useAllServices, useInvalidateServices } from "@/hooks/useServices";
import { useStaff } from "@/hooks/useStaff";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activityLogger";
import { classifyStatus, isClosedStatus, isCompletedStatus } from "@/lib/serviceStatus";

import { createNotification, sendMessage } from "@/lib/notifications";


interface ServiceRecord {
  serviceId: string;
  timestamp?: string;
  technician: string;
  service?: string;
  deviceType: string;
  brand?: string;
  device?: string;
  targetDate: string;
  status: string;
  clientName: string;
  adminRep?: string;
  adminRepresentative?: string;
  serviceCost?: string;
  transactionStatus?: string;
  serviceDate?: string;
  waitingForParts?: boolean;
  isBackjob?: boolean;
  rushFee?: boolean;
}

type SortField = "timestamp" | "technician" | "inService" | "targetDate";
type SortOrder = "asc" | "desc";
type DatePreset = "today" | "yesterday" | "thisWeek" | "last7" | "last30" | "thisMonth" | "clear";

/** Statuses shown as live count cards under the summary row. */
const STATUS_COUNT_CARDS = [
  "Pending Diagnosis",
  "Confirmed Diagnosis",
  "Waiting to Proceed",
  "Proceed Repair",
  "Ongoing Service",
  "Done Repair - Under Observation",
  "Done Repair - For Release",
  "Done Repair - Advise Client",
  "Completed",
  "RTO",
] as const;

const isDoneCompleted = (s: any) => isCompletedStatus(String(s?.status || ""));

/** True when the ticket priority is the "Within the Day" fast-track. */
const isWithinDay = (s: any) => String(s?.priority || "").trim().toLowerCase() === "within the day";

/** Loose date parser for the count cards (ISO or legacy "MM/dd/yyyy, hh:mm a"). */
const cardDate = (value?: string | null): Date | null => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const mdy = raw.split(",")[0].trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return new Date(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2]));
  const fallback = new Date(raw);
  return isNaN(fallback.getTime()) ? null : fallback;
};

/** True when the ticket's intake/service date is today (Manila) and it is not completed. */
const isTodayService = (s: any): boolean => {
  if (isCompletedStatus(String(s?.status || ""))) return false;
  const parsed = cardDate(s?.serviceDate) || cardDate(s?.timestamp);
  if (!parsed) return false;
  return format(parsed, "yyyy-MM-dd") === format(getManilaDate(), "yyyy-MM-dd");
};


/** Flag cards — tickets whose toggles are on, regardless of status. */
type FlagKey = "today" | "waitingParts" | "backjob" | "completedBackjob" | "withinDay" | "rush";
const FLAG_COUNT_CARDS: { key: FlagKey; label: string; match: (s: any) => boolean }[] = [
  { key: "today", label: "Today", match: isTodayService },
  { key: "waitingParts", label: "Waiting for Parts", match: (s) => !!s.waitingForParts },
  { key: "backjob", label: "Backjob", match: (s) => !!s.isBackjob && !isDoneCompleted(s) },
  {
    key: "completedBackjob",
    label: "Completed - Backjob",
    match: (s) => !!s.isBackjob && isDoneCompleted(s),
  },
  {
    key: "withinDay",
    label: "Within the Day",
    match: (s) => isWithinDay(s) && !isDoneCompleted(s),
  },
  { key: "rush", label: "Rush", match: (s) => !!s.rushFee },
];


const ServiceTracker = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const {
    data: services = [],
    isLoading,
    isPending,
    isFetching,
    error: servicesError,
    refetch: refetchServices,
  } = useAllServices();
  const invalidateServices = useInvalidateServices();
  const { data: staffList = [] } = useStaff();
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  // Set when a status count card drives the filter — the dropdown is then locked
  // so the card and the dropdown can't disagree.
  const [statusLockedByCard, setStatusLockedByCard] = useState(false);
  const [flagFilter, setFlagFilter] = useState<FlagKey | "all">("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [sortField, setSortField] = useState<SortField>("targetDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [dueDateFilter, setDueDateFilter] = useState("all");
  const [activePreset, setActivePreset] = useState<DatePreset | null>(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardService, setForwardService] = useState<ServiceRecord | null>(null);
  const [forwardRecipient, setForwardRecipient] = useState("");
  const [forwardMessage, setForwardMessage] = useState("");
  const [forwardSending, setForwardSending] = useState(false);
  // Notify dialog state
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [notifyService, setNotifyService] = useState<ServiceRecord | null>(null);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifySending, setNotifySending] = useState(false);
  type TrackerTab = "all" | "walkin" | "ongoing" | "completed" | "closed";
  const initialTab = ((): TrackerTab => {
    const t = searchParams.get("tab") as TrackerTab | null;
    if (t && ["all", "walkin", "ongoing", "completed", "closed"].includes(t)) return t;
    const s = searchParams.get("status");
    if (s) {
      const c = classifyStatus(s);
      if (c === "completed") return "completed";
      if (c === "closed") return "closed";
    }
    return "all";
  })();
  const [activeTab, setActiveTab] = useState<TrackerTab>(initialTab);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [deleteTarget, setDeleteTarget] = useState<ServiceRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const itemsPerPage = 15;


  // Derive technicians with departments from staff data
  const techniciansWithDept = useMemo(() => {
    return staffList
      .filter((staff) => staff.role?.toLowerCase() === "technician" && staff.status?.toLowerCase() === "active")
      .map((staff) => ({
        name: staff.name,
        department: staff.department || ""
      }));
  }, [staffList]);

  // Handle URL params for status filter / tab (from dashboard clicks)
  useEffect(() => {
    const urlStatusFilter = searchParams.get('statusFilter');
    const urlStatus = searchParams.get('status');
    const urlTab = searchParams.get('tab');
    if (!urlStatusFilter && !urlStatus && !urlTab) return;

    const next = new URLSearchParams(searchParams);
    if (urlTab && ["all", "walkin", "ongoing", "completed", "closed"].includes(urlTab)) {
      setActiveTab(urlTab as TrackerTab);
      next.delete('tab');
    }
    if (urlStatusFilter) {
      setDueDateFilter(urlStatusFilter);
      // Due-today / overdue only make sense for tickets still in the workflow.
      if (!urlTab) setActiveTab("ongoing");
      next.delete('statusFilter');
    }
    if (urlStatus) {
      setStatusFilter(urlStatus);
      if (!urlTab) {
        const cls = classifyStatus(urlStatus);
        setActiveTab(cls === "completed" ? "completed" : cls === "closed" ? "closed" : "ongoing");
      }
      next.delete('status');
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);



  // Identify the logged-in technician from the authenticated profile (the old
  // sessionStorage lookup compared a full name against an email and never matched).
  const { profile, roles } = useAuth();
  const userRole = roles.includes("admin")
    ? "admin"
    : roles.includes("management")
    ? "management"
    : roles.includes("technician")
    ? "technician"
    : sessionStorage.getItem("userRole") || "";
  const username = profile?.name || sessionStorage.getItem("userFullName") || sessionStorage.getItem("username");
  const isTechnician = userRole === "technician";
  const [technicianName, setTechnicianName] = useState("");
  const [technicianDepartment, setTechnicianDepartment] = useState("");

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case "Proceed Repair":
      case "Ongoing Service":
      case "Done Repair - Observation":
      case "Done Repair - Advise Client":
        return "text-green-600 font-medium";
      case "Completed":
        return "text-orange-600 font-medium";
      case "Backjob":
        return "text-blue-600 font-medium";
      case "RTO":
      case "Cancelled":
        return "text-red-600 font-medium";
      default:
        return "text-foreground";
    }
  };

  const getStatusCardBg = (status: string) => {
    switch (status) {
      case "Confirmed Diagnosis": return "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200/60 dark:border-yellow-900/40";
      case "Waiting to Proceed": return "bg-orange-50 dark:bg-orange-950/20 border-orange-200/60 dark:border-orange-900/40";
      case "Proceed Repair": return "bg-orange-100/70 dark:bg-orange-900/25 border-orange-300/60 dark:border-orange-800/40";
      case "Ongoing Service": return "bg-blue-50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40";
      case "Done Repair - Under Observation":
      case "Done Repair - Observation": return "bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200/60 dark:border-cyan-900/40";
      case "Done Repair - For Release":
      case "Done Repair - Advise Client":
      case "For Pickup": return "bg-green-50 dark:bg-green-950/20 border-green-200/60 dark:border-green-900/40";
      case "Completed": return "bg-green-100/70 dark:bg-green-900/25 border-green-300/60 dark:border-green-800/40";
      case "Backjob": return "bg-slate-100 dark:bg-slate-800/40 border-slate-300/60 dark:border-slate-700/50";
      case "RTO": return "bg-purple-50 dark:bg-purple-950/20 border-purple-200/60 dark:border-purple-900/40";
      case "On Hold":
      case "Cancelled": return "bg-gray-100 dark:bg-gray-800/40 border-gray-300/60 dark:border-gray-700/50";
      default: return "bg-[hsl(var(--surface-glass))] border-border/60";
    }
  };

  // ---- Delete a service (management only) -------------------------------
  const canDeleteService = userRole === "management";

  const openDeleteDialog = (service: ServiceRecord) => {
    setDeleteTarget(service);
    setDeleteConfirm("");
  };

  const handleDeleteService = async () => {
    if (!deleteTarget) return;
    const sid = deleteTarget.serviceId;
    setDeleting(true);
    try {
      await logActivity({
        serviceId: sid,
        username: sessionStorage.getItem("userFullName") || "Unknown",
        role: userRole || "management",
        activity: `Service deleted permanently (client: ${deleteTarget.clientName || "N/A"})`,
      });

      // Remove loosely-linked child rows first (no FK cascade on these).
      await supabase.from("service_breakdowns").delete().eq("service_id", sid);
      const { error } = await supabase.from("services").delete().eq("service_id", sid);
      if (error) throw error;

      toast({ title: "Service deleted", description: `${sid} has been permanently removed.` });
      setDeleteTarget(null);
      setDeleteConfirm("");
      invalidateServices();
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err?.message || "Could not delete this service.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };



  const handleEditService = (serviceId: string) => {
    if (isTechnician) {
      navigate(`/service-update?serviceId=${encodeURIComponent(serviceId)}`);
      return;
    }
    navigate(`/manage-client?serviceId=${encodeURIComponent(serviceId)}`);
  };

  // Check if status is after "In Service" (Ongoing Service or later)
  const isAfterInService = (status: string): boolean => {
    const afterInServiceStatuses = [
      "Ongoing Service",
      "Done Repair - Observation",
      "Done Repair - Under Observation",
      "Done Repair - For Release",
      "Done Repair - Advise Client",
      "Done Repair - Advice Client",
      "On Hold",
      "RTO",
      "Backjob"
    ];
    return afterInServiceStatuses.includes(status);
  };

  // Open notify dialog instead of sending immediately
  const openNotifyDialog = (service: ServiceRecord) => {
    setNotifyService(service);
    setNotifyMessage("");
    setNotifyDialogOpen(true);
  };

  const handleNotify = async () => {
    if (!notifyService) return;
    
    setNotifySending(true);
    const service = notifyService;
    const userFullName = sessionStorage.getItem("userFullName") || sessionStorage.getItem("fullName") || "System";
    const deviceInfo = service.device || service.deviceType || "device";
    const customMsg = notifyMessage.trim();
    
    // Helper to find staff by name (case-insensitive, trimmed, flexible matching)
    const findStaffByName = (name: string) => {
      if (!name) return undefined;
      const normalizedName = name.trim().toLowerCase();
      
      return staffList.find(s => {
        const staffName = s.name?.trim().toLowerCase() || "";
        const staffNameBase = staffName.split(" - ")[0].trim();
        const searchNameBase = normalizedName.split(" - ")[0].trim();
        
        return staffName === normalizedName || 
               staffNameBase === searchNameBase ||
               staffName.includes(normalizedName) ||
               normalizedName.includes(staffName);
      });
    };
    
    try {
      if (userRole === "management") {
        // Notify assigned admin and technician
        const notifyPromises: Promise<boolean>[] = [];
        let notifiedSomeone = false;
        
        // Notify each assigned admin (supports comma-separated multi-admin)
        const adminNames = (service.adminRep || "").split(",").map(s => s.trim()).filter(Boolean);
        for (const adminName of adminNames) {
          const adminStaff = findStaffByName(adminName);
          if (adminStaff?.userId) {
            notifiedSomeone = true;
            const baseMessage = `Management is asking you to check on the repair for ${service.clientName}'s ${deviceInfo}.`;
            notifyPromises.push(
              createNotification({
                userId: adminStaff.userId,
                title: `Reminder: Check on ${service.serviceId}`,
                message: customMsg ? `${baseMessage}\n\n💬 ${customMsg}` : baseMessage,
                type: "service_update",
                serviceId: service.serviceId,
              })
            );
          }
        }
        
        // Notify technicians
        const techNames = service.technician?.split(",").map(t => t.trim()).filter(Boolean) || [];
        for (const techName of techNames) {
          const tech = findStaffByName(techName);
          if (tech?.userId) {
            notifiedSomeone = true;
            const baseMessage = `Management is asking you to check on the repair for ${service.clientName}'s ${deviceInfo}.`;
            notifyPromises.push(
              createNotification({
                userId: tech.userId,
                title: `Reminder: Check on ${service.serviceId}`,
                message: customMsg ? `${baseMessage}\n\n💬 ${customMsg}` : baseMessage,
                type: "service_update",
                serviceId: service.serviceId,
              })
            );
          }
        }
        
        if (notifiedSomeone) {
          await Promise.all(notifyPromises);
          toast({ title: "Notification sent", description: "Admin and technician have been notified." });
        } else {
          toast({ title: "No recipients found", description: "Could not find any assigned staff to notify.", variant: "destructive" });
        }
        
      } else if (userRole === "admin") {
        // Notify technicians only
        const techNames = service.technician?.split(",").map(t => t.trim()).filter(Boolean) || [];
        const notifyPromises: Promise<boolean>[] = [];
        let notifiedSomeone = false;
        
        for (const techName of techNames) {
          const tech = findStaffByName(techName);
          if (tech?.userId) {
            notifiedSomeone = true;
            const baseMessage = `Admin is asking you to check on the repair for ${service.clientName}'s ${deviceInfo}.`;
            notifyPromises.push(
              createNotification({
                userId: tech.userId,
                title: `Reminder: Check on ${service.serviceId}`,
                message: customMsg ? `${baseMessage}\n\n💬 ${customMsg}` : baseMessage,
                type: "service_update",
                serviceId: service.serviceId,
              })
            );
          }
        }
        
        if (notifiedSomeone) {
          await Promise.all(notifyPromises);
          toast({ title: "Notification sent", description: "Technician has been notified." });
        } else {
          toast({ title: "No technician assigned", description: "This service has no assigned technician.", variant: "destructive" });
        }
        
      } else if (userRole === "technician") {
        // Notify all assigned admins (multi-admin supported)
        const adminCsv = service.adminRep || (service as any).adminRepresentative || (service as any)["Admin Representative"] || "";
        const adminNames = String(adminCsv).split(",").map(s => s.trim()).filter(Boolean);
        let notifiedAny = false;
        const promises: Promise<boolean>[] = [];
        for (const adminName of adminNames) {
          const adminStaff = findStaffByName(adminName);
          if (adminStaff?.userId) {
            notifiedAny = true;
            const baseMessage = `Technician ${userFullName} is asking you to check on the repair for ${service.clientName}'s ${deviceInfo}.`;
            promises.push(createNotification({
              userId: adminStaff.userId,
              title: `Reminder: Check on ${service.serviceId}`,
              message: customMsg ? `${baseMessage}\n\n💬 ${customMsg}` : baseMessage,
              type: "service_update",
              serviceId: service.serviceId,
            }));
          }
        }
        if (notifiedAny) {
          await Promise.all(promises);
          toast({ title: "Notification sent", description: "Admin(s) have been notified." });
        } else {
          toast({ title: "No admin assigned", description: "This service has no assigned admin.", variant: "destructive" });
        }
      }
        
      setNotifyDialogOpen(false);
    } catch {
      toast({ title: "Error", description: "Failed to send notification.", variant: "destructive" });
    } finally {
      setNotifySending(false);
    }
  };

  const handleForward = (service: ServiceRecord) => {
    setForwardService(service);
    setForwardRecipient("");
    setForwardMessage("");
    setForwardDialogOpen(true);
  };

  const handleSendForward = async () => {
    if (!forwardService || !forwardRecipient) return;
    
    setForwardSending(true);
    try {
      const userId = sessionStorage.getItem("authUserId") || sessionStorage.getItem("staffId") || "";
      const userFullName = sessionStorage.getItem("userFullName") || sessionStorage.getItem("fullName") || "System";
      
      // Find recipient staff
      const recipient = staffList.find(s => (s.userId === forwardRecipient || s.staffId === forwardRecipient));
      if (!recipient) {
        toast({ title: "Error", description: "Recipient not found.", variant: "destructive" });
        return;
      }

      // Build service details message with navigation path
      const deviceInfo = forwardService.device || forwardService.deviceType || "device";
      
      // Determine navigation path based on recipient role
      let navPath = "";
      if (recipient.role?.toLowerCase() === "technician") {
        navPath = `/service-update?serviceId=${encodeURIComponent(forwardService.serviceId)}`;
      } else {
        navPath = `/manage-client?serviceId=${encodeURIComponent(forwardService.serviceId)}`;
      }
      
      const customMessage = forwardMessage.trim();
      const messageContent = `📋 Service Forwarded: ${forwardService.serviceId}
      
Client: ${forwardService.clientName}
Device: ${deviceInfo}
Brand: ${forwardService.brand || "N/A"}
Model: ${forwardService.device || "N/A"}
Status: ${forwardService.status}
Target Date: ${forwardService.targetDate}
Technician: ${forwardService.technician || "Unassigned"}
${customMessage ? `\n💬 Message: ${customMessage}` : ""}
🔗 NAV_PATH: ${navPath}`;

      const success = await sendMessage({
        senderId: userId,
        senderName: userFullName,
        receiverId: recipient.userId || recipient.staffId,
        receiverName: recipient.name,
        content: messageContent,
      });

      if (success) {
        toast({ title: "Forwarded", description: `Service details sent to ${recipient.name}.` });
        setForwardDialogOpen(false);
      } else {
        toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to forward service.", variant: "destructive" });
    } finally {
      setForwardSending(false);
    }
  };

  // Get available staff for forwarding (exclude current user)
  const forwardableStaff = useMemo(() => {
    const currentUserId = sessionStorage.getItem("authUserId") || sessionStorage.getItem("staffId");
    return staffList.filter(s => 
      (s.userId || s.staffId) !== currentUserId && 
      s.status?.toLowerCase() === "active" &&
      ["technician", "admin", "management"].includes(s.role?.toLowerCase() || "")
    );
  }, [staffList]);

  const applyDatePreset = (preset: DatePreset) => {
    const today = new Date();

    switch (preset) {
      case "today":
        setStartDate(today);
        setEndDate(today);
        break;
      case "yesterday": {
        const y = subDays(today, 1);
        setStartDate(y);
        setEndDate(y);
        break;
      }
      case "thisWeek":
        setStartDate(startOfWeek(today, { weekStartsOn: 1 }));
        setEndDate(endOfWeek(today, { weekStartsOn: 1 }));
        break;
      case "last7":
        setStartDate(subDays(today, 7));
        setEndDate(today);
        break;
      case "last30":
        setStartDate(subDays(today, 30));
        setEndDate(today);
        break;
      case "thisMonth":
        setStartDate(startOfMonth(today));
        setEndDate(endOfMonth(today));
        break;
      case "clear":
        setStartDate(undefined);
        setEndDate(undefined);
        break;
    }
    setActivePreset(preset === "clear" ? null : preset);
  };

  /** Manual refresh: actually refetch and tell the user what happened. */
  const handleRefresh = async () => {
    try {
      const result = await refetchServices();
      if (result.error) throw result.error;
      toast({ title: "Tickets refreshed" });
    } catch (err: any) {
      toast({
        title: "Refresh failed",
        description: err?.message || "The connection dropped while fetching services.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    // Lock the filters to the signed-in technician. Match on the profile id
    // first, then fall back to a normalized name comparison.
    if (!isTechnician) return;
    const norm = (v?: string | null) => (v || "").trim().toLowerCase();
    const techInfo =
      staffList.find((staff) => staff.userId && profile?.id && staff.userId === profile.id) ||
      staffList.find((staff) => norm(staff.name) === norm(username)) ||
      staffList.find((staff) => norm(staff.username) === norm(profile?.username));
    if (techInfo) {
      setTechnicianName(techInfo.name);
      setTechnicianDepartment(techInfo.department || "");
      setTechnicianFilter(techInfo.name);
      setDepartmentFilter(techInfo.department || "all");
    } else if (username) {
      // Identity could not be resolved in the staff list — still scope by name.
      setTechnicianName(username);
      setTechnicianFilter(username);
    }
  }, [isTechnician, username, staffList, profile?.id, profile?.username]);

  // Realtime keeps the services cache fresh (see useRealtimeInvalidate); a slow
  // safety-net poll covers dropped websocket connections without visible reloads.
  useEffect(() => {
    const intervalId = setInterval(() => {
      invalidateServices();
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [invalidateServices]);


  /**
   * Planned service span: Service Date -> Estimated Target Date.
   */
  const calculateInServiceDays = (timestamp: string, status?: string, serviceDate?: string): number => {
    if (status && status.toLowerCase().includes("completed")) return 0;
    const parseDay = (value?: string): Date | null => {
      if (!value) return null;
      const [datePart] = String(value).split(", ");
      const parts = datePart.split(/[-/]/);
      if (parts.length !== 3) return null;
      const [m, d, y] = parts[0].length === 4 ? [parts[1], parts[2], parts[0]] : [parts[0], parts[1], parts[2]];
      const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      dt.setHours(0, 0, 0, 0);
      return isNaN(dt.getTime()) ? null : dt;
    };
    const start = parseDay(serviceDate) || parseDay(timestamp);
    if (!start) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today <= start) return 0;
    // Elapsed calendar days since the service date, Sundays not counted.
    let days = 0;
    const cursor = new Date(start);
    while (cursor < today) {
      cursor.setDate(cursor.getDate() + 1);
      if (cursor.getDay() !== 0) days += 1;
    }
    return days;
  };

  // Accepts both MM/dd/yyyy (legacy) and yyyy-MM-dd (database) target dates.
  const parseTargetDate = (targetDate: string): Date | null => {
    const parts = (targetDate || "").split(/[-/]/);
    if (parts.length !== 3) return null;
    const [month, day, year] = parts[0].length === 4
      ? [parts[1], parts[2], parts[0]]
      : [parts[0], parts[1], parts[2]];
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return isNaN(d.getTime()) ? null : d;
  };

  /**
   * Service (received) date parser used by the date-range filter.
   * Handles ISO timestamps from the database and legacy "MM/dd/yyyy, hh:mm a".
   */
  const parseServiceDate = (value?: string | null): Date | null => {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      return isNaN(d.getTime()) ? null : d;
    }
    const [datePart] = raw.split(",");
    const fromParts = parseTargetDate(datePart.trim());
    if (fromParts) return fromParts;
    const fallback = new Date(raw);
    return isNaN(fallback.getTime()) ? null : fallback;
  };


  const isOverdue = (targetDate: string, status: string): boolean => {
    if (!targetDate) return false;
    if (status === "Completed") return false;
    try {
      const target = parseTargetDate(targetDate);
      if (!target) return false;
      target.setHours(23, 59, 59, 999);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      return today > target;
    } catch (error) {
      return false;
    }
  };

  const getDaysUntilDue = (targetDate: string): number => {
    if (!targetDate) return 999;
    try {
      const target = parseTargetDate(targetDate);
      if (!target) return 999;
      target.setHours(23, 59, 59, 999);

      
      if (isNaN(target.getTime())) return 999;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      return differenceInDays(target, today);
    } catch (error) {
      return 999;
    }
  };

  const deviceTypes = useMemo(() => {
    const types = new Set(services.map(s => s.deviceType).filter(Boolean));
    return Array.from(types).sort();
  }, [services]);

  const technicians = useMemo(() => {
    const techs = new Set(services.map(s => s.technician).filter(Boolean));
    return Array.from(techs).sort();
  }, [services]);

  /**
   * All filters are AND-combined. `includeStatus` lets the status count cards
   * reuse the exact same predicate while ignoring the Status dropdown itself.
   */
  const passesFilters = (service: any, includeStatus: boolean): boolean => {
    const normName = (v?: string) => (v || "").trim().toLowerCase();

    // Search filter - search by Service ID or Client Name
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      const matchesServiceId = service.serviceId?.toLowerCase().includes(query);
      const matchesClientName = service.clientName?.toLowerCase().includes(query);
      if (!matchesServiceId && !matchesClientName) return false;
    }

    // Device type filter
    if (deviceTypeFilter !== "all" && service.deviceType !== deviceTypeFilter) return false;

    // Technician filter — tolerates multiple techs / spacing / casing.
    if (technicianFilter !== "all") {
      const assignedTechnicians = (service.technician || "").split(",").map((t: string) => normName(t));
      if (!assignedTechnicians.includes(normName(technicianFilter))) return false;
    }

    // Department filter — applies alongside the technician filter, not instead of it.
    if (departmentFilter !== "all") {
      const assigned = (service.technician || "").split(",").map(normName).filter(Boolean);
      const matchesDept =
        assigned.some((n) =>
          techniciansWithDept.some((t) => normName(t.name) === n && t.department === departmentFilter),
        ) ||
        (service.technicianDepartment || "")
          .split(",")
          .map((d: string) => d.trim())
          .includes(departmentFilter);
      if (!matchesDept) return false;
    }

    // Tab filter — Cancelled / RTO / On Hold tickets are only ever visible in
    // the "All" and "Cancelled / RTO / On Hold" tabs.
    const cls = classifyStatus(service.status);
    if (activeTab !== "all" && activeTab !== "closed" && cls === "closed") return false;
    if (activeTab === "ongoing" && cls !== "active") return false;
    if (activeTab === "completed" && cls !== "completed") return false;
    if (activeTab === "closed" && cls !== "closed") return false;
    if (activeTab === "walkin") {
      // Walk-in tab: only today's intakes whose client type is a walk-in variant.
      const type = String(service.clientType || "").toLowerCase();
      const isWalkInType = /(new client|returning client)\s*-\s*walk\s*in/.test(type);
      const parsed = cardDate(service.serviceDate) || cardDate(service.timestamp);
      const isToday = !!parsed && format(parsed, "yyyy-MM-dd") === format(getManilaDate(), "yyyy-MM-dd");
      if (!isWalkInType || !isToday) return false;
    }

    // Status filter — "RTO" matches both RTO - ACTech and RTO - Client.
    // Completed backjobs live in their own card, so keep them out of "Completed".
    if (includeStatus && statusFilter !== "all") {
      const st = String(service.status || "").trim();
      const ok =
        statusFilter === "RTO"
          ? /^rto/i.test(st)
          : statusFilter === "Completed"
          ? st === "Completed" && !service.isBackjob
          : st === statusFilter;
      if (!ok) return false;
    }

    // Flag card filter (Waiting for Parts / Backjob / Rush)
    if (includeStatus && flagFilter !== "all") {
      const flag = FLAG_COUNT_CARDS.find((f) => f.key === flagFilter);
      if (flag && !flag.match(service)) return false;
    }

    // Date range filter — by the ticket's service / received date.
    if (startDate || endDate) {
      const serviceDate =
        parseServiceDate(service.serviceDate) ||
        parseServiceDate(service.dateReceived) ||
        parseServiceDate(service.timestamp);
      if (!serviceDate) return false;
      serviceDate.setHours(0, 0, 0, 0);

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (serviceDate < start) return false;
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (serviceDate > end) return false;
      }
    }

    // Due date filter
    if (dueDateFilter !== "all") {
      const daysUntilDue = getDaysUntilDue(service.targetDate);
      if (dueDateFilter === "overdue") {
        if (!isOverdue(service.targetDate, service.status)) return false;
      } else if (dueDateFilter === "dueToday") {
        if (daysUntilDue !== 0) return false;
      } else if (dueDateFilter === "dueSoon") {
        if (daysUntilDue < 0 || daysUntilDue >= 2) return false;
      } else if (dueDateFilter === "onTrack") {
        // On track = has a target date, still in the workflow, not overdue.
        if (!service.targetDate) return false;
        if (isOverdue(service.targetDate, service.status)) return false;
        if (classifyStatus(service.status) !== "active") return false;
      }
    }

    return true;
  };

  const filteredAndSortedServices = useMemo(() => {
    // Only suppress the list on the very first load, so filters keep working
    // while a background refresh is in flight.
    if (isPending) {
      return [];
    }

    let filtered = services.filter((service) => passesFilters(service, true));



    // Sort: Put overdue services at the top, and completed/closed/cancelled at the bottom
    filtered.sort((a, b) => {
      const aStatus = a.status?.toLowerCase() || "";
      const bStatus = b.status?.toLowerCase() || "";

      // 1. Overdue services always on top
      const aOverdue = isOverdue(a.targetDate, a.status) || aStatus.includes("overdue");
      const bOverdue = isOverdue(b.targetDate, b.status) || bStatus.includes("overdue");

      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      // 2. Completed/closed/cancelled services at the bottom
      const aIsCompleted = aStatus.includes("completed") || aStatus.includes("closed") || aStatus.includes("cancelled");
      const bIsCompleted = bStatus.includes("completed") || bStatus.includes("closed") || bStatus.includes("cancelled");
      
      if (aIsCompleted && !bIsCompleted) return 1;
      if (!aIsCompleted && bIsCompleted) return -1;
      
      // 3. Otherwise, sort by selected field
      let compareValue = 0;

      switch (sortField) {
        case "timestamp":
          compareValue = (a.timestamp || "").localeCompare(b.timestamp || "");
          break;
        case "technician":
          compareValue = (a.technician || "").localeCompare(b.technician || "");
          break;
        case "inService":
          compareValue = calculateInServiceDays(a.timestamp, a.status, a.serviceDate) - calculateInServiceDays(b.timestamp, b.status, b.serviceDate);
          break;
        case "targetDate":
          compareValue = (a.targetDate || "").localeCompare(b.targetDate || "");
          break;
      }

      return sortOrder === "asc" ? compareValue : -compareValue;
    });

    return filtered;
  }, [services, deviceTypeFilter, technicianFilter, departmentFilter, statusFilter, startDate, endDate, sortField, sortOrder, debouncedSearch, dueDateFilter, techniciansWithDept, activeTab, isPending, flagFilter]);

  /**
   * Live per-status counts. They respect every filter EXCEPT the Status
   * dropdown, so the row always shows the full breakdown of the current view.
   */
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUS_COUNT_CARDS.forEach((s) => (counts[s] = 0));
    FLAG_COUNT_CARDS.forEach((f) => (counts[f.key] = 0));
    if (isPending) return counts;
    services.forEach((service) => {
      if (!passesFilters(service, false)) return;
      const status = (service.status || "").trim();
      if (/^rto/i.test(status)) counts["RTO"] += 1;
      else if (status === "Completed" && (service as any).isBackjob) {
        /* counted by the Completed - Backjob card only */
      } else if (status in counts) counts[status] += 1;
      FLAG_COUNT_CARDS.forEach((f) => {
        if (f.match(service)) counts[f.key] += 1;
      });
    });
    return counts;
  }, [services, deviceTypeFilter, technicianFilter, departmentFilter, startDate, endDate, debouncedSearch, dueDateFilter, techniciansWithDept, activeTab, isPending, flagFilter]);

  const departments = useMemo(() => {
    const depts = new Set(techniciansWithDept.map(t => t.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [techniciansWithDept]);

  const paginatedServices = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedServices.slice(startIndex, endIndex);
  }, [filteredAndSortedServices, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedServices.length / itemsPerPage));

  useEffect(() => {
    // Never leave the user on a page that no longer exists after filtering.
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const hasActiveFilters =
    deviceTypeFilter !== "all" ||
    statusFilter !== "all" ||
    flagFilter !== "all" ||
    dueDateFilter !== "all" ||
    !!startDate ||
    !!endDate ||
    !!debouncedSearch.trim() ||
    (!isTechnician && (technicianFilter !== "all" || departmentFilter !== "all"));

  /**
   * Set the status filter and only move the tab when the chosen status could
   * never appear in the tab currently selected (so filters keep combining).
   */
  /** Overdue / On Track summary cards act as due-date filters. */
  const selectDueFilter = (key: "overdue" | "onTrack") => {
    setDueDateFilter((prev) => (prev === key ? "all" : key));
    setCurrentPage(1);
  };

  const selectFlag = (key: FlagKey) => {
    setStatusFilter("all");
    setStatusLockedByCard(false);
    setFlagFilter((prev) => (prev === key ? "all" : key));
    setActiveTab("all");
  };

  const selectStatus = (v: string, fromCard = false) => {
    setStatusFilter(v);
    setStatusLockedByCard(v !== "all" && fromCard);
    setFlagFilter("all");
    if (v === "all") return;
    const cls = classifyStatus(v);
    const tabAllows =
      activeTab === "all" ||
      (activeTab === "closed" && cls === "closed") ||
      (activeTab === "completed" && cls === "completed") ||
      (activeTab === "ongoing" && cls === "active") ||
      (activeTab === "walkin" && cls !== "closed" && cls !== "completed");
    if (!tabAllows) {
      setActiveTab(cls === "completed" ? "completed" : cls === "closed" ? "closed" : "ongoing");
    }
  };

  const clearAllFilters = () => {
    setDeviceTypeFilter("all");
    setStatusFilter("all");
    setStatusLockedByCard(false);
    setDueDateFilter("all");
    setStartDate(undefined);
    setEndDate(undefined);
    setActivePreset(null);
    setSearchInput("");
    if (!isTechnician) {
      setTechnicianFilter("all");
      setDepartmentFilter("all");
    }
  };

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [deviceTypeFilter, technicianFilter, departmentFilter, statusFilter, startDate, endDate, sortField, sortOrder, debouncedSearch, dueDateFilter, activeTab]);


  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };


  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 animate-fade-in">
        {/* Header */}
        <PageHeader
          icon={<Clock className="h-5 w-5" />}
          title="Service Tracker"
          subtitle="Monitor all ongoing services in real time"
        />


        {/* Search Bar */}
        <Card className="mb-6 border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-soft)] rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by Service ID or Client Name..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onFocus={(e) => {
                    if (!e.target.value) {
                      setSearchInput("AC");
                      e.target.setSelectionRange(2, 2);
                    }
                  }}
                  className="pl-10 h-11 rounded-xl bg-background"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setSearchInput("")}
                className="h-11 rounded-xl"
              >
                Clear
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isFetching}
                title="Refresh data"
                className="h-11 w-11 rounded-xl"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="mb-6 border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-soft)] rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-7">
              <div className="space-y-2">
                <Label>Due Date Status</Label>
                <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Services" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="dueToday">Due Today</SelectItem>
                    <SelectItem value="dueSoon">Due Soon (&lt;2 days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Device Type</Label>
                <Select value={deviceTypeFilter} onValueChange={setDeviceTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Device Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Device Types</SelectItem>
                    {deviceTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Technician</Label>
                <Select 
                  value={technicianFilter} 
                  onValueChange={setTechnicianFilter}
                  disabled={isTechnician}
                >
                  <SelectTrigger className={isTechnician ? "opacity-60 cursor-not-allowed" : ""}>
                    <SelectValue placeholder="All Technicians" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-md z-[100] max-h-[300px] overflow-y-auto">
                    <SelectItem value="all">All Technicians</SelectItem>
                    {techniciansWithDept.map(tech => (
                      <SelectItem key={tech.name} value={tech.name}>
                        {tech.name} - {tech.department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isTechnician && (
                  <p className="text-xs text-muted-foreground">Locked to your account</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <Select 
                  value={departmentFilter} 
                  onValueChange={setDepartmentFilter}
                  disabled={isTechnician}
                >
                  <SelectTrigger className={isTechnician ? "opacity-60 cursor-not-allowed" : ""}>
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-md z-[100]">
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isTechnician && (
                  <p className="text-xs text-muted-foreground">Locked to your department</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => selectStatus(v)}
                  disabled={statusLockedByCard}
                >

                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-md z-[100] max-h-[300px] overflow-y-auto">
                    <SelectItem value="all">All Statuses</SelectItem>
                    {STATUS_OPTIONS.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {statusLockedByCard && (
                  <p className="text-xs text-muted-foreground">
                    Set by the status card — click the card again to unlock.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Service Date From</Label>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "From date"}
                      {startDate && (
                        <X 
                          className="ml-auto h-4 w-4" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setStartDate(undefined);
                          }}
                        />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={(d) => { setStartDate(d); setActivePreset(null); }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Service Date To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "To date"}
                      {endDate && (
                        <X 
                          className="ml-auto h-4 w-4" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEndDate(undefined);
                          }}
                        />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={(d) => { setEndDate(d); setActivePreset(null); }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      disabled={(date) => startDate ? date < startDate : false}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Sort By</Label>
                <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="targetDate">Target Date</SelectItem>
                    <SelectItem value="timestamp">Service Date</SelectItem>
                    <SelectItem value="inService">In Service Days</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Order</Label>
                <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 lg:col-span-4">
                <Label>Quick Date Filters</Label>
                <div className="flex flex-wrap gap-2">
                  {([
                    ["today", "Today"],
                    ["yesterday", "Yesterday"],
                    ["thisWeek", "This Week"],
                    ["last7", "Last 7 Days"],
                    ["last30", "Last 30 Days"],
                    ["thisMonth", "This Month"],
                  ] as [DatePreset, string][]).map(([preset, label]) => (
                    <Button
                      key={preset}
                      variant={activePreset === preset ? "default" : "outline"}
                      size="sm"
                      onClick={() => applyDatePreset(preset)}
                    >
                      {label}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyDatePreset("clear")}
                  >
                    Clear Date Filter
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats — always reflect the tab / filters currently shown */}
        {(() => {
          const shown = filteredAndSortedServices;
          const active = shown.filter((s) => classifyStatus(s.status) === "active");
          const overdueCount = active.filter(s => isOverdue(s.targetDate, s.status)).length;
          const onTrackCount = active.filter(s => !isOverdue(s.targetDate, s.status) && s.targetDate).length;
          const totalLabel =
            activeTab === "completed" ? "Completed shown"
            : activeTab === "closed" ? "Cancelled / RTO / On Hold"
            : activeTab === "all" ? "All shown"
            : activeTab === "walkin" ? "Walk-in shown"
            : "Total ongoing";
          return (
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <StatCard
                label={totalLabel}
                value={shown.length}
                tone="primary"
                icon={<Clock className="h-5 w-5" />}
              />
              <button
                type="button"
                onClick={() => selectDueFilter("overdue")}
                className={cn(
                  "rounded-2xl text-left transition-shadow",
                  dueDateFilter === "overdue" && "ring-2 ring-destructive/50",
                )}
              >
                <StatCard
                  label="Overdue"
                  value={overdueCount}
                  tone="destructive"
                  icon={<AlertCircle className="h-5 w-5" />}
                />
              </button>
              <button
                type="button"
                onClick={() => selectDueFilter("onTrack")}
                className={cn(
                  "rounded-2xl text-left transition-shadow",
                  dueDateFilter === "onTrack" && "ring-2 ring-primary/50",
                )}
              >
                <StatCard
                  label="On Track"
                  value={onTrackCount}
                  tone="success"
                  icon={<Calendar className="h-5 w-5" />}
                />
              </button>

            </div>
          );
        })()}

        {/* Live per-status counts — respect all filters except Status itself */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-6">
          {FLAG_COUNT_CARDS.map((flag) => {
            const isActive = flagFilter === flag.key;
            return (
              <button
                key={flag.key}
                type="button"
                onClick={() => selectFlag(flag.key)}
                className={cn(
                  "rounded-2xl border p-3 text-left transition-colors",
                  isActive
                    ? "border-primary bg-primary/10"
                    : "border-border/60 bg-[hsl(var(--surface-glass))] hover:border-primary/40",
                )}
              >
                <p className="text-2xl font-bold tabular-nums text-foreground">{statusCounts[flag.key] ?? 0}</p>
                <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{flag.label}</p>
              </button>
            );
          })}
          {STATUS_COUNT_CARDS.map((status) => {
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => selectStatus(isActive ? "all" : status, true)}
                className={cn(
                  "rounded-2xl border p-3 text-left transition-colors",
                  isActive
                    ? "border-primary bg-primary/10"
                    : "border-border/60 bg-[hsl(var(--surface-glass))] hover:border-primary/40",
                )}
              >
                <p className="text-2xl font-bold tabular-nums text-foreground">{statusCounts[status] ?? 0}</p>
                <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{status}</p>
              </button>
            );
          })}
        </div>


        {/* Services Table */}
        <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-elegant)] rounded-2xl">
          <CardHeader>
            <CardTitle>
              {activeTab === "completed"
                ? "Completed Services"
                : activeTab === "closed"
                ? "Cancelled / RTO / On Hold"
                : activeTab === "all"
                ? "All Services"
  
                : activeTab === "walkin"
                ? "Walk-In Services"
                : "Ongoing Services"}
            </CardTitle>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mt-3">
              <TabsList className="flex flex-wrap gap-1">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="walkin">Walk In</TabsTrigger>
                <TabsTrigger value="ongoing">Ongoing</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="closed">Cancelled / RTO / On Hold</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Txn Status</TableHead>
                      <TableHead>Client Name</TableHead>
                      <TableHead>Service Date</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead>Service/s</TableHead>
                      <TableHead>Device Type</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Service Cost</TableHead>
                      <TableHead>Target Date</TableHead>
                      <TableHead>In Service</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={`skeleton-${i}`}>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : servicesError ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-sm font-semibold text-destructive">Tickets could not be loaded</p>
                <p className="text-xs text-muted-foreground">
                  {(servicesError as any)?.message || "The connection dropped while fetching services."}
                </p>
                <Button variant="outline" size="sm" onClick={() => refetchServices()}>
                  Retry
                </Button>
              </div>
            ) : filteredAndSortedServices.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-muted-foreground">No services match the current filters</p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearAllFilters}>
                    Clear filters
                  </Button>
                )}
              </div>

            ) : viewMode === "cards" ? (
              <>
                <div className="flex items-center justify-end mb-4">
                  <div className="inline-flex rounded-full border border-border/60 bg-muted/40 p-1 text-xs">
                    <button
                      onClick={() => setViewMode("cards")}
                      className={cn("px-3 py-1.5 rounded-full transition-colors", viewMode === "cards" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}
                    >Cards</button>
                    <button
                      onClick={() => setViewMode("table")}
                      className={cn("px-3 py-1.5 rounded-full transition-colors", (viewMode as string) === "table" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}
                    >Table</button>
                  </div>
                </div>
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {paginatedServices.map((service) => {
                    const inServiceDays = calculateInServiceDays(service.timestamp, service.status, service.serviceDate);
                    const overdueStatus = isOverdue(service.targetDate, service.status);
                    const isCompleted = (service.status || "").toLowerCase().includes("completed");
                    return (
                      <div
                        key={service.serviceId}
                        onClick={() => handleEditService(service.serviceId)}
                        className={cn(
                          "group relative cursor-pointer rounded-2xl border shadow-[var(--shadow-float)] backdrop-blur p-4 hover:border-primary/40 hover:shadow-lg transition-all",
                          getStatusCardBg(service.status || ""),
                          overdueStatus && "border-destructive/40 ring-1 ring-destructive/20",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground">{service.serviceId}</span>
                              {overdueStatus && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                            </div>
                            <p className="text-base font-semibold text-foreground truncate mt-0.5">{service.clientName || "N/A"}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {isWithinDay(service) && (
                                <span className="rounded-full border border-sky-400/40 bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-600">
                                  Within the Day
                                </span>
                              )}
                              {(service as any).rushFee && (
                                <span className="rounded-full border border-orange-400/40 bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-600">
                                  Rush
                                </span>
                              )}
                              {(service as any).isBackjob && (
                                <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">
                                  Backjob
                                </span>
                              )}
                              {(service as any).waitingForParts && (
                                <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                                  Waiting for Parts
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={cn("text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border font-medium whitespace-nowrap", getStatusTextColor(service.status || ""), "border-current/30")}>
                            {service.status || "N/A"}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground text-xs">Device</span>
                            <span className="text-foreground truncate max-w-[60%] text-right">
                              {Array.from(new Set([service.deviceType, service.brand, service.deviceModel].filter(Boolean).map((v) => String(v).trim()))).join(" · ") || "N/A"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground text-xs">Service</span>
                            <span className="text-foreground truncate max-w-[60%] text-right">{service.service || "N/A"}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground text-xs">Technician</span>
                            <span className="text-foreground truncate max-w-[60%] text-right">{service.technician || "Unassigned"}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground text-xs">Admin</span>
                            <span className="text-foreground truncate max-w-[60%] text-right">{service.adminRep || "N/A"}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground text-xs">Cost</span>
                            <span className="text-foreground tabular-nums">{service.serviceCost || "—"}</span>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                          <div className="flex flex-col">
                            <span className="text-muted-foreground">Service date</span>
                            <span className="font-medium">
                              {service.serviceDate ? displayDate(service.serviceDate, "MMM dd, yyyy") : "—"}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-muted-foreground">Target</span>
                            <span className={cn("font-medium", overdueStatus && "text-destructive")}>
                              {service.targetDate ? displayDate(service.targetDate, "MMM dd, yyyy") : "—"}
                            </span>
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-muted-foreground">In service</span>
                            <span className={cn("font-semibold", inServiceDays > 7 && !isCompleted && "text-orange-600")}>
                              {isCompleted ? "—" : `${inServiceDays} ${inServiceDays === 1 ? "day" : "days"}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); openNotifyDialog(service as ServiceRecord); }}
                              title="Notify"
                              className="h-8 w-8 p-0"
                            >
                              <Bell className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleForward(service as ServiceRecord); }}
                              title="Forward"
                              className="h-8 w-8 p-0"
                            >
                              <Forward className="h-4 w-4" />
                            </Button>
                            {canDeleteService && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); openDeleteDialog(service as ServiceRecord); }}
                                title="Delete service"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-end mb-4">
                  <div className="inline-flex rounded-full border border-border/60 bg-muted/40 p-1 text-xs">
                    <button
                      onClick={() => setViewMode("cards")}
                      className={cn("px-3 py-1.5 rounded-full transition-colors", (viewMode as string) === "cards" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}
                    >Cards</button>
                    <button
                      onClick={() => setViewMode("table")}
                      className={cn("px-3 py-1.5 rounded-full transition-colors", viewMode === "table" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}
                    >Table</button>
                  </div>
                </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Txn Status</TableHead>
                      <TableHead>Client Name</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("timestamp")}>
                        <div className="flex items-center gap-1">
                          Service Date <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("technician")}>
                        <div className="flex items-center gap-1">
                          Technician <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead>Service/s</TableHead>
                      <TableHead>Device Type</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Service Cost</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("targetDate")}>
                        <div className="flex items-center gap-1">
                          Target Date <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("inService")}>
                        <div className="flex items-center gap-1">
                          In Service <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedServices.map((service) => {
                       const inServiceDays = calculateInServiceDays(service.timestamp, service.status, service.serviceDate);
                       const overdueStatus = isOverdue(service.targetDate, service.status);
                       const isCompleted = (service.status || "").toLowerCase().includes("completed");

                       return (
                         <ActivityLogRow
                           key={service.serviceId}
                           service={service}
                           overdueStatus={overdueStatus}
                           inServiceDays={inServiceDays}
                         >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span>{service.serviceId}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditService(service.serviceId);
                                  }}
                                  className="p-1 rounded hover:bg-muted transition-colors"
                                >
                                  <ExternalLink className="h-4 w-4 text-primary" />
                                </button>
                                {overdueStatus && <AlertCircle className="h-4 w-4 text-destructive" />}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={getStatusTextColor(service.status || "")}>
                                {service.status || "N/A"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs">
                                {(service as any).transactionStatus || "-"}
                              </span>
                            </TableCell>
                           <TableCell>{service.clientName || "N/A"}</TableCell>
                           <TableCell>{service.timestamp ? displayDate(service.timestamp, "MMM dd, yyyy, hh:mm a") : "N/A"}</TableCell>
                           <TableCell>{service.adminRep || "N/A"}</TableCell>
                           <TableCell>
                             <div className="flex flex-col">
                               <span>{service.technician || "Unassigned"}</span>
                               <span className="text-xs text-muted-foreground">
                                 {techniciansWithDept.find(t => t.name === service.technician)?.department || ""}
                               </span>
                             </div>
                           </TableCell>
                            <TableCell className="min-w-[200px] whitespace-normal break-words">
                              {service.service || "N/A"}
                            </TableCell>
                           <TableCell>{service.deviceType || "N/A"}</TableCell>
                           <TableCell>{service.brand || "N/A"}</TableCell>
                           <TableCell>{service.device || "N/A"}</TableCell>
                           <TableCell>{service.serviceCost || "N/A"}</TableCell>
                           <TableCell className={overdueStatus ? "text-destructive font-semibold" : ""}>
                             {service.targetDate ? displayDate(service.targetDate, "MMM dd, yyyy") : "N/A"}
                           </TableCell>
                           <TableCell>
                             {isCompleted ? (
                               <span className="text-muted-foreground">-</span>
                             ) : (
                               <span className={`font-semibold ${inServiceDays > 7 ? "text-orange-600" : ""}`}>
                                 {inServiceDays} {inServiceDays === 1 ? "day" : "days"}
                               </span>
                             )}
                           </TableCell>
                           <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openNotifyDialog(service as ServiceRecord);
                                  }}
                                  title="Notify"
                                  className="h-8 w-8 p-0"
                                >
                                  <Bell className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleForward(service as ServiceRecord);
                                  }}
                                  title="Forward"
                                  className="h-8 w-8 p-0"
                                >
                                  <Forward className="h-4 w-4" />
                                </Button>
                                {canDeleteService && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDeleteDialog(service as ServiceRecord);
                                    }}
                                    title="Delete service"
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>

                            </TableCell>
                         </ActivityLogRow>
                       );
                     })}
                  </TableBody>
                </Table>
               </div>
              </>
            )}


            {!isLoading && filteredAndSortedServices.length > 0 && (
              <div className="mt-6">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                      return null;
                    })}

                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                <div className="text-center mt-2 text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages} • Showing {paginatedServices.length} of {filteredAndSortedServices.length} services
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          
        </div>
      </div>

      {/* Notify Service Dialog */}
      <Dialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {notifyService && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-semibold">{notifyService.serviceId}</p>
                <p className="text-muted-foreground">{notifyService.clientName} - {notifyService.device || notifyService.deviceType}</p>
                <p className="text-muted-foreground">Status: {notifyService.status}</p>
                {notifyService.technician && (
                  <p className="text-muted-foreground">Technician: {notifyService.technician}</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Message (optional)</Label>
              <Textarea
                placeholder="Add a message to include in the notification..."
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleNotify} 
              disabled={notifySending}
            >
              <Bell className="h-4 w-4 mr-2" />
              {notifySending ? "Sending..." : "Notify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forward Service Dialog */}
      <Dialog open={forwardDialogOpen} onOpenChange={setForwardDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Forward Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {forwardService && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-semibold">{forwardService.serviceId}</p>
                <p className="text-muted-foreground">{forwardService.clientName} - {forwardService.device || forwardService.deviceType}</p>
                <p className="text-muted-foreground">Status: {forwardService.status}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Send to</Label>
              <Select value={forwardRecipient} onValueChange={setForwardRecipient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select recipient..." />
                </SelectTrigger>
                <SelectContent>
                  {forwardableStaff.map((staff) => (
                    <SelectItem key={staff.staffId} value={staff.staffId}>
                      {staff.name} ({staff.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message (optional)</Label>
              <Textarea
                placeholder="Add a note or instructions..."
                value={forwardMessage}
                onChange={(e) => setForwardMessage(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForwardDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendForward} 
              disabled={!forwardRecipient || forwardSending}
            >
              <Send className="h-4 w-4 mr-2" />
              {forwardSending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete service confirmation (management only) */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirm(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete service permanently</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This permanently removes <span className="font-mono font-semibold text-foreground">{deleteTarget?.serviceId}</span>
              {deleteTarget?.clientName ? <> for <span className="font-semibold text-foreground">{deleteTarget.clientName}</span></> : null} and its uploaded forms. This cannot be undone.
            </p>
            <div className="space-y-1.5">
              <Label>Type the Service ID to confirm</Label>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={deleteTarget?.serviceId || ""}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirm(""); }} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting || deleteConfirm.trim().toUpperCase() !== (deleteTarget?.serviceId || "").toUpperCase()}
              onClick={handleDeleteService}
            >
              {deleting ? "Deleting..." : "Delete service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>

  );
};

export default ServiceTracker;
