import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2 } from "lucide-react";
import { DEFAULT_TIMEFRAME, lineAmount, quoteTotals, type QuoteLine, type QuotePayload } from "@/lib/companyQuotation";

export type QuoteMode = "combined" | "individual";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyName: string;
  defaultCustomer: string;
  vatDefault: boolean;
  initialLines: QuoteLine[];
  busy: boolean;
  onGenerate: (mode: QuoteMode, base: Omit<QuotePayload, "lines">, lines: QuoteLine[]) => void;
}

const peso = (n: number) => "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2 });

export const QuotationDialog = ({ open, onOpenChange, companyName, defaultCustomer, vatDefault, initialLines, busy, onGenerate }: Props) => {
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [mode, setMode] = useState<QuoteMode>("combined");
  const [customer, setCustomer] = useState(defaultCustomer);
  const [timeframe, setTimeframe] = useState(DEFAULT_TIMEFRAME);
  const [discount, setDiscount] = useState("0");
  const [vat, setVat] = useState(vatDefault);
  const [warranty, setWarranty] = useState("");

  useEffect(() => {
    if (open) { setLines(initialLines); setCustomer(defaultCustomer); setVat(vatDefault); setDiscount("0"); }
  }, [open, initialLines, defaultCustomer, vatDefault]);

  const patch = (i: number, p: Partial<QuoteLine>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));
  const totals = quoteTotals({ lines, discount: mode === "individual" ? 0 : Number(discount.replace(/,/g, "")) || 0, vatIncluded: vat });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl !flex !flex-col max-h-[95dvh] p-0">
        <DialogHeader className="px-6 pt-6 shrink-0"><DialogTitle>Generate billing statement — {companyName}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>Customer name / department</Label><Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="e.g. SOC 8" /></div>
            <div className="sm:col-span-2">
              <Label>Document</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as QuoteMode)} className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="combined" />One document for all {lines.length}</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="individual" />One document per device</label>
              </RadioGroup>
            </div>
          </div>

          {lines.map((l, i) => (
            <div key={l.serviceId + i} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold">{i + 1}. {l.serviceId}</span>
                <span className="font-semibold">{peso(lineAmount(l))}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input value={l.serial} onChange={(e) => patch(i, { serial: e.target.value })} placeholder="Serial number" />
                <Input value={l.model} onChange={(e) => patch(i, { model: e.target.value })} placeholder="Model" />
                <Input value={l.partsRequested} onChange={(e) => patch(i, { partsRequested: e.target.value })} placeholder="Part(s) requested" />
              </div>
              <Textarea rows={2} value={l.issue} onChange={(e) => patch(i, { issue: e.target.value })} placeholder="Issue(s) reported" />
              {l.solutions.map((s, k) => (
                <div key={k} className="grid gap-2 grid-cols-[1fr_110px_120px_auto]">
                  <Input value={s.name} onChange={(e) => patch(i, { solutions: l.solutions.map((x, j) => (j === k ? { ...x, name: e.target.value } : x)) })} placeholder="Solution" />
                  <Input inputMode="decimal" value={String(s.cost)} onChange={(e) => patch(i, { solutions: l.solutions.map((x, j) => (j === k ? { ...x, cost: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 } : x)) })} placeholder="Cost" />
                  <Input value={s.warranty ?? ""} onChange={(e) => patch(i, { solutions: l.solutions.map((x, j) => (j === k ? { ...x, warranty: e.target.value } : x)) })} placeholder="Warranty" />
                  <Button variant="ghost" size="icon" aria-label="Remove solution" onClick={() => patch(i, { solutions: l.solutions.filter((_, j) => j !== k) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 items-center">
                <Button variant="outline" size="sm" onClick={() => patch(i, { solutions: [...l.solutions, { name: "", cost: 0, warranty: "" }] })}><Plus className="h-4 w-4 mr-1" />Solution</Button>
                <Label className="text-xs">Qty</Label>
                <Input className="w-16 h-8" inputMode="numeric" value={String(l.quantity)} onChange={(e) => patch(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
              </div>
              <Textarea rows={2} value={l.notes} onChange={(e) => patch(i, { notes: e.target.value })} placeholder="Notes (e.g. We will use your existing assembly/casing...)" />
            </div>
          ))}

          <div><Label>Estimated timeframe</Label><Textarea rows={3} value={timeframe} onChange={(e) => setTimeframe(e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-3 items-end">
            <div><Label>Discount (₱){mode === "individual" ? " — combined only" : ""}</Label><Input inputMode="decimal" disabled={mode === "individual"} value={mode === "individual" ? "0" : discount} onChange={(e) => setDiscount(e.target.value)} /></div>
            <div><Label>Warranty (overall, optional)</Label><Input value={warranty} onChange={(e) => setWarranty(e.target.value)} /></div>
            <label className="flex items-center gap-2 text-sm pb-2"><Switch checked={vat} onCheckedChange={setVat} />Show VAT 12% (inclusive)</label>
          </div>
          <div className="rounded-lg bg-muted p-3 text-sm grid grid-cols-2 gap-1 mb-4">
            {vat && <><span>Sub Total</span><span className="text-right">{peso(totals.subTotal)}</span><span>VAT 12%</span><span className="text-right">{peso(totals.vat)}</span></>}
            <span className="font-semibold">Final Amount{mode === "individual" ? " (all documents)" : ""}</span><span className="text-right font-semibold">{peso(totals.finalAmount)}</span>
          </div>
        </div>
        <DialogFooter className="px-6 pb-6 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy || !lines.length} onClick={() => onGenerate(mode, {
            customerName: customer, companyName, date: new Date().toISOString(), timeframe,
            discount: mode === "individual" ? 0 : Number(discount.replace(/,/g, "")) || 0, vatIncluded: vat, warranty,
          }, lines)}>{busy ? "Generating…" : "Generate & download"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
