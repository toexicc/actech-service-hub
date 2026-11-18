import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Building2, Copy, Download, FileText, Plus, RefreshCw, Search } from "lucide-react";
import { DEVICE_TYPES } from "@/lib/constants";
import { isClosedStatus } from "@/lib/serviceStatus";
import { lineFromService, nextQuotationNo, quoteTotals, QUOTATION_REQUEST_OPTIONS, type QuoteLine, type QuotePayload } from "@/lib/companyQuotation";
import { generateCompanyQuotationPdf } from "@/lib/companyQuotationPdf";
import { downloadPdfBytes } from "@/lib/pdfActions";
import { QuotationDialog, type QuoteMode } from "@/components/company/QuotationDialog";
import { logActivityAsync } from "@/lib/activityLogger";

type Company = {
  id: string; name: string; contact_person: string | null; contact_number: string | null; email: string | null;
  billing_address: string | null; tin: string | null; vat_default: boolean; notes: string | null; public_token: string;
};
type Batch = { id: string; company_id: string; label: string; received_date: string | null };
type Svc = Record<string, any> & { service_id: string };
type Quote = { id: string; quotation_no: string; service_ids: string[]; payload: QuotePayload; final_amount: number; created_at: string; created_by_name: string | null };

const SERVICE_COLS = "service_id,company_id,company_batch_id,company_location,needs_individual_quote,quotation_request_status,serial_number,brand,model,device_type,chief_complaint,issue_description,quoted_breakdown,diagnosis_warranty,service_cost,final_cost,status,is_on_hold,technicians,date_received,date_completed";

const fmtDate = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
};
const peso = (n: number) => "₱" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });
const emptyCompany = { name: "", contact_person: "", contact_number: "", email: "", billing_address: "", tin: "", vat_default: true, notes: "" };

export default function CompanyRepairs() {
  const { isAdminOrManagement, isTechnician, profile } = useAuth();
  const canManage = isAdminOrManagement;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const companyId = params.get("company");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [services, setServices] = useState<Svc[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  const [companyForm, setCompanyForm] = useState<typeof emptyCompany & { id?: string }>(emptyCompany);
  const [companyOpen, setCompanyOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, s, b] = await Promise.all([
      supabase.from("companies").select("*").order("name"),
      supabase.from("services").select(SERVICE_COLS).not("company_id", "is", null).order("date_received", { ascending: false }).limit(1000),
      supabase.from("company_batches").select("*").order("created_at", { ascending: false }),
    ]);
    if (c.error || s.error) toast.error("Could not load company repairs");
    setCompanies((c.data as Company[]) ?? []);
    setServices((s.data as Svc[]) ?? []);
    setBatches((b.data as Batch[]) ?? []);
    if (companyId) {
      const q = await supabase.from("company_quotations").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
      setQuotes((q.data as unknown as Quote[]) ?? []);
    }
    setLoading(false);
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const saveCompany = async () => {
    if (!companyForm.name.trim()) return toast.error("Company name is required");
    const { id, ...row } = companyForm;
    const res = id
      ? await supabase.from("companies").update(row).eq("id", id)
      : await supabase.from("companies").insert({ ...row, created_by: profile?.id ?? null });
    if (res.error) return toast.error(res.error.message);
    toast.success("Company saved");
    setCompanyOpen(false);
    load();
  };

  const company = companies.find((c) => c.id === companyId);

  if (!companyId || !company) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Company Repairs</h1>
            <p className="text-sm text-muted-foreground">Bulk repairs for companies. Each device is still its own ticket.</p>
          </div>
          {canManage && <Button onClick={() => { setCompanyForm(emptyCompany); setCompanyOpen(true); }}><Plus className="h-4 w-4 mr-1" />New company</Button>}
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : companies.length === 0 ? (
          <Card><CardContent className="text-sm text-muted-foreground">No companies yet.</CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => {
              const mine = services.filter((s) => s.company_id === c.id);
              const ongoing = mine.filter((s) => !isClosedStatus(s.status)).length;
              const rfq = mine.filter((s) => (s.quotation_request_status ?? "RFQ") === "RFQ" && !isClosedStatus(s.status)).length;
              if (isTechnician && !canManage && mine.length === 0) return null;
              return (
                <button key={c.id} className="text-left" onClick={() => setParams({ company: c.id })}>
                  <Card className="hover:border-primary transition-colors h-full">
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 font-semibold"><Building2 className="h-4 w-4" />{c.name}</div>
                      {c.contact_person && <p className="text-xs text-muted-foreground">{c.contact_person}</p>}
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary">{ongoing} ongoing</Badge>
                        <Badge variant="outline">{mine.length - ongoing} completed</Badge>
                        {rfq > 0 && <Badge>{rfq} awaiting quotation</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>
        )}
        <CompanyDialog open={companyOpen} onOpenChange={setCompanyOpen} form={companyForm} setForm={setCompanyForm} onSave={saveCompany} />
      </div>
    );
  }

  return (
    <CompanyDetail
      company={company}
      services={services.filter((s) => s.company_id === company.id)}
      batches={batches.filter((b) => b.company_id === company.id)}
      quotes={quotes}
      canManage={canManage}
      profileName={profile?.name ?? ""}
      onBack={() => setParams({})}
      onEdit={() => { setCompanyForm({ ...emptyCompany, ...(company as any) }); setCompanyOpen(true); }}
      reload={load}
      openTicket={(id) => navigate(canManage ? `/manage-client?serviceId=${encodeURIComponent(id)}` : `/service-update?serviceId=${encodeURIComponent(id)}`)}
      extra={<CompanyDialog open={companyOpen} onOpenChange={setCompanyOpen} form={companyForm} setForm={setCompanyForm} onSave={saveCompany} />}
    />
  );
}

function CompanyDialog({ open, onOpenChange, form, setForm, onSave }: any) {
  const f = (k: string) => ({ value: form[k] ?? "", onChange: (e: any) => setForm({ ...form, [k]: e.target.value }) });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg !flex !flex-col max-h-[95dvh]">
        <DialogHeader className="shrink-0"><DialogTitle>{form.id ? "Edit company" : "New company"}</DialogTitle></DialogHeader>
        <div className="overflow-y-auto grid gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Company name *</Label><Input {...f("name")} placeholder="Shopee Philippines Inc." /></div>
          <div><Label>Contact person</Label><Input {...f("contact_person")} /></div>
          <div><Label>Contact number</Label><Input {...f("contact_number")} /></div>
          <div><Label>Email</Label><Input {...f("email")} /></div>
          <div><Label>TIN</Label><Input {...f("tin")} /></div>
          <div className="sm:col-span-2"><Label>Billing address</Label><Input {...f("billing_address")} /></div>
          <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={2} {...f("notes")} /></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={form.vat_default} onCheckedChange={(v) => setForm({ ...form, vat_default: v })} />Show VAT on quotations</label>
        </div>
        <DialogFooter className="shrink-0"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={onSave}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompanyDetail({ company, services, batches, quotes, canManage, profileName, onBack, onEdit, reload, openTicket, extra }: {
  company: Company; services: Svc[]; batches: Batch[]; quotes: Quote[]; canManage: boolean; profileName: string;
  onBack: () => void; onEdit: () => void; reload: () => void; openTicket: (id: string) => void; extra: React.ReactNode;
}) {
  const [tab, setTab] = useState<"ongoing" | "completed" | "all">("ongoing");
  const [batchFilter, setBatchFilter] = useState("all");
  const [locFilter, setLocFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const locations = useMemo(() => [...new Set(services.map((s) => s.company_location).filter(Boolean))] as string[], [services]);
  const batchLabel = (id?: string | null) => batches.find((b) => b.id === id)?.label ?? "";
  const quoteFor = (sid: string) => quotes.find((q) => q.service_ids.includes(sid));

  const rows = services.filter((s) => {
    const closed = isClosedStatus(s.status);
    if (tab === "ongoing" && closed) return false;
    if (tab === "completed" && !closed) return false;
    if (batchFilter !== "all" && s.company_batch_id !== batchFilter) return false;
    if (locFilter !== "all" && s.company_location !== locFilter) return false;
    const q = search.trim().toLowerCase();
    if (q && ![s.service_id, s.serial_number, s.model, s.brand, s.chief_complaint].join(" ").toLowerCase().includes(q)) return false;
    return true;
  });

  const shareUrl = `https://actechrepair-service.com/company/${company.public_token}`;
  const regenerate = async () => {
    if (!confirm("Make a new link? The old link will stop working.")) return;
    const token = Array.from(crypto.getRandomValues(new Uint8Array(18))).map((b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabase.from("companies").update({ public_token: token }).eq("id", company.id);
    if (error) return toast.error(error.message);
    toast.success("New link created"); reload();
  };

  const updateSvc = async (ids: string[], patch: Record<string, unknown>, label: string) => {
    const { error } = await supabase.from("services").update(patch as any).in("service_id", ids);
    if (error) return toast.error(error.message);
    ids.forEach((id) => logActivityAsync({ serviceId: id, username: profileName, role: canManage ? "admin" : "technician", activity: label, details: patch }));
    reload();
  };

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectedRows = services.filter((s) => selected.has(s.service_id));
  const initialLines = useMemo<QuoteLine[]>(() => selectedRows.map(lineFromService), [quoteOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async (mode: QuoteMode, base: Omit<QuotePayload, "lines">, lines: QuoteLine[]) => {
    setBusy(true);
    try {
      const now = new Date();
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      const { count } = await supabase.from("company_quotations").select("id", { count: "exact", head: true }).gte("created_at", start.toISOString());
      let n = count ?? 0;
      const groups = mode === "combined" ? [lines] : lines.map((l) => [l]);
      for (const g of groups) {
        const payload: QuotePayload = { ...base, lines: g };
        const no = nextQuotationNo(now, n++);
        const { error } = await supabase.from("company_quotations").insert({
          quotation_no: no, company_id: company.id, service_ids: g.map((l) => l.serviceId), mode,
          payload: payload as any, final_amount: quoteTotals(payload).finalAmount, created_by_name: profileName,
        });
        if (error) throw error;
        const bytes = await generateCompanyQuotationPdf(no, payload);
        downloadPdfBytes(bytes, `${no} ${company.name}.pdf`);
      }
      await updateSvc(lines.map((l) => l.serviceId), { quotation_request_status: "Quotation Sent" }, "Company quotation generated");
      toast.success(`${groups.length} document${groups.length > 1 ? "s" : ""} generated`);
      setQuoteOpen(false); setSelected(new Set());
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate quotation");
    } finally { setBusy(false); }
  };

  const downloadQuote = async (q: Quote) => downloadPdfBytes(await generateCompanyQuotationPdf(q.quotation_no, q.payload), `${q.quotation_no} ${company.name}.pdf`);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Companies</Button>
        <h1 className="text-2xl font-bold flex-1 min-w-0">{company.name}</h1>
        {canManage && <Button variant="outline" size="sm" onClick={onEdit}>Edit company</Button>}
        {canManage && <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" />Add devices</Button>}
      </div>

      {canManage && (
        <Card><CardContent className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Client link:</span>
          <code className="truncate max-w-full flex-1 rounded bg-muted px-2 py-1 text-xs">{shareUrl}</code>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Link copied"); }}><Copy className="h-4 w-4 mr-1" />Copy</Button>
          <Button size="sm" variant="ghost" onClick={regenerate}><RefreshCw className="h-4 w-4 mr-1" />New link</Button>
        </CardContent></Card>
      )}

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList><TabsTrigger value="ongoing">Ongoing</TabsTrigger><TabsTrigger value="completed">Completed</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList>
            </Tabs>
            <Select value={batchFilter} onValueChange={setBatchFilter}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Batch" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All batches</SelectItem>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={locFilter} onValueChange={setLocFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All locations</SelectItem>{locations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search serial, model, ticket, issue" />
            </div>
          </div>

          {canManage && selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-2 text-sm">
              <span className="font-medium">{selected.size} selected</span>
              <Button size="sm" onClick={() => setQuoteOpen(true)}><FileText className="h-4 w-4 mr-1" />Generate quotation</Button>
              <Select onValueChange={(v) => updateSvc([...selected], { company_batch_id: v }, "Company batch set")}>
                <SelectTrigger className="w-48 h-8"><SelectValue placeholder="Move to batch" /></SelectTrigger>
                <SelectContent>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select onValueChange={(v) => updateSvc([...selected], { quotation_request_status: v }, "Quotation request status set")}>
                <SelectTrigger className="w-44 h-8"><SelectValue placeholder="Set quotation status" /></SelectTrigger>
                <SelectContent>{QUOTATION_REQUEST_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          )}

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  {canManage && <th className="p-2 w-8"><Checkbox checked={rows.length > 0 && rows.every((r) => selected.has(r.service_id))} onCheckedChange={(v) => setSelected(v ? new Set(rows.map((r) => r.service_id)) : new Set())} aria-label="Select all" /></th>}
                  <th className="p-2 text-left">Ticket</th><th className="p-2 text-left">Batch</th><th className="p-2 text-left">Location</th>
                  <th className="p-2 text-left">Serial</th><th className="p-2 text-left">Model</th><th className="p-2 text-left min-w-[200px]">Issue reported</th>
                  <th className="p-2 text-left min-w-[160px]">Parts / cost</th><th className="p-2 text-right">Total</th>
                  <th className="p-2 text-center">Own quote</th><th className="p-2 text-left">Quotation</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Document</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={13} className="p-6 text-center text-muted-foreground">No devices here.</td></tr>}
                {rows.map((s) => {
                  const line = lineFromService(s as any);
                  const total = Number(s.final_cost) || Number(s.service_cost) || 0;
                  const q = quoteFor(s.service_id);
                  return (
                    <tr key={s.service_id} className="border-t align-top">
                      {canManage && <td className="p-2"><Checkbox checked={selected.has(s.service_id)} onCheckedChange={() => toggle(s.service_id)} aria-label={`Select ${s.service_id}`} /></td>}
                      <td className="p-2 whitespace-nowrap"><button className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => openTicket(s.service_id)}>{s.service_id}</button><div className="text-xs text-muted-foreground">{fmtDate(s.date_received)}</div></td>
                      <td className="p-2 text-xs">{batchLabel(s.company_batch_id)}</td>
                      <td className="p-2">{canManage ? (
                        <Input className="h-8 w-20" defaultValue={s.company_location ?? ""} onBlur={(e) => e.target.value !== (s.company_location ?? "") && updateSvc([s.service_id], { company_location: e.target.value || null }, "Company location set")} />
                      ) : s.company_location}</td>
                      <td className="p-2 font-mono text-xs">{s.serial_number}</td>
                      <td className="p-2">{[s.brand, s.model].filter(Boolean).join(" ")}</td>
                      <td className="p-2 text-xs whitespace-pre-line">{s.chief_complaint || s.issue_description}</td>
                      <td className="p-2 text-xs">{line.solutions.map((x, i) => <div key={i}>{x.name} – {peso(x.cost)}</div>)}</td>
                      <td className="p-2 text-right whitespace-nowrap">{peso(total)}</td>
                      <td className="p-2 text-center"><Checkbox disabled={!canManage} checked={!!s.needs_individual_quote} onCheckedChange={(v) => updateSvc([s.service_id], { needs_individual_quote: !!v }, "Individual quotation flag set")} aria-label="Requires individual quotation" /></td>
                      <td className="p-2">{canManage ? (
                        <Select value={s.quotation_request_status ?? "RFQ"} onValueChange={(v) => updateSvc([s.service_id], { quotation_request_status: v }, "Quotation request status set")}>
                          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>{QUOTATION_REQUEST_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (s.quotation_request_status ?? "RFQ")}</td>
                      <td className="p-2 text-xs"><Badge variant="outline" className="whitespace-nowrap">{s.status}</Badge>{s.is_on_hold && <Badge className="ml-1">On Hold</Badge>}</td>
                      <td className="p-2">{q && <Button size="sm" variant="ghost" onClick={() => downloadQuote(q)}><Download className="h-4 w-4 mr-1" />{q.quotation_no}</Button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {quotes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Quotations</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {quotes.map((q) => (
              <div key={q.id} className="flex flex-wrap items-center gap-2 text-sm border-b last:border-0 py-1.5">
                <span className="font-medium">{q.quotation_no}</span>
                <span className="text-muted-foreground">{fmtDate(q.created_at)} · {q.service_ids.length} device(s) · {peso(q.final_amount)}{q.created_by_name ? ` · ${q.created_by_name}` : ""}</span>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => downloadQuote(q)}><Download className="h-4 w-4 mr-1" />Download</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canManage && <AddDevicesDialog open={addOpen} onOpenChange={setAddOpen} company={company} batches={batches} profileName={profileName} onDone={reload} />}
      {canManage && <QuotationDialog open={quoteOpen} onOpenChange={setQuoteOpen} companyName={company.name} defaultCustomer={company.contact_person ?? ""} vatDefault={company.vat_default} initialLines={initialLines} busy={busy} onGenerate={generate} />}
      {extra}
    </div>
  );
}

type DraftRow = { serial: string; brand: string; model: string; issue: string; location: string };
const blankRow = (): DraftRow => ({ serial: "", brand: "", model: "", issue: "", location: "" });

function AddDevicesDialog({ open, onOpenChange, company, batches, profileName, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void; company: Company; batches: Batch[]; profileName: string; onDone: () => void;
}) {
  const [batchId, setBatchId] = useState("new");
  const [batchName, setBatchName] = useState("");
  const [deviceType, setDeviceType] = useState<string>("");
  const [rows, setRows] = useState<DraftRow[]>([blankRow()]);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setRows([blankRow()]); setPaste(""); setBatchId("new"); setBatchName(`Faulty Devices - ${fmtDate(new Date().toISOString())}`); }
  }, [open]);

  const applyPaste = () => {
    const parsed = paste.split(/\r?\n/).map((l) => l.split("\t")).filter((c) => c.some((x) => x.trim()))
      .map(([serial = "", model = "", issue = "", location = ""]) => ({ serial: serial.trim(), brand: "", model: model.trim(), issue: issue.trim(), location: location.trim() }));
    if (parsed.length) { setRows(parsed); setPaste(""); }
  };
  const patch = (i: number, p: Partial<DraftRow>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)));

  const submit = async () => {
    const good = rows.filter((r) => r.serial || r.model || r.issue);
    if (!good.length) return toast.error("Add at least one device");
    if (!deviceType) return toast.error("Pick a device type");
    setBusy(true);
    try {
      let bid = batchId;
      if (bid === "new") {
        const { data, error } = await supabase.from("company_batches").insert({ company_id: company.id, label: batchName || "Batch", received_date: new Date().toISOString().slice(0, 10) }).select("id").single();
        if (error) throw error;
        bid = data.id;
      }
      let made = 0;
      for (const r of good) {
        const { data: sid, error } = await supabase.rpc("create_service_atomic", {
          _payload: {
            client_name: company.name, contact_number: company.contact_number ?? "", email: company.email ?? "",
            address: company.billing_address ?? "", client_type: "Company", device_type: deviceType,
            brand: r.brand, model: r.model, serial_number: r.serial, chief_complaint: r.issue, issue_description: r.issue,
            receiving_staff: profileName, source: "Company Repairs", priority: "Normal",
          },
        });
        if (error) throw error;
        await supabase.from("services").update({ company_id: company.id, company_batch_id: bid, company_location: r.location || null, quotation_request_status: "RFQ" }).eq("service_id", sid as string);
        made++;
      }
      toast.success(`${made} ticket${made > 1 ? "s" : ""} created`);
      onOpenChange(false); onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not add devices");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl !flex !flex-col max-h-[95dvh]">
        <DialogHeader className="shrink-0"><DialogTitle>Add devices — {company.name}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div><Label>Batch</Label>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="new">New batch…</SelectItem>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {batchId === "new" && <div><Label>Batch name</Label><Input value={batchName} onChange={(e) => setBatchName(e.target.value)} /></div>}
            <div><Label>Device type</Label>
              <Select value={deviceType} onValueChange={setDeviceType}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{DEVICE_TYPES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Paste from spreadsheet (Serial, Model, Issue, Location columns)</Label>
            <div className="flex gap-2"><Textarea rows={2} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Copy rows from Sheets and paste here" /><Button variant="outline" onClick={applyPaste} disabled={!paste.trim()}>Use rows</Button></div>
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid gap-2 grid-cols-2 sm:grid-cols-[1fr_0.8fr_1fr_2fr_0.6fr]">
                <Input value={r.serial} onChange={(e) => patch(i, { serial: e.target.value })} placeholder="Serial" />
                <Input value={r.brand} onChange={(e) => patch(i, { brand: e.target.value })} placeholder="Brand" />
                <Input value={r.model} onChange={(e) => patch(i, { model: e.target.value })} placeholder="Model" />
                <Input value={r.issue} onChange={(e) => patch(i, { issue: e.target.value })} placeholder="Issue reported" />
                <Input value={r.location} onChange={(e) => patch(i, { location: e.target.value })} placeholder="Location" />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setRows((r) => [...r, blankRow()])}><Plus className="h-4 w-4 mr-1" />Row</Button>
          </div>
          <p className="text-xs text-muted-foreground">Each device becomes its own ticket. Assign technicians from Manage Client as usual.</p>
        </div>
        <DialogFooter className="shrink-0"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={busy} onClick={submit}>{busy ? "Creating…" : `Create ${rows.filter((r) => r.serial || r.model || r.issue).length} ticket(s)`}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
