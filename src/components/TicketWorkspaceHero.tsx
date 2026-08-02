import { Badge } from "@/components/ui/badge";
import { TrackingShareActions } from "@/components/TrackingShareActions";
import { STATUS_OPTIONS } from "@/lib/constants";

import {
  User,
  Wrench,
  Calendar,
  DollarSign,
  Smartphone,
  ShieldCheck,
  Clock,
  Sparkles,
} from "lucide-react";

interface TicketWorkspaceHeroProps {
  service: any;
  /** Show the copy-link + QR share actions beside the ticket ID. */
  showShare?: boolean;
  /** Realtime watch is connected for this ticket. */
  isLive?: boolean;
}



const STAGE_MAP: Record<string, { stage: string; tone: string; next: string }> = {
  "Pending Diagnosis": { stage: "Intake", tone: "bg-warning/15 text-warning border-warning/30", next: "Run the diagnostic and generate the intake form." },
  "Confirmed Diagnosis": { stage: "Diagnosing", tone: "bg-primary/15 text-primary border-primary/30", next: "Generate the service quotation and await client approval." },
  "Waiting to Proceed": { stage: "Awaiting Client", tone: "bg-warning/15 text-warning border-warning/30", next: "Client is reviewing the quotation on /track." },
  "Proceed Repair": { stage: "Repairing", tone: "bg-primary/15 text-primary border-primary/30", next: "Client approved — start the repair." },
  "Ongoing Service": { stage: "Repairing", tone: "bg-primary/15 text-primary border-primary/30", next: "Repair in progress." },
  "Done Repair - Under Observation": { stage: "Testing", tone: "bg-primary/15 text-primary border-primary/30", next: "Observing the unit before release." },
  "Done Repair - For Release": { stage: "Ready", tone: "bg-success/15 text-success border-success/30", next: "Generate the technician report and advise the client." },
  "Done Repair - Advise Client": { stage: "Ready", tone: "bg-success/15 text-success border-success/30", next: "Client has been advised — awaiting pickup." },
  Completed: { stage: "Released", tone: "bg-muted text-muted-foreground border-border", next: "Service released and closed." },
  Backjob: { stage: "Backjob", tone: "bg-destructive/15 text-destructive border-destructive/30", next: "Reopened — re-investigate." },
  RTO: { stage: "RTO", tone: "bg-muted text-muted-foreground border-border", next: "Returned to owner." },
  "On Hold": { stage: "On Hold", tone: "bg-warning/15 text-warning border-warning/30", next: "Paused — see technician notes." },
  Cancelled: { stage: "Cancelled", tone: "bg-destructive/15 text-destructive border-destructive/30", next: "Service cancelled." },
};

const currency = (n: any) => {
  const v = Number(String(n ?? "").replace(/[^0-9.-]/g, ""));
  if (!isFinite(v) || v === 0) return "—";
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function TicketWorkspaceHero({ service, showShare = false, isLive = false }: TicketWorkspaceHeroProps) {
  if (!service) return null;
  const status = service.status || "Pending Diagnosis";
  const info = STAGE_MAP[status] || STAGE_MAP["Pending Diagnosis"];
  const currentIdx = STATUS_OPTIONS.indexOf(status as any);
  const totalMain = 9; // through Completed
  const pct = currentIdx >= 0 ? Math.min(100, Math.round(((currentIdx + 1) / totalMain) * 100)) : 0;

  const device = [service.deviceType, service.deviceBrand, service.deviceModel]
    .filter(Boolean)
    .join(" • ") || service.device || "—";

  const stats: { icon: any; label: string; value: string }[] = [
    { icon: User, label: "Client", value: service.clientName || "—" },
    { icon: Smartphone, label: "Device", value: device },
    { icon: Wrench, label: "Technician", value: service.technician || "Unassigned" },
    { icon: ShieldCheck, label: "Admin Rep", value: service.adminRep || "—" },
    { icon: Calendar, label: "Target Date", value: service.targetDate || service.estimatedTargetDate || "—" },
    { icon: DollarSign, label: "Final Cost", value: currency(service.finalCost || service.serviceCost) },
  ];

  return (
    <section className="mb-6 rounded-3xl border border-border/60 bg-[hsl(var(--surface-glass))] shadow-[var(--shadow-float)] backdrop-blur overflow-hidden animate-fade-in">
      {/* Top strip */}
      <div className="relative p-6 sm:p-8">
        <div className="absolute inset-0 pointer-events-none opacity-70">
          <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[hsl(var(--surface-tinted))] blur-3xl" />
        </div>

        <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`rounded-full border ${info.tone} font-medium px-3 py-1`}>
                {info.stage}
              </Badge>
              <span className="text-xs text-muted-foreground">Ticket</span>
              {isLive && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  Live
                </span>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-mono">
                {service.serviceId || "—"}
              </h2>
              {showShare && service.serviceId && (
                <TrackingShareActions serviceId={service.serviceId} />
              )}
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{service.clientName || "—"}</span>
              {service.contactNumber ? <> • {service.contactNumber}</> : null}
            </p>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-2 shrink-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Current status
            </div>
            <div className="text-base font-semibold text-foreground">{status}</div>
            <div className="flex items-start gap-2 max-w-sm text-xs text-muted-foreground lg:text-right">
              <Sparkles className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
              <span>{info.next}</span>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="relative mt-6">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            <span>Workflow progress</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-t border-border/60 bg-background/40">
        {stats.map((s) => (
          <div
            key={s.label}
            className="px-4 py-3 border-r last:border-r-0 border-border/40 min-w-0"
          >
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <s.icon className="h-3 w-3" />
              {s.label}
            </div>
            <div className="mt-1 text-sm font-medium text-foreground truncate" title={s.value}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default TicketWorkspaceHero;
