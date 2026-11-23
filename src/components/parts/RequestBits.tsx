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
  cancelPartRequest,
  useRefreshAfterRequest,
  type ApproveResult,
  type PartRequestRow,
} from "@/hooks/usePartRequests";
import { matchesPartSearch, requestStatusText, requestTone, stockLevel, stockText } from "@/lib/partRequests";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  waiting: "bg-primary/10 text-primary border-primary/25",
  ordering: "bg-warning/10 text-warning border-warning/30",
  ready: "bg-success/10 text-success border-success/30",
  done: "bg-success/10 text-success border-success/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

/** Request status. Requesters see it in words ("Waiting for inventory"); inventory sees the status name. */
export function RequestStatusBadge({ status, plain = false }: { status: string; plain?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE[requestTone(status)],
      )}
    >
      {plain ? requestStatusText(status) : status}
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
          <DialogTitle>{declining ? "Decline part request" : "Cancel part request"}</DialogTitle>
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
