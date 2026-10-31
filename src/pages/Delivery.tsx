import { useMemo, useState } from "react";
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
import { PickupZoneNote } from "@/components/pickup/PickupZoneNote";
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
  const [busy, setBusy] = useState(false);

  const dayKey = format(selected, "yyyy-MM-dd");
  const day = useMemo(() => entries.filter((e) => e.schedule_date === dayKey && e.status !== "cancelled"), [entries, dayKey]);
  const zone = zoneForDate(dayKey);

  const markDone = async (e: PickupEntry) => {
    setBusy(true);
    const { error } = await supabase.from("pickup_schedules").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", e.id);
    setBusy(false);
    if (error) toast({ title: "Could not update", description: error.message, variant: "destructive" });
    else { toast({ title: "Marked done" }); refresh(); }
  };

  const doResched = async () => {
    if (!resched || !newDate || !reason.trim()) { toast({ title: "New date and reason are required", variant: "destructive" }); return; }
    setBusy(true);
    const { error } = await supabase.from("pickup_schedules").update({
      status: "rescheduled", rescheduled_from: resched.schedule_date, schedule_date: newDate, reschedule_reason: reason.trim(), completed_at: null,
    }).eq("id", resched.id);
    setBusy(false);
    if (error) { toast({ title: "Could not reschedule", description: error.message, variant: "destructive" }); return; }
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
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <Card><CardContent><PickupCalendar selected={selected} onSelect={setSelected} month={month} onMonthChange={setMonth} entries={entries} /></CardContent></Card>
        <div>
          <h2 className="font-semibold">{format(selected, "EEEE, MM/dd/yyyy")}</h2>
          {zone && <p className="text-sm text-muted-foreground">{ZONE_LABEL[zone]} route</p>}
        </div>
        {day.length === 0 && <p className="text-sm text-muted-foreground">No pickups or deliveries this day.</p>}
        {day.map((e) => (
          <Card key={e.id}>
            <CardContent className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="capitalize">{e.kind}</Badge>
                <span className="font-semibold text-base">{e.client_name}</span>
                <span className={`rounded px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[e.status] || ""}`}>{e.status}</span>
              </div>
              {e.time_window && <p className="font-medium">{e.time_window}</p>}
              {(e.city || e.address) && <p className="flex gap-1"><MapPin className="h-4 w-4 shrink-0 mt-0.5" />{[e.address, e.city].filter(Boolean).join(", ")}</p>}
              {e.contact_number && <a href={`tel:${e.contact_number}`} className="flex items-center gap-1 text-primary underline"><Phone className="h-4 w-4" />{e.contact_number}</a>}
              {e.service_id && <p className="text-muted-foreground">Ticket {e.service_id}</p>}
              {e.notes && <p>{e.notes}</p>}
              {e.status !== "done" && (
                <div className="flex gap-2 pt-1">
                  <Button className="flex-1 h-11" disabled={busy} onClick={() => markDone(e)}><Check className="h-4 w-4 mr-1" />Done</Button>
                  <Button className="flex-1 h-11" variant="outline" onClick={() => { setResched(e); setNewDate(""); setReason(""); }}><CalendarClock className="h-4 w-4 mr-1" />Reschedule</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        <PickupZoneNote highlight={zone} />
      </main>

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
