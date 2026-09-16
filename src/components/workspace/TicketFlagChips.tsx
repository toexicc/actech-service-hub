import { cn } from "@/lib/utils";
import { isCompletedStatus } from "@/lib/serviceStatus";

/**
 * The at-a-glance flags for a ticket (Rush, Released, Pre-Order, Backjob,
 * Waiting for Parts, Within the Day). Shared by the card and table views on
 * Service Tracker and Service Tracking so the same chips show everywhere.
 */
export interface TicketFlagChipsProps {
  service: any;
  /** Show the "Within the Day" chip (hidden in the RTO/closed views). */
  showWithinDay?: boolean;
  /**
   * Cash actually received on this ticket (payments less refunds). When given,
   * a Paid / Partial Payment chip is shown so collection is visible at a glance.
   */
  collected?: number | null;
  /** Hide the "Released" chip (e.g. on Completed Services where it's implied). */
  hideReleased?: boolean;
  /** Show a "Disbursed" chip when the technician has already been paid out. */
  disbursed?: boolean;
  className?: string;
}

const num = (v: any) => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Quoted price less discount — the amount the client owes. */
const billableOf = (s: any) => {
  const gross =
    num(s?.quotedPrice) || num(s?.serviceCost) || num(s?.finalCost) || num(s?.totalCost);
  return Math.max(0, gross - num(s?.discount));
};

const CHIP =
  "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap";

const isWithinDayPriority = (s: any) => /within\s*the\s*day/i.test(String(s?.priority || ""));

export function TicketFlagChips({
  service,
  showWithinDay = true,
  collected,
  hideReleased = false,
  disbursed = false,
  className,
}: TicketFlagChipsProps) {
  const chips: { key: string; label: string; cls: string }[] = [];

  if (collected != null && collected > 0.01) {
    const billable = billableOf(service);
    const fullyPaid = billable > 0 && collected >= billable - 0.01;
    chips.push(
      fullyPaid
        ? { key: "paid", label: "Paid", cls: "border-emerald-400/40 bg-emerald-500/15 text-emerald-600" }
        : {
            key: "partial",
            label: "Partial Payment",
            cls: "border-yellow-400/40 bg-yellow-500/15 text-yellow-600",
          },
    );
  }

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
  if (service?.hasPreOrder && !isCompletedStatus(service?.status)) {
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
  if (service?.vatRequested) {
    chips.push({
      key: "invoice",
      label: "Invoice Requested",
      cls: "border-violet-400/40 bg-violet-500/15 text-violet-600",
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
