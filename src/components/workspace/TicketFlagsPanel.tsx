import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logTicketActivity } from "@/lib/activityLogger";
import { notifyPartsAvailable, notifyWaitingForPartsOn } from "@/lib/serviceNotifications";

interface TicketFlagsPanelProps {
  service: any;
  /** Merge the saved values back into the page's ticket state. */
  onChange: (patch: Record<string, any>) => void;
  /** Management can write the Waiting for Parts update note; others read it. */
  canEditNote?: boolean;
  /** Only management may switch Waiting for Parts; admins see it read-only. */
  canToggleWaitingForParts?: boolean;
}

const actorName = () => {
  try {
    return (
      sessionStorage.getItem("userFullName") || sessionStorage.getItem("username") || "Staff"
    );
  } catch {
    return "Staff";
  }
};

/**
 * Waiting for Parts (toggle + shared update note) and Backjob flag. Shared by
 * /manage-client and /service-update so every role sees the same state.
 */
export function TicketFlagsPanel({
  service,
  onChange,
  canEditNote = false,
  canToggleWaitingForParts = true,
}: TicketFlagsPanelProps) {
  const { toast } = useToast();
  const serviceId: string = service?.serviceId || "";
  const [busyParts, setBusyParts] = useState(false);
  const [busyBackjob, setBusyBackjob] = useState(false);
  const [busyPreOrder, setBusyPreOrder] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [note, setNote] = useState<string>(service?.waitingPartsNote || "");

  useEffect(() => {
    setNote(service?.waitingPartsNote || "");
  }, [serviceId, service?.waitingPartsNote]);

  const notifyInfo = {
    serviceId,
    clientName: service?.clientName || "",
    technician: service?.technician || "",
    adminRep: service?.adminRep || "",
    deviceType: service?.deviceType || "",
    device: [service?.brand, service?.model].filter(Boolean).join(" ") || service?.deviceType || "",
  };

  const toggleWaitingForParts = async (next: boolean) => {
    if (!serviceId || busyParts) return;
    setBusyParts(true);
    try {
      const { error } = await supabase
        .from("services")
        .update({ waiting_for_parts: next, last_updated: new Date().toISOString() } as any)
        .eq("service_id", serviceId);
      if (error) throw new Error(error.message);
      onChange({ waitingForParts: next });
      const by = actorName();
      logTicketActivity(
        serviceId,
        next ? "Waiting for Parts turned on" : "Waiting for Parts turned off",
        note ? { "Parts update": note } : undefined,
      );
      if (next) await notifyWaitingForPartsOn(notifyInfo, by, note);
      else await notifyPartsAvailable(notifyInfo, by);
      toast({
        title: next ? "Waiting for Parts" : "Waiting for Parts cleared",
        description: next
          ? "Repair paused while parts are procured. Turnaround time stops counting."
          : "Repair resumed — the assigned admin and technician were notified.",
      });
    } catch (e) {
      toast({
        title: "Update failed",
        description: e instanceof Error ? e.message : "Could not change the Waiting for Parts setting.",
        variant: "destructive",
      });
    } finally {
      setBusyParts(false);
    }
  };

  const togglePreOrder = async (next: boolean) => {
    if (!serviceId || busyPreOrder) return;
    setBusyPreOrder(true);
    try {
      const { error } = await supabase
        .from("services")
        .update({ has_pre_order: next, last_updated: new Date().toISOString() } as any)
        .eq("service_id", serviceId);
      if (error) throw new Error(error.message);
      onChange({ hasPreOrder: next });
      logTicketActivity(serviceId, next ? "Marked as Pre-Order" : "Pre-Order flag removed");
      toast({ title: next ? "Pre-Order flagged" : "Pre-Order flag removed" });
    } catch (e) {
      toast({
        title: "Update failed",
        description: e instanceof Error ? e.message : "Could not change the Pre-Order flag.",
        variant: "destructive",
      });
    } finally {
      setBusyPreOrder(false);
    }
  };

  const saveNote = async () => {
    if (!serviceId || savingNote) return;
    setSavingNote(true);
    try {
      const before = service?.waitingPartsNote || "";
      const { error } = await supabase
        .from("services")
        .update({ waiting_parts_note: note, last_updated: new Date().toISOString() } as any)
        .eq("service_id", serviceId);
      if (error) throw new Error(error.message);
      onChange({ waitingPartsNote: note });
      logTicketActivity(serviceId, "Waiting for Parts update saved", {
        "Parts update": { from: before || "(empty)", to: note || "(empty)" },
      });
      toast({ title: "Parts update saved", description: "Everyone on this ticket can now see it." });
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Could not save the parts update.",
        variant: "destructive",
      });
    } finally {
      setSavingNote(false);
    }
  };

  const toggleBackjob = async (next: boolean) => {
    if (!serviceId || busyBackjob) return;
    setBusyBackjob(true);
    try {
      const { error } = await supabase
        .from("services")
        .update({ is_backjob: next, last_updated: new Date().toISOString() } as any)
        .eq("service_id", serviceId);
      if (error) throw new Error(error.message);
      onChange({ isBackjob: next });
      logTicketActivity(serviceId, next ? "Marked as Backjob" : "Backjob flag removed");
      toast({ title: next ? "Marked as Backjob" : "Backjob flag removed" });
    } catch (e) {
      toast({
        title: "Update failed",
        description: e instanceof Error ? e.message : "Could not change the Backjob flag.",
        variant: "destructive",
      });
    } finally {
      setBusyBackjob(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-3 space-y-3">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-background/70 p-2.5">
          <div>
            <p className="text-sm font-semibold">Pre-Order</p>
            <p className="text-xs text-muted-foreground">
              {service?.hasPreOrder
                ? "This ticket has a pre-order."
                : "Turn on when this ticket has a pre-order."}
            </p>
          </div>
          <Switch checked={!!service?.hasPreOrder} disabled={busyPreOrder} onCheckedChange={togglePreOrder} />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Waiting for Parts</p>
            <p className="text-xs text-muted-foreground">
              {service?.waitingForParts
                ? "Repair paused — parts/supplies are being procured. Turnaround time is not counting."
                : canToggleWaitingForParts
                  ? "Turn on when the repair is paused while parts/supplies are being procured."
                  : "Only management can switch this on or off."}
            </p>
          </div>
          <Switch
            checked={!!service?.waitingForParts}
            disabled={busyParts || !canToggleWaitingForParts}
            onCheckedChange={toggleWaitingForParts}
          />
        </div>

        {canEditNote ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Parts update (visible to all roles)
            </p>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Screen ordered 08/14, ETA 3 days from supplier."
            />
            <Button size="sm" variant="outline" onClick={saveNote} disabled={savingNote}>
              {savingNote ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-2 h-3.5 w-3.5" />
              )}
              Save parts update
            </Button>
          </div>
        ) : (
          (service?.waitingPartsNote || "").trim() && (
            <div className="rounded-lg border border-border/60 bg-background/70 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Parts update
              </p>
              <p className="text-xs text-foreground whitespace-pre-wrap">{service.waitingPartsNote}</p>
            </div>
          )
        )}
      </div>

      <div className="flex items-start justify-between gap-4 rounded-xl border border-purple-300/60 bg-purple-50/60 p-3">
        <div>
          <p className="text-sm font-semibold">Backjob</p>
          <p className="text-xs text-muted-foreground">
            {service?.isBackjob
              ? "This ticket is flagged as a backjob."
              : "Turn on when the device is back for the same issue."}
          </p>
        </div>
        <Switch checked={!!service?.isBackjob} disabled={busyBackjob} onCheckedChange={toggleBackjob} />
      </div>
    </div>
  );
}

export default TicketFlagsPanel;
