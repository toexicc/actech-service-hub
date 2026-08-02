import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { parseApprovalRemark, approvalRemarkText } from "@/lib/serviceApproval";

interface Props {
  /** Internal admin notes for the ticket (the remark is parsed out of it). */
  adminNotes?: string | null;
  className?: string;
}

/**
 * Read-only "Approval Remark" block, shown on /manage-client and
 * /service-update so staff can see the client's decision from /track.
 */
const ApprovalRemarkBlock = ({ adminNotes, className }: Props) => {
  const remark = parseApprovalRemark(adminNotes);
  if (!remark) return null;

  const declined = remark.decision === "Declined";
  const partial = !declined && remark.pending.length > 0;

  const Icon = declined ? XCircle : partial ? AlertTriangle : CheckCircle2;
  const tone = declined
    ? "border-destructive/30 bg-destructive/5 text-destructive"
    : partial
    ? "border-amber-500/30 bg-amber-500/5 text-amber-600"
    : "border-primary/20 bg-primary/5 text-primary";

  return (
    <div className={`rounded-xl border p-3 ${tone} ${className ?? ""}`}>
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider">Approval Remark</p>
          <p className="text-sm font-medium text-foreground">{approvalRemarkText(remark)}</p>
          {partial && (
            <p className="text-xs text-muted-foreground">
              Not all services were approved — confirm with the client before moving to Proceed Repair.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApprovalRemarkBlock;
