import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_OPTIONS } from "@/lib/constants";

interface StatusProgressBarProps {
  serviceId: string;
  clientName: string;
  technician?: string;
  adminRep?: string;
  device?: string;
  currentStatus: string;
}

// The "happy-path" stepper. Off-path statuses (Backjob/RTO/On Hold/Cancelled) are still recognized
// and shown as the active step, but the bar only advances along the main flow.
const PROGRESS_STEPS = [
  "Pending Diagnosis",
  "Confirmed Diagnosis",
  "Waiting to Proceed",
  "Proceed Repair",
  "Ongoing Service",
  "Done Repair - Under Observation",
  "Done Repair - For Release",
  "Done Repair - Advise Client",
  "Completed",
] as const;

const SHORT_LABEL: Record<string, string> = {
  "Pending Diagnosis": "Pending",
  "Confirmed Diagnosis": "Confirmed",
  "Waiting to Proceed": "Waiting",
  "Proceed Repair": "Proceed",
  "Ongoing Service": "Ongoing",
  "Done Repair - Under Observation": "Observation",
  "Done Repair - For Release": "For Release",
  "Done Repair - Advise Client": "Advise",
  "Completed": "Completed",
};

export function StatusProgressBar({
  serviceId,
  clientName,
  technician,
  adminRep,
  device,
  currentStatus,
}: StatusProgressBarProps) {
  const currentIdx = PROGRESS_STEPS.indexOf(currentStatus as typeof PROGRESS_STEPS[number]);
  const isOffPath = currentIdx === -1 && STATUS_OPTIONS.includes(currentStatus as any);

  return (
    <div className="rounded-lg border bg-card p-4 mb-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Service Progress
        </span>
        <span
          className={cn(
            "max-w-full break-words rounded-full px-2 py-0.5 text-right text-xs font-semibold leading-tight",
            isOffPath ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
          )}
        >
          {currentStatus}
        </span>
      </div>

      {/* Stepper */}
      <div className="grid w-full grid-cols-3 gap-2 pb-1 md:flex md:items-center md:overflow-x-auto md:pb-2">
        {PROGRESS_STEPS.map((step, idx) => {
          const isComplete = currentIdx > idx;
          const isCurrent = currentIdx === idx;
          return (
            <div key={step} className="min-w-0 md:flex md:min-w-fit md:flex-1 md:items-center">
              <div className="flex min-w-0 flex-col items-center gap-1 rounded-lg bg-background/50 p-1.5 md:bg-transparent md:p-0">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold",
                    isComplete && "bg-primary border-primary text-primary-foreground",
                    isCurrent && "border-primary text-primary bg-primary/10 ring-2 ring-primary/20",
                    !isComplete && !isCurrent && "border-muted-foreground/30 text-muted-foreground",
                  )}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <span
                  className={cn(
                    "max-w-full break-words text-center text-[10px] leading-tight",
                    isCurrent ? "text-primary font-medium" : "text-muted-foreground",
                  )}
                >
                  {SHORT_LABEL[step]}
                </span>
              </div>
              {idx < PROGRESS_STEPS.length - 1 && (
                <div
                  className={cn(
                    "mb-5 mx-1 hidden h-0.5 flex-1 md:block",
                    currentIdx > idx ? "bg-primary" : "bg-muted-foreground/20",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
