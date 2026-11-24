import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useInventory } from "@/hooks/useInventory";
import {
  approvePartRequest,
  approvePartReturn,
  cancelPartRequest,
  createPartRequest,
  useRefreshAfterRequest,
  type ApproveResult,
  type PartRequestRow,
} from "@/hooks/usePartRequests";
import {
  matchesPartSearch,
  RETURN_REASONS,
  requestStatusText,
  requestTone,
  returnReasonLabel,
  stockLevel,
  stockText,
  type ReturnReason,
} from "@/lib/partRequests";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  waiting: "bg-primary/10 text-primary border-primary/25",
  ordering: "bg-warning/10 text-warning border-warning/30",
  ready: "bg-success/10 text-success border-success/30",
  done: "bg-success/10 text-success border-success/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

/** Request status. Requesters see it in words ("Waiting for inventory"); inventory sees the status name. */
export function RequestStatusBadge({ status, plain = false, kind = "request" }: { status: string; plain?: boolean; kind?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE[requestTone(status)],
      )}
    >
      {plain ? requestStatusText(status, kind) : status}
    </span>
  );
}

/** "Return · Defective" etc. for returns; nothing for ordinary requests. */
export function ReturnBadge({ request }: { request: Pick<PartRequestRow, "kind" | "return_reason"> }) {
  if (request.kind !== "return") return null;
  const defective = request.return_reason === "defective";
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        defective ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border bg-muted text-foreground",
      )}
    >
      Return · {returnReasonLabel(request.return_reason)}
    </span>
  );
}

/** Shown on requests and returns made after the repair was done (parts locked). */
export function AfterLockBadge({ request }: { request: Pick<PartRequestRow, "after_lock"> }) {
  if (!request.after_lock) return null;
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
      After repair done
    </span>
  );
}

const STOCK_TONE: Record<string, string> = {
  in: "bg-success/10 text-success border-success/30",
  low: "bg-warning/10 text-warning border-warning/30",
  out: "bg-destructive/10 text-destructive border-destructive/30",
  order: "bg-primary/10 text-primary border-primary/25",
};

/** "In stock · 4", "Low · 1 left", "Out of stock" or "On order". */
export function StockPill({ onHand, status, className }: { onHand: number; status?: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        STOCK_TONE[stockLevel(onHand, status)],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {stockText(onHand, status)}
    </span>
  );
}

/**
 * Approve a request: pick the inventory part (needed for requests typed in by name), check the amount,
 * then the stock is taken and the part goes onto the ticket in one step.
 */
export function ApproveRequestDialog({
  request,
  onOpenChange,
  onApproved,
}: {
  request: PartRequestRow | null;
  onOpenChange: (open: boolean) => void;
  onApproved?: (result?: ApproveResult) => void;
}) {
  if (request?.kind === "return") {
    return <ApproveReturnDialog request={request} onOpenChange={onOpenChange} onApproved={() => onApproved?.()} />;
  }
  return <ApproveAddDialog request={request} onOpenChange={onOpenChange} onApproved={onApproved} />;
}

function ApproveAddDialog({
  request,
  onOpenChange,
  onApproved,
}: {
  request: PartRequestRow | null;
  onOpenChange: (open: boolean) => void;
  onApproved?: (result: ApproveResult) => void;
}) {
  const { data: inventory = [] } = useInventory();
  const refresh = useRefreshAfterRequest();
  const { toast } = useToast();
  const [partId, setPartId] = useState("");
  const [qty, setQty] = useState(1);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!request) return;
    setPartId(request.part_id ?? "");
    setQty(Math.max(1, request.quantity || 1));
    setPicking(!request.part_id);
    setSearch(request.part_id ? "" : request.part_name ?? "");
    setBusy(false);
  }, [request?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const part = inventory.find((i) => i.partId === partId);
  const matches = useMemo(
    () =>
      picking && search.trim()
        ? inventory
            .filter((i) => matchesPartSearch([i.partId, i.partName, i.brand, i.deviceType, i.model, i.partType, i.color], search))
            .slice(0, 30)
        : [],
    [picking, search, inventory],
  );
  const enough = !!part && part.quantity >= qty;

  const approve = async () => {
    if (!request || !part || !enough) return;
    setBusy(true);
    try {
      const res = await approvePartRequest(
        request.id,
        part.partId !== request.part_id ? part.partId : null,
        qty !== request.quantity ? qty : null,
      );
      toast({
        title: `Added to ${res.service_id}`,
        description: `${res.quantity}× ${part.partName}. ${res.stock_left} left in stock.`,
      });
      refresh();
      onApproved?.(res);
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Could not approve", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="flex max-h-[92dvh] max-w-lg flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Approve part request</DialogTitle>
          <DialogDescription>
            The part is taken out of stock and added to {request?.service_id ?? "the ticket"}'s parts used.
          </DialogDescription>
        </DialogHeader>
        {request && (
          <div className="-mx-6 min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-1 text-sm">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-medium">
                {request.quantity}× {request.part_name || request.part_id}
              </p>
              <p className="text-xs text-muted-foreground">
                {request.service_id} · requested by {request.requested_by_name || "—"} · {request.request_id}
              </p>
              {request.notes && <p className="mt-1 text-xs">{request.notes}</p>}
            </div>

            <div className="space-y-2">
              <Label>Part to give</Label>
              {part && !picking ? (
                <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">{part.partName}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{part.partId}</p>
                    <StockPill onHand={part.quantity} status={part.status} className="mt-1.5" />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>
                    Change
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search inventory by SKU, name or model"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-56 space-y-1 overflow-y-auto">
                    {search.trim() && matches.length === 0 && (
                      <p className="py-3 text-center text-xs text-muted-foreground">
                        No part matches. If it's new, add it in Inventory Items first.
                      </p>
                    )}
                    {matches.map((i) => (
                      <button
                        key={i.partId}
                        type="button"
                        onClick={() => {
                          setPartId(i.partId);
                          setPicking(false);
                        }}
                        className="flex w-full items-start justify-between gap-3 rounded-md border px-3 py-2 text-left hover:border-primary"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm leading-snug">{i.partName}</span>
                          <span className="block font-mono text-[11px] text-muted-foreground">{i.partId}</span>
                        </span>
                        <StockPill onHand={i.quantity} status={i.status} className="shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-end gap-3">
              <div className="w-28 space-y-2">
                <Label htmlFor="approve-qty">Quantity</Label>
                <Input
                  id="approve-qty"
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>
              {part && !enough && (
                <p className="pb-2 text-xs text-destructive">
                  Only {part.quantity} in stock. Receive the stock first, or set the request to For Ordering.
                </p>
              )}
            </div>
          </div>
        )}
        <DialogFooter className="shrink-0 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={approve} disabled={busy || !part || !enough || picking}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve & add to ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Decline (inventory) or cancel (requester). Declining needs a reason, which the requester is told. */
export function CancelRequestDialog({
  request,
  mode,
  onOpenChange,
}: {
  request: PartRequestRow | null;
  mode: "decline" | "cancel";
  onOpenChange: (open: boolean) => void;
}) {
  const { profile, user } = useAuth();
  const refresh = useRefreshAfterRequest();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const declining = mode === "decline";

  useEffect(() => {
    setReason("");
    setBusy(false);
  }, [request?.id]);

  const submit = async () => {
    if (!request || (declining && !reason.trim())) return;
    setBusy(true);
    try {
      await cancelPartRequest(request, {
        reason,
        byName: profile?.name || sessionStorage.getItem("userFullName") || "Staff",
        byId: user?.id ?? null,
        declined: declining,
      });
      toast({ title: declining ? "Request declined" : "Request cancelled" });
      refresh();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Could not update the request", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {declining ? "Decline" : "Cancel"} {request?.kind === "return" ? "part return" : "part request"}
          </DialogTitle>
          <DialogDescription>
            {request ? `${request.quantity}× ${request.part_name || request.part_id} for ${request.service_id}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="request-reason">{declining ? "Reason (the requester sees this)" : "Reason (optional)"}</Label>
          <Textarea id="request-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Back
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy || (declining && !reason.trim())}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {declining ? "Decline" : "Cancel request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Approve a return: the part comes off the ticket; back into stock unless it's defective. */
function ApproveReturnDialog({
  request,
  onOpenChange,
  onApproved,
}: {
  request: PartRequestRow;
  onOpenChange: (open: boolean) => void;
  onApproved?: () => void;
}) {
  const refresh = useRefreshAfterRequest();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const defective = request.return_reason === "defective";

  const approve = async () => {
    setBusy(true);
    try {
      const res = await approvePartReturn(request.id);
      toast({
        title: `Taken off ${res.service_id}`,
        description: defective
          ? `${res.quantity}× ${request.part_name || request.part_id} is on the Defective list. Stock didn't change.`
          : `${res.quantity}× ${request.part_name || request.part_id} is back in stock${res.stock_after != null ? ` (${res.stock_after} now)` : ""}.`,
      });
      refresh();
      onApproved?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Could not approve the return", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approve part return</DialogTitle>
          <DialogDescription>
            {request.quantity}× {request.part_name || request.part_id} comes off {request.service_id}'s parts used, and its cost comes off the parts cost.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <ReturnBadge request={request} />
              <AfterLockBadge request={request} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Requested by {request.requested_by_name || "—"} · {request.request_id}
              {request.part_id ? ` · ${request.part_id}` : ""}
            </p>
            {request.notes && <p className="mt-1 text-xs">{request.notes}</p>}
          </div>
          <p className={cn("text-sm", defective ? "text-destructive" : "text-success")}>
            {defective
              ? "Defective: stock doesn't change. The part goes on the Defective list to send back to the supplier."
              : "The part goes back into stock."}
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={approve} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Ask to take a part off a ticket: why (not used, wrong entry, defective), how many, and a note. */
export function ReturnPartDialog({
  serviceId,
  part,
  maxQty,
  onOpenChange,
}: {
  serviceId: string;
  /** The part on the ticket: its SKU (or the line's name) and display name. */
  part: { id: string; name: string } | null;
  maxQty: number;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, profile } = useAuth();
  const refresh = useRefreshAfterRequest();
  const { toast } = useToast();
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setReason(null);
    setQty(1);
    setNote("");
    setBusy(false);
  }, [part?.id]);

  const needsNote = reason === "defective";
  const submit = async () => {
    if (!part || !reason || busy || (needsNote && !note.trim())) return;
    setBusy(true);
    try {
      await createPartRequest({
        serviceId,
        kind: "return",
        returnReason: reason,
        partId: part.id,
        partName: part.name,
        quantity: Math.min(Math.max(1, qty), Math.max(1, maxQty)),
        notes: note,
        requestedBy: user?.id ?? null,
        requestedByName: profile?.name || sessionStorage.getItem("userFullName") || "Staff",
      });
      toast({ title: "Return sent for approval", description: "Inventory staff or management approve it, then the part comes off the ticket." });
      refresh();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Could not send the return", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!part} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Return a part</DialogTitle>
          <DialogDescription>{part ? `${part.name} on ${serviceId}` : ""}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Why is it coming off the ticket?</Label>
            <div className="grid gap-2">
              {RETURN_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors hover:border-primary/60",
                    reason === r.value && "border-primary bg-primary/5 ring-1 ring-primary/30",
                  )}
                >
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.effect}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-2">
            <div className="space-y-1">
              <Label htmlFor="return-qty" className="text-xs">
                Quantity
              </Label>
              <Input
                id="return-qty"
                type="number"
                min={1}
                max={maxQty}
                value={qty}
                onChange={(e) => setQty(Math.min(Math.max(1, parseInt(e.target.value, 10) || 1), Math.max(1, maxQty)))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="return-note" className="text-xs">
                {needsNote ? "What's wrong with it?" : "Note (optional)"}
              </Label>
              <Input
                id="return-note"
                placeholder={needsNote ? "e.g. no display after install" : "e.g. client declined"}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {maxQty} on the ticket can be returned. Inventory staff or management approve it; the ticket's log records who asked and who approved.
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !reason || (needsNote && !note.trim())}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
