import { Loader2 } from "lucide-react";
import { useWindowTally } from "@/hooks/useWindowTally";

const peso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  start?: Date;
  end?: Date;
}

/**
 * The same one-line summary on Completed Services, the POS Transaction Tracker
 * and Reports, so the three pages can be checked against each other at a glance.
 * Always measured over tickets COMPLETED inside the selected window.
 */
export const TallyLine = ({ start, end }: Props) => {
  const { data, isLoading, isError } = useWindowTally(start, end);

  if (!start || !end) {
    return (
      <p className="mb-6 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        Pick a cut-off or date range to see the shared tally line (same numbers on Completed Services, POS Transaction
        Tracker and Reports).
      </p>
    );
  }

  if (isLoading) {
    return (
      <p className="mb-6 flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Working out the tally for this window…
      </p>
    );
  }

  if (isError || !data) {
    return (
      <p className="mb-6 rounded-md border px-3 py-2 text-xs text-destructive">
        Couldn't work out the tally for this window.
      </p>
    );
  }

  const items = [
    { label: "Tickets completed", value: String(data.ticketCount) },
    { label: "Billable value", value: peso(data.billable) },
    { label: "Collected", value: peso(data.paidOnTickets) },
    { label: "Unpaid", value: peso(data.unpaid) },
  ];

  return (
    <div className="mb-6 rounded-md border bg-muted/30 px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-1">
        {items.map((i) => (
          <span key={i.label} className="min-w-0 text-xs text-muted-foreground">
            {i.label}: <span className="font-semibold tabular-nums text-foreground">{i.value}</span>
          </span>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Same window, same tickets (completed in range) on Completed Services, POS Transaction Tracker and Reports —
        billable value is quoted price less discount, collected is payments received on those tickets.
      </p>
    </div>
  );
};

export default TallyLine;
