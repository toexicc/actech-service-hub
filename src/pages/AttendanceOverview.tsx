import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CalendarIcon, Search, Download } from "lucide-react";
import { cn } from "@/lib/utils";

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

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

const computeHours = (ti: string | null, to: string | null): string => {
  if (!ti || !to) return "—";
  const ms = new Date(to).getTime() - new Date(ti).getTime();
  if (ms <= 0) return "—";
  const h = ms / 3_600_000;
  return `${h.toFixed(2)} h`;
};

const AttendanceOverview = () => {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [start, setStart] = useState<Date | undefined>();
  const [end, setEnd] = useState<Date | undefined>();

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase.from("attendance_logs").select("*").order("log_date", { ascending: false }).order("time_in", { ascending: false }).limit(2000);
      if (start) q = q.gte("log_date", format(start, "yyyy-MM-dd"));
      if (end) q = q.lte("log_date", format(end, "yyyy-MM-dd"));
      const { data } = await q;
      setRows((data as AttendanceRow[]) || []);
      setLoading(false);
    })();
  }, [start, end]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.staff_name.toLowerCase().includes(q));
  }, [rows, search]);

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

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Attendance Overview</h1>
          <p className="text-muted-foreground">Daily Time In and Time Out records for all employees</p>
        </div>
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
                <Input placeholder="Search employee..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[140px]", !start && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {start ? format(start, "MMM dd") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={start} onSelect={setStart} className="pointer-events-auto" /></PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[140px]", !end && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {end ? format(end, "MMM dd") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={end} onSelect={setEnd} className="pointer-events-auto" /></PopoverContent>
              </Popover>
              {(start || end) && (
                <Button variant="ghost" size="sm" onClick={() => { setStart(undefined); setEnd(undefined); }}>Clear</Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Time In</TableHead>
                    <TableHead>Time Out</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No records</TableCell></TableRow>
                  ) : (
                    filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{format(new Date(r.log_date + "T00:00:00"), "MM/dd/yyyy")}</TableCell>
                        <TableCell className="font-medium">{r.staff_name}</TableCell>
                        <TableCell>{fmtTime(r.time_in)}</TableCell>
                        <TableCell>{fmtTime(r.time_out)}</TableCell>
                        <TableCell>{computeHours(r.time_in, r.time_out)}</TableCell>
                        <TableCell className="space-x-1">
                          {r.is_late && <Badge variant="destructive">Late</Badge>}
                          {r.is_overtime && <Badge>Overtime</Badge>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AttendanceOverview;
