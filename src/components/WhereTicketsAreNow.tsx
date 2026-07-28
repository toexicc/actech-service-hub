import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Inbox,
  Stethoscope,
  Wrench,
  PackageCheck,
  CheckCircle2,
  AlertOctagon,
} from "lucide-react";

interface Props {
  services: any[];
  role: string | null;
}

const STAGES: {
  key: string;
  label: string;
  icon: any;
  tone: string;
  match: (s: string) => boolean;
}[] = [
  {
    key: "intake",
    label: "Intake",
    icon: Inbox,
    tone: "from-warning/20 to-warning/5 text-warning",
    match: (s) => s === "Pending Diagnosis",
  },
  {
    key: "diagnosing",
    label: "Diagnosing",
    icon: Stethoscope,
    tone: "from-primary/20 to-primary/5 text-primary",
    match: (s) => s === "Confirmed Diagnosis" || s === "Waiting to Proceed",
  },
  {
    key: "repairing",
    label: "Repairing",
    icon: Wrench,
    tone: "from-primary/25 to-primary/10 text-primary",
    match: (s) =>
      s === "Proceed Repair" ||
      s === "Ongoing Service" ||
      s === "Done Repair - Under Observation",
  },
  {
    key: "ready",
    label: "Ready to Release",
    icon: PackageCheck,
    tone: "from-success/20 to-success/5 text-success",
    match: (s) =>
      s === "Done Repair - For Release" || s === "Done Repair - Advise Client",
  },
  {
    key: "completed",
    label: "Completed",
    icon: CheckCircle2,
    tone: "from-muted to-muted/40 text-muted-foreground",
    match: (s) => s === "Completed",
  },
  {
    key: "attention",
    label: "Needs Attention",
    icon: AlertOctagon,
    tone: "from-destructive/20 to-destructive/5 text-destructive",
    match: (s) => s === "Backjob" || s === "On Hold" || s === "RTO",
  },
];

export function WhereTicketsAreNow({ services, role }: Props) {
  const navigate = useNavigate();

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const st of STAGES) map[st.key] = [];
    for (const s of services || []) {
      const status = (s.status || "").trim();
      const stage = STAGES.find((st) => st.match(status));
      if (stage) map[stage.key].push(s);
    }
    return map;
  }, [services]);

  const handleClick = (svc: any) => {
    const path = role === "technician" ? "/service-update" : "/manage-client";
    navigate(`${path}?serviceId=${encodeURIComponent(svc.serviceId)}`);
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Where tickets are now
        </h2>
        <span className="text-xs text-muted-foreground">
          {services?.length || 0} total
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {STAGES.map((stage) => {
          const items = grouped[stage.key] || [];
          const preview = items.slice(0, 3);
          return (
            <div
              key={stage.key}
              className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur shadow-[var(--shadow-float)] p-4 flex flex-col min-h-[180px]"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-8 w-8 rounded-lg bg-gradient-to-br ${stage.tone} flex items-center justify-center`}
                  >
                    <stage.icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {stage.label}
                  </span>
                </div>
                <span className="text-lg font-bold text-foreground">
                  {items.length}
                </span>
              </div>

              {preview.length === 0 ? (
                <p className="text-xs text-muted-foreground/70 mt-auto">No tickets here.</p>
              ) : (
                <ul className="space-y-1.5 mt-1">
                  {preview.map((svc) => (
                    <li key={svc.serviceId}>
                      <button
                        onClick={() => handleClick(svc)}
                        className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-primary/5 transition-colors group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono font-medium text-foreground">
                            {svc.serviceId}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[80px] group-hover:text-primary">
                            {svc.clientName}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                  {items.length > preview.length && (
                    <li className="text-[10px] text-muted-foreground pl-2 pt-1">
                      +{items.length - preview.length} more
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default WhereTicketsAreNow;
