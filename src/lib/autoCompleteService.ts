import { supabase } from "@/integrations/supabase/client";
import { logSystemTicketActivity } from "@/lib/activityLogger";


/**
 * Statuses that already mean the ticket is closed out — a payment on these
 * never needs to change anything.
 */
const ALREADY_CLOSED = ["Completed", "Cancelled", "RTO"] as const;

interface Args {
  serviceId: string;
  /** Total collected for this service including the payment just recorded. */
  totalPaid: number;
  actorName?: string;
  actorRole?: string;
}

/**
 * Flip a service to Completed once its outstanding balance reaches zero,
 * whatever stage it is at. This covers backfilled/old-system tickets that are
 * recorded straight from intake and paid in full.
 */
export const completeServiceIfFullyPaid = async ({
  serviceId,
  totalPaid,
  actorName = "",
  actorRole = "",
}: Args): Promise<boolean> => {
  if (!serviceId || serviceId === "MANUAL") return false;

  const { data: row } = await supabase
    .from("services")
    .select("status, final_cost, total_cost, service_cost")
    .eq("service_id", serviceId)
    .maybeSingle();
  if (!row) return false;

  if (
    (ALREADY_CLOSED as readonly string[]).includes(row.status as string) ||
    /^rto/i.test(String(row.status ?? "").trim())
  ) {
    return false;
  }

  const due = Number(row.final_cost) || Number(row.total_cost) || Number(row.service_cost) || 0;
  if (due <= 0) return false;
  if (totalPaid + 0.01 < due) return false;


  const { error } = await supabase
    .from("services")
    .update({
      status: "Completed",
      payment_status: "Paid",
      waiting_for_parts: false,
      date_completed: new Date().toISOString(),
    })
    .eq("service_id", serviceId);
  if (error) return false;

  logSystemTicketActivity(
    serviceId,
    "Status auto-changed to Completed (service fully paid)",
    {
      Status: { from: String(row.status ?? ""), to: "Completed" },
      "Payment status": { from: "", to: "Paid" },
      "Amount due": String(due),
      "Total paid": String(totalPaid),
      "Triggered by": actorName || "payment",
      ...(actorRole ? { "Actor role": actorRole } : {}),
    },
    "System (Auto-Complete)",
  );
  return true;
};

