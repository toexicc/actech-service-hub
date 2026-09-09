import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WARRANTY_TERM_PRESETS, type ApprovedLine } from "@/lib/posDocuments";

const CUSTOM = "__custom__";

const peso = (n: number) =>
  `Php ${(Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  lines: ApprovedLine[];
  terms: Record<string, string>;
  onTermsChange: (terms: Record<string, string>) => void;
  /** Warranty card is only produced once the balance reaches zero. */
  fullyPaid: boolean;
}

/**
 * Create-warranty-card block shown on the POS page and in the in-page payment
 * modal. One warranty term per client-approved service line.
 */
export const WarrantyCardFields = ({
  enabled,
  onEnabledChange,
  lines,
  terms,
  onTermsChange,
  fullyPaid,
}: Props) => {
  const setTerm = (label: string, value: string) =>
    onTermsChange({ ...terms, [label]: value });

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-sm font-medium">Create warranty card</Label>
          <p className="text-xs text-muted-foreground">
            A5 warranty document for the approved services.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      {enabled && !fullyPaid && (
        <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700">
          The warranty card is generated once this payment clears the full balance.
        </p>
      )}

      {enabled && lines.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No client-approved service lines on this ticket yet.
        </p>
      )}

      {enabled &&
        lines.map((line) => {
          const current = terms[line.label] ?? WARRANTY_TERM_PRESETS[0];
          const isPreset = WARRANTY_TERM_PRESETS.includes(current);
          return (
            <div key={line.label} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium">{line.label}</span>
                <span className="text-xs text-muted-foreground">{peso(line.amount)}</span>
              </div>
              <Select
                value={isPreset ? current : CUSTOM}
                onValueChange={(v) => setTerm(line.label, v === CUSTOM ? "" : v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Warranty term" />
                </SelectTrigger>
                <SelectContent>
                  {WARRANTY_TERM_PRESETS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM}>Custom…</SelectItem>
                </SelectContent>
              </Select>
              {!isPreset && (
                <Input
                  placeholder="e.g. 90 days on the replaced part"
                  value={current}
                  onChange={(e) => setTerm(line.label, e.target.value)}
                />
              )}
            </div>
          );
        })}
    </div>
  );
};
