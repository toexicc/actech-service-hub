import { useMemo, useState } from "react";
import { useQueueEntries, requeueEntry, type QueueEntry } from "@/hooks/useQueueEntries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, RotateCcw, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { logTicketActivity } from "@/lib/activityLogger";


const PAGE_SIZE = 10;

const DEVICE_TYPES = [
  "Laptop/Macbook",
  "IPad/Tablet",
  "IPhone/Mobile",
  "Apple Watch",
  "Computer/IMac",
];

const statusMeta: Record<string, { label: string; className: string }> = {
  waiting: { label: "Waiting", className: "border-blue-400 text-blue-700" },
  proceed: { label: "Proceed", className: "border-emerald-400 text-emerald-700" },
  completed: { label: "Completed", className: "border-slate-400 text-slate-600" },
  cancelled: { label: "Cancelled", className: "border-destructive/50 text-destructive" },
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const inDateRange = (iso: string, from: string, to: string) => {
  const d = new Date(iso);
  if (from) {
    const start = new Date(`${from}T00:00:00`);
    if (d < start) return false;
  }
  if (to) {
    const end = new Date(`${to}T23:59:59.999`);
    if (d > end) return false;
  }
  return true;
};


/**
 * Intake tracker — table of every public /intake submission with search,
 * status, device type, and date range filters. Cancelled submissions can be
 * put back on the queue when the client returns.
 */
export const IntakeQueuePanel = () => {
  const { entries, loading, refetch } = useQueueEntries({ activeOnly: false, kind: "intake" });
  const { isAdminOrManagement } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [deviceType, setDeviceType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [resending, setResending] = useState<string | null>(null);

  const handleResend = async (entry: QueueEntry) => {
    setResending(entry.id);
    try {
      const { data, error } = await requeueEntry(entry);
      if (error) throw new Error(error.message);
      const code = (data as any)?.display_code ?? "";
      toast({
        title: "Back on the queue",
        description: `${entry.client_name} is now ${code || "waiting"}.`,
      });
      logTicketActivity(
        "SYSTEM",
        `Resent cancelled intake ${entry.display_code} to the queue as ${code}`,
        { Client: entry.client_name, From: entry.display_code, To: code },
      );
      refetch();
    } catch (e: any) {
      toast({
        title: "Could not resend to queue",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setResending(null);
    }
  };


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter((e) => (status === "all" ? true : e.status === status))
      .filter((e) => (deviceType === "all" ? true : e.device_type === deviceType))
      .filter((e) => inDateRange(e.created_at, dateFrom, dateTo))
      .filter((e) =>
        !q
          ? true
          : [e.display_code, e.client_name, e.contact_number, e.service_id]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q)),
      )
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [entries, search, status, deviceType, dateFrom, dateTo]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-200/60 bg-blue-50/40 p-4">
        <div className="text-sm font-semibold text-blue-700">Intake Tracker</div>
        <p className="text-xs text-muted-foreground">
          Every submission from the customer-facing /intake page. Process entries
          from the Queue tab.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search queue #, name, phone, service ID"
            className="pl-8 w-72"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="proceed">Proceed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={deviceType}
          onValueChange={(v) => {
            setDeviceType(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Device type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All device types</SelectItem>
            {DEVICE_TYPES.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Input
            type="date"
            className="w-[150px]"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            className="w-[150px]"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
          {(dateFrom || dateTo) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}
            >
              Clear
            </Button>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} record(s)</span>
      </div>

      <div className="rounded-2xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Queue #</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Complaint</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Service ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Loading intake records…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No intake submissions match these filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((e) => {
                const meta = statusMeta[e.status] ?? statusMeta.waiting;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-semibold text-blue-600">{e.display_code}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDate(e.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{e.client_name}</div>
                      <div className="text-xs text-muted-foreground">{e.contact_number || "—"}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {[e.device_type, e.brand, e.model].filter(Boolean).join(" • ") || "—"}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-foreground/70">
                      {e.chief_complaint || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={meta.className}>
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{e.service_id || "—"}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            size="sm"
            variant="outline"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {current} of {pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={current === pageCount}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

