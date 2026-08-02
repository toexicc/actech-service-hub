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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CalendarIcon, Search, Download, UserPlus, Plane, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStaff } from "@/hooks/useStaff";
import { toast } from "@/hooks/use-toast";

interface AttendanceRow {
  id: string;
  staff_id: string;
  staff_name: string;
  log_date: string;
  time_in: string | null;
  time_out: string | null;
  is_late: boolean;
  is_overtime: boolean;
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

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

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
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [start, setStart] = useState<Date | undefined>();
  const [end, setEnd] = useState<Date | undefined>();
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);

  const { data: staff } = useStaff();
  const eligibleStaff = useMemo(
    () =>
      (staff ?? []).filter(
        (s) =>
          ["technician", "admin"].includes((s.role || "").toLowerCase()) &&
          (s.status || "active").toLowerCase() === "active",
      ),
    [staff],
  );

  // ---- Bulk attendance modal state ----
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkSel, setBulkSel] = useState<Record<string, { checked: boolean; timeIn: string; timeOut: string }>>({});

  // ---- Leave modal state ----
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveStaff, setLeaveStaff] = useState("");
  const [leaveType, setLeaveType] = useState("sick");
  const [leaveStart, setLeaveStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [leaveEnd, setLeaveEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [leaveNotes, setLeaveNotes] = useState("");

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

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.staff_name.toLowerCase().includes(q));
  }, [rows, search]);

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

  useEffect(() => setPage(0), [search, start, end]);

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
      setReload((n) => n + 1);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Could not save attendance.", variant: "destructive" });
    } finally {
      setBulkSaving(false);
    }
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
      const { error } = await supabase.from("staff_leaves").insert({
        staff_id: member.userId,
        staff_name: member.name,
        leave_type: leaveType,
        start_date: leaveStart,
        end_date: leaveEnd,
        notes: leaveNotes || null,
        created_by: userRes?.user?.id ?? null,
      });
      if (error) throw new Error(error.message);
      toast({ title: "Leave recorded", description: `${member.name} is marked unavailable.` });
      setLeaveOpen(false);
      setLeaveNotes("");
      setReload((n) => n + 1);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Could not save leave.", variant: "destructive" });
    } finally {
      setLeaveSaving(false);
    }
  };

  const deleteLeave = async (id: string) => {
    const { error } = await supabase.from("staff_leaves").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setReload((n) => n + 1);
  };

  const today = format(new Date(), "yyyy-MM-dd");
  const onLeaveToday = leaves.filter((l) => l.start_date <= today && l.end_date >= today && l.status === "approved");

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
            <Button size="sm" variant="outline" onClick={() => setLeaveOpen(true)}>
              <Plane className="h-4 w-4 mr-1" /> Add leave
            </Button>
          </div>
        </div>

        <Tabs defaultValue="logs">
          <TabsList className="mb-4">
            <TabsTrigger value="logs">Daily Logs</TabsTrigger>
            <TabsTrigger value="leave">Leave Tracker ({onLeaveToday.length} today)</TabsTrigger>
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
                      <Button variant="outline" size="sm" className={cn("w-[140px]", !start && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {start ? format(start, "MMM dd") : "From"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={start} onSelect={setStart} className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-[140px]", !end && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {end ? format(end, "MMM dd") : "To"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={end} onSelect={setEnd} className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  {(start || end) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStart(undefined);
                        setEnd(undefined);
                      }}
                    >
                      Clear
                    </Button>
                  )}
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
                                <TableHead>Time In</TableHead>
                                <TableHead>Time Out</TableHead>
                                <TableHead>Hours</TableHead>
                                <TableHead>Tags</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filtered
                                .filter((r) => r.log_date === day)
                                .map((r) => (
                                  <TableRow key={r.id}>
                                    <TableCell className="font-medium">{r.staff_name}</TableCell>
                                    <TableCell>{fmtTime(r.time_in)}</TableCell>
                                    <TableCell>{fmtTime(r.time_out)}</TableCell>
                                    <TableCell>{computeHours(r.time_in, r.time_out)}</TableCell>
                                    <TableCell className="space-x-1">
                                      {r.is_late && <Badge variant="destructive">Late</Badge>}
                                      {r.is_overtime && <Badge>Overtime</Badge>}
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
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-[60px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaves.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                              <TableCell className="capitalize">{l.leave_type}</TableCell>
                              <TableCell>{format(new Date(l.start_date + "T00:00:00"), "MM/dd/yyyy")}</TableCell>
                              <TableCell>{format(new Date(l.end_date + "T00:00:00"), "MM/dd/yyyy")}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">{l.notes || "—"}</TableCell>
                              <TableCell>
                                <Button size="icon" variant="ghost" onClick={() => deleteLeave(l.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
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
          <div className="flex-1 overflow-y-auto space-y-3">
            <div className="space-y-1">
              <Label htmlFor="bulkDate">Date</Label>
              <Input id="bulkDate" type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} />
            </div>
            {eligibleStaff.length === 0 && (
              <p className="text-sm text-muted-foreground">No active technicians or admins found.</p>
            )}
            {eligibleStaff.map((s) => {
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

      {/* Leave entry */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="max-w-md !flex !flex-col max-h-[95dvh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>Add leave</DialogTitle>
            <DialogDescription>Staff on leave are not offered for service assignment.</DialogDescription>
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
            <div className="space-y-1">
              <Label>Leave type</Label>
              <Select value={leaveType} onValueChange={setLeaveType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
    </DashboardLayout>
  );
};

export default AttendanceOverview;
