import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import ServiceForm, { type QueueClientMatch } from "@/pages/ServiceForm";

interface CompleteIntakeModalProps {
  queueId: string | null;
  displayCode?: string | null;
  onOpenChange: (open: boolean) => void;
  onCompleted?: (serviceId: string) => void;
}

/**
 * Opens the full staff intake form inside a modal, pre-filled from a queue
 * entry — front-desk admins finish the intake without leaving the console.
 * When the queued name looks like an existing customer, it offers to link the
 * ticket to that customer instead of creating another Client ID. The matching
 * alert is rendered inside the form, directly below the Client ID Search.
 */
export const CompleteIntakeModal = ({
  queueId,
  displayCode,
  onOpenChange,
  onCompleted,
}: CompleteIntakeModalProps) => {
  const [matches, setMatches] = useState<QueueClientMatch[]>([]);
  const [linkedClientId, setLinkedClientId] = useState<string | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMatches([]);
    setLinkedClientId(undefined);
    setDismissed(false);
    if (!queueId) return;
    let cancelled = false;
    (async () => {
      const { data: entry } = await supabase
        .from("queue_entries")
        .select("client_name, contact_number")
        .eq("id", queueId)
        .maybeSingle();
      const name = (entry?.client_name || "").trim();
      if (!name || name.length < 3) return;
      const { data } = await supabase
        .from("clients")
        .select("client_id, name, contact_number, email")
        .or(`name.ilike.%${name}%${entry?.contact_number ? `,contact_number.eq.${entry.contact_number}` : ""}`)
        .limit(5);
      if (!cancelled) setMatches((data ?? []) as QueueClientMatch[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [queueId]);

  const visibleMatches = !dismissed && !linkedClientId ? matches : [];

  return (
    <Dialog open={!!queueId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl !flex !flex-col max-h-[95dvh] p-0 gap-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>
            Complete Intake{displayCode ? ` — ${displayCode}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {linkedClientId && (
            <p className="mx-4 mt-4 text-sm font-medium text-emerald-700">
              Linked to customer {linkedClientId}
            </p>
          )}
          {queueId && (
            <ServiceForm
              key={`${queueId}-${linkedClientId ?? "new"}`}
              embedded
              embeddedQueueId={queueId}
              prefillClientId={linkedClientId}
              embeddedQueueMatches={visibleMatches}
              onQueueMatchLink={setLinkedClientId}
              onQueueMatchDismiss={() => setDismissed(true)}
              onCompleted={(serviceId) => {
                onCompleted?.(serviceId);
                onOpenChange(false);
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CompleteIntakeModal;
