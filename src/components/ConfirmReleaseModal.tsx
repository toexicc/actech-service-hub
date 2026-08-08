import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { moveQueueEntry, type QueueEntry } from "@/hooks/useQueueEntries";
import { logTicketActivity } from "@/lib/activityLogger";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2 } from "lucide-react";

interface Props {
  entry: QueueEntry | null;
  onOpenChange: (open: boolean) => void;
  onReleased?: () => void;
}

const Row = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex items-start justify-between gap-3 py-1 text-sm">
    <span className="shrink-0 text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value || "—"}</span>
  </div>
);

/**
 * Confirm-release modal for the Release Queue. Marks the queue entry as
 * released and writes the hand-over to the ticket's activity log.
 */
export const ConfirmReleaseModal = ({ entry, onOpenChange, onReleased }: Props) => {
  const { toast } = useToast();
  const [receivedBy, setReceivedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const close = () => {
    setReceivedBy("");
    setNotes("");
    onOpenChange(false);
  };

  const confirm = async () => {
    if (!entry) return;
    setSaving(true);
    const { error } = await moveQueueEntry(entry.id, "completed");
    setSaving(false);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }

    if (entry.service_id) {
      logTicketActivity(
        entry.service_id,
        `Device released to client (queue ${entry.display_code})`,
        {
          queue_code: entry.display_code,
          client_name: entry.client_name,
          received_by: receivedBy.trim() || entry.client_name,
          release_notes: notes.trim() || null,
        },
      );
    }

    toast({
      title: "Released",
      description: `${entry.display_code} confirmed released and logged.`,
    });
    onReleased?.();
    close();
  };

  return (
    <Dialog open={!!entry} onOpenChange={(o) => (!o ? close() : undefined)}>
      <DialogContent className="max-w-md !flex !flex-col max-h-[95dvh]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Confirm device release
          </DialogTitle>
          <DialogDescription>
            Verify the client and device before handing over. This is recorded in the
            ticket activity log.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="rounded-xl border bg-muted/30 p-3">
            <Row label="Queue #" value={entry?.display_code} />
            <Row label="Service ID" value={entry?.service_id} />
            <Row label="Client" value={entry?.client_name} />
            <Row label="Contact" value={entry?.contact_number} />
            <Row
              label="Device"
              value={[entry?.device_type, entry?.brand, entry?.model].filter(Boolean).join(" • ")}
            />
          </div>

          <div className="mt-4 space-y-3">
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
          <Button onClick={confirm} disabled={saving}>
            {saving ? "Releasing…" : "Confirm release"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
