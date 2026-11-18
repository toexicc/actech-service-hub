import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, ExternalLink, Loader2, Search } from "lucide-react";
import { isClosedStatus } from "@/lib/serviceStatus";
import { generateCompanyQuotationPdf } from "@/lib/companyQuotationPdf";
import { downloadPdfBytes } from "@/lib/pdfActions";
import type { QuotePayload } from "@/lib/companyQuotation";

type Portal = {
  company: { name: string; contact_person: string | null };
  batches: { id: string; label: string }[];
  services: { service_id: string; batch_id: string | null; location: string | null; serial_number: string | null; brand: string | null; model: string | null; issue: string | null; status: string; is_on_hold: boolean; quotation_status: string | null; total: number; date_received: string; date_completed: string | null }[];
  quotations: { id: string; quotation_no: string; service_ids: string[]; payload: QuotePayload; final_amount: number; created_at: string }[];
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
};
const peso = (n: number) => "₱" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });

export default function CompanyPortal() {
  const { token = "" } = useParams();
  const [data, setData] = useState<Portal | null | undefined>(undefined);
  const [tab, setTab] = useState<"ongoing" | "completed">("ongoing");
  const [batch, setBatch] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.rpc("public_company_portal" as any, { _token: token }).then(({ data, error }) => setData(error ? null : ((data as unknown as Portal) ?? null)));
  }, [token]);

  const rows = useMemo(() => (data?.services ?? []).filter((s) => {
    const closed = isClosedStatus(s.status);
    if ((tab === "ongoing") === closed) return false;
    if (batch !== "all" && s.batch_id !== batch) return false;
    const t = q.trim().toLowerCase();
    return !t || [s.service_id, s.serial_number, s.model, s.issue].join(" ").toLowerCase().includes(t);
  }), [data, tab, batch, q]);

  if (data === undefined) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (data === null) return <div className="min-h-screen grid place-items-center p-6 text-center text-muted-foreground">This link is not valid. Please ask AC Tech for a new one.</div>;

  const batchLabel = (id: string | null) => data.batches.find((b) => b.id === id)?.label ?? "";
  const ongoing = data.services.filter((s) => !isClosedStatus(s.status)).length;
  const dl = async (x: Portal["quotations"][number]) => downloadPdfBytes(await generateCompanyQuotationPdf(x.quotation_no, x.payload), `${x.quotation_no}.pdf`);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl p-4 md:p-8 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">AC Tech Repair · Company repairs</p>
          <h1 className="text-2xl font-bold">{data.company.name}</h1>
          <p className="text-sm text-muted-foreground">{ongoing} ongoing · {data.services.length - ongoing} completed</p>
        </div>

        <Card><CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}><TabsList><TabsTrigger value="ongoing">Ongoing</TabsTrigger><TabsTrigger value="completed">Completed</TabsTrigger></TabsList></Tabs>
            <Select value={batch} onValueChange={setBatch}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All batches</SelectItem>{data.batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}</SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search serial, model, ticket" /></div>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground"><tr>
                <th className="p-2 text-left">Ticket</th><th className="p-2 text-left">Batch</th><th className="p-2 text-left">Location</th><th className="p-2 text-left">Serial</th><th className="p-2 text-left">Model</th><th className="p-2 text-left min-w-[200px]">Issue</th><th className="p-2 text-left">Status</th><th className="p-2 text-right">Price</th><th className="p-2 text-left">Quotation</th>
              </tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Nothing here.</td></tr>}
                {rows.map((s) => {
                  const quote = data.quotations.find((x) => x.service_ids.includes(s.service_id));
                  return (
                    <tr key={s.service_id} className="border-t align-top">
                      <td className="p-2 whitespace-nowrap"><a className="inline-flex items-center gap-1 font-medium text-primary hover:underline" href={`/track/${s.service_id}`} target="_blank" rel="noreferrer">{s.service_id}<ExternalLink className="h-3 w-3" /></a><div className="text-xs text-muted-foreground">{fmtDate(s.date_received)}</div></td>
                      <td className="p-2 text-xs">{batchLabel(s.batch_id)}</td>
                      <td className="p-2">{s.location}</td>
                      <td className="p-2 font-mono text-xs">{s.serial_number}</td>
                      <td className="p-2">{[s.brand, s.model].filter(Boolean).join(" ")}</td>
                      <td className="p-2 text-xs whitespace-pre-line">{s.issue}</td>
                      <td className="p-2"><Badge variant="outline" className="whitespace-nowrap">{s.is_on_hold ? "On Hold" : s.status}</Badge></td>
                      <td className="p-2 text-right whitespace-nowrap">{s.total ? peso(s.total) : "—"}</td>
                      <td className="p-2">{quote ? <Button size="sm" variant="ghost" onClick={() => dl(quote)}><Download className="h-4 w-4 mr-1" />{quote.quotation_no}</Button> : <span className="text-xs text-muted-foreground">{s.quotation_status ?? "RFQ"}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
        <p className="text-xs text-muted-foreground text-center">Questions? Email actechrepairph@gmail.com</p>
      </div>
    </div>
  );
}
