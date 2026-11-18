import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { logActivityAsync } from "@/lib/activityLogger";
import { DEFAULT_TIMEFRAME, QUOTATION_REQUEST_OPTIONS, lineFromService, nextQuotationNo, quoteTotals, type QuotePayload } from "@/lib/companyQuotation";
import { generateCompanyQuotationPdf } from "@/lib/companyQuotationPdf";

export type CompanyTicket = {
  companyId: string; companyName: string; contactPerson: string | null; vatDefault: boolean;
  batchId: string | null; batchLabel: string | null; location: string | null;
  needsOwnQuote: boolean; quoteStatus: string;
};

export async function fetchCompanyTicket(serviceId: string): Promise<CompanyTicket | null> {
  const { data: s } = await supabase.from("services")
    .select("company_id,company_batch_id,company_location,needs_individual_quote,quotation_request_status")
    .eq("service_id", serviceId).maybeSingle();
  if (!s?.company_id) return null;
  const [{ data: c }, { data: b }] = await Promise.all([
    supabase.from("companies").select("name,contact_person,vat_default").eq("id", s.company_id).maybeSingle(),
    s.company_batch_id ? supabase.from("company_batches").select("label").eq("id", s.company_batch_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    companyId: s.company_id, companyName: c?.name ?? "Company", contactPerson: c?.contact_person ?? null, vatDefault: c?.vat_default ?? true,
    batchId: s.company_batch_id, batchLabel: (b as any)?.label ?? null, location: s.company_location,
    needsOwnQuote: !!s.needs_individual_quote, quoteStatus: s.quotation_request_status ?? "RFQ",
  };
}

/** Build the branded Company Quotation Form for one ticket from its saved breakdown. */
export async function buildCompanyTicketQuotation(serviceId: string, ct: CompanyTicket, actor: string): Promise<Blob> {
  const { data: s, error } = await supabase.from("services")
    .select("service_id,serial_number,brand,model,chief_complaint,issue_description,quoted_breakdown,diagnosis_warranty,service_cost,final_cost,vat_requested,repair_time_frame,discount")
    .eq("service_id", serviceId).single();
  if (error) throw error;
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const { count } = await supabase.from("company_quotations").select("id", { count: "exact", head: true }).gte("created_at", start.toISOString());
  const no = nextQuotationNo(now, count ?? 0);
  const payload: QuotePayload = {
    customerName: ct.contactPerson ?? "", companyName: ct.companyName, date: now.toISOString(),
    lines: [lineFromService(s as any)], timeframe: DEFAULT_TIMEFRAME,
    discount: Number((s as any).discount) || 0, vatIncluded: (s as any).vat_requested ?? ct.vatDefault, warranty: (s as any).diagnosis_warranty ?? "",
  };
  const bytes = await generateCompanyQuotationPdf(no, payload);
  const { error: insErr } = await supabase.from("company_quotations").insert({
    quotation_no: no, company_id: ct.companyId, service_ids: [serviceId], mode: "individual",
    payload: payload as any, final_amount: quoteTotals(payload).finalAmount, created_by_name: actor,
  });
  if (insErr) throw insErr;
  await supabase.from("services").update({ quotation_request_status: "Quotation Sent" }).eq("service_id", serviceId);
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

export function CompanyTicketPanel({ serviceId, canEdit, actor, refreshKey, onLoaded }: {
  serviceId: string; canEdit: boolean; actor: string; refreshKey?: unknown; onLoaded?: (ct: CompanyTicket | null) => void;
}) {
  const [ct, setCt] = useState<CompanyTicket | null>(null);
  const [batches, setBatches] = useState<{ id: string; label: string }[]>([]);
  const load = async () => {
    const v = await fetchCompanyTicket(serviceId);
    setCt(v); onLoaded?.(v);
    if (v && canEdit) {
      const { data } = await supabase.from("company_batches").select("id,label").eq("company_id", v.companyId).order("created_at", { ascending: false });
      setBatches(data ?? []);
    }
  };
  useEffect(() => { load(); }, [serviceId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ct) return null;

  const save = async (patch: Record<string, unknown>, label: string) => {
    const { error } = await supabase.from("services").update(patch as any).eq("service_id", serviceId);
    if (error) return toast.error(error.message);
    logActivityAsync({ serviceId, username: actor, role: "admin", activity: label, details: patch });
    load();
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <span className="font-semibold">Company repair</span>
        <Link to={`/company-repairs?company=${ct.companyId}`} className="text-primary hover:underline">{ct.companyName}</Link>
      </div>
      {canEdit ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={ct.batchId ?? "none"} onValueChange={(v) => save({ company_batch_id: v === "none" ? null : v }, "Company batch set")}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Batch" /></SelectTrigger>
            <SelectContent><SelectItem value="none">No batch</SelectItem>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="h-9" defaultValue={ct.location ?? ""} key={ct.location ?? ""} placeholder="Location / site"
            onBlur={(e) => e.target.value.trim() !== (ct.location ?? "") && save({ company_location: e.target.value.trim() || null }, "Company location set")} />
          <Select value={ct.quoteStatus} onValueChange={(v) => save({ quotation_request_status: v }, "Quotation request status set")}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{QUOTATION_REQUEST_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={ct.needsOwnQuote} onCheckedChange={(v) => save({ needs_individual_quote: !!v }, "Individual quotation flag set")} />Needs its own quotation
          </label>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">{[ct.batchLabel, ct.location, `Quote: ${ct.quoteStatus}`].filter(Boolean).join(" · ")}</div>
      )}
    </div>
  );
}
