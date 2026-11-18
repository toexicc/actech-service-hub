import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type CompanyRecord = {
  id: string; name: string; contact_person: string | null; contact_number: string | null;
  email: string | null; billing_address: string | null; vat_default: boolean;
};
export type CompanyIntake = { companyId: string; batchId: string; newBatch: string; location: string };
export const emptyCompanyIntake = (): CompanyIntake => ({ companyId: "", batchId: "none", newBatch: "", location: "" });

/** Resolve the batch choice to an id, creating a new batch when needed. */
export async function resolveCompanyBatch(v: CompanyIntake): Promise<string | null> {
  if (v.batchId === "new") {
    const label = v.newBatch.trim();
    if (!label) return null;
    const { data, error } = await supabase.from("company_batches")
      .insert({ company_id: v.companyId, label, received_date: new Date().toISOString().slice(0, 10) })
      .select("id").single();
    if (error) throw error;
    return data.id;
  }
  return v.batchId && v.batchId !== "none" ? v.batchId : null;
}

export function CompanyIntakeFields({ value, onChange, onCompanyPicked }: {
  value: CompanyIntake;
  onChange: (v: CompanyIntake) => void;
  onCompanyPicked?: (c: CompanyRecord) => void;
}) {
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [batches, setBatches] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    supabase.from("companies").select("id,name,contact_person,contact_number,email,billing_address,vat_default").order("name")
      .then(({ data }) => setCompanies((data as CompanyRecord[]) ?? []));
  }, []);
  useEffect(() => {
    if (!value.companyId) { setBatches([]); return; }
    supabase.from("company_batches").select("id,label").eq("company_id", value.companyId).order("created_at", { ascending: false })
      .then(({ data }) => setBatches(data ?? []));
  }, [value.companyId]);
  // Prefill contact details when the company arrives via the link.
  useEffect(() => {
    const c = companies.find((x) => x.id === value.companyId);
    if (c) onCompanyPicked?.(c);
  }, [companies, value.companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 md:col-span-2 md:grid-cols-3">
      <div className="space-y-1">
        <Label>Company</Label>
        <Select value={value.companyId} onValueChange={(id) => onChange({ ...value, companyId: id, batchId: "none" })}>
          <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
          <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Batch</Label>
        <Select value={value.batchId} onValueChange={(b) => onChange({ ...value, batchId: b })} disabled={!value.companyId}>
          <SelectTrigger><SelectValue placeholder="No batch" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No batch</SelectItem>
            <SelectItem value="new">+ New batch</SelectItem>
            {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {value.batchId === "new" && (
          <Input value={value.newBatch} onChange={(e) => onChange({ ...value, newBatch: e.target.value })} placeholder="e.g. Faulty Devices - 11/18/2026" />
        )}
      </div>
      <div className="space-y-1">
        <Label>Location / site</Label>
        <Input value={value.location} onChange={(e) => onChange({ ...value, location: e.target.value })} placeholder="e.g. PDM" />
      </div>
    </div>
  );
}
