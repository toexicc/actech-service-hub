import { useMemo, useState } from "react";
import { useQueueEntries, moveQueueEntry, type QueueEntry } from "@/hooks/useQueueEntries";
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
import { useToast } from "@/hooks/use-toast";
import { CompleteIntakeModal } from "@/components/CompleteIntakeModal";
import { CheckCircle2, XCircle, ArrowRight, ArrowLeft, Search } from "lucide-react";

const PAGE_SIZE = 10;

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

const inRange = (iso: string, range: string) => {
  if (range === "all") return true;
  const d = new Date(iso);
  const now = new Date();
  const start = new Date(now);
  if (range === "today") start.setHours(0, 0, 0, 0);
  else if (range === "7d") start.setDate(now.getDate() - 7);
  else if (range === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return d >= start;
};

/**
 * Intake tracker — table view of every public /intake submission (pending and
 * completed) with date/status filters, search, and inline actions.
 */
export const IntakeQueuePanel = () => {
  const { entries, loading } = useQueueEntries({ activeOnly: false });
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState("all");
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<QueueEntry | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter((e) => (status === "all" ? true : e.status === status))
      .filter((e) => inRange(e.created_at, range))
      .filter((e) =>
        !q
          ? true
          : [e.display_code, e.client_name, e.contact_number, e.service_id]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q)),
      )
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [entries, search, status, range]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const move = async (id: string, next: "waiting" | "proceed" | "cancelled") => {
    const { error } = await moveQueueEntry(id, next);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-200/60 bg-blue-50/40 p-4">
        <div className="text-sm font-semibold text-blue-700">Intake Tracker</div>
        <p className="text-xs text-muted-foreground">
          Every submission from the customer-facing /intake page. Click "Complete
          Intake" to finish it into a full service without leaving this page.
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
          value={range}
          onValueChange={(v) => {
            setRange(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All dates</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="month">This month</SelectItem>
          </SelectContent>
        </Select>
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Loading intake records…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No intake submissions match these filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((e) => {
                const meta = statusMeta[e.status] ?? statusMeta.waiting;
                const open = e.status === "waiting" || e.status === "proceed";
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
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {open && (
                          <>
                            <Button size="sm" onClick={() => setActive(e)}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Complete
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                move(e.id, e.status === "waiting" ? "proceed" : "waiting")
                              }
                            >
                              {e.status === "waiting" ? (
                                <ArrowRight className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowLeft className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => move(e.id, "cancelled")}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
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

      <CompleteIntakeModal
        queueId={active?.id ?? null}
        displayCode={active?.display_code}
        onOpenChange={(open) => !open && setActive(null)}
        onCompleted={() =>
          toast({ title: "Intake completed", description: "Service created from the queue entry." })
        }
      />
    </div>
  );
};
