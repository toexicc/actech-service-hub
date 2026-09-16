import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapServiceRow } from "@/hooks/useServices";
import { useServicePayments } from "@/hooks/useServicePayments";
import { useServiceBreakdowns } from "@/hooks/useServiceBreakdowns";
import { useClosedDates } from "@/hooks/useClosedDates";
import { parseStatusLog, buildTimings, StatusLogEntry } from "@/lib/reportMetrics";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Loader2,
  ExternalLink,
  User,
  Smartphone,
  FileText,
  Stethoscope,
  ListChecks,
  Wallet,
  Users,
  Images,
  ChevronDown,
  Clock,
} from "lucide-react";
import { TicketFlagChips } from "@/components/workspace/TicketFlagChips";
import { ChargesBreakdown } from "@/components/workspace/ChargesBreakdown";
import { PosDocumentActions } from "@/components/PosDocumentActions";
import { DeviceReportPhotos } from "@/components/DeviceReportPhotos";
import { DiagnosisPhotos } from "@/components/DiagnosisPhotos";
import { displayDate } from "@/lib/timezone";
import { cn } from "@/lib/utils";

/**
 * Read-only ticket preview in a right slide-over. Opened from the small icon
 * button beside a ticket ID anywhere in the app; never edits anything, and
 * hands off to Manage Client for the full editable view.
 */

interface ServicePreviewSheetProps {
  serviceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const textOr = (v: any, fallback = "—") => {
  const s = String(v ?? "").trim();
  return s || fallback;
};

const formatWorkingHours = (hours: number | null | undefined) => {
  if (hours === null || hours === undefined || !isFinite(hours)) return null;
  const total = Math.max(0, hours);
  const days = Math.floor(total / 8);
  const rest = Math.round(total - days * 8);
  if (days <= 0) return `${rest}h working time`;
  return `${days}d ${rest}h working time`;
};

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-[hsl(var(--surface-glass))] p-3.5 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-medium">{value}</span>
    </div>
  );
}

function LongText({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(false);
  const preview = body.replace(/\s+/g, " ").trim();
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-start justify-between gap-3 rounded-lg px-1 py-1.5 text-left hover:bg-muted/40">
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wide text-foreground">{title}</span>
          {!open && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{preview}</span>
          )}
        </span>
        <ChevronDown
          className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="whitespace-pre-wrap px-1 pb-2 pt-1 text-sm leading-relaxed">{body}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ServicePreviewSheet({ serviceId, open, onOpenChange }: ServicePreviewSheetProps) {
  const navigate = useNavigate();

  const { data: service, isLoading } = useQuery({
    queryKey: ["servicePreview", serviceId],
    queryFn: async () => {
      if (!serviceId) return null;
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("service_id", serviceId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapServiceRow(data) : null;
    },
    enabled: open && !!serviceId,
    staleTime: 30 * 1000,
  });

  const { data: paymentsSummary } = useServicePayments(open ? (serviceId ?? undefined) : undefined);
  const { data: breakdowns = [] } = useServiceBreakdowns(open ? (serviceId ?? undefined) : undefined);
  const { data: closedDates = [] } = useClosedDates();

  // Ticket-scoped activity logs, used only to derive the working-time duration.
  const { data: ticketLogs = [] } = useQuery({
    queryKey: ["servicePreviewLogs", serviceId],
    queryFn: async (): Promise<StatusLogEntry[]> => {
      if (!serviceId) return [];
      const { data, error } = await supabase
        .from("activity_logs")
        .select("action, entity_id, created_at, actor_name, changes")
        .eq("entity_type", "service")
        .eq("entity_id", serviceId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? [])
        .map((r) => parseStatusLog(r))
        .filter((e): e is StatusLogEntry => !!e);
    },
    enabled: open && !!serviceId,
    staleTime: 60 * 1000,
  });

  const timing = service
    ? buildTimings(
        [service],
        ticketLogs,
        closedDates.map((d) => d.startDate),
      ).get(String(service.serviceId))
    : undefined;
  const durationLabel = formatWorkingHours(timing?.totalHours ?? null);
  const pausedLabel =
    timing && timing.pausedHours > 0 ? `${Math.round(timing.pausedHours)}h paused (waiting)` : null;

  const device = [
    service?.deviceType,
    (service as any)?.deviceBrand || service?.brand,
    service?.deviceModel,
  ]
    .filter(Boolean)
    .join(" • ");
  const billable = Math.max(
    0,
    Number(String(service?.serviceCost ?? "0").replace(/[^0-9.-]/g, "")) -
      Number(String(service?.discount ?? "0").replace(/[^0-9.-]/g, "")),
  );
  const balance = Math.max(0, billable - (paymentsSummary?.transactionsPaid ?? 0));

  const complaint = textOr(service?.chiefComplaint, "");
  const issue = textOr(service?.issueDescription, "");
  const showIssue =
    !!issue && issue.replace(/\s+/g, " ").toLowerCase() !== complaint.replace(/\s+/g, " ").toLowerCase();

  const diagnosis = String(service?.diagnosis || service?.technicianDiagnosis || "").trim();
  const summary = String(service?.diagnosisSummary || "").trim();
  const report = String(service?.technicianReport || "").trim();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!flex w-full flex-col sm:max-w-xl p-0 overflow-hidden"
      >
        <SheetHeader className="shrink-0 space-y-0 border-b border-border/60 bg-gradient-to-br from-primary/10 via-background to-background px-6 py-4 text-left">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="min-w-0 space-y-1.5">
              <SheetTitle className="truncate font-mono text-lg font-semibold tracking-tight">
                {serviceId}
              </SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="truncate font-medium text-foreground">
                    {textOr(service?.clientName, "Ticket preview")}
                  </span>
                  {service?.status && (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                      {service.status}
                    </span>
                  )}
                </div>
              </SheetDescription>
            </div>
          </div>
          {service && (
            <div className="pt-2.5">
              <TicketFlagChips service={service} />
            </div>
          )}
        </SheetHeader>


        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
          {isLoading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {!isLoading && !service && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Ticket not found.
            </p>
          )}

          {service && (
            <>
              <Section icon={Users} title="Assignment">
                <Card className="space-y-2">
                  <KV label="Assigned Admin" value={textOr((service as any).adminRep)} />
                  <KV label="Handling Staff" value={textOr((service as any).receivingStaff)} />
                  <KV label="Technician" value={textOr(service.technician, "Unassigned")} />
                </Card>
              </Section>

              <Section icon={User} title="Client">
                <Card className="space-y-2">
                  <KV label="Name" value={textOr(service.clientName)} />
                  <KV label="Contact" value={textOr(service.contactNumber)} />
                  <KV label="Email" value={textOr((service as any).email)} />
                  <KV label="Client Type" value={textOr((service as any).clientType)} />
                </Card>
              </Section>

              <Section icon={FileText} title="Ticket Documents">
                <PosDocumentActions
                  serviceId={service.serviceId}
                  clientName={service.clientName}
                  serviceDate={service.serviceDate}
                />
              </Section>

              <Section icon={Smartphone} title="Device">
                <Card className="space-y-2">
                  <KV label="Device" value={textOr(device)} />
                  <KV
                    label="Color / Memory"
                    value={textOr([service.color, service.memory].filter(Boolean).join(" / "))}
                  />
                </Card>
              </Section>

              <Section icon={FileText} title="Complaint & Issue">
                <Card className="space-y-2.5 text-sm">
                  <p className="font-semibold leading-snug">
                    {complaint || "No chief complaint recorded."}
                  </p>
                  {showIssue && (
                    <p className="whitespace-pre-wrap text-muted-foreground">{issue}</p>
                  )}
                  <Separator />
                  <KV
                    label="Received"
                    value={service.dateReceived ? displayDate(service.dateReceived, "MMM dd, yyyy") : "—"}
                  />
                  <KV
                    label="Target"
                    value={
                      service.targetDate
                        ? displayDate(service.targetDate, "MMM dd, yyyy")
                        : textOr(service.estimatedCompletion)
                    }
                  />
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="flex shrink-0 items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Duration in system
                    </span>
                    <span className="min-w-0 text-right">
                      <span className="block font-medium">{durationLabel ?? "In progress"}</span>
                      {pausedLabel && (
                        <span className="block text-xs text-muted-foreground">{pausedLabel}</span>
                      )}
                    </span>
                  </div>
                </Card>
              </Section>

              <Section icon={Stethoscope} title="Diagnosis & Reports">
                <Card className="divide-y divide-border/50 py-1">
                  {summary && (
                    <p className="px-1 py-2 text-sm font-medium">{summary}</p>
                  )}
                  {diagnosis ? (
                    <LongText title="Diagnosis" body={diagnosis} />
                  ) : (
                    <p className="px-1 py-2 text-sm text-muted-foreground">No diagnosis yet.</p>
                  )}
                  {report ? (
                    <LongText title="Technician Report" body={report} />
                  ) : (
                    <p className="px-1 py-2 text-sm text-muted-foreground">No technician report yet.</p>
                  )}
                  {aiReport && <LongText title="AI Report" body={aiReport} />}
                </Card>
              </Section>

              <Section icon={ListChecks} title="Service Choices & Breakdown">
                <Card className="space-y-2.5 text-sm">
                  {service.approvedServices && service.approvedServices.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-success">Approved</p>
                      <ul className="list-disc space-y-0.5 pl-5">
                        {service.approvedServices.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {service.pendingServices && service.pendingServices.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-warning">Pending</p>
                      <ul className="list-disc space-y-0.5 pl-5">
                        {service.pendingServices.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {breakdowns.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-1">
                        {breakdowns.map((b: any) => (
                          <div key={b.id} className="flex justify-between gap-3">
                            <span className="min-w-0 truncate">{b.serviceName} — {b.technicianName}</span>
                            <span className="shrink-0 font-medium">
                              ₱{Number(b.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {!service.approvedServices?.length &&
                    !service.pendingServices?.length &&
                    !breakdowns.length && (
                      <p className="text-muted-foreground">No services recorded.</p>
                    )}
                </Card>
              </Section>

              <Section icon={Wallet} title="Charges & Payments">
                <ChargesBreakdown
                  serviceCost={service.serviceCost}
                  discount={service.discount}
                  finalCost={service.finalCost}
                  vatRequested={!!service.vatRequested}
                  initialPayment={service.initialPayment}
                  paymentStatus={service.paymentStatus}
                  serviceId={service.serviceId}
                />
                <Card className="space-y-2 text-sm">
                  <KV
                    label="Payments received"
                    value={`₱${(paymentsSummary?.transactionsPaid ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  />
                  <KV
                    label="Balance"
                    value={`₱${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  />
                  {paymentsSummary?.payments?.length ? (
                    <>
                      <Separator />
                      {paymentsSummary.payments.map((p) => (
                        <div key={p.id} className="flex justify-between gap-3 text-xs text-muted-foreground">
                          <span>{p.type}{p.paymentMethod ? ` · ${p.paymentMethod}` : ""}</span>
                          <span>₱{p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </>
                  ) : null}
                </Card>
              </Section>

              <Section icon={Images} title="Device Report Photos">
                <DeviceReportPhotos serviceId={service.serviceId} editable={false} />
              </Section>

              <Section icon={Images} title="Diagnosis Photos">
                <DiagnosisPhotos serviceId={service.serviceId} editable={false} />
              </Section>
            </>
          )}
        </div>

        <SheetFooter className="shrink-0 border-t border-border/60 px-6 py-3 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {serviceId && (
            <Button
              onClick={() => {
                onOpenChange(false);
                navigate(`/manage-client?serviceId=${encodeURIComponent(serviceId)}`);
              }}
            >
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Open in Manage Client
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default ServicePreviewSheet;
