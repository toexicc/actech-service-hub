import { cn } from "@/lib/utils";

/**
 * The at-a-glance flags for a ticket (Rush, Released, Pre-Order, Backjob,
 * Waiting for Parts, Within the Day). Shared by the card and table views on
 * Service Tracker and Service Tracking so the same chips show everywhere.
 */
export interface TicketFlagChipsProps {
  service: any;
  /** Show the "Within the Day" chip (hidden in the RTO/closed views). */
  showWithinDay?: boolean;
  className?: string;
}

const CHIP =
  "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap";

const isWithinDayPriority = (s: any) => /within\s*the\s*day/i.test(String(s?.priority || ""));

export function TicketFlagChips({ service, showWithinDay = true, className }: TicketFlagChipsProps) {
  const chips: { key: string; label: string; cls: string }[] = [];

  if (showWithinDay && isWithinDayPriority(service)) {
    chips.push({
      key: "withinDay",
      label: "Within the Day",
      cls: "border-sky-400/40 bg-sky-500/15 text-sky-600",
    });
  }
  if (service?.rushFee) {
    chips.push({ key: "rush", label: "Rush", cls: "border-orange-400/40 bg-orange-500/15 text-orange-600" });
  }
  if (service?.hasPreOrder) {
    chips.push({
      key: "preOrder",
      label: "Pre-Order",
      cls: "border-indigo-400/40 bg-indigo-500/15 text-indigo-600",
    });
  }
  if (service?.isReleased) {
    chips.push({
      key: "released",
      label: "Released",
      cls: "border-emerald-400/40 bg-emerald-500/15 text-emerald-600",
    });
  }
  if (service?.isBackjob) {
    chips.push({
      key: "backjob",
      label: "Backjob",
      cls: "border-destructive/40 bg-destructive/10 text-destructive",
    });
  }
  if (service?.waitingForParts) {
    chips.push({
      key: "waitingParts",
      label: "Waiting for Parts",
      cls: "border-amber-400/40 bg-amber-500/15 text-amber-600",
    });
  }

  if (chips.length === 0) return <span className="text-xs text-muted-foreground">-</span>;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {chips.map((c) => (
        <span key={c.key} className={cn(CHIP, c.cls)}>
          {c.label}
        </span>
      ))}
    </div>
  );
}

export default TicketFlagChips;
