import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { moveQueueEntry, type QueueEntry } from "@/hooks/useQueueEntries";
import { logTicketActivity } from "@/lib/activityLogger";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { fetchStaffList, type StaffMember } from "@/lib/staffList";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Search } from "lucide-react";

const DELIVERY_OPTION = "AC Tech Delivery - Harly";

interface Props {
  /** Queue-driven release. Modal is open while this is non-null. */
  entry?: QueueEntry | null;
  /** Manual release mode (no queue entry) — modal is open while true. */
  manual?: boolean;
  /** Manual mode: look this ticket up automatically. */
  prefillServiceId?: string;
  onOpenChange: (open: boolean) => void;
  onReleased?: () => void;
}

interface TicketInfo {
  serviceId: string;
  clientName: string;
  contactNumber: string | null;
  deviceType: string | null;
  brand: string | null;
  model: string | null;
  adminReps: string;
  technicians: string;
  receivingStaff: string;
}

const Row = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex items-start justify-between gap-3 py-1 text-sm">
    <span className="shrink-0 text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value || "—"}</span>
  </div>
);

/**
 * Confirm-release modal used by the Release Queue and by the manual release
 * action. Captures device custody (released from / by / received by) and writes
 * the hand-over to the ticket's activity log.
 */
export const ConfirmReleaseModal = ({ entry, manual, prefillServiceId, onOpenChange, onReleased }: Props) => {
  const { toast } = useToast();
  const { profile, user } = useAuth();
  const open = !!entry || !!manual;

  const [releasedFrom, setReleasedFrom] = useState("");
  // When the device is handed to the courier, we also record which staff released it to them.
  const [releasedFromSecondary, setReleasedFromSecondary] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [ticket, setTicket] = useState<TicketInfo | null>(null);
  const [lookupId, setLookupId] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const releasedBy = profile?.name || user?.email || "Unknown staff";

  useEffect(() => {
    if (!open) return;
    fetchStaffList()
      .then((list) => setStaff(list.filter((s) => (s.name || "").trim())))
      .catch(() => setStaff([]));
  }, [open]);

  const loadTicket = async (serviceId: string): Promise<TicketInfo | null> => {
    const { data } = await supabase
      .from("services")
      .select(
        "service_id, client_name, contact_number, device_type, brand, model, admin_reps, technicians, receiving_staff",
      )
      .eq("service_id", serviceId.trim())
      .maybeSingle();
    if (!data) return null;
    return {
      serviceId: data.service_id,
      clientName: data.client_name,
      contactNumber: data.contact_number,
      deviceType: data.device_type,
      brand: data.brand,
      model: data.model,
      adminReps: (data.admin_reps ?? []).filter(Boolean).join(", "),
      technicians: (data.technicians ?? []).filter(Boolean).join(", "),
      receivingStaff: data.receiving_staff ?? "",
    };
  };

  // Queue mode: hydrate the ticket team from the linked service, if any.
  useEffect(() => {
    if (!entry?.service_id) {
      if (entry) setTicket(null);
      return;
    }
    let active = true;
    loadTicket(entry.service_id).then((t) => {
      if (active) setTicket(t);
    });
    return () => {
      active = false;
    };
  }, [entry?.service_id, entry]);

  // Manual mode deep link: hydrate straight from the passed Service ID.
  useEffect(() => {
    const sid = (prefillServiceId || "").trim();
    if (!manual || !sid) return;
    setLookupId(sid);
    setLookupError(null);
    setLooking(true);
    loadTicket(sid)
      .then((t) => {
        setTicket(t);
        if (!t) setLookupError(`No ticket found for ${sid}.`);
      })
      .catch(() => setLookupError("Lookup failed. Please try again."))
      .finally(() => setLooking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual, prefillServiceId]);

  const summary = useMemo(() => {
    if (entry) {
      return {
        queueCode: entry.display_code as string | null,
        serviceId: entry.service_id,
        clientName: ticket?.clientName || entry.client_name,
        contactNumber: ticket?.contactNumber || entry.contact_number,
        device: [
          ticket?.deviceType ?? entry.device_type,
          ticket?.brand ?? entry.brand,
          ticket?.model ?? entry.model,
        ]
          .filter(Boolean)
          .join(" • "),
      };
    }
    return {
      queueCode: null,
      serviceId: ticket?.serviceId ?? null,
      clientName: ticket?.clientName ?? "",
      contactNumber: ticket?.contactNumber ?? "",
      device: [ticket?.deviceType, ticket?.brand, ticket?.model].filter(Boolean).join(" • "),
    };
  }, [entry, ticket]);

  const close = () => {
    setReleasedFrom("");
    setReceivedBy("");
    setNotes("");
    setTicket(null);
    setLookupId("");
    setLookupError(null);
    onOpenChange(false);
  };

  const doLookup = async () => {
    const id = lookupId.trim();
    if (!id) return;
    setLooking(true);
    setLookupError(null);
    const found = await loadTicket(id);
    setLooking(false);
    if (!found) {
      setTicket(null);
      setLookupError("No ticket found for that Service ID.");
      return;
    }
    setTicket(found);
  };

  const confirm = async () => {
    if (!releasedFrom) {
      toast({ title: "Select who holds the device", variant: "destructive" });
      return;
    }
    if (releasedFrom === DELIVERY_OPTION && !releasedFromSecondary) {
      toast({ title: "Select the staff who handed the device to delivery", variant: "destructive" });
      return;
    }
    const serviceId = entry?.service_id || ticket?.serviceId || null;
    if (!entry && !serviceId) {
      toast({ title: "Search a Service ID first", variant: "destructive" });
      return;
    }

    setSaving(true);
    if (entry) {
      const { error } = await moveQueueEntry(entry.id, "completed");
      if (error) {
        setSaving(false);
        toast({ title: "Failed", description: error.message, variant: "destructive" });
        return;
      }
    }
    setSaving(false);

    if (serviceId) {
      // Flags the ticket as Released so it shows up as such everywhere.
      await supabase
        .from("services")
        .update({
          is_released: true,
          released_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
        } as any)
        .eq("service_id", serviceId);

      logTicketActivity(
        serviceId,
        entry
          ? `Device released to client (queue ${entry.display_code})`
          : "Device released to client (manual release)",
        {
          queue_code: entry?.display_code ?? null,
          manual_release: !entry,
          client_name: summary.clientName,
          assigned_admin: ticket?.adminReps || null,
          assigned_technician: ticket?.technicians || null,
          handling_staff: ticket?.receivingStaff || null,
          released_from:
            releasedFrom === DELIVERY_OPTION
              ? `${DELIVERY_OPTION} (via ${releasedFromSecondary})`
              : releasedFrom,
          released_by: releasedBy,
          received_by: receivedBy.trim() || summary.clientName,
          release_notes: notes.trim() || null,
        },
      );
    }

    toast({
      title: "Released",
      description: entry
        ? `${entry.display_code} confirmed released and logged.`
        : `${serviceId} confirmed released and logged.`,
    });
    onReleased?.();
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? close() : undefined)}>
      <DialogContent className="max-w-md !flex !flex-col max-h-[95dvh]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            {entry ? "Confirm device release" : "Manual device release"}
          </DialogTitle>
          <DialogDescription>
            Verify the client and device before handing over. This is recorded in the
            ticket activity log.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!entry && (
            <div className="mb-4 space-y-1">
              <Label htmlFor="release-lookup">Service ID</Label>
              <div className="flex gap-2">
                <Input
                  id="release-lookup"
                  placeholder="e.g. AC110826009"
                  value={lookupId}
                  onChange={(e) => setLookupId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      doLookup();
                    }
                  }}
                />
                <Button variant="outline" onClick={doLookup} disabled={looking}>
                  <Search className="mr-1 h-4 w-4" />
                  {looking ? "Searching…" : "Search"}
                </Button>
              </div>
              {lookupError && <p className="text-xs text-destructive">{lookupError}</p>}
            </div>
          )}

          {(entry || ticket) && (
            <div className="rounded-xl border bg-muted/30 p-3">
              {entry && <Row label="Queue #" value={summary.queueCode} />}
              <Row label="Service ID" value={summary.serviceId} />
              <Row label="Client" value={summary.clientName} />
              <Row label="Contact" value={summary.contactNumber} />
              <Row label="Device" value={summary.device} />
              <div className="my-2 border-t" />
              <div className="pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ticket team
              </div>
              <Row label="Assigned admin" value={ticket?.adminReps} />
              <Row label="Assigned technician" value={ticket?.technicians} />
              <Row label="Handling staff" value={ticket?.receivingStaff} />
            </div>
          )}

          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="released-from">Released from</Label>
              <Select value={releasedFrom} onValueChange={setReleasedFrom}>
                <SelectTrigger id="released-from">
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DELIVERY_OPTION}>{DELIVERY_OPTION}</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.name}>
                      {s.name}
                      {s.role ? ` — ${s.role}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Who holds the device before releasing.
              </p>
            </div>

            {releasedFrom === DELIVERY_OPTION && (
              <div className="space-y-1">
                <Label htmlFor="released-from-secondary">Handed to delivery by</Label>
                <Select value={releasedFromSecondary} onValueChange={setReleasedFromSecondary}>
                  <SelectTrigger id="released-from-secondary">
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={`sec-${s.id}`} value={s.name}>
                        {s.name}
                        {s.role ? ` — ${s.role}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Required when the device leaves through AC Tech delivery.
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="released-by">Released by</Label>
              <Input id="released-by" value={releasedBy} readOnly className="bg-muted/50" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="received-by">Received by (optional)</Label>
              <Textarea
                id="received-by"
                rows={1}
                placeholder="Name of the person picking up the device"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="release-notes">Release notes (optional)</Label>
              <Textarea
                id="release-notes"
                rows={3}
                placeholder="Accessories returned, remarks, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={confirm}
            disabled={saving || !releasedFrom || (releasedFrom === DELIVERY_OPTION && !releasedFromSecondary) || (!entry && !ticket)}
          >
            {saving ? "Releasing…" : "Confirm release"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
