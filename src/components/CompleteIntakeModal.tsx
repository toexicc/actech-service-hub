import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import ServiceForm from "@/pages/ServiceForm";

interface CompleteIntakeModalProps {
  queueId: string | null;
  displayCode?: string | null;
  onOpenChange: (open: boolean) => void;
  onCompleted?: (serviceId: string) => void;
}

interface ClientMatch {
  client_id: string;
  name: string | null;
  contact_number: string | null;
  email: string | null;
}

/**
 * Opens the full staff intake form inside a modal, pre-filled from a queue
 * entry — front-desk admins finish the intake without leaving the console.
 * When the queued name looks like an existing customer, it offers to link the
 * ticket to that customer instead of creating another Client ID.
 */
export const CompleteIntakeModal = ({
  queueId,
  displayCode,
  onOpenChange,
  onCompleted,
}: CompleteIntakeModalProps) => {
  const [matches, setMatches] = useState<ClientMatch[]>([]);
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
      if (!cancelled) setMatches((data ?? []) as ClientMatch[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [queueId]);

  const showMatches = !dismissed && !linkedClientId && matches.length > 0;

  return (
    <Dialog open={!!queueId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl !flex !flex-col max-h-[95dvh] p-0 gap-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>
            Complete Intake{displayCode ? ` — ${displayCode}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {showMatches && (
            <div className="m-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                This name matches existing customers — link the ticket instead of creating a new
                Client ID.
              </p>
              <div className="mt-2 space-y-1">
                {matches.map((m) => (
                  <button
                    key={m.client_id}
                    type="button"
                    onClick={() => setLinkedClientId(m.client_id)}
                    className="flex w-full flex-col items-start rounded-md bg-white px-3 py-2 text-left hover:bg-amber-100"
                  >
                    <span className="text-sm font-medium">
                      {m.name || "No name"} — {m.client_id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {[m.contact_number, m.email].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setDismissed(true)}
              >
                New customer, skip linking
              </Button>
            </div>
          )}
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
