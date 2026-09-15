import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFilterPersistence } from "@/hooks/useFilterPersistence";
import {
  CUTOFF_STORAGE_KEY,
  cutoffRange,
  currentCutoffHalf,
  currentCutoffMonth,
  monthLabel,
  recentCutoffMonths,
  type CutoffHalf,
} from "@/lib/cutoffPeriod";

interface Props {
  /** Applies the chosen cut-off to the page's own date range state. */
  onApply: (start: Date, end: Date) => void;
  className?: string;
}

/**
 * Month picker plus 1-15 / 16-End buttons. The selection is shared through
 * localStorage so moving between Completed Services, the Transaction Tracker,
 * Reports and Salary Disbursement keeps the same window.
 */
export const CutoffPresets = ({ onApply, className }: Props) => {
  const [cutoff, setCutoff] = useFilterPersistence<{ month: string; half: CutoffHalf }>(
    CUTOFF_STORAGE_KEY,
    { month: currentCutoffMonth(), half: currentCutoffHalf() },
  );

  const apply = (month: string, half: CutoffHalf) => {
    setCutoff({ month, half });
    const { start, end } = cutoffRange(month, half);
    onApply(start, end);
  };

  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-2 ${className ?? ""}`}>
      <span className="text-xs text-muted-foreground">Cut-off:</span>
      <Select value={cutoff.month} onValueChange={(v) => apply(v, cutoff.half)}>
        <SelectTrigger className="h-8 w-[170px] min-w-0">
          <SelectValue className="truncate" />
        </SelectTrigger>
        <SelectContent>
          {recentCutoffMonths().map((m) => (
            <SelectItem key={m} value={m}>
              {monthLabel(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant={cutoff.half === "first" ? "default" : "outline"} onClick={() => apply(cutoff.month, "first")}>
        1 - 15
      </Button>
      <Button size="sm" variant={cutoff.half === "second" ? "default" : "outline"} onClick={() => apply(cutoff.month, "second")}>
        16 - End
      </Button>
    </div>
  );
};

export default CutoffPresets;
