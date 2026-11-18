import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DEVICE_TYPES, DEVICE_TYPES_BY_DEPARTMENT, TIME_FRAME_OPTIONS } from "@/lib/constants";
import { useStaff } from "@/hooks/useStaff";
import { useStaffAvailability } from "@/hooks/useStaffAvailability";
import { fetchTodayAssignments, manilaDayNumber, pickRoundRobin } from "@/lib/techRotation";
import { notifyNewServiceAssignment } from "@/lib/serviceNotifications";
import { logActivityAsync } from "@/lib/activityLogger";

type Company = { id: string; name: string; contact_person: string | null; contact_number: string | null; email: string | null; billing_address: string | null; vat_default: boolean };
type Row = { brand: string; model: string; serial: string; location: string; issue: string };
const blank = (location = ""): Row => ({ brand: "", model: "", serial: "", location, issue: "" });
const today = () => { const d = new Date(); return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`; };

/** Multi-device intake for one company. Uses the same ticket creation and technician rotation as the normal intake form. */
export function CompanyIntakeDialog({ open, onOpenChange, company, batches, actor, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void; company: Company; batches: { id: string; label: string }[]; actor: string; onDone: () => void;
}) {
  const { data: staff = [] } = useStaff();
  const { data: availability } = useStaffAvailability();
  const [batchId, setBatchId] = useState("new");
  const [batchName, setBatchName] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [dept, setDept] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [timeFrame, setTimeFrame] = useState("");
  const [defaultLoc, setDefaultLoc] = useState("");
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBatchId("new"); setBatchName(`Faulty Devices - ${today()}`); setRows([blank()]); setPaste(""); setDefaultLoc("");
  }, [open]);

  const depts = useMemo(() => Object.entries(DEVICE_TYPES_BY_DEPARTMENT).filter(([, t]) => t.includes(deviceType)).map(([d]) => d), [deviceType]);
  useEffect(() => { setDept(depts[0] ?? ""); }, [depts]);
  const pool = useMemo(() => staff.filter((s: any) =>
    s.role?.toLowerCase() === "technician" && s.status?.toLowerCase() !== "inactive" && s.department === dept && availability?.isAvailable(s.name),
  ).map((s: any) => s.name as string), [staff, dept, availability]);

  const patch = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const applyPaste = () => {
    const parsed = paste.split(/\r?\n/).map((l) => l.split("\t")).filter((c) => c.some((x) => x.trim()))
      .map(([serial = "", model = "", issue = "", location = ""]) => ({ brand: "", serial: serial.trim(), model: model.trim(), issue: issue.trim(), location: location.trim() || defaultLoc }));
    if (parsed.length) { setRows((r) => [...r.filter((x) => x.model || x.serial || x.issue), ...parsed]); setPaste(""); }
  };

  const submit = async () => {
    const good = rows.filter((r) => r.model.trim() || r.serial.trim() || r.issue.trim());
    if (!good.length) return toast.error("Add at least one device");
    if (!deviceType) return toast.error("Pick the device type");
    if (good.some((r) => !r.issue.trim())) return toast.error("Every device needs the reported issue (chief complaint)");
    if (!pool.length) return toast.error("No technician in this department has timed in today (or they are on leave)");
    if (batchId === "new" && !batchName.trim()) return toast.error("Name the new batch");
    setBusy(true);
    try {
      let bid: string | null = batchId === "none" ? null : batchId;
      if (batchId === "new") {
        const { data, error } = await supabase.from("company_batches").insert({ company_id: company.id, label: batchName.trim(), received_date: new Date().toISOString().slice(0, 10) }).select("id").single();
        if (error) throw error;
        bid = data.id;
      }
      const { loadCount, lastAt } = await fetchTodayAssignments();
      const made: string[] = [];
      for (const r of good) {
        const tech = pickRoundRobin(pool, loadCount, lastAt, manilaDayNumber());
        loadCount.set(tech, (loadCount.get(tech) ?? 0) + 1); lastAt.set(tech, Date.now());
        const { data: sid, error } = await supabase.rpc("create_service_atomic", {
          _payload: {
            client_name: company.name, contact_number: company.contact_number ?? "", email: company.email ?? null, address: company.billing_address ?? null,
            device_type: deviceType, brand: r.brand.trim(), model: r.model.trim(), serial_number: r.serial.trim(),
            chief_complaint: r.issue.trim(), issue_description: r.issue.trim(), estimated_completion: timeFrame || null,
            client_type: "Company", priority, rush_fee: false, receiving_staff: actor, technicians: [tech], admin_reps: [actor],
            technician_departments: [dept], source: "Company Repairs",
            conditions: {}, acknowledgements: { ack1: true, ack2: true, ack3: true }, auto_approve_diagnosis: false,
          },
        });
        if (error || !sid) throw new Error(error?.message || "Could not create a ticket");
        await supabase.from("services").update({
          company_id: company.id, company_batch_id: bid, company_location: (r.location || defaultLoc).trim() || null,
          quotation_request_status: "RFQ", vat_requested: company.vat_default,
        } as any).eq("service_id", sid as string);
        made.push(sid as string);
        notifyNewServiceAssignment({ serviceId: sid as string, clientName: company.name, technician: tech, adminRep: actor, deviceType, device: r.model }, tech, actor).catch(() => {});
        logActivityAsync({ serviceId: sid as string, username: actor, role: "admin", activity: `New company service created - ${company.name}, Device: ${deviceType} ${r.brand} ${r.model}, Technician: ${tech}` });
      }
      toast.success(`${made.length} ticket${made.length > 1 ? "s" : ""} created: ${made.join(", ")}`);
      onOpenChange(false); onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create tickets");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex !flex-col max-h-[95dvh] max-w-5xl">
        <DialogHeader className="shrink-0"><DialogTitle>Intake devices · {company.name}</DialogTitle></DialogHeader>
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label>Batch</Label>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">+ New batch</SelectItem>
                  <SelectItem value="none">No batch</SelectItem>
                  {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {batchId === "new" && <Input value={batchName} onChange={(e) => setBatchName(e.target.value)} placeholder="Batch name" />}
            </div>
            <div className="space-y-1">
              <Label>Device type (all devices)</Label>
              <Select value={deviceType} onValueChange={setDeviceType}>
                <SelectTrigger><SelectValue placeholder="Select device type" /></SelectTrigger>
                <SelectContent>{DEVICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Technician department</Label>
              <Select value={dept} onValueChange={setDept} disabled={!depts.length}>
                <SelectTrigger><SelectValue placeholder="Pick device type first" /></SelectTrigger>
                <SelectContent>{depts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
              {dept && <p className="text-xs text-muted-foreground">{pool.length ? `Rotates between: ${pool.join(", ")}` : "No one in this department has timed in today"}</p>}
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Normal", "Within The Day"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Diagnostic time frame</Label>
              <Select value={timeFrame} onValueChange={setTimeFrame}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{TIME_FRAME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Default location / site</Label>
              <Input value={defaultLoc} onChange={(e) => setDefaultLoc(e.target.value)} placeholder="e.g. PDM" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Client, contact and address come from the company. Requesting Invoice (VAT) is {company.vat_default ? "on" : "off"} by default. Admin rep and receiving staff: {actor}.
          </p>

          <div className="space-y-2">
            <div className="hidden gap-2 px-1 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[0.8fr_1fr_1fr_0.7fr_2fr_auto]">
              <span>Brand</span><span>Model</span><span>Serial</span><span>Location</span><span>Issue reported (chief complaint)</span><span className="w-8" />
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid gap-2 rounded-md border p-2 md:grid-cols-[0.8fr_1fr_1fr_0.7fr_2fr_auto] md:border-0 md:p-0">
                <Input value={r.brand} onChange={(e) => patch(i, { brand: e.target.value })} placeholder="Brand" />
                <Input value={r.model} onChange={(e) => patch(i, { model: e.target.value })} placeholder="Model" />
                <Input value={r.serial} onChange={(e) => patch(i, { serial: e.target.value })} placeholder="Serial" />
                <Input value={r.location} onChange={(e) => patch(i, { location: e.target.value })} placeholder={defaultLoc || "Location"} />
                <Textarea rows={1} className="min-h-10" value={r.issue} onChange={(e) => patch(i, { issue: e.target.value })} placeholder="What the company reported" />
                <Button type="button" variant="ghost" size="icon" onClick={() => setRows((x) => (x.length > 1 ? x.filter((_, k) => k !== i) : [blank(defaultLoc)]))} aria-label="Remove device"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setRows((x) => [...x, { ...blank(defaultLoc), brand: x[x.length - 1]?.brand ?? "", model: x[x.length - 1]?.model ?? "" }])}><Plus className="mr-1 h-4 w-4" />Add device</Button>
              <span className="self-center text-xs text-muted-foreground">New rows copy the brand and model of the last one.</span>
            </div>
          </div>

          <details className="rounded-md border p-2 text-sm">
            <summary className="cursor-pointer text-muted-foreground">Paste from a spreadsheet (Serial, Model, Issue, Location)</summary>
            <div className="mt-2 flex gap-2">
              <Textarea rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Copy rows from Sheets and paste here" />
              <Button type="button" variant="outline" onClick={applyPaste} disabled={!paste.trim()}>Add rows</Button>
            </div>
          </details>
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Create {rows.filter((r) => r.model || r.serial || r.issue).length || ""} ticket(s)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
