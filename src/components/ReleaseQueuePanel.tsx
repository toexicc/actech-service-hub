import { useMemo, useState } from "react";
import { useQueueEntries } from "@/hooks/useQueueEntries";
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
import { Search } from "lucide-react";

const PAGE_SIZE = 10;

const statusMeta: Record<string, { label: string; className: string }> = {
  waiting: { label: "Waiting", className: "border-blue-400 text-blue-700" },
  proceed: { label: "Proceed", className: "border-emerald-400 text-emerald-700" },
  completed: { label: "Released", className: "border-slate-400 text-slate-600" },
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
  if (from && d < new Date(`${from}T00:00:00`)) return false;
  if (to && d > new Date(`${to}T23:59:59.999`)) return false;
  return true;
};

/**
 * Release tracker — read-only table of every public /release request, including
 * entries that have already been handed over to the client.
 */
export const ReleaseQueuePanel = () => {
  const { entries, loading } = useQueueEntries({ activeOnly: false, kind: "release" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter((e) => (status === "all" ? true : e.status === status))
      .filter((e) => inDateRange(e.created_at, dateFrom, dateTo))
      .filter((e) =>
        !q
          ? true
          : [e.display_code, e.client_name, e.contact_number, e.service_id]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q)),
      )
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [entries, search, status, dateFrom, dateTo]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/40 p-4">
        <div className="text-sm font-semibold text-emerald-700">Release Tracker</div>
        <p className="text-xs text-muted-foreground">
          Every pickup request from the customer-facing /release page, including
          completed hand-overs. Process entries from the Release Queue tab.
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
            <SelectItem value="completed">Released</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
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
              <TableHead>Requested</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Service ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last update</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Loading release records…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No release requests match these filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((e) => {
                const meta = statusMeta[e.status] ?? statusMeta.waiting;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-semibold text-emerald-600">
                      {e.display_code}
                    </TableCell>
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
                    <TableCell className="text-xs">{e.service_id || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={meta.className}>
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDate(e.updated_at)}
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
    </div>
  );
};
