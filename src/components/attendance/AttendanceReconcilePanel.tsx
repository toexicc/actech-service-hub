import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { reconcileAttendance, type ReconcileAttendanceRow, type ReconcileStaff } from "@/lib/attendanceReconcile";
import { useServices, useCompletedServices } from "@/hooks/useServices";

interface Props {
  /** Manila date (yyyy-MM-dd) being reconciled. */
  date: string;
  onDateChange: (next: string) => void;
  attendance: ReconcileAttendanceRow[];
  staff: ReconcileStaff[];
}

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-US", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "—";

/**
 * Cross-check panel: who was clocked in vs who was assigned ticket work on a
 * given day, with the gaps management needs to correct.
 */
const AttendanceReconcilePanel = ({ date, onDateChange, attendance, staff }: Props) => {
  const { data: active = [] } = useServices();
  const { data: completed = [] } = useCompletedServices();

  const entries = useMemo(
    () => reconcileAttendance(date, attendance, staff, [...(active as any[]), ...(completed as any[])]),
    [date, attendance, staff, active, completed],
  );

  const problems = entries.filter((e) => e.issues.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>Attendance vs ticket assignments</span>
          <div className="flex items-end gap-2">
            <div>
              <Label htmlFor="reconcileDate" className="text-xs">
                Date
              </Label>
              <Input
                id="reconcileDate"
                type="date"
                className="h-9 w-[160px]"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
              />
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
            problems.length
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-primary/20 bg-primary/5"
          }`}
        >
          {problems.length ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
          )}
          <span>
            {problems.length
              ? `${problems.length} of ${entries.length} people need attention for this date.`
              : entries.length
              ? "Attendance logs and ticket assignments match for this date."
              : "No attendance logs or ticket activity recorded for this date."}
          </span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Time In</TableHead>
                <TableHead>Time Out</TableHead>
                <TableHead>Tickets worked</TableHead>
                <TableHead>Findings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nothing to reconcile for this date.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((e) => (
                  <TableRow key={e.name}>
                    <TableCell className="font-medium">
                      {e.name}
                      {e.unknownStaff && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          No profile
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{fmt(e.timeIn)}</TableCell>
                    <TableCell>{fmt(e.timeOut)}</TableCell>
                    <TableCell className="max-w-[280px] text-xs">
                      {e.tickets.length ? e.tickets.join(", ") : "—"}
                    </TableCell>
                    <TableCell>
                      {e.issues.length === 0 ? (
                        <Badge variant="secondary" className="text-xs">
                          OK
                        </Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {e.issues.map((i) => (
                            <Badge key={i} variant="destructive" className="text-[11px] font-normal">
                              {i}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceReconcilePanel;
