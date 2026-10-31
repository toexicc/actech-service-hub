import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Plus, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { PickupCalendar } from "@/components/pickup/PickupCalendar";
import { PickupZoneNote } from "@/components/pickup/PickupZoneNote";
import { usePickupSchedules, PickupEntry, STATUS_STYLE } from "@/hooks/usePickupSchedules";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PickupLogs } from "@/components/pickup/PickupLogs";
import { logPickup, parseCost } from "@/lib/pickupLog";
import { useQuery } from "@tanstack/react-query";
import { NORTH, SOUTH, cityMatchesDate, zoneForDate, ZONE_LABEL } from "@/lib/pickupZones";

const empty = { schedule_date: "", kind: "pickup", client_name: "", service_id: "", contact_number: "", city: "", address: "", time_window: "", notes: "", cost: "" };

const PickupSchedule = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selected, setSelected] = useState(new Date());
  const [month, setMonth] = useState(new Date());
  const { data: entries = [], refresh } = usePickupSchedules(month);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [otherCity, setOtherCity] = useState(false);
  const [saving, setSaving] = useState(false);

  const dayKey = format(selected, "yyyy-MM-dd");
  const dayEntries = useMemo(() => entries.filter((e) => e.schedule_date === dayKey), [entries, dayKey]);
  const zone = zoneForDate(dayKey);
  const mismatch = form.schedule_date && form.city ? cityMatchesDate(form.city, form.schedule_date) === false : false;

  const openNew = () => { setEditId(null); setForm({ ...empty, schedule_date: dayKey }); setOtherCity(false); setOpen(true); };
  const openEdit = (e: PickupEntry) => {
    setEditId(e.id);
    setForm({ schedule_date: e.schedule_date, kind: e.kind, client_name: e.client_name, service_id: e.service_id || "", contact_number: e.contact_number || "", city: e.city || "", address: e.address || "", time_window: e.time_window || "", notes: e.notes || "", cost: e.cost != null ? String(e.cost) : "" });
    setOtherCity(!!e.city && ![...NORTH, ...SOUTH].includes(e.city as never));
    setOpen(true);
  };

  const save = async () => {
    if (!form.client_name.trim() || !form.schedule_date) { toast({ title: "Client and date are required", variant: "destructive" }); return; }
    setSaving(true);
    const { cost: rawCost, ...rest } = form;
    const payload = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v])) as Record<string, string | number | null>;
    payload.cost = parseCost(rawCost);
    payload.service_id = payload.service_id ? String(payload.service_id).toUpperCase() : null;
    let error; let newId = editId;
    const prev = editId ? entries.find((x) => x.id === editId) : undefined;
    if (editId) ({ error } = await supabase.from("pickup_schedules").update(payload as never).eq("id", editId));
    else {
      const { data: me } = await supabase.rpc("get_my_name");
      const res = await supabase.from("pickup_schedules").insert({ ...payload, created_by: user?.id, created_by_name: me } as never).select("id").single();
      error = res.error; newId = (res.data as { id: string } | null)?.id ?? null;
    }
    if (!error && newId) {
      const fields = prev ? Object.keys(payload).filter((k) => String((prev as never)[k] ?? "") !== String(payload[k] ?? "")) : undefined;
      void logPickup(editId ? "pickup_updated" : "pickup_created", newId, { client_name: payload.client_name, date: payload.schedule_date, cost: payload.cost, fields });
    }
    setSaving(false);
    if (error) { toast({ title: "Could not save", description: error.message, variant: "destructive" }); return; }
    toast({ title: editId ? "Schedule updated" : "Schedule added" });
    setOpen(false);
    refresh();
  };

  const cancelEntry = async (e: PickupEntry) => {
    if (!window.confirm(`Cancel ${e.kind} for ${e.client_name}?`)) return;
    const { error } = await supabase.from("pickup_schedules").update({ status: "cancelled" }).eq("id", e.id);
    if (error) toast({ title: "Could not cancel", description: error.message, variant: "destructive" });
    else { void logPickup("pickup_cancelled", e.id, { client_name: e.client_name, date: e.schedule_date }); refresh(); }
  };

  const { data: lastView } = useQuery({
    queryKey: ["pickup_last_view", dayKey],
    queryFn: async () => {
      const { data } = await supabase.from("activity_logs").select("created_at,actor_name").eq("entity_type", "pickup").eq("action", "pickup_viewed").eq("entity_id", dayKey).order("created_at", { ascending: false }).limit(1);
      return data?.[0] ?? null;
    },
    staleTime: 30_000,
  });

  const f = (k: keyof typeof empty) => (ev: { target: { value: string } }) => setForm((p) => ({ ...p, [k]: ev.target.value }));

  return (
    <div className="space-y-4 p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Pickup Schedule</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add schedule</Button>
      </div>
      <Tabs defaultValue="schedule">
      <TabsList><TabsTrigger value="schedule">Schedule</TabsTrigger><TabsTrigger value="logs">Logs</TabsTrigger></TabsList>
      <TabsContent value="logs"><PickupLogs /></TabsContent>
      <TabsContent value="schedule" className="space-y-4">
      <PickupZoneNote highlight={zone} />
      <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-start">
        <Card><CardContent><PickupCalendar selected={selected} onSelect={setSelected} month={month} onMonthChange={setMonth} entries={entries} /></CardContent></Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{format(selected, "MM/dd/yyyy (EEEE)")}{zone && <span className="ml-2 text-sm font-normal text-muted-foreground">{ZONE_LABEL[zone]}</span>}</CardTitle>
            <p className="text-xs text-muted-foreground">{lastView ? `Last viewed by ${lastView.actor_name || "rider"}: ${new Date(lastView.created_at).toLocaleString("en-US", { timeZone: "Asia/Manila", month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : "Not yet viewed by rider"}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {dayEntries.length === 0 && <p className="text-sm text-muted-foreground">Nothing scheduled for this day.</p>}
            {dayEntries.map((e) => (
              <div key={e.id} className="rounded-md border p-3 flex items-start justify-between gap-2">
                <div className="text-sm space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="capitalize">{e.kind}</Badge>
                    <span className="font-semibold">{e.client_name}</span>
                    <span className={`rounded px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[e.status] || ""}`}>{e.status}</span>
                  </div>
                  <p className="text-muted-foreground">{[e.time_window, e.city, e.address].filter(Boolean).join(" · ")}</p>
                  <p className="text-muted-foreground">{[e.service_id, e.contact_number, e.cost != null ? `₱${Number(e.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : null].filter(Boolean).join(" · ")}</p>
                  {e.notes && <p>{e.notes}</p>}
                  {e.reschedule_reason && <p className="text-xs text-muted-foreground">Rescheduled from {e.rescheduled_from ? format(parseISO(e.rescheduled_from), "MM/dd/yyyy") : "—"}: {e.reschedule_reason}</p>}
                </div>
                {e.status !== "cancelled" && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Cancel" onClick={() => cancelEntry(e)}><X className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!flex !flex-col max-h-[95dvh] max-w-lg">
          <DialogHeader className="shrink-0"><DialogTitle>{editId ? "Edit schedule" : "Add schedule"}</DialogTitle></DialogHeader>
          <div className="overflow-y-auto grid gap-3 px-1">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={form.schedule_date} onChange={f("schedule_date")} /></div>
              <div><Label>Type</Label>
                <Select value={form.kind} onValueChange={(v) => setForm((p) => ({ ...p, kind: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="pickup">Pickup</SelectItem><SelectItem value="delivery">Delivery</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Client name</Label><Input value={form.client_name} onChange={f("client_name")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Service ID (optional)</Label><Input value={form.service_id} onChange={f("service_id")} /></div>
              <div><Label>Contact</Label><Input value={form.contact_number} onChange={f("contact_number")} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>City</Label>
                <Select value={otherCity ? "__other" : form.city} onValueChange={(v) => { if (v === "__other") { setOtherCity(true); setForm((p) => ({ ...p, city: "" })); } else { setOtherCity(false); setForm((p) => ({ ...p, city: v })); } }}>
                  <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup><SelectLabel>North (MWF)</SelectLabel>{NORTH.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectGroup>
                    <SelectGroup><SelectLabel>South (TTHS)</SelectLabel>{SOUTH.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectGroup>
                    <SelectItem value="__other">Other…</SelectItem>
                  </SelectContent>
                </Select>
                {otherCity && <Input className="mt-2" placeholder="City" value={form.city} onChange={f("city")} />}
              </div>
              <div><Label>Time window</Label><Input placeholder="e.g. 1–3 PM" value={form.time_window} onChange={f("time_window")} /></div>
            </div>
            {mismatch && (
              <p className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />{form.city} isn't on the {ZONE_LABEL[zoneForDate(form.schedule_date)!]} route for this day.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3"><div><Label>Cost (₱)</Label><Input inputMode="decimal" placeholder="0.00" value={form.cost} onChange={f("cost")} /></div><div /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={f("address")} /></div>
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={f("notes")} /></div>
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PickupSchedule;
