import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useInventory, type InventoryItem } from "@/hooks/useInventory";
import { ticketDevice, useTicketSummaries } from "@/hooks/useTicketSummaries";
import {
  acknowledgePartRequest,
  setPartRequestStatus,
  useRefreshAfterRequest,
  usePartRequestsAll,
  type PartRequestRow,
} from "@/hooks/usePartRequests";
import { isApprovedRequest, isOpenRequest, MANUAL_REQUEST_STATUSES } from "@/lib/partRequests";
import { formatManilaDate } from "@/lib/timezone";
import { ApproveRequestDialog, CancelRequestDialog, RequestStatusBadge } from "@/components/parts/RequestBits";
import { cn } from "@/lib/utils";

export { usePartRequestsAll } from "@/hooks/usePartRequests";
export type { PartRequestRow } from "@/hooks/usePartRequests";

type View = "new" | "open" | "all";

/**
 * Inventory → Requests: parts requested from tickets. Inventory staff and management approve a request
 * (stock goes down and the part goes onto the ticket), decline it, or track ordering for parts not in stock.
 */
// `stockByPart` is no longer needed (stock comes from the inventory list) but is accepted for older callers.
export function PartRequestsInbox({ compact = false }: { stockByPart?: Map<string, number>; compact?: boolean }) {
  const { data: rows = [], isLoading } = usePartRequestsAll();
  const { data: inventory = [] } = useInventory();
  const { profile, user, hasInventoryAccess } = useAuth();
  const refresh = useRefreshAfterRequest();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("open");
  const [search, setSearch] = useState("");
  const [approving, setApproving] = useState<PartRequestRow | null>(null);
  const [declining, setDeclining] = useState<PartRequestRow | null>(null);

  const stock = useMemo(() => {
    const m = new Map<string, InventoryItem>();
    inventory.forEach((i) => m.set(i.partId.toLowerCase(), i));
    return m;
  }, [inventory]);
  const ticketIds = useMemo(() => {
    const ids = new Set<string>();
    rows.forEach((r) => {
      if (r.service_id) ids.add(r.service_id);
    });
    return [...ids].sort();
  }, [rows]);
  const { data: tickets = {} } = useTicketSummaries(ticketIds);

  const isNew = (r: PartRequestRow) => !r.acknowledged_at && isOpenRequest(r.status);
  const newCount = rows.filter(isNew).length;
  const openCount = rows.filter((r) => isOpenRequest(r.status)).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (view === "new" && !isNew(r)) return false;
      if (view === "open" && !isOpenRequest(r.status)) return false;
      if (!q) return true;
      const t = r.service_id ? tickets[r.service_id] : undefined;
      return [r.request_id, r.part_id, r.part_name, r.service_id, r.requested_by_name, r.device_model, r.notes, t?.client_name, ticketDevice(t)]
        .some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [rows, view, search, tickets]);

  const by = { byName: profile?.name || sessionStorage.getItem("userFullName") || "Inventory", byId: user?.id ?? null };

  const run = async (fn: () => Promise<void>, done: string) => {
    try {
      await fn();
      toast({ title: done });
      refresh();
    } catch (e) {
      toast({ title: "Could not update the request", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  };

  const openTicket = (id: string) => navigate(`/manage-client?serviceId=${encodeURIComponent(id)}`);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-lg">
            Part requests {newCount > 0 && <Badge className="ml-2">{newCount} new</Badge>}
          </CardTitle>
          {!compact && (
            <p className="mt-0.5 text-sm text-muted-foreground">Requested from tickets. Approving takes the stock and adds the part to the ticket.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["new", `New${newCount ? ` (${newCount})` : ""}`],
              ["open", `Open${openCount ? ` (${openCount})` : ""}`],
              ["all", "All"],
            ] as const
          ).map(([v, text]) => (
            <Button key={v} size="sm" variant={view === v ? "default" : "outline"} onClick={() => setView(v)}>
              {text}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!compact && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search part, ticket, client, technician, request number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
        {!hasInventoryAccess && !compact && (
          <p className="text-xs text-muted-foreground">Only inventory staff and management can approve or decline requests.</p>
        )}
        {isLoading && <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            {view === "new" ? "No new requests." : view === "open" ? "No open requests." : "No requests yet."}
          </p>
        )}
        <div className="space-y-2">
          {filtered.slice(0, compact ? 6 : 300).map((r) => {
            const open = isOpenRequest(r.status);
            const part = r.part_id ? stock.get(r.part_id.toLowerCase()) : undefined;
            const enough = !!part && part.quantity >= r.quantity;
            const t = r.service_id ? tickets[r.service_id] : undefined;
            return (
              <div key={r.id} className={cn("rounded-lg border p-3", !open && "bg-muted/30")}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("font-medium", r.status === "Cancelled" && "text-muted-foreground line-through")}>
                        {r.quantity}× {r.part_name || r.part_id || "Part"}
                      </span>
                      <RequestStatusBadge status={isApprovedRequest(r.status) ? "Approved" : r.status} />
                      {isNew(r) && <Badge>New</Badge>}
                      {open &&
                        (part ? (
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-xs font-medium",
                              enough ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive",
                            )}
                          >
                            On hand: {part.quantity}
                          </span>
                        ) : (
                          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Typed in by name</span>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.part_id && <span className="font-mono">{r.part_id} · </span>}
                      {r.request_id}
                    </p>
                    <p className="text-sm">
                      {r.service_id ? (
                        <button type="button" className="font-mono font-semibold text-primary hover:underline" onClick={() => openTicket(r.service_id!)}>
                          {r.service_id}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">No ticket</span>
                      )}
                      {t?.client_name && <span> · {t.client_name}</span>}
                      {ticketDevice(t) && <span className="text-muted-foreground"> · {ticketDevice(t)}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Requested by {r.requested_by_name || "—"} · {formatManilaDate(r.created_at, "MMM d, yyyy h:mm a")}
                      {r.acknowledged_by_name && open && ` · seen by ${r.acknowledged_by_name}`}
                    </p>
                    {r.notes && <p className="text-xs">{r.notes}</p>}
                    {isApprovedRequest(r.status) && (
                      <p className="text-xs text-muted-foreground">
                        Approved{r.approved_by_name ? ` by ${r.approved_by_name}` : ""}
                        {r.approved_at ? ` · ${formatManilaDate(r.approved_at, "MMM d, h:mm a")}` : ""}
                      </p>
                    )}
                    {r.status === "Cancelled" && r.cancelled_reason && <p className="text-xs text-muted-foreground">Reason: {r.cancelled_reason}</p>}
                  </div>

                  {open && hasInventoryAccess && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
                      {!r.acknowledged_at && (
                        <Button size="sm" variant="outline" onClick={() => run(() => acknowledgePartRequest(r, by), "Marked as seen")}>
                          Mark as seen
                        </Button>
                      )}
                      <Select value={r.status} onValueChange={(v) => run(() => setPartRequestStatus(r, v, by), `Set to ${v}`)}>
                        <SelectTrigger className="h-9 w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[...new Set([r.status, ...MANUAL_REQUEST_STATUSES])].map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" onClick={() => setDeclining(r)}>
                        Decline
                      </Button>
                      <Button size="sm" onClick={() => setApproving(r)}>
                        Approve & add
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      <ApproveRequestDialog request={approving} onOpenChange={(o) => !o && setApproving(null)} />
      <CancelRequestDialog request={declining} mode="decline" onOpenChange={(o) => !o && setDeclining(null)} />
    </Card>
  );
}
