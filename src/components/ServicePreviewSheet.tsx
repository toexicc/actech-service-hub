import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapServiceRow } from "@/hooks/useServices";
import { useServicePayments } from "@/hooks/useServicePayments";
import { useServiceBreakdowns } from "@/hooks/useServiceBreakdowns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, ExternalLink, User, Smartphone, FileText, Stethoscope, Wrench, ListChecks, Wallet } from "lucide-react";
import { TicketFlagChips } from "@/components/workspace/TicketFlagChips";
import { ChargesBreakdown } from "@/components/workspace/ChargesBreakdown";
import { DeviceReportPhotos } from "@/components/DeviceReportPhotos";
import { DiagnosisPhotos } from "@/components/DiagnosisPhotos";
import { displayDate } from "@/lib/timezone";

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

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right break-words min-w-0">{value}</span>
    </div>
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!flex w-full flex-col sm:max-w-xl p-0 overflow-hidden"
      >
        <SheetHeader className="shrink-0 border-b border-border/60 px-6 py-4 text-left">
          <SheetTitle className="font-mono text-lg">{serviceId}</SheetTitle>
          <SheetDescription>
            {service ? (
              <span className="flex flex-col gap-1">
                <span className="text-foreground font-medium">
                  {textOr(service.clientName)} — {textOr(service.status)}
                </span>
                <TicketFlagChips service={service} />
              </span>
            ) : (
              "Ticket preview"
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
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
              <Section icon={User} title="Client">
                <div className="rounded-lg border border-border/60 p-3 space-y-1.5">
                  <KV label="Name" value={textOr(service.clientName)} />
                  <KV label="Contact" value={textOr(service.contactNumber)} />
                  <KV label="Email" value={textOr((service as any).email)} />
                  <KV label="Client Type" value={textOr((service as any).clientType)} />
                </div>
              </Section>

              <Section icon={Smartphone} title="Device">
                <div className="rounded-lg border border-border/60 p-3 space-y-1.5">
                  <KV label="Device" value={textOr(device)} />
                  <KV label="Color / Memory" value={textOr([service.color, service.memory].filter(Boolean).join(" / "))} />
                  <KV label="Serial" value={textOr(service.serialNumber)} />
                </div>
              </Section>

              <Section icon={FileText} title="Complaint & Issue">
                <div className="rounded-lg border border-border/60 p-3 space-y-2 text-sm">
                  <p className="font-medium">{textOr(service.chiefComplaint, "No chief complaint recorded.")}</p>
                  {textOr(service.issueDescription, "") && (
                    <p className="text-muted-foreground whitespace-pre-wrap">{service.issueDescription}</p>
                  )}
                  <Separator />
                  <KV label="Received" value={service.dateReceived ? displayDate(service.dateReceived, "MMM dd, yyyy") : "—"} />
                  <KV label="Target" value={service.targetDate ? displayDate(service.targetDate, "MMM dd, yyyy") : textOr(service.estimatedCompletion)} />
                  <KV label="Technician" value={textOr(service.technician)} />
                </div>
              </Section>

              <Section icon={Stethoscope} title="Diagnosis & Reports">
                <div className="rounded-lg border border-border/60 p-3 space-y-3 text-sm">
                  {textOr(service.diagnosisSummary, "") && <p>{service.diagnosisSummary}</p>}
                  {textOr(service.technicianDiagnosis || service.diagnosis, "") ? (
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {service.technicianDiagnosis || service.diagnosis}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">No diagnosis yet.</p>
                  )}
                  {textOr(service.technicianReport, "") && (
                    <>
                      <Separator />
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Technician Report</p>
                      <p className="whitespace-pre-wrap">{service.technicianReport}</p>
                    </>
                  )}
                  {textOr(service.aiReport, "") && (
                    <>
                      <Separator />
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI Report</p>
                      <p className="whitespace-pre-wrap text-muted-foreground">{service.aiReport}</p>
                    </>
                  )}
                </div>
              </Section>

              <Section icon={ListChecks} title="Service Choices & Breakdown">
                <div className="rounded-lg border border-border/60 p-3 space-y-2 text-sm">
                  {service.approvedServices && service.approvedServices.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-success mb-1">Approved</p>
                      <ul className="list-disc pl-5 space-y-0.5">
                        {service.approvedServices.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {service.pendingServices && service.pendingServices.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-warning mb-1">Pending</p>
                      <ul className="list-disc pl-5 space-y-0.5">
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
                  {(!service.approvedServices?.length && !service.pendingServices?.length && !breakdowns.length) && (
                    <p className="text-muted-foreground">No services recorded.</p>
                  )}
                </div>
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
                <div className="rounded-lg border border-border/60 p-3 text-sm space-y-1.5">
                  <KV label="Payments received" value={`₱${(paymentsSummary?.transactionsPaid ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                  <KV label="Balance" value={`₱${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
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
                </div>
              </Section>

              <Section icon={Wrench} title="Photos">
                <DeviceReportPhotos serviceId={service.serviceId} editable={false} />
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
