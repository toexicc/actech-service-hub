import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Download, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

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

export const TYPE_LABEL: Record<string, string> = {
  added: "New part",
  removed: "Part removed",
  stock_in: "Stock in",
  stock_out: "Stock out",
};

export const useStockMovements = () =>
  useQuery({
    queryKey: ["stock-movements"],
    queryFn: async (): Promise<StockMovement[]> => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as StockMovement[];
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

const statusVariant = (s: string) =>
  s === "pending" ? "default" : s === "rejected" ? "destructive" : "secondary";

export function StockMovementsPanel({ canReview, partFilter }: { canReview: boolean; partFilter?: string }) {
  const { data: rows = [], isLoading } = useStockMovements();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState(canReview ? "pending" : "all");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState(partFilter ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectIds, setRejectIds] = useState<string[] | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (type !== "all" && r.movement_type !== type) return false;
      const d = r.created_at.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (!q) return true;
      return [r.part_id, r.part_name, r.actor_name, r.service_id, r.notes].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [rows, status, type, search, from, to]);

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  const review = async (ids: string[], approve: boolean, why?: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("review_stock_movement", { _ids: ids, _approve: approve, _reason: why ?? null });
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
    const head = ["Date", "Part ID", "Part", "Type", "Before", "After", "Change", "Service", "By", "Status", "Reviewed by", "Reason"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((r) =>
      [format(new Date(r.created_at), "MM/dd/yyyy HH:mm"), r.part_id, r.part_name, TYPE_LABEL[r.movement_type] ?? r.movement_type,
        r.quantity_before, r.quantity_after, r.delta, r.service_id, r.actor_name, r.status, r.reviewed_by_name, r.review_reason].map(esc).join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `stock-movements-${format(new Date(), "MM-dd-yyyy")}.csv`;
    a.click();
  };

  const pendingVisible = filtered.filter((r) => r.status === "pending");
  const allChecked = pendingVisible.length > 0 && pendingVisible.every((r) => selected.has(r.id));
  // The select-all circle and action buttons only matter when something is waiting for review.
  const showReviewCols = canReview && pendingVisible.length > 0;
  const colCount = showReviewCols ? 9 : canReview ? 7 : 7;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-lg">
          Stock movements {pendingCount > 0 && <Badge className="ml-2">{pendingCount} pending</Badge>}
        </CardTitle>
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
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Input placeholder="Search part, staff, ticket…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                {showReviewCols && (
                  <th className="w-8 p-2">
                    <Checkbox
                      checked={allChecked}
                      onCheckedChange={(v) => setSelected(v ? new Set(pendingVisible.map((r) => r.id)) : new Set())}
                      aria-label="Select all pending"
                    />
                  </th>
                )}
                <th className="p-2">When</th>
                <th className="p-2">Part</th>
                <th className="p-2">Type</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2">Ticket</th>
                <th className="p-2">By</th>
                <th className="p-2">Status</th>
                {canReview && showReviewCols && <th className="p-2 text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No movements match.</td></tr>}
              {filtered.slice(0, 300).map((r) => (
                <tr key={r.id} className="border-t align-top">
                  {canReview && (
                    <td className="p-2">
                      {r.status === "pending" && (
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={(v) => {
                            const n = new Set(selected);
                            v ? n.add(r.id) : n.delete(r.id);
                            setSelected(n);
                          }}
                          aria-label="Select movement"
                        />
                      )}
                    </td>
                  )}
                  <td className="whitespace-nowrap p-2">{format(new Date(r.created_at), "MM/dd/yyyy h:mm a")}</td>
                  <td className="p-2">
                    <div className="font-medium">{r.part_name || "—"}</div>
                    <div className="font-mono text-xs text-muted-foreground">{r.part_id}{r.part_source === "fast_moving" ? " · Pre-ordered" : ""}</div>
                  </td>
                  <td className="p-2">{TYPE_LABEL[r.movement_type] ?? r.movement_type}</td>
                  <td className="whitespace-nowrap p-2 text-right font-mono">
                    {r.quantity_before} → {r.quantity_after}
                    <span className={r.delta >= 0 ? " text-primary" : " text-destructive"}> ({r.delta >= 0 ? "+" : ""}{r.delta})</span>
                  </td>
                  <td className="p-2 font-mono text-xs">{r.service_id || "—"}</td>
                  <td className="p-2">{r.actor_name || "—"}</td>
                  <td className="p-2">
                    <Badge variant={statusVariant(r.status)} className="capitalize">{r.status}</Badge>
                    {r.reviewed_by_name && r.status !== "pending" && (
                      <div className="mt-1 text-xs text-muted-foreground">{r.reviewed_by_name}{r.review_reason ? ` — ${r.review_reason}` : ""}</div>
                    )}
                  </td>
                  {canReview && (
                    <td className="whitespace-nowrap p-2 text-right">
                      {r.status === "pending" && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => review([r.id], true)} aria-label="Approve">
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejectIds([r.id])} aria-label="Reject">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 300 && <p className="text-xs text-muted-foreground">Showing the latest 300. Narrow the filters or export the CSV to see more.</p>}
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
