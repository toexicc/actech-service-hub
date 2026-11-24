import { useEffect, useMemo, useState } from "react";
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
  setDefectStatus,
  setPartRequestStatus,
  useRefreshAfterRequest,
  usePartRequestsAll,
  type PartRequestRow,
} from "@/hooks/usePartRequests";
import {
  DEFECT_STATUSES,
  isApprovedRequest,
  isDefectSettled,
  isOpenRequest,
  isPartsLocked,
  MANUAL_REQUEST_STATUSES,
} from "@/lib/partRequests";
import { formatManilaDate } from "@/lib/timezone";
import {
  AfterLockBadge,
  ApproveRequestDialog,
  CancelRequestDialog,
  RequestStatusBadge,
  ReturnBadge,
} from "@/components/parts/RequestBits";
import { cn } from "@/lib/utils";

export { usePartRequestsAll } from "@/hooks/usePartRequests";
export type { PartRequestRow } from "@/hooks/usePartRequests";

type View = "new" | "open" | "returns" | "defective" | "all";

const isReturn = (r: PartRequestRow) => r.kind === "return";
/** An approved return of a defective part: it sits on the Defective list until it's settled with the supplier. */
const isDefectiveItem = (r: PartRequestRow) => isReturn(r) && r.return_reason === "defective" && isApprovedRequest(r.status);

/**
 * Inventory → Requests: parts requested from tickets, and parts asked to be taken off them (returns).
 * Inventory staff and management approve: a request takes the stock and puts the part on the ticket; a return
 * takes the part off the ticket and puts it back into stock, or onto the Defective list if it's defective.
 * On a ticket whose parts are locked (repair done), nobody approves their own request or return.
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
  const returnsWaiting = rows.filter((r) => isReturn(r) && isOpenRequest(r.status)).length;
  const defectiveOpen = rows.filter((r) => isDefectiveItem(r) && !isDefectSettled(r.defect_status)).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (view === "new" && !isNew(r)) return false;
      if (view === "open" && !isOpenRequest(r.status)) return false;
      if (view === "returns" && !isReturn(r)) return false;
      if (view === "defective" && !isDefectiveItem(r)) return false;
      if (!q) return true;
      const t = r.service_id ? tickets[r.service_id] : undefined;
      return [
        r.request_id,
        r.part_id,
        r.part_name,
        r.service_id,
        r.requested_by_name,
        r.approved_by_name,
        r.device_model,
        r.notes,
        r.defect_status,
        r.defect_note,
        t?.client_name,
        ticketDevice(t),
      ].some((v) => (v ?? "").toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, view, search, tickets]);

  const by = { byName: profile?.name || sessionStorage.getItem("userFullName") || "Inventory", byId: user?.id ?? null };

  const run = async (fn: () => Promise<void>, done: string) => {
    try {
      await fn();
      toast({ title: done });
      refresh();
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  };

  const openTicket = (id: string) => navigate(`/manage-client?serviceId=${encodeURIComponent(id)}`);

  const emptyText: Record<View, string> = {
    new: "Nothing new.",
    open: "Nothing waiting.",
    returns: "No returns yet.",
    defective: "No defective parts.",
    all: "No requests yet.",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-lg">
            Part requests {newCount > 0 && <Badge className="ml-2">{newCount} new</Badge>}
          </CardTitle>
          {!compact && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              From tickets. Approving a request takes the stock and adds the part; approving a return takes the part off the ticket.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["new", `New${newCount ? ` (${newCount})` : ""}`],
              ["open", `Waiting${openCount ? ` (${openCount})` : ""}`],
              ["returns", `Returns${returnsWaiting ? ` (${returnsWaiting})` : ""}`],
              ["defective", `Defective${defectiveOpen ? ` (${defectiveOpen})` : ""}`],
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
        {view === "defective" && !compact && (
          <p className="text-xs text-muted-foreground">
            Defective parts taken off tickets. They didn't go back into stock. Update where each one is with the supplier.
          </p>
        )}
        {!hasInventoryAccess && !compact && (
          <p className="text-xs text-muted-foreground">Only inventory staff and management can approve or decline requests and returns.</p>
        )}
        {isLoading && <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">{emptyText[view]}</p>
        )}
        <div className="space-y-2">
          {filtered.slice(0, compact ? 6 : 300).map((r) => {
            const open = isOpenRequest(r.status);
            const ret = isReturn(r);
            const part = r.part_id ? stock.get(r.part_id.toLowerCase()) : undefined;
            const enough = !!part && part.quantity >= r.quantity;
            const t = r.service_id ? tickets[r.service_id] : undefined;
            // Parts locked now (repair done): the person who asked can't approve it (the database enforces this too).
            const lockedNow = t ? isPartsLocked(t.status) : r.after_lock;
            const ownLocked = lockedNow && !!user?.id && r.requested_by === user.id;
            return (
              <div key={r.id} className={cn("rounded-lg border p-3", !open && "bg-muted/30")}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("font-medium", r.status === "Cancelled" && "text-muted-foreground line-through")}>
                        {r.quantity}× {r.part_name || r.part_id || "Part"}
                      </span>
                      <RequestStatusBadge status={isApprovedRequest(r.status) ? "Approved" : r.status} />
                      <ReturnBadge request={r} />
                      <AfterLockBadge request={r} />
                      {isNew(r) && <Badge>New</Badge>}
                      {open &&
                        !ret &&
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
                      {t?.status && <span className="text-muted-foreground"> · {t.status}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ret ? "Return asked by" : "Requested by"} {r.requested_by_name || "—"} · {formatManilaDate(r.created_at, "MMM d, yyyy h:mm a")}
                      {r.acknowledged_by_name && open && ` · seen by ${r.acknowledged_by_name}`}
                    </p>
                    {r.notes && <p className="text-xs">{r.notes}</p>}
                    {ret && open && (
                      <p className="text-xs text-muted-foreground">
                        {r.return_reason === "defective"
                          ? "When approved: comes off the ticket and its cost; stock doesn't change (set aside for the supplier)."
                          : "When approved: comes off the ticket and its cost, and goes back into stock."}
                      </p>
                    )}
                    {isApprovedRequest(r.status) && (
                      <p className="text-xs text-muted-foreground">
                        Approved{r.approved_by_name ? ` by ${r.approved_by_name}` : ""}
                        {r.approved_at ? ` · ${formatManilaDate(r.approved_at, "MMM d, h:mm a")}` : ""}
                      </p>
                    )}
                    {isDefectiveItem(r) && view !== "defective" && (
                      <p className="text-xs">
                        Defective part: <span className="font-medium">{r.defect_status || "Waiting to send"}</span>
                      </p>
                    )}
                    {r.status === "Cancelled" && r.cancelled_reason && <p className="text-xs text-muted-foreground">Reason: {r.cancelled_reason}</p>}
                  </div>

                  {open && hasInventoryAccess && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2 md:max-w-[22rem] md:justify-end">
                      {!r.acknowledged_at && (
                        <Button size="sm" variant="outline" onClick={() => run(() => acknowledgePartRequest(r, by), "Marked as seen")}>
                          Mark as seen
                        </Button>
                      )}
                      {!ret && (
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
                      )}
                      <Button size="sm" variant="outline" onClick={() => setDeclining(r)}>
                        Decline
                      </Button>
                      {ownLocked ? (
                        <span className="text-xs text-muted-foreground">You asked for this and the parts are locked, so someone else approves it.</span>
                      ) : (
                        <Button size="sm" onClick={() => setApproving(r)}>
                          {ret ? "Approve return" : "Approve & add"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {view === "defective" && <DefectiveControls row={r} canEdit={hasInventoryAccess} onSaved={refresh} />}
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

/** Defective list: where the part is with the supplier, plus a note (courier, RMA number…). Logged on the ticket. */
function DefectiveControls({ row, canEdit, onSaved }: { row: PartRequestRow; canEdit: boolean; onSaved: () => void }) {
  const { toast } = useToast();
  const [status, setStatus] = useState(row.defect_status || "Waiting to send");
  const [note, setNote] = useState(row.defect_note || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus(row.defect_status || "Waiting to send");
    setNote(row.defect_note || "");
  }, [row.defect_status, row.defect_note]);

  const changed = status !== (row.defect_status || "Waiting to send") || note.trim() !== (row.defect_note || "").trim();
  const save = async () => {
    setBusy(true);
    try {
      await setDefectStatus(row.id, status, note);
      toast({ title: `Defective part: ${status}` });
      onSaved();
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <p className="text-xs text-muted-foreground">
        Defective part: <span className={cn("font-medium", isDefectSettled(row.defect_status) ? "text-success" : "text-foreground")}>{row.defect_status || "Waiting to send"}</span>
        {row.defect_updated_by_name ? ` · updated by ${row.defect_updated_by_name}` : ""}
        {row.defect_updated_at ? ` · ${formatManilaDate(row.defect_updated_at, "MMM d, h:mm a")}` : ""}
      </p>
      {canEdit && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 sm:w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEFECT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input className="h-9 flex-1" placeholder="Note, e.g. courier or supplier reference" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" onClick={save} disabled={busy || !changed}>
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
