import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, CheckCircle2, Clock, Download, ExternalLink, FileText, Laptop, Loader2, Mail, MapPin, Phone, Search, Wrench } from "lucide-react";
import { isClosedStatus } from "@/lib/serviceStatus";
import { generateCompanyQuotationPdf } from "@/lib/companyQuotationPdf";
import { downloadPdfBytes } from "@/lib/pdfActions";
import type { QuotePayload } from "@/lib/companyQuotation";
import { cn } from "@/lib/utils";
import logo from "@/assets/S_S_Marketing-2.png";

type Svc = { service_id: string; batch_id: string | null; location: string | null; serial_number: string | null; brand: string | null; model: string | null; issue: string | null; status: string; is_on_hold: boolean; quotation_status: string | null; total: number; date_received: string; date_completed: string | null };
type Portal = {
  company: { name: string; contact_person: string | null };
  batches: { id: string; label: string }[];
  services: Svc[];
  quotations: { id: string; quotation_no: string; service_ids: string[]; payload: QuotePayload; final_amount: number; created_at: string }[];
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
};
const peso = (n: number) => "₱" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });

/** Client-friendly stage for a ticket. */
const stageOf = (s: Svc): { label: string; tone: "muted" | "warn" | "info" | "ok" | "bad" } => {
  if (s.is_on_hold) return { label: "On Hold", tone: "warn" };
  const st = s.status || "";
  if (st === "Completed") return { label: "Completed", tone: "ok" };
  if (st.startsWith("RTO") || st === "Cancelled") return { label: "Returned unrepaired", tone: "bad" };
  if (st === "Done Repair - For Release" || st === "Done Repair - Advise Client") return { label: "Ready for release", tone: "ok" };
  if (st.startsWith("Done Repair")) return { label: "Testing", tone: "info" };
  if (st === "Proceed Repair" || st === "Ongoing Service" || st === "Backjob") return { label: "Repair in progress", tone: "info" };
  if (st === "Waiting to Proceed") return { label: s.quotation_status === "Quotation Sent" ? "Awaiting your approval" : "Quotation being prepared", tone: "warn" };
  return { label: "For diagnosis", tone: "muted" };
};
const TONE: Record<string, string> = {
  muted: "bg-muted text-muted-foreground border-border",
  warn: "bg-accent text-accent-foreground border-accent",
  info: "bg-primary/10 text-primary border-primary/20",
  ok: "bg-primary text-primary-foreground border-primary",
  bad: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function CompanyPortal() {
  const { token = "" } = useParams();
  const [data, setData] = useState<Portal | null | undefined>(undefined);
  const [tab, setTab] = useState<"ongoing" | "completed">("ongoing");
  const [batch, setBatch] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    document.title = "Company Repairs · AC Tech Repair PH";
    supabase.rpc("public_company_portal" as any, { _token: token }).then(({ data, error }) => setData(error ? null : ((data as unknown as Portal) ?? null)));
  }, [token]);

  const rows = useMemo(() => (data?.services ?? []).filter((s) => {
    const closed = isClosedStatus(s.status);
    if ((tab === "ongoing") === closed) return false;
    if (batch !== "all" && s.batch_id !== batch) return false;
    const t = q.trim().toLowerCase();
    return !t || [s.service_id, s.serial_number, s.model, s.issue, s.location].join(" ").toLowerCase().includes(t);
  }), [data, tab, batch, q]);

  if (data === undefined) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (data === null) return (
    <div className="min-h-screen grid place-items-center p-6">
      <Card className="max-w-sm rounded-2xl text-center"><CardContent className="space-y-3">
        <img src={logo} alt="AC Tech Repair PH" className="mx-auto h-14 w-14 object-contain" />
        <p className="font-semibold">This link is no longer valid</p>
        <p className="text-sm text-muted-foreground">Please ask AC Tech Repair for a new company link.</p>
      </CardContent></Card>
    </div>
  );

  const all = data.services;
  const ongoing = all.filter((s) => !isClosedStatus(s.status));
  const completed = all.length - ongoing.length;
  const awaiting = ongoing.filter((s) => stageOf(s).label === "Awaiting your approval").length;
  const ready = ongoing.filter((s) => stageOf(s).label === "Ready for release").length;
  const batchLabel = (id: string | null) => data.batches.find((b) => b.id === id)?.label ?? "—";
  const dl = async (x: Portal["quotations"][number]) => downloadPdfBytes(await generateCompanyQuotationPdf(x.quotation_no, x.payload), `${x.quotation_no}.pdf`);
  const quoteFor = (sid: string) => data.quotations.find((x) => x.service_ids.includes(sid));

  const batchStats = data.batches.map((b) => {
    const items = all.filter((s) => s.batch_id === b.id);
    const done = items.filter((s) => isClosedStatus(s.status)).length;
    return { ...b, total: items.length, done };
  }).filter((b) => b.total > 0);

  const stats = [
    { label: "Total devices", value: all.length, icon: Laptop },
    { label: "In progress", value: ongoing.length, icon: Wrench },
    { label: "Awaiting your approval", value: awaiting, icon: Clock },
    { label: "Ready for release", value: ready, icon: CheckCircle2 },
    { label: "Completed", value: completed, icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen w-full">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl space-y-6">
        {/* Hero — same look as /track */}
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[var(--shadow-float)]">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 80% at 0% 0%, hsl(var(--primary) / 0.10) 0%, transparent 60%), radial-gradient(ellipse 50% 70% at 100% 0%, hsl(var(--primary-glow) / 0.12) 0%, transparent 60%)" }} />
          <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-6 sm:p-8">
            <img src={logo} alt="AC Tech Repair PH" className="h-16 w-16 rounded-2xl object-contain bg-card p-1.5 border border-border/50 shadow-[var(--shadow-soft)]" />
            <div className="flex-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-2">
                <Building2 className="h-3.5 w-3.5" />Company Repairs
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{data.company.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {data.company.contact_person ? `${data.company.contact_person} · ` : ""}Live status of every device you sent to AC Tech Repair PH.
              </p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stats.map((s) => (
            <Card key={s.label} className="rounded-2xl border-border/60 shadow-[var(--shadow-soft)]">
              <CardContent className="flex items-center gap-3 p-4 sm:p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><s.icon className="h-5 w-5" /></div>
                <div className="min-w-0"><p className="text-2xl font-bold leading-none">{s.value}</p><p className="text-xs text-muted-foreground mt-1">{s.label}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Batches */}
        {batchStats.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {batchStats.map((b) => (
              <button key={b.id} onClick={() => setBatch(batch === b.id ? "all" : b.id)} className="text-left">
                <Card className={cn("rounded-2xl border-border/60 transition-colors hover:border-primary", batch === b.id && "border-primary ring-1 ring-primary")}>
                  <CardContent className="space-y-2 p-4 sm:p-4">
                    <div className="flex items-center justify-between gap-2"><p className="font-semibold text-sm">{b.label}</p><span className="text-xs text-muted-foreground whitespace-nowrap">{b.done}/{b.total} done</span></div>
                    <Progress value={(b.done / b.total) * 100} className="h-2" />
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}

        {/* Devices */}
        <Card className="rounded-2xl border-border/60 shadow-[var(--shadow-elegant)]">
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                <TabsList className="rounded-full h-10"><TabsTrigger className="rounded-full" value="ongoing">Ongoing ({ongoing.length})</TabsTrigger><TabsTrigger className="rounded-full" value="completed">Completed ({completed})</TabsTrigger></TabsList>
              </Tabs>
              <Select value={batch} onValueChange={setBatch}>
                <SelectTrigger className="w-full sm:w-60 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All batches</SelectItem>{data.batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}</SelectContent>
              </Select>
              <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9 rounded-xl" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search serial, model, ticket, location" /></div>
            </div>

            {rows.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No devices here yet.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((s) => {
                  const st = stageOf(s);
                  const quote = quoteFor(s.service_id);
                  return (
                    <div key={s.service_id} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3 shadow-[var(--shadow-soft)]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold leading-tight">{[s.brand, s.model].filter(Boolean).join(" ") || "Device"}</p>
                          <p className="font-mono text-xs text-muted-foreground mt-0.5">S/N {s.serial_number || "—"}</p>
                        </div>
                        <span className={cn("shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium", TONE[st.tone])}>{st.label}</span>
                      </div>
                      {s.issue && <p className="text-sm text-foreground/80 whitespace-pre-line line-clamp-3">{s.issue}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{batchLabel(s.batch_id)}</span>
                        {s.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{s.location}</span>}
                        <span>Received {fmtDate(s.date_received)}</span>
                        {s.date_completed && <span>Done {fmtDate(s.date_completed)}</span>}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Quoted</p>
                          <p className="font-semibold">{s.total ? peso(s.total) : "Pending"}</p>
                        </div>
                        <div className="flex gap-1.5">
                          {quote && <Button size="sm" variant="outline" className="rounded-full" onClick={() => dl(quote)}><Download className="h-3.5 w-3.5 mr-1" />{quote.quotation_no}</Button>}
                          <Button size="sm" variant="ghost" className="rounded-full" asChild>
                            <a href={`/track/${s.service_id}`} target="_blank" rel="noreferrer">{s.service_id}<ExternalLink className="h-3.5 w-3.5 ml-1" /></a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quotations */}
        {data.quotations.length > 0 && (
          <Card className="rounded-2xl border-border/60">
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4 text-primary" />Quotations & billing statements</div>
              <div className="divide-y">
                {data.quotations.map((x) => (
                  <div key={x.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                    <span className="font-medium">{x.quotation_no}</span>
                    <Badge variant="secondary">{x.service_ids.length} device{x.service_ids.length > 1 ? "s" : ""}</Badge>
                    <span className="text-muted-foreground">{fmtDate(x.created_at)}</span>
                    <span className="ml-auto font-semibold">{peso(x.final_amount)}</span>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => dl(x)}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact */}
        <div className="rounded-2xl bg-primary text-primary-foreground p-5 grid gap-3 sm:grid-cols-3 text-sm">
          <a href="tel:09456479905" className="inline-flex items-center gap-2"><Phone className="h-4 w-4" />0945 647 9905</a>
          <a href="mailto:actechrepairph@gmail.com" className="inline-flex items-center gap-2"><Mail className="h-4 w-4" />actechrepairph@gmail.com</a>
          <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" />Unit 103, FBR Arcade, Katipunan Ave, QC</span>
        </div>
      </div>
    </div>
  );
}
