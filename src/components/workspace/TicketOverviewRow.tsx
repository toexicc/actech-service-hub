import { ReactNode } from "react";
import { Sparkles, Users, Wallet, Zap } from "lucide-react";
import { WorkspacePanel } from "./WorkspacePanel";
import { cn } from "@/lib/utils";
import { useServicePayments, derivePaymentTotals } from "@/hooks/useServicePayments";


const STAGE_MAP: Record<string, { stage: string; next: string; tone: string }> = {
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

const num = (v: any) => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return isFinite(n) ? n : 0;
};
const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface TicketOverviewRowProps {
  status?: string;
  /** Ticket ID — enables actual POS payment totals in the Payment card. */
  serviceId?: string;
  technician?: string;
  adminRep?: string;
  receivingStaff?: string;
  serviceCost?: number | string;
  discount?: number | string;
  finalCost?: number | string;
  initialPayment?: number | string;
  paymentStatus?: string;
  showCharges?: boolean;
  showServiceCost?: boolean;
  showDiscount?: boolean;
  showFinal?: boolean;
  showPayment?: boolean;
  actions?: ReactNode;
  extraNote?: ReactNode;
  guidance?: string;
  className?: string;
}

export function TicketOverviewRow({
  status,
  serviceId,
  technician,
  adminRep,
  receivingStaff,
  serviceCost,
  discount,
  finalCost,
  initialPayment,
  paymentStatus,
  showCharges = true,
  showServiceCost = true,
  showDiscount = true,
  showFinal = true,
  showPayment = true,
  actions,
  extraNote,
  guidance,
  className,
}: TicketOverviewRowProps) {
  const info = STAGE_MAP[status || ""] || STAGE_MAP["Pending Diagnosis"];
  const nextText = (guidance && guidance.trim()) || info.next;

  const { data: paymentsSummary } = useServicePayments(serviceId);
  const sc = num(serviceCost);
  const dc = num(discount);
  const fc = finalCost !== undefined && finalCost !== null && String(finalCost) !== ""
    ? num(finalCost)
    : Math.max(0, sc - dc);
  const ip = num(initialPayment);
  const totals = derivePaymentTotals(fc, ip, paymentsSummary?.transactionsPaid || 0);
  const paid = totals.paid;
  const balance = totals.balance;
  const paymentRows = paymentsSummary?.payments ?? [];


  const assignees = [
    { role: "Technician", name: technician },
    { role: "Admin Rep", name: adminRep },
    { role: "Receiving", name: receivingStaff },
  ].filter((a) => a.name && a.name.trim());

  return (
    <div className={cn("space-y-4", className)}>
      {/* What's next full-width banner */}
      <div
        className={cn(
          "rounded-2xl border px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-[var(--shadow-float)] backdrop-blur",
          info.tone,
        )}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
                What's next
              </p>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-background/60 border border-border/60 text-muted-foreground">
                {info.stage}
              </span>
            </div>
            <p className="text-sm sm:text-base font-semibold text-foreground mt-1">{nextText}</p>
            {extraNote && <div className="mt-1 text-xs text-muted-foreground">{extraNote}</div>}
          </div>
        </div>
      </div>

      {/* 3-card row */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {/* Assigned To */}
        <WorkspacePanel title="Assigned To" icon={<Users className="h-4 w-4" />} bodyClassName="p-4">
          {assignees.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Unassigned</p>
          ) : (
            <ul className="space-y-2.5">
              {assignees.map((a) => (
                <li key={a.role} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                    {a.name!.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      {a.role}
                    </p>
                    <p className="text-sm font-medium text-foreground break-words">{a.name}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </WorkspacePanel>

        {/* Payment / Charges */}
        <WorkspacePanel title="Payment" icon={<Wallet className="h-4 w-4" />} bodyClassName="p-0">
          {!showCharges ? (
            <p className="text-sm text-muted-foreground italic px-4 py-4">No charges yet.</p>
          ) : (
            <div className="divide-y divide-border/50">
              <div className="px-4 py-3">
                <p className="text-2xl font-bold text-primary tabular-nums">{peso(fc)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {peso(paid)} paid · <span className={balance > 0 ? "text-destructive font-medium" : "text-success font-medium"}>{peso(balance)} {balance > 0 ? "due" : "settled"}</span>
                </p>
              </div>
              <div className="px-4 py-2 space-y-1.5 text-sm">
                {showServiceCost && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Service Cost</span>
                    <span className="tabular-nums">{peso(sc)}</span>
                  </div>
                )}
                {showDiscount && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="tabular-nums">{dc > 0 ? `- ${peso(dc)}` : peso(0)}</span>
                  </div>
                )}
                {showFinal && (
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-foreground">Final Cost</span>
                    <span className="tabular-nums text-foreground">{peso(fc)}</span>
                  </div>
                )}
                {showPayment && (
                  <>
                    {ip > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Initial Payment</span>
                        <span className="tabular-nums">{peso(ip)}</span>
                      </div>
                    )}
                    {paymentRows.map((p) => (
                      <div key={p.id} className="flex items-center justify-between">
                        <span className="text-muted-foreground truncate">
                          {p.type}{p.paymentMethod ? ` · ${p.paymentMethod}` : ""}
                        </span>
                        <span className="tabular-nums">{peso(p.amount)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Total Paid</span>
                      <span className="tabular-nums">{peso(paid)}</span>
                    </div>
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-foreground">Balance</span>
                      <span className="tabular-nums text-foreground">{peso(balance)}</span>
                    </div>
                  </>
                )}

              </div>
              {paymentStatus && (
                <div className="flex items-center justify-between px-4 py-2 bg-muted/40">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Status</span>
                  <span className="text-xs font-semibold text-foreground">{paymentStatus}</span>
                </div>
              )}
            </div>
          )}
        </WorkspacePanel>

        {/* Actions */}
        <WorkspacePanel title="Actions" icon={<Zap className="h-4 w-4" />} bodyClassName="p-4">
          {actions ? (
            <div className="flex flex-col gap-2">{actions}</div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Use the update form to change status, notes, or assignments.
            </p>
          )}
        </WorkspacePanel>
      </div>
    </div>
  );
}

export default TicketOverviewRow;
