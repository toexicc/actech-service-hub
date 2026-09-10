import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  lineDisplayName,
  lineEffectiveCost,
  type QuotedLine,
} from "@/lib/serviceApproval";
import { computeLineTotals } from "@/lib/posServiceLines";

const peso = (n: number) =>
  `Php ${(Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toNum = (raw: string) => {
  const n = parseFloat(String(raw ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

interface Props {
  lines: QuotedLine[];
  /** `rename` reports a changed line label so warranty terms can follow it. */
  onChange: (lines: QuotedLine[], rename?: { from: string; to: string }) => void;
  discount: number;
  vatRequested: boolean;
  rushFee: boolean;
  alreadyPaid: number;
  /** Warn that the client already approved this quotation. */
  clientApproved?: boolean;
}

/**
 * Service lines of a ticket, editable from the payment screen so staff can fix
 * wrong prices (or a missing line) before taking the money. Totals update live.
 */
export const ServiceLinesEditor = ({
  lines,
  onChange,
  discount,
  vatRequested,
  rushFee,
  alreadyPaid,
  clientApproved,
}: Props) => {
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  /** Raw text while a price is being typed, so "1500." / "1500.5" survive. */
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const totals = computeLineTotals(lines, discount, vatRequested, rushFee);
  const balance = Math.max(0, totals.finalCost - (Number(alreadyPaid) || 0));

  const patch = (index: number, next: Partial<QuotedLine>, rename?: { from: string; to: string }) =>
    onChange(
      lines.map((l, i) => (i === index ? { ...l, ...next } : l)),
      rename,
    );

  const setAmount = (index: number, raw: string) => {
    // Keep the typed text (allow one decimal point, max 2 decimals).
    const cleaned = raw.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    const [whole, dec] = cleaned.split(".");
    const value = dec === undefined ? whole : `${whole}.${dec.slice(0, 2)}`;
    setDrafts((d) => ({ ...d, [index]: value }));
    const amount = toNum(value);
    const line = lines[index];
    if (line.options?.length) {
      const chosen = line.selectedOption || line.options[0].label;
      patch(index, {
        selectedOption: chosen,
        options: line.options.map((o) => (o.label === chosen ? { ...o, cost: amount } : o)),
      });
      return;
    }
    patch(index, { cost: amount });
  };

  const setName = (index: number, value: string) => {
    const line = lines[index];
    const from = lineDisplayName(line);
    const to = lineDisplayName({ ...line, name: value });
    patch(index, { name: value }, from !== to ? { from, to } : undefined);
  };

  const removeLine = (index: number) =>
    onChange(lines.filter((_, i) => i !== index));

  const addLine = () => {
    const name = newName.trim();
    if (!name) return;
    onChange([
      ...lines,
      { name, cost: toNum(newAmount), selected: true, required: false },
    ]);
    setNewName("");
    setNewAmount("");
  };

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
      <div>
        <Label className="text-sm font-medium">Service lines</Label>
        <p className="text-xs text-muted-foreground">
          Correct a price or add a missing service — saved to the ticket when the payment is recorded.
        </p>
      </div>

      {clientApproved && lines.length > 0 && (
        <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700">
          The client already approved this quotation. Editing changes what was approved.
        </p>
      )}

      {lines.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No service lines on this ticket yet — add one below.
        </p>
      )}

      <div className="space-y-2">
        {lines.map((line, i) => (
          <div key={i} className="flex items-center gap-2">
            <Checkbox
              checked={!!line.selected}
              onCheckedChange={(v) => patch(i, { selected: !!v })}
              aria-label={`Include ${line.name}`}
            />
            <Input
              className="h-9 flex-1"
              value={line.name}
              onChange={(e) => setName(i, e.target.value)}
              placeholder="Service name"
            />
            <Input
              className="h-9 w-28 text-right"
              inputMode="decimal"
              value={drafts[i] ?? String(lineEffectiveCost(line))}
              onChange={(e) => setAmount(i, e.target.value)}
              onBlur={() => setDrafts((d) => {
                const { [i]: _drop, ...rest } = d;
                return rest;
              })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-destructive"
              aria-label={`Remove ${line.name}`}
              onClick={() => removeLine(i)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {lines.some((l) => l.options?.length) && (
          <p className="text-xs text-muted-foreground">
            For lines with options, the amount shown belongs to the chosen option.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border/60 pt-2">
        <Input
          className="h-9 flex-1"
          placeholder="Add a service"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addLine();
            }
          }}
        />
        <Input
          className="h-9 w-28 text-right"
          inputMode="decimal"
          placeholder="0.00"
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label="Add service line"
          disabled={!newName.trim()}
          onClick={addLine}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-0.5 border-t border-border/60 pt-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Services subtotal</span>
          <span>{peso(totals.subtotal)}</span>
        </div>
        {totals.discount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span>- {peso(totals.discount)}</span>
          </div>
        )}
        {totals.rush > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rush fee (10%)</span>
            <span>{peso(totals.rush)}</span>
          </div>
        )}
        {totals.vat > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">VAT (12%)</span>
            <span>{peso(totals.vat)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold">
          <span>Final cost</span>
          <span>{peso(totals.finalCost)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Already paid</span>
          <span>{peso(alreadyPaid)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Balance</span>
          <span>{peso(balance)}</span>
        </div>
      </div>
    </div>
  );
};
