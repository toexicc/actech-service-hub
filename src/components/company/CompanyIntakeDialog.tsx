import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DEVICE_TYPES, DEVICE_TYPES_BY_DEPARTMENT, TIME_FRAME_OPTIONS } from "@/lib/constants";
import { useStaff } from "@/hooks/useStaff";
import { useStaffAvailability } from "@/hooks/useStaffAvailability";
import { fetchTodayAssignments, manilaDayNumber } from "@/lib/techRotation";
import { planCompanyAssignments } from "@/lib/companyIntakeAssign";
import { notifyNewServiceAssignment } from "@/lib/serviceNotifications";
import { logActivityAsync } from "@/lib/activityLogger";
import { DeviceFieldSuggest } from "@/components/DeviceFieldSuggest";
import { DeviceAccessoryPicker } from "@/components/DeviceAccessoryPicker";
import { rememberDeviceFields } from "@/lib/deviceCatalog";
import { invokeAiFunction } from "@/lib/aiFormatters";
import { cn } from "@/lib/utils";

const DEFAULT_ADMIN = "Romar Badilles";
const SPECIAL_DEPT = "Special Cases";
const SPECIAL_TECH = "John Paul Espedido";
const AUTO = "__auto";

type Company = { id: string; name: string; contact_person: string | null; contact_number: string | null; email: string | null; billing_address: string | null; vat_default: boolean };
type Row = {
  deviceType: string; dept: string; tech: string; serial: string; brand: string; color: string; model: string; memory: string;
  location: string; issue: string; password: string; hasAccessory: boolean; accessories: string[]; ownQuote: boolean;
};
const blank = (location = ""): Row => ({ deviceType: "", dept: "", tech: AUTO, serial: "", brand: "", color: "", model: "", memory: "", location, issue: "", password: "", hasAccessory: false, accessories: [], ownQuote: false });
const today = () => { const d = new Date(); return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`; };
const deptsFor = (type: string) => [...Object.entries(DEVICE_TYPES_BY_DEPARTMENT).filter(([, t]) => t.includes(type)).map(([d]) => d), SPECIAL_DEPT];
const filled = (r: Row) => !!(r.model.trim() || r.serial.trim() || r.issue.trim() || r.deviceType);

/** Multi-device intake for one company. Each device gets its own type, department and technician, like the regular intake form. */
export function CompanyIntakeDialog({ open, onOpenChange, company, batches, actor, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void; company: Company; batches: { id: string; label: string }[]; actor: string; onDone: () => void;
}) {
  const { data: staff = [] } = useStaff();
  const { data: availability } = useStaffAvailability();
  const [batchId, setBatchId] = useState("new");
  const [batchName, setBatchName] = useState("");
  const [adminRep, setAdminRep] = useState(DEFAULT_ADMIN);
  const [priority, setPriority] = useState("Normal");
  const [timeFrame, setTimeFrame] = useState("");
  const [defaultLoc, setDefaultLoc] = useState("");
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [paste, setPaste] = useState("");
  const [pasteType, setPasteType] = useState("");
  const [busy, setBusy] = useState(false);
  const [formatting, setFormatting] = useState<number | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [counts, setCounts] = useState<{ loadCount: Map<string, number>; lastAt: Map<string, number> }>({ loadCount: new Map(), lastAt: new Map() });

  const adminOptions = useMemo(() => staff.filter((s: any) => ["admin", "management"].includes(s.role?.trim().toLowerCase()) && s.status?.toLowerCase() !== "inactive")
    .map((s: any) => s.name as string).sort((a, b) => a.localeCompare(b)), [staff]);

  useEffect(() => {
    if (!open) return;
    setBatchId("new"); setBatchName(`Faulty Devices - ${today()}`); setRows([blank()]); setPaste(""); setDefaultLoc(""); setShowErrors(false);
    fetchTodayAssignments().then(setCounts).catch(() => {});
  }, [open]);
  useEffect(() => {
    if (!open) return;
    setAdminRep(adminOptions.includes(DEFAULT_ADMIN) ? DEFAULT_ADMIN : adminOptions.includes(actor) ? actor : adminOptions[0] ?? actor);
  }, [open, adminOptions, actor]);

  const pools = useMemo(() => {
    const p: Record<string, string[]> = { [SPECIAL_DEPT]: [SPECIAL_TECH] };
    staff.forEach((s: any) => {
      if (s.role?.toLowerCase() !== "technician" || s.status?.toLowerCase() === "inactive" || !s.department || s.name === SPECIAL_TECH) return;
      if (!availability?.isAvailable(s.name)) return;
      (p[s.department] ??= []).push(s.name);
    });
    return p;
  }, [staff, availability]);

  const plan = useMemo(() => planCompanyAssignments(rows.map((r) => ({ department: r.dept, override: r.tech === AUTO ? undefined : r.tech })),
    pools, counts.loadCount, counts.lastAt, manilaDayNumber()), [rows, pools, counts]);

  const patch = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const setType = (i: number, type: string) => patch(i, { deviceType: type, dept: deptsFor(type)[0] ?? "", tech: AUTO });
  const duplicate = (i: number) => setRows((x) => { const s = x[i]; const copy = { ...blank(s.location), deviceType: s.deviceType, dept: s.dept, brand: s.brand, model: s.model, color: s.color, memory: s.memory }; return [...x.slice(0, i + 1), copy, ...x.slice(i + 1)]; });

  const applyPaste = () => {
    const parsed = paste.split(/\r?\n/).map((l) => l.split("\t")).filter((c) => c.some((x) => x.trim()))
      .map(([location = "", serial = "", model = "", issue = ""]) => ({ ...blank(location.trim() || defaultLoc), serial: serial.trim(), model: model.trim(), issue: issue.trim(),
        ...(pasteType ? { deviceType: pasteType, dept: deptsFor(pasteType)[0] ?? "" } : {}) }));
    if (parsed.length) { setRows((r) => [...r.filter(filled), ...parsed]); setPaste(""); }
  };
  const setTypeForAll = (type: string) => setRows((r) => r.map((x) => (x.deviceType ? x : { ...x, deviceType: type, dept: deptsFor(type)[0] ?? "", tech: AUTO })));

  const formatIssue = async (i: number) => {
    const raw = rows[i].issue.trim(); if (!raw) return;
    setFormatting(i);
    try {
      const resp = await invokeAiFunction<any>("format-complaint", { rawComplaint: raw, mode: "detailed" });
      if (!resp?.formattedComplaint) throw new Error();
      patch(i, { issue: resp.formattedComplaint });
    } catch { toast.error("AI Network Error - Contact Administrator"); } finally { setFormatting(null); }
  };

  const rowProblem = (r: Row, i: number) => {
    if (!r.deviceType) return "Pick the device type";
    if (!r.model.trim() && !r.serial.trim()) return "Add the model or serial";
    if (!r.issue.trim()) return "Add the chief complaint";
    if (!plan[i]) return `No ${r.dept} technician has timed in today`;
    return null;
  };

  const submit = async () => {
    const list = rows.map((r, i) => ({ r, i })).filter(({ r }) => filled(r));
    if (!list.length) return toast.error("Add at least one device");
    if (!adminRep) return toast.error("Pick the admin rep");
    if (batchId === "new" && !batchName.trim()) return toast.error("Name the new batch");
    if (list.some(({ r, i }) => rowProblem(r, i))) { setShowErrors(true); return toast.error("Some devices need fixing (highlighted in red)"); }
    setBusy(true);
    try {
      const fresh = await fetchTodayAssignments();
      const techs = planCompanyAssignments(list.map(({ r }) => ({ department: r.dept, override: r.tech === AUTO ? undefined : r.tech })), pools, fresh.loadCount, fresh.lastAt, manilaDayNumber());
      if (techs.some((t) => !t)) throw new Error("A technician just became unavailable — check the devices again");
      let bid: string | null = batchId === "none" ? null : batchId;
      if (batchId === "new") {
        const { data, error } = await supabase.from("company_batches").insert({ company_id: company.id, label: batchName.trim(), received_date: new Date().toISOString().slice(0, 10) }).select("id").single();
        if (error) throw error;
        bid = data.id;
      }
      const made: string[] = [];
      for (let k = 0; k < list.length; k++) {
        const { r } = list[k]; const tech = techs[k] as string;
        const accessories = r.hasAccessory ? r.accessories : [];
        const { data: sid, error } = await supabase.rpc("create_service_atomic", {
          _payload: {
            client_name: company.name, contact_number: company.contact_number ?? "", email: company.email ?? null, address: company.billing_address ?? null,
            device_type: r.deviceType, brand: r.brand.trim(), model: r.model.trim(), serial_number: r.serial.trim(), color: r.color.trim() || null, memory: r.memory.trim() || null,
            device_password: r.password.trim() || null, chief_complaint: r.issue.trim(), issue_description: r.issue.trim(), estimated_completion: timeFrame || null,
            client_type: "Company", priority, rush_fee: false, receiving_staff: actor, technicians: [tech], admin_reps: [adminRep],
            technician_departments: [r.dept], source: "Company Repairs",
            conditions: {}, acknowledgements: { ack1: true, ack2: true, ack3: true }, auto_approve_diagnosis: false,
          },
        });
        if (error || !sid) throw new Error(error?.message || "Could not create a ticket");
        await supabase.from("services").update({
          company_id: company.id, company_batch_id: bid, company_location: (r.location || defaultLoc).trim() || null,
          quotation_request_status: "RFQ", vat_requested: company.vat_default, needs_individual_quote: r.ownQuote,
          has_device_accessory: r.hasAccessory && accessories.length > 0, device_accessories: accessories,
        } as any).eq("service_id", sid as string);
        made.push(sid as string);
        rememberDeviceFields({ brand: r.brand.trim(), model: r.model.trim(), color: r.color.trim(), memory: r.memory.trim() });
        notifyNewServiceAssignment({ serviceId: sid as string, clientName: company.name, technician: tech, adminRep, deviceType: r.deviceType, device: r.model }, tech, adminRep).catch(() => {});
        logActivityAsync({ serviceId: sid as string, username: actor, role: "admin", activity: `New company service created - ${company.name}, Device: ${r.deviceType} ${r.brand} ${r.model}, Technician: ${tech}, Admin Rep: ${adminRep}` });
      }
      toast.success(`${made.length} ticket${made.length > 1 ? "s" : ""} created: ${made.join(", ")}`);
      onOpenChange(false); onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create tickets");
    } finally { setBusy(false); }
  };

  const count = rows.filter(filled).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex !flex-col max-h-[95dvh] max-w-5xl">
        <DialogHeader className="shrink-0"><DialogTitle>Intake devices · {company.name}</DialogTitle></DialogHeader>
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label>Admin Rep</Label>
              <Select value={adminRep} onValueChange={setAdminRep}>
                <SelectTrigger><SelectValue placeholder="Select admin" /></SelectTrigger>
                <SelectContent>{adminOptions.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Receiving Staff</Label>
              <Input value={actor} disabled />
            </div>
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
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Normal", "Within The Day"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Diagnostic Time Frame</Label>
              <Select value={timeFrame} onValueChange={setTimeFrame}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{TIME_FRAME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Default Location / Site</Label>
              <Input value={defaultLoc} onChange={(e) => setDefaultLoc(e.target.value)} placeholder="e.g. PDM" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Client, contact and address come from the company. Requesting Invoice (VAT) is {company.vat_default ? "on" : "off"} by default. Each device is assigned to a timed-in technician of its own department.
          </p>

          <div className="space-y-3">
            {rows.map((r, i) => {
              const problem = showErrors && filled(r) ? rowProblem(r, i) : null;
              const depts = r.deviceType ? deptsFor(r.deviceType) : [];
              const pool = pools[r.dept] ?? [];
              return (
                <div key={i} className={cn("space-y-2 rounded-lg border p-3", problem && "border-destructive")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">Device {i + 1}</span>
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => duplicate(i)}><Copy className="mr-1 h-3.5 w-3.5" />Duplicate</Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setRows((x) => (x.length > 1 ? x.filter((_, k) => k !== i) : [blank(defaultLoc)]))} aria-label="Remove device"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1"><Label className="text-xs">Device Type</Label>
                      <Select value={r.deviceType} onValueChange={(v) => setType(i, v)}>
                        <SelectTrigger><SelectValue placeholder="Select device type" /></SelectTrigger>
                        <SelectContent>{DEVICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label className="text-xs">Technician Department</Label>
                      <Select value={r.dept} onValueChange={(v) => patch(i, { dept: v, tech: AUTO })} disabled={!depts.length}>
                        <SelectTrigger><SelectValue placeholder="Pick device type first" /></SelectTrigger>
                        <SelectContent>{depts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label className="text-xs">Technician</Label>
                      <Select value={r.tech} onValueChange={(v) => patch(i, { tech: v })} disabled={!r.dept}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={AUTO}>{r.dept ? (plan[i] && r.tech === AUTO ? `Auto: ${plan[i]}` : pool.length ? "Auto" : "Auto: nobody timed in") : "Auto"}</SelectItem>
                          {pool.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    <div className="space-y-1"><Label className="text-xs">Serial</Label><Input value={r.serial} onChange={(e) => patch(i, { serial: e.target.value })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Brand</Label><DeviceFieldSuggest kind="brand" value={r.brand} onChange={(v) => patch(i, { brand: v })} placeholder="e.g. Apple" /></div>
                    <div className="space-y-1"><Label className="text-xs">Color</Label><DeviceFieldSuggest kind="color" value={r.color} onChange={(v) => patch(i, { color: v })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Model</Label><DeviceFieldSuggest kind="model" brand={r.brand} value={r.model} onChange={(v) => patch(i, { model: v })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Storage</Label><DeviceFieldSuggest kind="storage" value={r.memory} onChange={(v) => patch(i, { memory: v })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Location / Site</Label><Input value={r.location} onChange={(e) => patch(i, { location: e.target.value })} placeholder={defaultLoc || "Location"} /></div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Chief Complaint (issue reported)</Label>
                      <Button type="button" variant="outline" size="sm" className="h-7" disabled={formatting !== null || !r.issue.trim()} onClick={() => formatIssue(i)}>
                        {formatting === i ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}Format with AI
                      </Button>
                    </div>
                    <Textarea rows={2} value={r.issue} onChange={(e) => patch(i, { issue: e.target.value })} placeholder="What the company reported" />
                  </div>
                  <div className="grid items-start gap-2 sm:grid-cols-3">
                    <div className="space-y-1"><Label className="text-xs">Device Password</Label><Input value={r.password} onChange={(e) => patch(i, { password: e.target.value })} /></div>
                    <div className="space-y-2 sm:col-span-2">
                      <div className="flex flex-wrap items-center gap-4 pt-5">
                        <label className="flex items-center gap-2 text-sm"><Switch checked={r.hasAccessory} onCheckedChange={(v) => patch(i, { hasAccessory: v })} />Device Accessory</label>
                        <label className="flex items-center gap-2 text-sm"><Checkbox checked={r.ownQuote} onCheckedChange={(v) => patch(i, { ownQuote: !!v })} />Needs individual quote</label>
                      </div>
                      {r.hasAccessory && <DeviceAccessoryPicker value={r.accessories} onChange={(v) => patch(i, { accessories: v })} />}
                    </div>
                  </div>
                  {problem && <p className="text-xs font-medium text-destructive">{problem}</p>}
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm" onClick={() => setRows((x) => [...x, blank(defaultLoc)])}><Plus className="mr-1 h-4 w-4" />Add device</Button>
          </div>

          <details className="rounded-md border p-2 text-sm">
            <summary className="cursor-pointer text-muted-foreground">Paste from the company sheet (Location, Serial, Model, Reported Issue)</summary>
            <div className="mt-2 space-y-2">
              <Textarea rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Copy rows from Sheets and paste here" />
              <div className="flex flex-wrap items-center gap-2">
                <Select value={pasteType} onValueChange={setPasteType}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Device type for pasted rows" /></SelectTrigger>
                  <SelectContent>{DEVICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={applyPaste} disabled={!paste.trim()}>Add rows</Button>
                {rows.some((r) => filled(r) && !r.deviceType) && pasteType && (
                  <Button type="button" variant="ghost" onClick={() => setTypeForAll(pasteType)}>Set {pasteType} on devices without a type</Button>
                )}
              </div>
            </div>
          </details>
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Create {count || ""} ticket(s)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
