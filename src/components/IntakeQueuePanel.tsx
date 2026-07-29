import { useNavigate } from "react-router-dom";
import { useQueueEntries, moveQueueEntry } from "@/hooks/useQueueEntries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, ArrowRight, ExternalLink, Clock } from "lucide-react";

/**
 * Inline queue panel used inside the Service Tracker's "Intake" tab.
 * Public /intake submissions land here first — front-desk admins turn them
 * into real services from the Queue Console or by clicking "Complete Intake".
 */
export const IntakeQueuePanel = () => {
  const { entries, loading } = useQueueEntries({ activeOnly: true });
  const { toast } = useToast();
  const navigate = useNavigate();

  const move = async (id: string, status: "waiting" | "proceed" | "cancelled") => {
    const { error } = await moveQueueEntry(id, status);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200/60 bg-blue-50/40 p-4">
        <div>
          <div className="text-sm font-semibold text-blue-700">Public Intake Queue</div>
          <p className="text-xs text-muted-foreground">
            New submissions from the customer-facing /intake page appear here. Click
            "Complete Intake" to turn a queue entry into a full service — it will then
            move into the tracker.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/queueing")}>
          <ExternalLink className="h-4 w-4 mr-1" /> Open Queue Console
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
          Loading queue…
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
          No customers in the queue.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {entries.map((e) => (
            <div
              key={e.id}
              className={`rounded-2xl border p-4 ${
                e.status === "proceed"
                  ? "border-emerald-200 bg-emerald-50/50"
                  : "border-blue-200 bg-blue-50/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div
                    className={`text-2xl font-black ${
                      e.status === "proceed" ? "text-emerald-600" : "text-blue-600"
                    }`}
                  >
                    {e.display_code}
                  </div>
                  <div className="text-sm font-medium">{e.client_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[e.device_type, e.brand, e.model].filter(Boolean).join(" • ") || "—"}
                  </div>
                  {e.contact_number && (
                    <div className="text-xs text-muted-foreground">
                      📞 {e.contact_number}
                    </div>
                  )}
                  {e.chief_complaint && (
                    <div className="mt-2 text-xs text-foreground/70 line-clamp-2">
                      "{e.chief_complaint}"
                    </div>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={
                    e.status === "proceed"
                      ? "border-emerald-400 text-emerald-700"
                      : "border-blue-400 text-blue-700"
                  }
                >
                  <Clock className="h-3 w-3 mr-1" />
                  {e.status === "proceed" ? "Proceed" : "Waiting"}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => navigate(`/service-form?queueId=${e.id}`)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Complete Intake
                </Button>
                {e.status === "waiting" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => move(e.id, "proceed")}
                  >
                    <ArrowRight className="h-3.5 w-3.5 mr-1" /> Proceed
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => move(e.id, "waiting")}
                  >
                    Back to Waiting
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => move(e.id, "cancelled")}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
