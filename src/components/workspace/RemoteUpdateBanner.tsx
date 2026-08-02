import { RefreshCw, X, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RemoteUpdateBannerProps {
  changedFields: string[];
  newStatus?: string;
  isDirty: boolean;
  isReloading?: boolean;
  onReload: () => void;
  onDismiss: () => void;
}

/**
 * Amber inline notice shown when the ticket was changed by someone else while
 * the page is open with unsaved edits (clean forms auto-refresh instead).
 */
export function RemoteUpdateBanner({
  changedFields,
  newStatus,
  isDirty,
  isReloading,
  onReload,
  onDismiss,
}: RemoteUpdateBannerProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-400/60 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Radio className="mt-0.5 h-4 w-4 shrink-0 animate-pulse" />
        <div className="text-sm">
          <p className="font-semibold">
            {newStatus
              ? `This ticket was updated elsewhere (Status → ${newStatus})`
              : "This ticket was updated elsewhere"}
          </p>
          <p className="text-amber-800/90">
            {changedFields.length > 0 ? `Changed: ${changedFields.join(", ")}. ` : ""}
            {isDirty
              ? "You have unsaved edits, so nothing was overwritten. Reload to see the latest."
              : "Reload to see the latest values."}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" onClick={onReload} disabled={isReloading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isReloading ? "animate-spin" : ""}`} />
          Reload ticket
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss} aria-label="Dismiss update notice">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default RemoteUpdateBanner;
