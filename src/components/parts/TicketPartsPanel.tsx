import { useEffect, useMemo, useState } from "react";
import { Loader2, Lock, Package, QrCode, Search, Send, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useInventory, type InventoryItem } from "@/hooks/useInventory";
import { createPartRequest, useRefreshAfterRequest, useTicketPartRequests, type PartRequestRow } from "@/hooks/usePartRequests";
import {
  initialRequestStatus,
  isApprovedRequest,
  isOpenRequest,
  isPartsLocked,
  matchesPartSearch,
  noPartAdditions,
  partsUsedText,
  returnableQty,
} from "@/lib/partRequests";
import { parsePartsUsed } from "@/lib/partsStock";
import { formatManilaDate } from "@/lib/timezone";
import { PARTS_REQUEST_GUIDE } from "@/lib/pageGuides";
import { PageGuide } from "@/components/PageGuide";
import { QRScanner } from "@/components/QRScanner";
import {
  AfterLockBadge,
  ApproveRequestDialog,
  CancelRequestDialog,
  RequestStatusBadge,
  ReturnBadge,
  ReturnPartDialog,
  StockPill,
} from "./RequestBits";
import { cn } from "@/lib/utils";

interface Props {
  serviceId: string;
  partsUsed?: string | string[] | null;
  /** The ticket's status: parts lock from Done Repair onward, and cancelled/RTO tickets get no new parts. */
  status?: string | null;
  /** The ticket's device, saved with requests typed in by name. */
  device?: string;
  /** Start with this part in the search (e.g. from Check Parts). */
  initialPartId?: string | null;
  /** The ticket's parts changed (a request was approved here), so the page should reload it. */
  onTicketChanged?: () => void;
  /** Big heading, for when the panel is a card of its own (Service Update). */
  large?: boolean;
  className?: string;
}

const MAX_RESULTS = 25;

const sortForPicking = (a: InventoryItem, b: InventoryItem) =>
  Number(b.quantity > 0) - Number(a.quantity > 0) || a.partName.localeCompare(b.partName);

/**
 * Parts on a ticket (Service Update and Manage Client). Nobody edits parts here directly: staff request parts
 * or ask to return them, and inventory staff or management approve. Once the repair is done the parts are
 * locked: changes still go through requests and returns, and nobody can approve their own.
 */
export function TicketPartsPanel({ serviceId, partsUsed, status, device, initialPartId, onTicketChanged, large = false, className }: Props) {
  const locked = isPartsLocked(status);
  const noAdds = noPartAdditions(status);
  const { toast } = useToast();
  const { user, profile, hasInventoryAccess } = useAuth();
  const { data: inventory = [] } = useInventory();
  const { data: requests = [], isLoading: requestsLoading } = useTicketPartRequests(serviceId);
  const refresh = useRefreshAfterRequest();

  const [search, setSearch] = useState("");
  const [scanning, setScanning] = useState(false);
  const [draftFor, setDraftFor] = useState<string | null>(null); // part id being requested, or "custom"
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [customName, setCustomName] = useState("");
  const [sending, setSending] = useState(false);
  const [approving, setApproving] = useState<PartRequestRow | null>(null);
  const [cancelling, setCancelling] = useState<{ row: PartRequestRow; mode: "decline" | "cancel" } | null>(null);
  const [returning, setReturning] = useState<{ id: string; name: string; max: number } | null>(null);

  useEffect(() => {
    setSearch(initialPartId ?? "");
    setDraftFor(null);
  }, [serviceId, initialPartId]);

  const byId = useMemo(() => {
    const m = new Map<string, InventoryItem>();
    inventory.forEach((i) => m.set(i.partId.toLowerCase(), i));
    return m;
  }, [inventory]);

  const onTicket = useMemo(
    () =>
      Object.entries(parsePartsUsed(partsUsedText(partsUsed))).map(([token, count]) => ({
        token,
        count,
        part: byId.get(token.toLowerCase()),
      })),
    [partsUsed, byId],
  );

  // Open requests to add a part (to avoid asking twice) and quantities already waiting to be returned.
  const openByPart = useMemo(() => {
    const m = new Map<string, PartRequestRow>();
    requests.filter((r) => r.kind !== "return" && isOpenRequest(r.status) && r.part_id).forEach((r) => m.set(r.part_id!, r));
    return m;
  }, [requests]);
  const pendingReturns = useMemo(() => {
    const m = new Map<string, number>();
    requests
      .filter((r) => r.kind === "return" && isOpenRequest(r.status) && r.part_id)
      .forEach((r) => m.set(r.part_id!.toLowerCase(), (m.get(r.part_id!.toLowerCase()) ?? 0) + r.quantity));
    return m;
  }, [requests]);

  const results = useMemo(() => {
    const q = search.trim();
    if (!q) return [];
    const exact = byId.get(q.toLowerCase());
    const found = inventory
      .filter((i) => i !== exact && matchesPartSearch([i.partId, i.partName, i.brand, i.deviceType, i.model, i.partType, i.color], q))
      .sort(sortForPicking);
    return (exact ? [exact, ...found] : found).slice(0, MAX_RESULTS);
  }, [search, inventory, byId]);

  const openCount = requests.filter((r) => isOpenRequest(r.status)).length;
  const myName = profile?.name || sessionStorage.getItem("userFullName") || "Staff";

  const startDraft = (key: string) => {
    setDraftFor(key);
    setQty(1);
    setNote("");
    if (key === "custom") setCustomName(search.trim());
  };

  const send = async (part?: InventoryItem) => {
    const name = part ? part.partName : customName.trim();
    if (!name || sending) return;
    setSending(true);
    try {
      const status = part ? initialRequestStatus(part.quantity, qty) : "For Ordering";
      await createPartRequest({
        serviceId,
        partId: part?.partId ?? null,
        partName: name,
        brand: part?.brand ?? null,
        deviceModel: part?.model || device || null,
        quantity: qty,
        notes: note,
        status,
        requestedBy: user?.id ?? null,
        requestedByName: myName,
      });
      toast({
        title: "Request sent to inventory",
        description:
          status === "Requested"
            ? `${qty}× ${name}. It's added to this ticket once inventory approves it.`
            : `${qty}× ${name}. Not enough in stock, so inventory will order it first.`,
      });
      setDraftFor(null);
      setSearch("");
      refresh();
    } catch (e) {
      toast({ title: "Could not send the request", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const draftForm = (part?: InventoryItem) => (
    <div className="mt-2 space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
      {!part && (
        <div className="space-y-1">
          <Label htmlFor="custom-part" className="text-xs">
            Part name
          </Label>
          <Input
            id="custom-part"
            placeholder="e.g. iPhone 15 Pro back glass, blue"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            autoFocus
          />
        </div>
      )}
      <div className="grid grid-cols-[5.5rem_1fr] gap-2">
        <div className="space-y-1">
          <Label htmlFor="req-qty" className="text-xs">
            Quantity
          </Label>
          <Input id="req-qty" type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="req-note" className="text-xs">
            Note for inventory (optional)
          </Label>
          <Input id="req-note" placeholder="e.g. needed today" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      {part && part.quantity < qty && (
        <p className="text-xs text-warning">
          Only {Math.max(0, part.quantity)} in stock, so this goes to inventory as <strong>For Ordering</strong>.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setDraftFor(null)} disabled={sending}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => send(part)} disabled={sending || (!part && !customName.trim())}>
          {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          Send request
        </Button>
      </div>
    </div>
  );

  return (
    <div className={cn("space-y-5 rounded-xl border border-border/60 bg-background/60 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {!large && <Package className="mt-0.5 h-4 w-4 text-muted-foreground" />}
          <div>
            <h3 className={large ? "text-2xl font-semibold tracking-tight" : "text-sm font-semibold"}>Parts</h3>
            <p className="text-xs text-muted-foreground">
              Request or return parts here. Inventory staff or management approve every change.
            </p>
          </div>
        </div>
        <PageGuide guide={PARTS_REQUEST_GUIDE} label="How it works" />
      </div>

      {locked && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            <span className="font-medium">Parts are locked</span> ({status}).{" "}
            {noAdds
              ? "Parts can't be added to this ticket, but they can still be returned. Someone other than the person who asked approves the return."
              : "Changes still go through a request or return, and someone other than the person who asked has to approve them."}
          </p>
        </div>
      )}

      {/* On the ticket */}
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">On this ticket</p>
        {onTicket.length === 0 ? (
          <p className="text-sm text-muted-foreground">No parts on this ticket yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {onTicket.map(({ token, count, part }) => {
              const pendingBack = pendingReturns.get((part?.partId ?? token).toLowerCase()) ?? 0;
              const canReturn = returnableQty(count, pendingBack);
              return (
                <li key={token} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm leading-snug">{part?.partName ?? token}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {part && <span className="font-mono">{part.partId}</span>}
                      {pendingBack > 0 && <span>{part ? " · " : ""}{pendingBack} waiting to be returned</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">× {count}</span>
                    {canReturn > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-muted-foreground"
                        onClick={() => setReturning({ id: part?.partId ?? token, name: part?.partName ?? token, max: canReturn })}
                      >
                        <Undo2 className="mr-1 h-3.5 w-3.5" />
                        Return
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* This ticket's requests */}
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Requests{openCount > 0 ? ` · ${openCount} waiting` : ""}
        </p>
        {requestsLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((r) => {
              const open = isOpenRequest(r.status);
              const mine = !!user?.id && r.requested_by === user.id;
              const stock = r.part_id ? byId.get(r.part_id.toLowerCase()) : undefined;
              const isReturn = r.kind === "return";
              // On a locked ticket nobody approves their own change (the database enforces this too).
              const ownLockedChange = locked && mine;
              return (
                <li key={r.id} className={cn("rounded-lg border p-3", !open && "bg-muted/30")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={cn("text-sm font-medium leading-snug", r.status === "Cancelled" && "text-muted-foreground line-through")}>
                        {r.quantity}× {r.part_name || r.part_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.part_id ? <span className="font-mono">{r.part_id}</span> : "Not in the parts list"} · {r.requested_by_name || "—"} ·{" "}
                        {formatManilaDate(r.created_at, "MMM d, h:mm a")}
                      </p>
                    </div>
                    <RequestStatusBadge status={r.status} plain kind={r.kind} />
                  </div>
                  {(isReturn || r.after_lock) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <ReturnBadge request={r} />
                      <AfterLockBadge request={r} />
                    </div>
                  )}
                  {r.notes && <p className="mt-1 text-xs">{r.notes}</p>}
                  {isApprovedRequest(r.status) && r.approved_by_name && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Approved by {r.approved_by_name}
                      {isReturn && r.return_reason === "defective" && r.defect_status ? ` · Defective part: ${r.defect_status}` : ""}
                    </p>
                  )}
                  {r.status === "Cancelled" && r.cancelled_reason && (
                    <p className="mt-1 text-xs text-muted-foreground">Reason: {r.cancelled_reason}</p>
                  )}
                  {open && (hasInventoryAccess || mine) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {hasInventoryAccess && (
                        <>
                          {ownLockedChange ? (
                            <span className="text-xs text-muted-foreground">Someone else has to approve this (parts are locked).</span>
                          ) : (
                            <Button size="sm" className="h-8" onClick={() => setApproving(r)}>
                              {isReturn ? "Approve return" : "Approve & add"}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-8" onClick={() => setCancelling({ row: r, mode: "decline" })}>
                            Decline
                          </Button>
                          {stock && !isReturn && <StockPill onHand={stock.quantity} status={stock.status} />}
                        </>
                      )}
                      {mine && !hasInventoryAccess && (
                        <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => setCancelling({ row: r, mode: "cancel" })}>
                          <X className="mr-1 h-3.5 w-3.5" />
                          {isReturn ? "Cancel return" : "Cancel request"}
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Ask for a part */}
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Request a part</p>
        {noAdds ? (
          <p className="text-sm text-muted-foreground">This ticket is {status}, so new parts can't be requested.</p>
        ) : (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by SKU, part name, model…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setDraftFor((d) => (d === "custom" ? d : null));
                  }}
                />
              </div>
              <Button type="button" variant="outline" onClick={() => setScanning((s) => !s)} aria-label="Scan a part's QR code">
                <QrCode className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Scan</span>
              </Button>
            </div>

            {scanning && (
              <QRScanner
                onScan={(text) => {
                  setSearch(text.trim());
                  setScanning(false);
                }}
                onClose={() => setScanning(false)}
              />
            )}

            {search.trim() && (
              <div className="max-h-[26rem] space-y-1.5 overflow-y-auto">
                {results.length === 0 && (
                  <p className="py-2 text-center text-sm text-muted-foreground">No parts match "{search.trim()}".</p>
                )}
                {results.map((i) => {
                  const pending = openByPart.get(i.partId);
                  return (
                    <div key={i.partId} className="rounded-lg border p-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm leading-snug">{i.partName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            <span className="font-mono">{i.partId}</span>
                            {[i.brand, i.model, i.color].filter(Boolean).length > 0 && ` · ${[i.brand, i.model, i.color].filter(Boolean).join(" · ")}`}
                          </p>
                          <StockPill onHand={i.quantity} status={i.status} className="mt-1.5" />
                        </div>
                        {pending ? (
                          <span className="shrink-0 pt-1 text-xs text-muted-foreground">Already requested</span>
                        ) : (
                          draftFor !== i.partId && (
                            <Button size="sm" variant="outline" className="shrink-0" onClick={() => startDraft(i.partId)}>
                              Request
                            </Button>
                          )
                        )}
                      </div>
                      {draftFor === i.partId && draftForm(i)}
                    </div>
                  );
                })}
              </div>
            )}

            {draftFor === "custom" ? (
              draftForm()
            ) : (
              <button type="button" onClick={() => startDraft("custom")} className="text-xs font-medium text-primary hover:underline">
                Can't find it? Request a part that's not in the list
              </button>
            )}
          </>
        )}
      </section>

      <ApproveRequestDialog request={approving} onOpenChange={(o) => !o && setApproving(null)} onApproved={() => onTicketChanged?.()} />
      <ReturnPartDialog
        serviceId={serviceId}
        part={returning ? { id: returning.id, name: returning.name } : null}
        maxQty={returning?.max ?? 1}
        onOpenChange={(o) => !o && setReturning(null)}
      />
      <CancelRequestDialog
        request={cancelling?.row ?? null}
        mode={cancelling?.mode ?? "cancel"}
        onOpenChange={(o) => !o && setCancelling(null)}
      />
    </div>
  );
}
