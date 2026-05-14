import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, differenceInDays, subDays, startOfMonth, endOfMonth } from "date-fns";
import { displayDate } from "@/lib/timezone";
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
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { STATUS_OPTIONS } from "@/lib/constants";
import { ArrowUpDown, Calendar, Clock, AlertCircle, CalendarIcon, X, Search, ExternalLink, Bell, Forward, Send, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import logo from "@/assets/S_S_Marketing-2.png";
import ActivityLogRow from "@/components/ActivityLogRow";
import { useServices, useInvalidateServices } from "@/hooks/useServices";
import { useStaff } from "@/hooks/useStaff";

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
}

type SortField = "timestamp" | "technician" | "inService" | "targetDate";
type SortOrder = "asc" | "desc";

const ServiceTracker = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { data: services = [], isLoading } = useServices();
  const invalidateServices = useInvalidateServices();
  const { data: staffList = [] } = useStaff();
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [sortField, setSortField] = useState<SortField>("targetDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [dueDateFilter, setDueDateFilter] = useState("all");
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

  // Handle URL params for status filter (from dashboard clicks)
  useEffect(() => {
    const urlStatusFilter = searchParams.get('statusFilter');
    const urlStatus = searchParams.get('status');
    if (urlStatusFilter) {
      setDueDateFilter(urlStatusFilter);
      searchParams.delete('statusFilter');
      setSearchParams(searchParams, { replace: true });
    }
    if (urlStatus) {
      setStatusFilter(urlStatus);
      searchParams.delete('status');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Check if user is a technician with locked filters
  const userRole = sessionStorage.getItem("userRole");
  const username = sessionStorage.getItem("username");
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
      const userId = sessionStorage.getItem("userId") || sessionStorage.getItem("staffId") || "";
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
    const currentUserId = sessionStorage.getItem("userId") || sessionStorage.getItem("staffId");
    return staffList.filter(s => 
      (s.userId || s.staffId) !== currentUserId && 
      s.status?.toLowerCase() === "active" &&
      ["technician", "admin", "management"].includes(s.role?.toLowerCase() || "")
    );
  }, [staffList]);

  const applyDatePreset = (preset: string) => {
    const today = new Date();
    
    switch (preset) {
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
  };

  useEffect(() => {
    // Set technician filters if user is a technician
    if (isTechnician && username && staffList.length > 0) {
      const techInfo = staffList.find((staff) => staff.username === username);
      if (techInfo) {
        setTechnicianName(techInfo.name);
        setTechnicianDepartment(techInfo.department || "");
        setTechnicianFilter(techInfo.name);
        setDepartmentFilter(techInfo.department || "all");
      }
    }
  }, [isTechnician, username, staffList]);

  // Optimized polling: refresh every 60 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      invalidateServices();
    }, 60000);
    
    return () => clearInterval(intervalId);
  }, [invalidateServices]);

  const calculateInServiceDays = (timestamp: string, status?: string): number => {
    if (status && status.toLowerCase().includes("completed")) {
      return 0;
    }
    if (!timestamp) return 0;
    try {
      const [datePart] = timestamp.split(", ");
      const parts = datePart.split(/[-/]/);
      if (parts.length !== 3) return 0;
      
      const [month, day, year] = parts;
      const serviceDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      serviceDate.setHours(0, 0, 0, 0);
      
      if (isNaN(serviceDate.getTime())) {
        return 0;
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const days = differenceInDays(today, serviceDate);
      return Math.max(0, days);
    } catch (error) {
      return 0;
    }
  };

  const isOverdue = (targetDate: string, status: string): boolean => {
    if (!targetDate) return false;
    if (status === "Completed") return false;
    try {
      const parts = targetDate.split(/[-/]/);
      if (parts.length !== 3) return false;
      
      const [month, day, year] = parts;
      const target = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      target.setHours(23, 59, 59, 999);
      
      if (isNaN(target.getTime())) return false;
      
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
      const parts = targetDate.split(/[-/]/);
      if (parts.length !== 3) return 999;
      
      const [month, day, year] = parts;
      const target = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
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

  const filteredAndSortedServices = useMemo(() => {
    // Don't filter while loading to prevent showing unfiltered data
    if (isLoading) {
      return [];
    }

    let filtered = services.filter(service => {
      // Do NOT filter out any services by status - show ALL services

      // Search filter - search by Service ID or Client Name
      if (debouncedSearch.trim()) {
        const query = debouncedSearch.toLowerCase();
        const matchesServiceId = service.serviceId?.toLowerCase().includes(query);
        const matchesClientName = service.clientName?.toLowerCase().includes(query);
        
        if (!matchesServiceId && !matchesClientName) {
          return false;
        }
      }

      // Device type filter
      if (deviceTypeFilter !== "all" && service.deviceType !== deviceTypeFilter) {
        return false;
      }

      // Technician filter - if a specific technician is selected, show services where they are assigned
      // Supports multiple technicians (comma-separated in the technician field)
      if (technicianFilter !== "all") {
        const assignedTechnicians = service.technician?.split(",").map(t => t.trim()) || [];
        if (!assignedTechnicians.includes(technicianFilter)) {
          return false;
        }
      } else if (departmentFilter !== "all") {
        // Department filter - only apply if no specific technician is selected
        const techDept = techniciansWithDept.find(t => t.name === service.technician)?.department;
        if (techDept !== departmentFilter) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "all" && service.status !== statusFilter) {
        return false;
      }

      // Date range filter - filter by TARGET DATE
      if (startDate || endDate) {
        try {
          const targetParts = service.targetDate.split(/[-/]/);
          if (targetParts.length === 3) {
            const [month, day, year] = targetParts;
            const targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            targetDate.setHours(0, 0, 0, 0);
            
            if (startDate) {
              const start = new Date(startDate);
              start.setHours(0, 0, 0, 0);
              if (targetDate < start) {
                return false;
              }
            }
            
            if (endDate) {
              const end = new Date(endDate);
              end.setHours(23, 59, 59, 999);
              if (targetDate > end) {
                return false;
              }
            }
          }
        } catch (error) {
          console.error("Error parsing target date for filter:", error);
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
        }
      }

      return true;
    });

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
          compareValue = calculateInServiceDays(a.timestamp, a.status) - calculateInServiceDays(b.timestamp, b.status);
          break;
        case "targetDate":
          compareValue = (a.targetDate || "").localeCompare(b.targetDate || "");
          break;
      }

      return sortOrder === "asc" ? compareValue : -compareValue;
    });

    return filtered;
  }, [services, deviceTypeFilter, technicianFilter, departmentFilter, statusFilter, startDate, endDate, sortField, sortOrder, debouncedSearch, dueDateFilter, techniciansWithDept]);

  const departments = useMemo(() => {
    const depts = new Set(techniciansWithDept.map(t => t.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [techniciansWithDept]);

  const paginatedServices = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedServices.slice(startIndex, endIndex);
  }, [filteredAndSortedServices, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedServices.length / itemsPerPage);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [deviceTypeFilter, technicianFilter, departmentFilter, startDate, endDate, sortField, sortOrder, debouncedSearch, dueDateFilter]);

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
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Service Tracker</h1>
            <p className="text-muted-foreground">Monitor all ongoing services</p>
          </div>
          {(userRole === "admin" || userRole === "management") && (
            <Button 
              onClick={() => window.open("https://docs.google.com/spreadsheets/d/14aDQwwbLLS7FWNdcx-mChLjC-8pTV73UIScjt8HPnSc/edit?usp=sharing", "_blank")} 
              variant="outline"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Sheet
            </Button>
          )}
        </div>

        {/* Search Bar */}
        <Card className="mb-6">
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
                  className="pl-10"
                />
              </div>
              <Button 
                variant="outline" 
                onClick={() => setSearchInput("")}
              >
                Clear
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => invalidateServices()}
                disabled={isLoading}
                title="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="mb-6">
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
                <Select value={statusFilter} onValueChange={setStatusFilter}>
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
              </div>

              <div className="space-y-2">
                <Label>Sort By</Label>
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
                      onSelect={setStartDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>End Date</Label>
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
                      onSelect={setEndDate}
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
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => applyDatePreset("last7")}
                  >
                    Last 7 Days
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => applyDatePreset("last30")}
                  >
                    Last 30 Days
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => applyDatePreset("thisMonth")}
                  >
                    This Month
                  </Button>
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

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Ongoing</p>
                  <p className="text-2xl font-bold">
                    {filteredAndSortedServices.filter(s => {
                      const status = s.status?.toLowerCase() || "";
                      return !status.includes("completed") && !status.includes("cancelled");
                    }).length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold text-destructive">
                    {filteredAndSortedServices.filter(s => {
                      const status = s.status?.toLowerCase() || "";
                      const isOngoing = !status.includes("completed") && !status.includes("cancelled");
                      return isOngoing && isOverdue(s.targetDate, s.status);
                    }).length}
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">On Track</p>
                  <p className="text-2xl font-bold text-green-600">
                    {filteredAndSortedServices.filter(s => {
                      const status = s.status?.toLowerCase() || "";
                      const isOngoing = !status.includes("completed") && !status.includes("cancelled");
                      return isOngoing && !isOverdue(s.targetDate, s.status) && s.targetDate;
                    }).length}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Services Table */}
        <Card>
          <CardHeader>
            <CardTitle>Ongoing Services</CardTitle>
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
            ) : filteredAndSortedServices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No ongoing services found</div>
            ) : (
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
                       const inServiceDays = calculateInServiceDays(service.timestamp, service.status);
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
                              </div>
                            </TableCell>
                         </ActivityLogRow>
                       );
                     })}
                  </TableBody>
                </Table>
              </div>
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
          powered by Stack&Scale
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
    </DashboardLayout>
  );
};

export default ServiceTracker;
