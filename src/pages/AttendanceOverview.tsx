import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { CalendarIcon, Search, Download, UserPlus, Plane, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStaff } from "@/hooks/useStaff";
import { useInvalidateAvailability } from "@/hooks/useStaffAvailability";
import { toast } from "@/hooks/use-toast";
import AttendanceReconcilePanel from "@/components/attendance/AttendanceReconcilePanel";

interface AttendanceRow {
  id: string;
  staff_id: string;
  staff_name: string;
  log_date: string;
  time_in: string | null;
  time_out: string | null;
  is_late: boolean;
  is_overtime: boolean;
  notes?: string | null;
}

interface LeaveRow {
  id: string;
  staff_id: string;
  staff_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  notes: string | null;
}

const LEAVE_TYPES = ["sick", "vacation", "emergency"];
const titleCase = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : "");

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

/** "HH:mm" value for a time input, from a stored timestamp. */
const toHHmm = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const computeHours = (ti: string | null, to: string | null): string => {
  if (!ti || !to) return "—";
  const ms = new Date(to).getTime() - new Date(ti).getTime();
  if (ms <= 0) return "—";
  return `${(ms / 3_600_000).toFixed(2)} h`;
};

/** Build an ISO timestamp for a "HH:mm" input on a given calendar day. */
const isoFor = (day: string, hhmm: string) => (hhmm ? new Date(`${day}T${hhmm}:00`).toISOString() : null);

const AttendanceOverview = () => {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [reconcileDate, setReconcileDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [start, setStart] = useState<Date | undefined>();
  const [end, setEnd] = useState<Date | undefined>();
  const [roleFilter, setRoleFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);

  const { data: staff } = useStaff();
  const invalidateAvailability = useInvalidateAvailability();

  /** Everyone active — management included — can be entered manually. */
  const eligibleStaff = useMemo(
    () =>
      (staff ?? [])
        .filter((s) => s.userId && (s.status || "active").toLowerCase() === "active")
        .sort((a, b) => (a.role || "zz").localeCompare(b.role || "zz") || a.name.localeCompare(b.name)),
    [staff],
  );

  const staffById = useMemo(() => {
    const m = new Map<string, { role: string; department: string }>();
    (staff ?? []).forEach((s) => {
      if (s.userId) m.set(s.userId, { role: (s.role || "").toLowerCase(), department: s.department || "" });
    });
    return m;
  }, [staff]);

  const departments = useMemo(
    () => Array.from(new Set((staff ?? []).map((s) => s.department).filter(Boolean))).sort() as string[],
    [staff],
  );

  // ---- Bulk attendance modal state ----
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkSel, setBulkSel] = useState<Record<string, { checked: boolean; timeIn: string; timeOut: string }>>({});

  // ---- Leave modal state ----
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveEditId, setLeaveEditId] = useState<string | null>(null);
  const [leaveStaff, setLeaveStaff] = useState("");
  const [leaveType, setLeaveType] = useState("sick");
  const [leaveStatus, setLeaveStatus] = useState("approved");
  const [leaveStart, setLeaveStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [leaveEnd, setLeaveEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [leaveNotes, setLeaveNotes] = useState("");

  // ---- Edit attendance modal state ----
  const [editRow, setEditRow] = useState<AttendanceRow | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editIn, setEditIn] = useState("");
  const [editOut, setEditOut] = useState("");
  const [editLate, setEditLate] = useState(false);
  const [editOt, setEditOt] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // ---- Convert to leave state ----
  const [convertRow, setConvertRow] = useState<AttendanceRow | null>(null);
  const [convertType, setConvertType] = useState("sick");
  const [convertNotes, setConvertNotes] = useState("");
  const [converting, setConverting] = useState(false);

  // ---- Delete confirmations ----
  const [deleteLog, setDeleteLog] = useState<AttendanceRow | null>(null);
  const [deleteLeaveRow, setDeleteLeaveRow] = useState<LeaveRow | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("attendance_logs")
        .select("*")
        .order("log_date", { ascending: false })
        .order("time_in", { ascending: false })
        .limit(2000);
      if (start) q = q.gte("log_date", format(start, "yyyy-MM-dd"));
      if (end) q = q.lte("log_date", format(end, "yyyy-MM-dd"));
      const [{ data }, { data: lv }] = await Promise.all([
        q,
        supabase.from("staff_leaves").select("*").order("start_date", { ascending: false }),
      ]);
      setRows((data as AttendanceRow[]) || []);
      setLeaves((lv as LeaveRow[]) || []);
      setLoading(false);
    })();
  }, [start, end, reload]);

  const refresh = () => {
    setReload((n) => n + 1);
    invalidateAvailability();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.staff_name.toLowerCase().includes(q)) return false;
      if (staffFilter !== "all" && r.staff_id !== staffFilter) return false;
      const info = staffById.get(r.staff_id);
      if (roleFilter !== "all" && (info?.role || "") !== roleFilter) return false;
      if (deptFilter !== "all" && (info?.department || "") !== deptFilter) return false;
      return true;
    });
  }, [rows, search, staffFilter, roleFilter, deptFilter, staffById]);

  // Pagination is by day so every record for a single day stays on one page.
  const days = useMemo(() => {
    const seen: string[] = [];
    filtered.forEach((r) => {
      if (!seen.includes(r.log_date)) seen.push(r.log_date);
    });
    return seen;
  }, [filtered]);

  const DAYS_PER_PAGE = 3;
  const pageCount = Math.max(1, Math.ceil(days.length / DAYS_PER_PAGE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageDays = days.slice(currentPage * DAYS_PER_PAGE, currentPage * DAYS_PER_PAGE + DAYS_PER_PAGE);

  useEffect(() => setPage(0), [search, start, end, roleFilter, deptFilter, staffFilter]);

  const hasFilters =
    !!start || !!end || !!search || roleFilter !== "all" || deptFilter !== "all" || staffFilter !== "all";
  const clearFilters = () => {
    setStart(undefined);
    setEnd(undefined);
    setSearch("");
    setRoleFilter("all");
    setDeptFilter("all");
    setStaffFilter("all");
  };

  const setMonth = (d: Date) => {
    setStart(startOfMonth(d));
    setEnd(endOfMonth(d));
  };

  const exportCsv = () => {
    const header = ["Date", "Employee", "Time In", "Late", "Time Out", "Overtime", "Hours"].join(",");
    const lines = filtered.map((r) =>
      [
        r.log_date,
        `"${r.staff_name.replace(/"/g, '""')}"`,
        fmtTime(r.time_in),
        r.is_late ? "Yes" : "No",
        fmtTime(r.time_out),
        r.is_overtime ? "Yes" : "No",
        computeHours(r.time_in, r.time_out),
      ].join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openBulk = () => {
    const init: Record<string, { checked: boolean; timeIn: string; timeOut: string }> = {};
    eligibleStaff.forEach((s) => {
      if (s.userId) init[s.userId] = { checked: false, timeIn: "09:00", timeOut: "" };
    });
    setBulkSel(init);
    setBulkSearch("");
    setBulkDate(format(new Date(), "yyyy-MM-dd"));
    setBulkOpen(true);
  };

  const saveBulk = async () => {
    const picked = eligibleStaff.filter((s) => s.userId && bulkSel[s.userId]?.checked);
    if (picked.length === 0) {
      toast({ title: "Select at least one employee", variant: "destructive" });
      return;
    }
    setBulkSaving(true);
    try {
      // Replace any existing rows for the selected staff on that day.
      const ids = picked.map((s) => s.userId as string);
      await supabase.from("attendance_logs").delete().eq("log_date", bulkDate).in("staff_id", ids);

      const payload = picked.map((s) => {
        const entry = bulkSel[s.userId as string];
        const timeIn = isoFor(bulkDate, entry.timeIn);
        return {
          staff_id: s.userId as string,
          staff_name: s.name,
          log_date: bulkDate,
          time_in: timeIn,
          time_out: isoFor(bulkDate, entry.timeOut),
          is_late: entry.timeIn > "09:15",
          is_overtime: !!entry.timeOut && entry.timeOut > "18:00",
        };
      });
      const { error } = await supabase.from("attendance_logs").insert(payload);
      if (error) throw new Error(error.message);
      toast({ title: "Attendance saved", description: `${payload.length} record(s) recorded.` });
      setBulkOpen(false);
      refresh();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Could not save attendance.", variant: "destructive" });
    } finally {
      setBulkSaving(false);
    }
  };

  // ---------- attendance row actions ----------
  const openEdit = (r: AttendanceRow) => {
    setEditRow(r);
    setEditDate(r.log_date);
    setEditIn(toHHmm(r.time_in));
    setEditOut(toHHmm(r.time_out));
    setEditLate(!!r.is_late);
    setEditOt(!!r.is_overtime);
    setEditNotes(r.notes || "");
  };

  const applyTimes = (nextIn: string, nextOut: string) => {
    setEditIn(nextIn);
    setEditOut(nextOut);
    setEditLate(!!nextIn && nextIn > "09:15");
    setEditOt(!!nextOut && nextOut > "18:00");
  };

  const saveEdit = async () => {
    if (!editRow) return;
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from("attendance_logs")
        .update({
          log_date: editDate,
          time_in: isoFor(editDate, editIn),
          time_out: isoFor(editDate, editOut),
          is_late: editLate,
          is_overtime: editOt,
          notes: editNotes || null,
        })
        .eq("id", editRow.id);
      if (error) throw new Error(error.message);
      toast({ title: "Attendance updated" });
      setEditRow(null);
      refresh();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Could not update record.", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDeleteLog = async () => {
    if (!deleteLog) return;
    const { error } = await supabase.from("attendance_logs").delete().eq("id", deleteLog.id);
    setDeleteLog(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Record deleted" });
    refresh();
  };

  const convertToLeave = async () => {
    if (!convertRow) return;
    setConverting(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("staff_leaves").insert({
        staff_id: convertRow.staff_id,
        staff_name: convertRow.staff_name,
        leave_type: convertType,
        start_date: convertRow.log_date,
        end_date: convertRow.log_date,
        status: "approved",
        notes: convertNotes || null,
        created_by: userRes?.user?.id ?? null,
      });
      if (error) throw new Error(error.message);
      await supabase.from("attendance_logs").delete().eq("id", convertRow.id);
      toast({ title: "Converted to leave", description: `${convertRow.staff_name} is marked on leave.` });
      setConvertRow(null);
      setConvertNotes("");
      setEditRow(null);
      refresh();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Could not convert record.", variant: "destructive" });
    } finally {
      setConverting(false);
    }
  };

  // ---------- leave actions ----------
  const openNewLeave = () => {
    setLeaveEditId(null);
    setLeaveStaff("");
    setLeaveType("sick");
    setLeaveStatus("approved");
    setLeaveStart(format(new Date(), "yyyy-MM-dd"));
    setLeaveEnd(format(new Date(), "yyyy-MM-dd"));
    setLeaveNotes("");
    setLeaveOpen(true);
  };

  const openEditLeave = (l: LeaveRow) => {
    setLeaveEditId(l.id);
    setLeaveStaff(l.staff_id);
    setLeaveType(l.leave_type);
    setLeaveStatus(l.status || "approved");
    setLeaveStart(l.start_date);
    setLeaveEnd(l.end_date);
    setLeaveNotes(l.notes || "");
    setLeaveOpen(true);
  };

  const saveLeave = async () => {
    const member = (staff ?? []).find((s) => s.userId === leaveStaff);
    if (!member?.userId) {
      toast({ title: "Select an employee", variant: "destructive" });
      return;
    }
    if (leaveEnd < leaveStart) {
      toast({ title: "End date must be on or after the start date", variant: "destructive" });
      return;
    }
    setLeaveSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const payload = {
        staff_id: member.userId,
        staff_name: member.name,
        leave_type: leaveType,
        status: leaveStatus,
        start_date: leaveStart,
        end_date: leaveEnd,
        notes: leaveNotes || null,
      };
      const { error } = leaveEditId
        ? await supabase.from("staff_leaves").update(payload).eq("id", leaveEditId)
        : await supabase.from("staff_leaves").insert({ ...payload, created_by: userRes?.user?.id ?? null });
      if (error) throw new Error(error.message);
      toast({ title: leaveEditId ? "Leave updated" : "Leave recorded", description: `${member.name} — ${titleCase(leaveType)}` });
      setLeaveOpen(false);
      setLeaveNotes("");
      refresh();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Could not save leave.", variant: "destructive" });
    } finally {
      setLeaveSaving(false);
    }
  };

  const confirmDeleteLeave = async () => {
    if (!deleteLeaveRow) return;
    const { error } = await supabase.from("staff_leaves").delete().eq("id", deleteLeaveRow.id);
    setDeleteLeaveRow(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Leave deleted" });
    refresh();
  };

  const today = format(new Date(), "yyyy-MM-dd");
  const onLeaveToday = leaves.filter((l) => l.start_date <= today && l.end_date >= today && l.status === "approved");

  const bulkVisible = eligibleStaff.filter((s) =>
    bulkSearch ? s.name.toLowerCase().includes(bulkSearch.toLowerCase()) : true,
  );

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 animate-fade-in">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Attendance</h1>
            <p className="text-muted-foreground">Daily Time In and Time Out records and staff availability</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={openBulk}>
              <UserPlus className="h-4 w-4 mr-1" /> Record attendance
            </Button>
            <Button size="sm" variant="outline" onClick={openNewLeave}>
              <Plane className="h-4 w-4 mr-1" /> Add leave
            </Button>
          </div>
        </div>

        <Tabs defaultValue="logs">
          <TabsList className="mb-4">
            <TabsTrigger value="logs">Daily Logs</TabsTrigger>
            <TabsTrigger value="leave">Leave Tracker ({onLeaveToday.length} today)</TabsTrigger>
            <TabsTrigger value="reconcile">Reconciliation</TabsTrigger>
          </TabsList>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Records ({filtered.length})</span>
                  <Button size="sm" variant="outline" onClick={exportCsv}>
                    <Download className="h-4 w-4 mr-1" /> CSV
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search employee..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn("min-w-[220px] justify-start", !start && !end && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {start && end
                            ? `${format(start, "MM/dd/yyyy")} – ${format(end, "MM/dd/yyyy")}`
                            : start
                            ? format(start, "MM/dd/yyyy")
                            : "Date range"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          selected={{ from: start, to: end }}
                          onSelect={(r: any) => {
                            setStart(r?.from);
                            setEnd(r?.to ?? r?.from);
                          }}
                          numberOfMonths={2}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <CalendarIcon className="mr-2 h-3 w-3" /> Month
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-2 border-b">
                          <Button size="sm" variant="ghost" className="w-full" onClick={() => setMonth(new Date())}>
                            This month
                          </Button>
                        </div>
                        <Calendar
                          mode="single"
                          onSelect={(d) => d && setMonth(d)}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="sm:w-[180px]">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All roles</SelectItem>
                        <SelectItem value="management">Management</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="technician">Technician</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={deptFilter}
                      onValueChange={setDeptFilter}
                      disabled={!(roleFilter === "all" || roleFilter === "technician")}
                    >
                      <SelectTrigger className="sm:w-[220px]">
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All departments</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={staffFilter} onValueChange={setStaffFilter}>
                      <SelectTrigger className="sm:w-[220px]">
                        <SelectValue placeholder="Staff" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All staff</SelectItem>
                        {(staff ?? [])
                          .filter((s) => s.userId)
                          .map((s) => (
                            <SelectItem key={s.userId} value={s.userId as string}>
                              {s.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {hasFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    )}
                  </div>
                </div>

                {loading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading…</p>
                ) : pageDays.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No records</p>
                ) : (
                  <div className="space-y-6">
                    {pageDays.map((day) => (
                      <div key={day} className="space-y-2">
                        <h3 className="text-sm font-semibold">
                          {format(new Date(day + "T00:00:00"), "EEEE, MM/dd/yyyy")}
                        </h3>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Time In</TableHead>
                                <TableHead>Time Out</TableHead>
                                <TableHead>Hours</TableHead>
                                <TableHead>Tags</TableHead>
                                <TableHead className="w-[100px]" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filtered
                                .filter((r) => r.log_date === day)
                                .map((r) => (
                                  <TableRow key={r.id}>
                                    <TableCell className="font-medium">{r.staff_name}</TableCell>
                                    <TableCell className="capitalize text-muted-foreground text-sm">
                                      {staffById.get(r.staff_id)?.role || "—"}
                                    </TableCell>
                                    <TableCell>{fmtTime(r.time_in)}</TableCell>
                                    <TableCell>{fmtTime(r.time_out)}</TableCell>
                                    <TableCell>{computeHours(r.time_in, r.time_out)}</TableCell>
                                    <TableCell className="space-x-1">
                                      {r.is_late && <Badge variant="destructive">Late</Badge>}
                                      {r.is_overtime && <Badge>Overtime</Badge>}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-1">
                                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={() => setDeleteLog(r)}>
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {pageCount > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                      Page {currentPage + 1} of {pageCount}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={currentPage === 0}
                        onClick={() => setPage(currentPage - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={currentPage >= pageCount - 1}
                        onClick={() => setPage(currentPage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leave">
            <Card>
              <CardHeader>
                <CardTitle>Leave Records ({leaves.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-[100px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaves.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No leave recorded
                          </TableCell>
                        </TableRow>
                      ) : (
                        leaves.map((l) => {
                          const active = l.start_date <= today && l.end_date >= today;
                          return (
                            <TableRow key={l.id} className={active ? "bg-amber-500/5" : undefined}>
                              <TableCell className="font-medium">
                                {l.staff_name}
                                {active && (
                                  <Badge variant="outline" className="ml-2">
                                    On leave
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>{titleCase(l.leave_type)}</TableCell>
                              <TableCell>{format(new Date(l.start_date + "T00:00:00"), "MM/dd/yyyy")}</TableCell>
                              <TableCell>{format(new Date(l.end_date + "T00:00:00"), "MM/dd/yyyy")}</TableCell>
                              <TableCell>{titleCase(l.status || "")}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">{l.notes || "—"}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" onClick={() => openEditLeave(l)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => setDeleteLeaveRow(l)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reconcile">
            <AttendanceReconcilePanel
              date={reconcileDate}
              onDateChange={setReconcileDate}
              attendance={rows}
              staff={(staff ?? []) as any}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Bulk attendance entry */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-2xl !flex !flex-col max-h-[95dvh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>Record attendance</DialogTitle>
            <DialogDescription>
              Tick everyone who reported for the day and set their times. Existing records for the same day are replaced.
            </DialogDescription>
          </DialogHeader>
          <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="bulkDate">Date</Label>
              <Input id="bulkDate" type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bulkSearch">Search staff</Label>
              <Input
                id="bulkSearch"
                placeholder="Filter by name"
                value={bulkSearch}
                onChange={(e) => setBulkSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 px-1">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <Checkbox
                checked={bulkVisible.length > 0 && bulkVisible.every((s) => bulkSel[s.userId as string]?.checked)}
                onCheckedChange={(v) => {
                  const checked = !!v;
                  setBulkSel((p) => {
                    const next = { ...p };
                    bulkVisible.forEach((s) => {
                      const key = s.userId as string;
                      next[key] = { ...(next[key] ?? { timeIn: "09:00", timeOut: "" }), checked };
                    });
                    return next;
                  });
                }}
              />
              Select all ({bulkVisible.filter((s) => bulkSel[s.userId as string]?.checked).length}/{bulkVisible.length})
            </label>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 mt-2">
            {bulkVisible.length === 0 && <p className="text-sm text-muted-foreground">No active staff found.</p>}
            {bulkVisible.map((s) => {
              const key = s.userId as string;
              const entry = bulkSel[key] ?? { checked: false, timeIn: "09:00", timeOut: "" };
              return (
                <div key={key} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
                  <Checkbox
                    checked={entry.checked}
                    onCheckedChange={(v) => setBulkSel((p) => ({ ...p, [key]: { ...entry, checked: !!v } }))}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{s.role || "staff"}</p>
                  </div>
                  <Input
                    type="time"
                    className="w-[120px]"
                    value={entry.timeIn}
                    disabled={!entry.checked}
                    onChange={(e) => setBulkSel((p) => ({ ...p, [key]: { ...entry, timeIn: e.target.value } }))}
                  />
                  <Input
                    type="time"
                    className="w-[120px]"
                    value={entry.timeOut}
                    disabled={!entry.checked}
                    onChange={(e) => setBulkSel((p) => ({ ...p, [key]: { ...entry, timeOut: e.target.value } }))}
                  />
                </div>
              );
            })}
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkSaving}>
              Cancel
            </Button>
            <Button onClick={saveBulk} disabled={bulkSaving}>
              {bulkSaving ? "Saving…" : "Save attendance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit attendance */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-md !flex !flex-col max-h-[95dvh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>Edit attendance</DialogTitle>
            <DialogDescription>{editRow?.staff_name}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3">
            <div className="space-y-1">
              <Label htmlFor="editDate">Date</Label>
              <Input id="editDate" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="editIn">Time In</Label>
                <Input id="editIn" type="time" value={editIn} onChange={(e) => applyTimes(e.target.value, editOut)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="editOut">Time Out</Label>
                <Input id="editOut" type="time" value={editOut} onChange={(e) => applyTimes(editIn, e.target.value)} />
              </div>
            </div>
            <div className="flex gap-6 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={editLate} onCheckedChange={(v) => setEditLate(!!v)} /> Late
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={editOt} onCheckedChange={(v) => setEditOt(!!v)} /> Overtime
              </label>
            </div>
            <div className="space-y-1">
              <Label htmlFor="editNotes">Notes</Label>
              <Textarea id="editNotes" rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setConvertType("sick");
                setConvertRow(editRow);
              }}
            >
              <Plane className="h-4 w-4 mr-1" /> Convert to leave
            </Button>
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setEditRow(null)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to leave */}
      <Dialog open={!!convertRow} onOpenChange={(o) => !o && setConvertRow(null)}>
        <DialogContent className="max-w-md !flex !flex-col max-h-[95dvh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>Convert to leave</DialogTitle>
            <DialogDescription>
              The attendance record is removed and {convertRow?.staff_name} is marked on leave for{" "}
              {convertRow ? format(new Date(convertRow.log_date + "T00:00:00"), "MM/dd/yyyy") : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3">
            <div className="space-y-1">
              <Label>Leave type</Label>
              <Select value={convertType} onValueChange={setConvertType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {titleCase(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="convertNotes">Notes</Label>
              <Textarea id="convertNotes" rows={2} value={convertNotes} onChange={(e) => setConvertNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setConvertRow(null)} disabled={converting}>
              Cancel
            </Button>
            <Button onClick={convertToLeave} disabled={converting}>
              {converting ? "Converting…" : "Convert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave entry / edit */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="max-w-md !flex !flex-col max-h-[95dvh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>{leaveEditId ? "Edit leave" : "Add leave"}</DialogTitle>
            <DialogDescription>Staff on approved leave are not offered for service assignment.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3">
            <div className="space-y-1">
              <Label>Employee</Label>
              <Select value={leaveStaff} onValueChange={setLeaveStaff}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {(staff ?? [])
                    .filter((s) => s.userId)
                    .map((s) => (
                      <SelectItem key={s.userId} value={s.userId as string}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Leave type</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {titleCase(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={leaveStatus} onValueChange={setLeaveStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="leaveStart">From</Label>
                <Input id="leaveStart" type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="leaveEnd">To</Label>
                <Input id="leaveEnd" type="date" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="leaveNotes">Notes</Label>
              <Textarea id="leaveNotes" rows={2} value={leaveNotes} onChange={(e) => setLeaveNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setLeaveOpen(false)} disabled={leaveSaving}>
              Cancel
            </Button>
            <Button onClick={saveLeave} disabled={leaveSaving}>
              {leaveSaving ? "Saving…" : "Save leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmations */}
      <AlertDialog open={!!deleteLog} onOpenChange={(o) => !o && setDeleteLog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete attendance record?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteLog?.staff_name} on{" "}
              {deleteLog ? format(new Date(deleteLog.log_date + "T00:00:00"), "MM/dd/yyyy") : ""} will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteLog}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteLeaveRow} onOpenChange={(o) => !o && setDeleteLeaveRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete leave record?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteLeaveRow?.staff_name} — {titleCase(deleteLeaveRow?.leave_type || "")} leave will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteLeave}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AttendanceOverview;
