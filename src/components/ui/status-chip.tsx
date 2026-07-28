import { cn } from "@/lib/utils";

interface StatusChipProps {
  status?: string | null;
  className?: string;
}

// Map service statuses to tone classes
function toneFor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("done") || s.includes("release") || s.includes("completed") || s.includes("released"))
    return "bg-success/12 text-success border-success/25";
  if (s.includes("pending") || s.includes("waiting") || s.includes("advise") || s.includes("observation"))
    return "bg-warning/12 text-warning border-warning/25";
  if (s.includes("cancel") || s.includes("reject") || s.includes("failed"))
    return "bg-destructive/12 text-destructive border-destructive/25";
  if (s.includes("proceed") || s.includes("repair") || s.includes("confirmed"))
    return "bg-primary/12 text-primary border-primary/25";
  return "bg-muted text-muted-foreground border-border";
}

export function StatusChip({ status, className }: StatusChipProps) {
  if (!status) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        toneFor(status),
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export default StatusChip;
