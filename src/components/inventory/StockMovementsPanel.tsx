import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Download, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { formatManilaDate } from "@/lib/timezone";
import { FROM_SHEET, manilaDayBounds, movementInView, movementLabel, type MovementView } from "@/lib/stockMovements";

export { TYPE_LABEL, movementLabel } from "@/lib/stockMovements";

export interface StockMovement {
  id: string;
  part_id: string | null;
  part_name: string | null;
  part_source: string;
  movement_type: string;
  quantity_before: number;
  quantity_after: number;
  delta: number;
  service_id: string | null;
  actor_name: string | null;
  notes: string | null;
  status: string;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  created_at: string;
}

/** Newest movements loaded when no dates are picked. */
export const LATEST_LIMIT = 1000;
const RANGE_LIMIT = 10000;

/**
 * Stock movements, newest first. With no dates: the latest 1,000. With a date range: every movement
 * in it (up to 10,000), read in pages past the 1,000-row API cap.
 */
export const useStockMovements = (range?: { from?: string; to?: string }) =>
  useQuery({
    queryKey: ["stock-movements", range?.from ?? "", range?.to ?? ""],
    queryFn: async (): Promise<StockMovement[]> => {
      const bounds = manilaDayBounds(range?.from, range?.to);
      const max = bounds.from || bounds.to ? RANGE_LIMIT : LATEST_LIMIT;
      const out: StockMovement[] = [];
      for (let offset = 0; offset < max; offset += 1000) {
        let q = supabase.from("stock_movements").select("*");
        if (bounds.from) q = q.gte("created_at", bounds.from);
        if (bounds.to) q = q.lte("created_at", bounds.to);
        const { data, error } = await q.order("created_at", { ascending: false }).range(offset, Math.min(offset + 999, max - 1));
        if (error) throw error;
        out.push(...((data ?? []) as StockMovement[]));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

interface TicketInfo {
  service_id: string;
  client_name: string | null;
  brand: string | null;
  model: string | null;
  device_type: string | null;
  technicians: string[] | null;
  status: string | null;
}

/** Client, device and technician for the tickets the movements point at. */
const useTicketInfo = (ids: string[]) =>
  useQuery({
    queryKey: ["movement-tickets", ids],
    enabled: ids.length > 0,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Record<string, TicketInfo>> => {
      const out: Record<string, TicketInfo> = {};
      for (let i = 0; i < ids.length; i += 150) {
        const { data, error } = await (supabase as any)
          .from("services")
          .select("service_id, client_name, brand, model, device_type, technicians, status")
          .in("service_id", ids.slice(i, i + 150));
        if (error) throw error;
        (data ?? []).forEach((t: TicketInfo) => (out[t.service_id] = t));
      }
      return out;
    },
  });

const PAGE_SIZE = 50;

const deviceOf = (t?: TicketInfo) => (t ? [t.brand, t.model].filter(Boolean).join(" ") || t.device_type || "" : "");

const statusTone = (s: string) =>
  s === "pending"
    ? "bg-warning/10 text-warning border-warning/30"
    : s === "rejected"
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : "bg-success/10 text-success border-success/30";

/**
 * Stock movements: every change to stock, and where parts went. Stock-outs tied to a ticket show the
 * ticket, client, device and technician. Inventory staff and management approve changes made by others.
 */
export function StockMovementsPanel({ canReview, partFilter }: { canReview: boolean; partFilter?: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data: rows = [], isLoading, isFetching } = useStockMovements({ from, to });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isAdminOrManagement, isTechnician } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState<MovementView>("all");
  const [search, setSearch] = useState(partFilter ?? "");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectIds, setRejectIds] = useState<string[] | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const ticketIds = useMemo(() => {
    const ids = new Set<string>();
    rows.forEach((r) => {
      if (r.service_id) ids.add(r.service_id);
    });
    return [...ids].sort();
  }, [rows]);
  const { data: tickets = {} } = useTicketInfo(ticketIds);

  // Technicians work tickets in Service Update; everyone else opens them in Manage Client.
  const openTicket = (id: string) =>
    navigate(
      isTechnician && !isAdminOrManagement
        ? `/service-update?serviceId=${encodeURIComponent(id)}`
        : `/manage-client?serviceId=${encodeURIComponent(id)}`,
    );

  // The date range is applied by the query; search applies to every view and to the summary numbers.
  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const t = r.service_id ? tickets[r.service_id] : undefined;
      return [r.part_id, r.part_name, r.actor_name, r.service_id, r.notes, t?.client_name, deviceOf(t), ...(t?.technicians ?? [])]
        .some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [rows, search, tickets]);
  const capped = !from && !to && rows.length >= LATEST_LIMIT;

  const filtered = useMemo(() => scoped.filter((r) => movementInView(r, view)), [scoped, view]);

  const summary = useMemo(() => {
    // A rejected change was undone (without a new movement), so it doesn't count toward the totals.
    const live = scoped.filter((r) => r.status !== "rejected");
    const units = (list: StockMovement[]) => list.reduce((s, r) => s + Math.abs(r.delta), 0);
    // Parts that ended up on each ticket: taken minus put back.
    const perTicket = new Map<string, number>();
    live.forEach((r) => {
      if (r.service_id && (r.movement_type === "stock_out" || r.movement_type === "stock_in")) {
        perTicket.set(r.service_id, (perTicket.get(r.service_id) ?? 0) - r.delta);
      }
    });
    const onTickets = [...perTicket.values()].filter((n) => n > 0);
    return {
      all: scoped.length,
      usedUnits: onTickets.reduce((s, n) => s + n, 0),
      usedTickets: onTickets.length,
      inUnits: units(live.filter((r) => movementInView(r, "in"))),
      outUnits: units(live.filter((r) => movementInView(r, "out"))),
      pending: scoped.filter((r) => r.status === "pending").length,
    };
  }, [scoped]);

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  useEffect(() => setPage(1), [view, search, from, to]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const review = async (ids: string[], approve: boolean, why?: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("review_stock_movement", { _ids: ids, _approve: approve, _reason: why });
    setBusy(false);
    if (error) {
      toast({ title: "Could not save review", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: approve ? `Approved ${ids.length}` : `Rejected ${ids.length}`, description: approve ? undefined : "Stock was put back where possible." });
    setSelected(new Set());
    setRejectIds(null);
    setReason("");
    qc.invalidateQueries({ queryKey: ["stock-movements"] });
    qc.invalidateQueries({ queryKey: ["inventory"] });
    qc.invalidateQueries({ queryKey: ["fastMovingParts"] });
  };

  const exportCsv = () => {
    const head = ["Date", "Part ID", "Part", "Movement", "Before", "After", "Change", "Ticket", "Client", "Device", "Technician", "By", "Status", "Reviewed by", "Reason", "Notes"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((r) => {
      const t = r.service_id ? tickets[r.service_id] : undefined;
      return [formatManilaDate(r.created_at, r.actor_name === FROM_SHEET ? "MM/dd/yyyy" : "MM/dd/yyyy HH:mm"), r.part_id, r.part_name, movementLabel(r),
        r.quantity_before, r.quantity_after, r.delta, r.service_id, t?.client_name, deviceOf(t), (t?.technicians ?? []).join("; "),
        r.actor_name, r.status, r.reviewed_by_name, r.review_reason, r.notes].map(esc).join(",");
    });
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `stock-movements-${format(new Date(), "MM-dd-yyyy")}.csv`;
    a.click();
  };

  const pendingVisible = pageRows.filter((r) => r.status === "pending");
  const allChecked = pendingVisible.length > 0 && pendingVisible.every((r) => selected.has(r.id));
  const showReviewCols = canReview && pendingVisible.length > 0;
  const toggleOne = (id: string, on: boolean) => {
    const n = new Set(selected);
    if (on) n.add(id);
    else n.delete(id);
    setSelected(n);
  };

  const cards: { key: MovementView; label: string; value: string; hint?: string }[] = [
    { key: "all", label: "All movements", value: String(summary.all) },
    { key: "tickets", label: "Used on tickets", value: String(summary.usedUnits), hint: `${summary.usedTickets} ticket${summary.usedTickets === 1 ? "" : "s"}` },
    { key: "in", label: "Stock in", value: String(summary.inUnits), hint: "units received" },
    { key: "out", label: "Stock out", value: String(summary.outUnits), hint: "not on a ticket" },
    { key: "pending", label: "Pending", value: String(summary.pending), hint: "to approve" },
  ];

  const changeCell = (r: StockMovement) => (
    <div className="text-right">
      <p className={cn("text-base font-semibold tabular-nums leading-tight", r.delta > 0 ? "text-success" : r.delta < 0 ? "text-destructive" : "")}>
        {r.delta > 0 ? "+" : ""}
        {r.delta}
      </p>
      <p className="whitespace-nowrap text-[11px] text-muted-foreground">
        {r.quantity_before} → {r.quantity_after}
      </p>
    </div>
  );

  const whereCell = (r: StockMovement) => {
    const t = r.service_id ? tickets[r.service_id] : undefined;
    return (
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{movementLabel(r)}</p>
        {r.service_id ? (
          <div className="mt-0.5">
            <button
              type="button"
              onClick={() => openTicket(r.service_id!)}
              className="font-mono text-sm font-semibold text-primary hover:underline"
              title="Open ticket"
            >
              {r.service_id}
            </button>
            {t?.client_name && <span className="text-sm"> · {t.client_name}</span>}
            {(deviceOf(t) || !!t?.technicians?.length) && (
              <p className="truncate text-xs text-muted-foreground">
                {[deviceOf(t), t?.technicians?.length ? `Tech: ${t.technicians.join(", ")}` : ""].filter(Boolean).join(" · ")}
              </p>
            )}
            {r.notes && <p className="line-clamp-1 text-[11px] text-muted-foreground/80" title={r.notes}>{r.notes}</p>}
          </div>
        ) : (
          r.notes && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground" title={r.notes}>{r.notes}</p>
        )}
        {r.status === "rejected" && r.review_reason && (
          <p className="mt-0.5 text-xs text-destructive">Rejected: {r.review_reason}</p>
        )}
      </div>
    );
  };

  // Sheet history only had dates, so its times are placeholders that keep the order; show the date alone.
  const whenCell = (r: StockMovement) => (
    <div className="whitespace-nowrap">
      <p className="text-sm">{formatManilaDate(r.created_at, "MMM d, yyyy")}</p>
      <p className="text-xs text-muted-foreground">{r.actor_name === FROM_SHEET ? "from sheet" : formatManilaDate(r.created_at, "h:mm a")}</p>
    </div>
  );

  const reviewer = (r: StockMovement) => {
    if (!r.reviewed_by_name || r.status === "pending" || r.reviewed_by_name === "Sheet import") return null;
    return r.reviewed_by_name.startsWith("Auto") ? "auto-approved" : `by ${r.reviewed_by_name}`;
  };

  const statusCell = (r: StockMovement) => (
    <div>
      <span className={cn("inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium capitalize", statusTone(r.status))}>
        {r.status}
      </span>
      {reviewer(r) && <p className="mt-1 whitespace-nowrap text-[11px] text-muted-foreground">{reviewer(r)}</p>}
    </div>
  );

  const reviewButtons = (r: StockMovement) =>
    canReview && r.status === "pending" ? (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => review([r.id], true)} aria-label="Approve">
          <Check className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => setRejectIds([r.id])} aria-label="Reject">
          <X className="h-4 w-4" />
        </Button>
      </div>
    ) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-lg">Stock movements</CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">Every stock change, and which ticket each part went to.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canReview && selected.size > 0 && (
            <>
              <Button size="sm" disabled={busy} onClick={() => review([...selected], true)}>
                <Check className="mr-1 h-4 w-4" /> Approve {selected.size}
              </Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => setRejectIds([...selected])}>
                <X className="mr-1 h-4 w-4" /> Reject {selected.size}
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {canReview && pendingCount > 0 && view !== "pending" && (
          <button
            type="button"
            onClick={() => setView("pending")}
            className="flex w-full items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-left text-sm"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
            <span className="flex-1">
              {pendingCount} stock change{pendingCount === 1 ? " is" : "s are"} waiting for your approval.
            </span>
            <span className="font-medium text-primary">Review</span>
          </button>
        )}

        {/* Summary cards double as the view switcher */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setView(c.key)}
              className={cn(
                "rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/60",
                view === c.key && "border-primary bg-primary/5 ring-1 ring-primary/30",
              )}
            >
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-semibold tabular-nums">{c.value}</p>
              {c.hint && <p className="text-[11px] text-muted-foreground">{c.hint}</p>}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search part, SKU, ticket, client, technician, staff…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Input type="date" className="w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          <Input type="date" className="w-[150px]" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          {(search || from || to || view !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFrom(""); setTo(""); setView("all"); }}>
              Clear
            </Button>
          )}
        </div>
        {(capped || (isFetching && !isLoading && (from || to))) && (
          <p className="-mt-2 text-xs text-muted-foreground">
            {capped ? `Showing the latest ${LATEST_LIMIT.toLocaleString()} movements. Pick dates to look further back.` : "Updating…"}
          </p>
        )}

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">No movements match.</p>
        ) : (
          <>
            {/* Phones */}
            <div className="space-y-2 md:hidden">
              {pageRows.map((r) => (
                <div key={r.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button type="button" className="text-left font-medium leading-snug hover:underline" onClick={() => setSearch(r.part_id ?? "")}>
                        {r.part_name || r.part_id || "—"}
                      </button>
                      <p className="font-mono text-[11px] text-muted-foreground">{r.part_id}</p>
                    </div>
                    {changeCell(r)}
                  </div>
                  <div className="mt-2">{whereCell(r)}</div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{formatManilaDate(r.created_at, "MMM d, yyyy")} · {r.actor_name || "—"}</span>
                    <div className="flex items-center gap-2">
                      {canReview && r.status === "pending" && (
                        <Checkbox checked={selected.has(r.id)} onCheckedChange={(v) => toggleOne(r.id, !!v)} aria-label="Select movement" />
                      )}
                      {statusCell(r)}
                    </div>
                  </div>
                  {canReview && r.status === "pending" && <div className="mt-2">{reviewButtons(r)}</div>}
                </div>
              ))}
            </div>

            {/* Tablets and computers */}
            <div className="hidden overflow-x-auto rounded-lg border md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="[&_th]:h-10 [&_th]:px-3 [&_th]:font-medium">
                    {showReviewCols && (
                      <th className="w-8">
                        <Checkbox
                          checked={allChecked}
                          onCheckedChange={(v) => setSelected(v ? new Set(pendingVisible.map((r) => r.id)) : new Set())}
                          aria-label="Select all pending"
                        />
                      </th>
                    )}
                    <th>When</th>
                    <th>Part</th>
                    <th className="text-right">Change</th>
                    <th>Where it went</th>
                    <th>By</th>
                    <th>Status</th>
                    {showReviewCols && <th className="text-right">Review</th>}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.id} className="border-t align-top [&_td]:px-3 [&_td]:py-3">
                      {showReviewCols && (
                        <td>
                          {r.status === "pending" && (
                            <Checkbox checked={selected.has(r.id)} onCheckedChange={(v) => toggleOne(r.id, !!v)} aria-label="Select movement" />
                          )}
                        </td>
                      )}
                      <td>{whenCell(r)}</td>
                      <td>
                        <div className="max-w-[300px]">
                          <button type="button" className="text-left font-medium leading-snug hover:underline" title="Show this part's movements" onClick={() => setSearch(r.part_id ?? "")}>
                            {r.part_name || r.part_id || "—"}
                          </button>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {r.part_id}
                            {r.part_source === "fast_moving" ? " · Pre-ordered" : ""}
                          </p>
                        </div>
                      </td>
                      <td>{changeCell(r)}</td>
                      <td><div className="w-[260px] lg:w-[340px]">{whereCell(r)}</div></td>
                      <td className="whitespace-nowrap text-sm">{r.actor_name || "—"}</td>
                      <td>{statusCell(r)}</td>
                      {showReviewCols && <td>{reviewButtons(r)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm">Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={!!rejectIds} onOpenChange={(o) => !o && setRejectIds(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject {rejectIds?.length ?? 0} movement(s)</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Stock in/out changes are reversed. The person who made the change is notified with your reason.</p>
          <Textarea placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectIds(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busy || !reason.trim()} onClick={() => rejectIds && review(rejectIds, false, reason.trim())}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
