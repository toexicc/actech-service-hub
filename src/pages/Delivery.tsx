import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, CalendarClock, LogOut, Phone, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { PickupCalendar } from "@/components/pickup/PickupCalendar";
import { logPickup, logViewThrottled } from "@/lib/pickupLog";
import { usePickupSchedules, PickupEntry, STATUS_STYLE } from "@/hooks/usePickupSchedules";
import { zoneForDate, ZONE_LABEL } from "@/lib/pickupZones";

const Delivery = () => {
  const { toast } = useToast();
  const { signOut } = useAuth() as { signOut?: () => Promise<void> };
  const navigate = useNavigate();
  const [selected, setSelected] = useState(new Date());
  const [month, setMonth] = useState(new Date());
  const { data: entries = [], refresh } = usePickupSchedules(month);
  const [resched, setResched] = useState<PickupEntry | null>(null);
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const [doneEntry, setDoneEntry] = useState<PickupEntry | null>(null);
  const [doneTime, setDoneTime] = useState("");
  const [busy, setBusy] = useState(false);

  const dayKey = format(selected, "yyyy-MM-dd");
  const day = useMemo(() => entries.filter((e) => e.schedule_date === dayKey && e.status !== "cancelled"), [entries, dayKey]);
  const zone = zoneForDate(dayKey);
  useEffect(() => { logViewThrottled(dayKey); }, [dayKey]);

  const openDone = (e: PickupEntry) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setDoneTime(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
    setDoneEntry(e);
  };

  const confirmDone = async () => {
    if (!doneEntry || !doneTime) { toast({ title: "Pickup time is required", variant: "destructive" }); return; }
    const at = new Date(doneTime);
    if (isNaN(at.getTime())) { toast({ title: "Invalid pickup time", variant: "destructive" }); return; }
    setBusy(true);
    const { error } = await supabase.from("pickup_schedules").update({ status: "done", completed_at: at.toISOString() }).eq("id", doneEntry.id);
    setBusy(false);
    if (error) { toast({ title: "Could not update", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Marked done" });
    void logPickup("pickup_done", doneEntry.id, { client_name: doneEntry.client_name, date: doneEntry.schedule_date, picked_up_at: at.toISOString() });
    setDoneEntry(null);
    refresh();
  };

  const doResched = async () => {
    if (!resched || !newDate || !reason.trim()) { toast({ title: "New date and reason are required", variant: "destructive" }); return; }
    setBusy(true);
    const { error } = await supabase.from("pickup_schedules").update({
      status: "rescheduled", rescheduled_from: resched.schedule_date, schedule_date: newDate, reschedule_reason: reason.trim(), completed_at: null,
    }).eq("id", resched.id);
    setBusy(false);
    if (error) { toast({ title: "Could not reschedule", description: error.message, variant: "destructive" }); return; }
    void logPickup("pickup_rescheduled", resched.id, { client_name: resched.client_name, from: resched.schedule_date, to: newDate, reason: reason.trim() });
    toast({ title: `Moved to ${format(parseISO(newDate), "MM/dd/yyyy")}` });
    setResched(null);
    refresh();
  };

  const logout = async () => {
    if (signOut) await signOut(); else await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="text-lg font-bold">Pickup & Delivery</h1>
        <Button variant="ghost" size="sm" onClick={logout}><LogOut className="h-4 w-4 mr-1" />Sign out</Button>
      </header>
      <main className="mx-auto max-w-6xl p-3 sm:p-4 grid gap-4 lg:grid-cols-[auto_1fr] lg:items-start">
        <Card className="lg:sticky lg:top-20 w-fit mx-auto lg:mx-0"><CardContent className="p-2 first:pt-2 sm:p-2 sm:first:pt-2"><PickupCalendar selected={selected} onSelect={setSelected} month={month} onMonthChange={setMonth} entries={entries} /></CardContent></Card>
        <section className="space-y-2 min-w-0">
          <div>
            <h2 className="font-semibold">{format(selected, "EEEE, MM/dd/yyyy")}</h2>
            {zone && <p className="text-xs text-muted-foreground">{ZONE_LABEL[zone]} route</p>}
          </div>
          {day.length === 0 && <p className="text-sm text-muted-foreground">No pickups or deliveries this day.</p>}
          {day.map((e) => (
            <Card key={e.id}>
              <CardContent className="p-3 first:pt-3 sm:p-3 sm:first:pt-3 space-y-1.5 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="capitalize px-1.5 py-0 text-xs">{e.kind}</Badge>
                  <span className="font-semibold">{e.client_name}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] capitalize ${STATUS_STYLE[e.status] || ""}`}>{e.status}</span>
                  {e.time_window && <span className="ml-auto text-xs font-medium">{e.time_window}</span>}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {(e.city || e.address) && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" />{[e.address, e.city].filter(Boolean).join(", ")}</span>}
                  {e.contact_number && <a href={`tel:${e.contact_number}`} className="flex items-center gap-1 text-primary underline"><Phone className="h-3.5 w-3.5" />{e.contact_number}</a>}
                  {e.service_id && <span>Ticket {e.service_id}</span>}
                  {e.cost != null && <span className="font-medium text-foreground">₱{Number(e.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
                </div>
                {e.notes && <p className="text-xs">{e.notes}</p>}
                {e.status !== "done" && (
                  <div className="flex gap-2 pt-0.5">
                    <Button size="sm" className="flex-1 h-9" disabled={busy} onClick={() => openDone(e)}><Check className="h-4 w-4 mr-1" />Done</Button>
                    <Button size="sm" className="flex-1 h-9" variant="outline" onClick={() => { setResched(e); setNewDate(""); setReason(""); }}><CalendarClock className="h-4 w-4 mr-1" />Reschedule</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      </main>

      <Dialog open={!!doneEntry} onOpenChange={(o) => !o && setDoneEntry(null)}>
        <DialogContent className="!flex !flex-col max-h-[95dvh]">
          <DialogHeader className="shrink-0"><DialogTitle>Confirm pickup done</DialogTitle></DialogHeader>
          <div className="overflow-y-auto grid gap-3 px-1">
            <p className="text-sm text-muted-foreground">
              Mark <span className="font-medium text-foreground">{doneEntry?.client_name}</span> as done? Enter the actual pickup time.
            </p>
            <div>
              <Label>Time of pickup</Label>
              <Input type="datetime-local" value={doneTime} onChange={(e) => setDoneTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setDoneEntry(null)}>Cancel</Button>
            <Button disabled={busy} onClick={confirmDone}><Check className="h-4 w-4 mr-1" />Confirm done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resched} onOpenChange={(o) => !o && setResched(null)}>
        <DialogContent className="!flex !flex-col max-h-[95dvh]">
          <DialogHeader className="shrink-0"><DialogTitle>Reschedule</DialogTitle></DialogHeader>
          <div className="overflow-y-auto grid gap-3 px-1">
            <div><Label>New date</Label><Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} /></div>
            <div><Label>Reason</Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setResched(null)}>Close</Button>
            <Button disabled={busy} onClick={doResched}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Delivery;
