import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseApprovalRemark, approvalRemarkText } from "@/lib/serviceApproval";

interface Props {
  /** Internal admin notes for the ticket (the remark is parsed out of it). */
  adminNotes?: string | null;
  /** Services still awaiting the client's decision. */
  pendingServices?: string[];
  /** True while the client checklist on /track is on hold. */
  approvalLocked?: boolean;
  /** Re-enable the client's approval choices on /track. */
  onReopen?: () => Promise<void> | void;
  className?: string;
}

/**
 * Read-only "Approval Remark" block, shown on /manage-client and
 * /service-update so staff can see the client's decision from /track.
 * When services remain pending, staff can re-open the client's choices.
 */
const ApprovalRemarkBlock = ({
  adminNotes,
  pendingServices,
  approvalLocked,
  onReopen,
  className,
}: Props) => {
  const [reopening, setReopening] = useState(false);
  const remark = parseApprovalRemark(adminNotes);
  if (!remark) return null;

  const declined = remark.decision === "Declined";
  const pending = pendingServices?.length ? pendingServices : remark.pending;
  const partial = !declined && pending.length > 0;

  const Icon = declined ? XCircle : partial ? AlertTriangle : CheckCircle2;
  const tone = declined
    ? "border-destructive/30 bg-destructive/5 text-destructive"
    : partial
    ? "border-amber-500/30 bg-amber-500/5 text-amber-600"
    : "border-primary/20 bg-primary/5 text-primary";

  const handleReopen = async () => {
    if (!onReopen) return;
    setReopening(true);
    try {
      await onReopen();
    } finally {
      setReopening(false);
    }
  };

  return (
    <div className={`rounded-xl border p-3 ${tone} ${className ?? ""}`}>
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider">Approval Remark</p>
          <p className="text-sm font-medium text-foreground">{approvalRemarkText(remark)}</p>
          {partial && (
            <p className="text-xs text-muted-foreground">
              Not all services were approved — confirm with the client, then re-open the approval so
              they can select the remaining services on the tracking page.
            </p>
          )}
          {partial && onReopen && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 h-8 text-xs"
              onClick={handleReopen}
              disabled={reopening}
            >
              {reopening ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
              )}
              {approvalLocked ? "Re-open approval on tracking page" : "Resend approval request"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApprovalRemarkBlock;
