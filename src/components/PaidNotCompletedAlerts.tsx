import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Row {
  service_id: string;
  client_name: string;
  status: string;
  payment_status: string | null;
}

/**
 * Exception list: tickets already marked Paid in POS that never moved to
 * Completed, so admins can close them out (or fix the record) quickly.
 */
export function PaidNotCompletedAlerts() {
  const navigate = useNavigate();

  const { data = [] } = useQuery({
    queryKey: ["paid-not-completed"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("services")
        .select("service_id, client_name, status, payment_status")
        .eq("payment_status", "Paid")
        .not("status", "in", '("Completed","Cancelled")')
        .order("last_updated", { ascending: false })
        .limit(25);
      if (error) throw error;
      return ((data ?? []) as Row[]).filter((r) => !/^rto/i.test(r.status || ""));
    },
    staleTime: 60 * 1000,
  });

  if (!data.length) return null;

  return (
    <Card className="border-amber-300/60 bg-amber-50/60 rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          Paid but not Completed ({data.length})
        </CardTitle>
        <p className="text-xs text-amber-800">
          These tickets are fully paid in POS but still sitting in the workflow. Review and close them out.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.map((r) => (
          <button
            key={r.service_id}
            type="button"
            onClick={() => navigate(`/manage-client?serviceId=${encodeURIComponent(r.service_id)}`)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-300/60 bg-background/70 px-3 py-2 text-left hover:border-amber-500/60"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{r.client_name || "N/A"}</p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {r.service_id} · {r.status}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
        <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate("/service-tracker")}>
          Open Service Tracker
        </Button>
      </CardContent>
    </Card>
  );
}

export default PaidNotCompletedAlerts;
