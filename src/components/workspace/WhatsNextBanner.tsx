import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGE_MAP: Record<string, { stage: string; tone: string; next: string }> = {
  "Pending Diagnosis": { stage: "Intake", tone: "border-warning/30 bg-warning/5", next: "Run the diagnostic and generate the intake form." },
  "Confirmed Diagnosis": { stage: "Diagnosing", tone: "border-primary/25 bg-primary/5", next: "Generate the service quotation and await client approval." },
  "Waiting to Proceed": { stage: "Awaiting Client", tone: "border-warning/30 bg-warning/5", next: "Client is reviewing the quotation on /track." },
  "Proceed Repair": { stage: "Repairing", tone: "border-primary/25 bg-primary/5", next: "Client approved — start the repair." },
  "Ongoing Service": { stage: "Repairing", tone: "border-primary/25 bg-primary/5", next: "Repair in progress." },
  "Done Repair - Under Observation": { stage: "Testing", tone: "border-primary/25 bg-primary/5", next: "Observing the unit before release." },
  "Done Repair - For Release": { stage: "Ready", tone: "border-success/30 bg-success/5", next: "Generate the technician report and advise the client." },
  "Done Repair - Advise Client": { stage: "Ready", tone: "border-success/30 bg-success/5", next: "Client has been advised — awaiting pickup." },
  Completed: { stage: "Released", tone: "border-border/60 bg-muted/30", next: "Service released and closed." },
  Backjob: { stage: "Backjob", tone: "border-destructive/30 bg-destructive/5", next: "Reopened — re-investigate." },
  RTO: { stage: "RTO", tone: "border-border/60 bg-muted/30", next: "Returned to owner." },
  "On Hold": { stage: "On Hold", tone: "border-warning/30 bg-warning/5", next: "Paused — see technician notes." },
  Cancelled: { stage: "Cancelled", tone: "border-destructive/30 bg-destructive/5", next: "Service cancelled." },
};

export function WhatsNextBanner({ status, className }: { status?: string; className?: string }) {
  const info = STAGE_MAP[status || ""] || STAGE_MAP["Pending Diagnosis"];
  return (
    <div className={cn("rounded-2xl border px-4 py-3 flex items-start gap-3", info.tone, className)}>
      <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">What's next</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{info.next}</p>
      </div>
    </div>
  );
}

export default WhatsNextBanner;
