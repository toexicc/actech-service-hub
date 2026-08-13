import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ServiceForm from "@/pages/ServiceForm";

interface CompleteIntakeModalProps {
  queueId: string | null;
  displayCode?: string | null;
  onOpenChange: (open: boolean) => void;
  onCompleted?: (serviceId: string) => void;
}

/**
 * Opens the full staff intake form inside a modal, pre-filled from a queue
 * entry — front-desk admins finish the intake without leaving the console.
 */
export const CompleteIntakeModal = ({
  queueId,
  displayCode,
  onOpenChange,
  onCompleted,
}: CompleteIntakeModalProps) => (
  <Dialog open={!!queueId} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-5xl !flex !flex-col max-h-[95dvh] p-0 gap-0">
      <DialogHeader className="shrink-0 border-b px-6 py-4">
        <DialogTitle>
          Complete Intake{displayCode ? ` — ${displayCode}` : ""}
        </DialogTitle>
      </DialogHeader>
      <div className="flex-1 overflow-y-auto">
        {queueId && (
          <ServiceForm
            key={queueId}
            embedded
            embeddedQueueId={queueId}

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

export default CompleteIntakeModal;
