import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { DATA_BRIDGE_URL } from "@/lib/dataBridge";
import { logActivityAsync } from "@/lib/activityLogger";
import { completeServiceIfFullyPaid } from "@/lib/autoCompleteService";
import { useServicePayments, derivePaymentTotals } from "@/hooks/useServicePayments";
import { WarrantyCardFields } from "@/components/WarrantyCardFields";
import { PosDocumentActions } from "@/components/PosDocumentActions";
import { ServiceLinesEditor } from "@/components/ServiceLinesEditor";
import {
  fetchTicketDocumentContext,
  regenerateTicketDocuments,
} from "@/lib/posDocuments";
import {
  fetchTicketLinesContext,
  computeLineTotals,
  saveTicketServiceLines,
} from "@/lib/posServiceLines";
import { lineDisplayName, lineEffectiveCost, type QuotedLine } from "@/lib/serviceApproval";

const PAYMENT_TYPES = ["Down Payment", "Partial Payment", "Full Payment"];
const PAYMENT_METHODS = ["GCash", "Bank Transfer", "Credit Card", "Cash", "N/A", "Others"];

const parseCurrency = (val: string | number | undefined): number => {
  if (val === undefined || val === null || val === "") return 0;
  const cleaned = String(val).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const peso = (n: number) => `Php ${n.toFixed(2)}`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: string;
  clientName?: string;
  device?: string;
  finalCost?: string | number;
  serviceCost?: string | number;
  partsCost?: string | number;
  initialPayment?: string | number;
  /** Called after a payment is recorded so the host page can refresh. */
  onRecorded?: () => void;
}

/**
 * Records a client payment for a ticket without leaving the page. Mirrors the
 * POS page rules: any amount is accepted, even before a final cost exists (it
 * simply sits as credit on the ticket until the cost is set).
 */
export const TicketPaymentModal = ({
  open,
  onOpenChange,
  serviceId,
  clientName,
  device,
  finalCost,
  serviceCost,
  partsCost,
  initialPayment,
  onRecorded,
}: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const username =
    sessionStorage.getItem("userFullName") || sessionStorage.getItem("username") || "Unknown";
  const userRole = sessionStorage.getItem("userRole") || "";

  const [type, setType] = useState("Full Payment");
  const [method, setMethod] = useState("");
  const [otherMethod, setOtherMethod] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [warrantyEnabled, setWarrantyEnabled] = useState(true);
  const [docsKey, setDocsKey] = useState(0);
  const [recorded, setRecorded] = useState(false);
  const [warrantyTerms, setWarrantyTerms] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<QuotedLine[]>([]);
  const [originalLines, setOriginalLines] = useState<QuotedLine[]>([]);
  const [pricing, setPricing] = useState({
    discount: 0,
    vatRequested: false,
    rushFee: false,
    clientApproved: false,
  });

  const { data: paymentsData } = useServicePayments(open ? serviceId : undefined);

  /** Final cost from the (possibly edited) lines; falls back to the stored one. */
  const editedFinalCost = useMemo(() => {
    if (!lines.length) return parseCurrency(finalCost);
    return computeLineTotals(lines, pricing.discount, pricing.vatRequested, pricing.rushFee)
      .finalCost;
  }, [lines, pricing, finalCost]);

  const totals = useMemo(
    () =>
      derivePaymentTotals(
        editedFinalCost,
        parseCurrency(initialPayment),
        paymentsData?.transactionsPaid ?? 0,
      ),
    [editedFinalCost, initialPayment, paymentsData?.transactionsPaid],
  );

  const amountNum = parseCurrency(amount);
  const remainingAfter = totals.total > 0 ? Math.max(0, totals.balance - amountNum) : 0;

  const fullyPaidAfter = totals.total > 0 && remainingAfter <= 0.01;

  const approvedLines = useMemo(
    () =>
      lines
        .filter((l) => l.selected)
        .map((l) => ({ label: lineDisplayName(l), amount: lineEffectiveCost(l) })),
    [lines],
  );

  /** Keep a saved warranty term with its line when the line is renamed. */
  const handleLinesChange = (next: QuotedLine[], rename?: { from: string; to: string }) => {
    setLines(next);
    if (rename && warrantyTerms[rename.from] !== undefined) {
      setWarrantyTerms((prev) => {
        const { [rename.from]: term, ...rest } = prev;
        return { ...rest, [rename.to]: term };
      });
    }
  };

  useEffect(() => {
    if (!open) {
      setType("Full Payment");
      setMethod("");
      setOtherMethod("");
      setAmount("");
      setRemarks("");
      setWarrantyEnabled(true);
      setRecorded(false);
      return;
    }
    let alive = true;
    fetchTicketDocumentContext(serviceId).then((ctx) => {
      if (!alive || !ctx) return;
      setWarrantyTerms(ctx.warrantyTerms);
    });
    fetchTicketLinesContext(serviceId).then((ctx) => {
      if (!alive || !ctx) return;
      setLines(ctx.lines);
      setOriginalLines(ctx.lines);
      setPricing({
        discount: ctx.discount,
        vatRequested: ctx.vatRequested,
        rushFee: ctx.rushFee,
        clientApproved: ctx.clientApproved,
      });
    });
    return () => {
      alive = false;
    };
  }, [open, serviceId]);

  const submit = async () => {
    const finalMethod = method === "Others" ? otherMethod.trim() : method;
    if (!type || !finalMethod || amountNum <= 0) {
      toast({
        title: "Missing details",
        description: "Choose a payment type and method, and enter an amount.",
        variant: "destructive",
      });
      return;
    }
    if (lines.some((l) => !l.name.trim())) {
      toast({
        title: "Check the service lines",
        description: "Every service line needs a name.",
        variant: "destructive",
      });
      return;
    }
    if (lines.length > 0 && !lines.some((l) => l.selected)) {
      toast({
        title: "Check the service lines",
        description: "Include at least one service line.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const transactionId = `TXN${Date.now()}`;
    const amountClean = amountNum.toFixed(2);
    try {
      // Save any line corrections first so the totals and documents agree.
      try {
        const saved = await saveTicketServiceLines({
          serviceId,
          lines,
          original: originalLines,
          discount: pricing.discount,
          vatRequested: pricing.vatRequested,
          rushFee: pricing.rushFee,
          actorName: username,
          actorRole: userRole,
        });
        if (saved.changed) setOriginalLines(lines);
      } catch {
        toast({
          title: "Service lines not saved",
          description: "The payment will still be recorded, but the line changes did not save.",
          variant: "destructive",
        });
      }

      const params = new URLSearchParams();
      params.append("action", "addTransaction");
      params.append("transactionId", transactionId);
      params.append("serviceId", serviceId);
      params.append("transactionType", type);
      params.append("modeOfPayment", finalMethod);
      params.append("name", clientName || "");
      params.append("device", device || "");
      params.append("amount", amountClean);
      params.append(
        "serviceCost",
        (lines.length
          ? computeLineTotals(lines, pricing.discount, pricing.vatRequested, pricing.rushFee)
              .subtotal
          : parseCurrency(serviceCost)
        ).toFixed(2),
      );
      params.append("attendant", username);
      params.append("remarks", remarks);
      params.append("partsCost", parseCurrency(partsCost).toFixed(2));
      params.append("finalCost", editedFinalCost.toFixed(2));
      params.append("previousPayments", totals.paid.toFixed(2));

      const res = await fetch(DATA_BRIDGE_URL, { method: "POST", body: params });
      const result = await res.json().catch(() => ({}));
      if (result?.status !== "success") {
        throw new Error(result?.message || "Could not record the payment.");
      }

      toast({ title: "Payment recorded", description: `${transactionId} • ${peso(amountNum)}` });

      logActivityAsync({
        serviceId,
        username,
        role: userRole,
        activity: `POS: Recorded ${type} of Php ${amountClean} via ${finalMethod} (${transactionId})`,
        details: {
          "Transaction ID": transactionId,
          Type: type,
          Amount: peso(amountNum),
          "Mode of payment": finalMethod,
          "Previous payments": peso(totals.paid),
          "Total paid": peso(totals.paid + amountNum),
          "Amount due": peso(totals.total),
          ...(remarks ? { Remarks: remarks } : {}),
        },
      });

      if (totals.total > 0) {
        try {
          const completed = await completeServiceIfFullyPaid({
            serviceId,
            totalPaid: totals.paid + amountNum,
            actorName: username,
            actorRole: userRole,
          });
          if (completed) {
            toast({
              title: "Service completed",
              description: `${serviceId} is fully paid and was moved to Completed.`,
            });
          }
        } catch {
          /* non-blocking */
        }
      }

      // Refresh the client-facing documents from the ticket's own record.
      try {
        const docs = await regenerateTicketDocuments({
          serviceId,
          actorName: username,
          warrantyTerms,
          createWarranty: warrantyEnabled,
        });
        if (docs.warranty) {
          toast({ title: "Warranty card created", description: `${serviceId} • A5 warranty card` });
        } else if (docs.warrantySkipped) {
          toast({ title: "Warranty card not created", description: docs.warrantySkipped });
        }
      } catch {
        /* documents are best effort */
      }

      queryClient.invalidateQueries({ queryKey: ["servicePayments", serviceId] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      onRecorded?.();
      // Stay open so the receipt / warranty card can be printed straight away.
      setRecorded(true);
      setDocsKey((k) => k + 1);
    } catch (e) {
      toast({
        title: "Could not record payment",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex !flex-col max-h-[95dvh] sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            {serviceId}
            {clientName ? ` • ${clientName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-1">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
            <div className="flex justify-between py-0.5">
              <span className="text-muted-foreground">Amount due</span>
              <span className="font-medium">{totals.total > 0 ? peso(totals.total) : "Not set yet"}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-muted-foreground">Already paid</span>
              <span className="font-medium">{peso(totals.paid)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-muted-foreground">Balance</span>
              <span className="font-semibold">
                {totals.total > 0 ? peso(totals.balance) : "—"}
              </span>
            </div>
            {amountNum > 0 && (
              <div className="mt-1 border-t border-border/60 pt-1 flex justify-between">
                <span className="text-muted-foreground">Balance after this payment</span>
                <span className="font-semibold">
                  {totals.total > 0 ? peso(remainingAfter) : "Credit on ticket"}
                </span>
              </div>
            )}
          </div>

          {totals.total <= 0 && (
            <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700">
              No final cost yet — this payment is kept as credit on the ticket and will be
              deducted once the cost is set.
            </p>
          )}

          {!recorded && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Payment type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Mode of payment</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {method === "Others" && (
                    <Input
                      placeholder="Specify payment method"
                      value={otherMethod}
                      onChange={(e) => setOtherMethod(e.target.value)}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <WarrantyCardFields
                enabled={warrantyEnabled}
                onEnabledChange={setWarrantyEnabled}
                lines={approvedLines}
                terms={warrantyTerms}
                onTermsChange={setWarrantyTerms}
                fullyPaid={fullyPaidAfter}
              />

              <div className="space-y-1.5">
                <Label>Remarks (optional)</Label>
                <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
            </>
          )}

          {recorded && (
            <p className="rounded-md bg-emerald-500/10 p-2 text-xs text-emerald-700">
              Payment recorded. You can print or save the documents below.
            </p>
          )}

          <PosDocumentActions
            serviceId={serviceId}
            clientName={clientName}
            refreshKey={docsKey}
          />
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {recorded ? "Close" : "Cancel"}
          </Button>
          {!recorded && (
            <Button onClick={submit} disabled={saving}>
              {saving ? "Recording…" : "Record payment"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
