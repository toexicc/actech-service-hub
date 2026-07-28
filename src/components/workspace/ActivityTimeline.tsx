import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { displayDate } from "@/lib/timezone";
import { WorkspacePanel } from "./WorkspacePanel";

interface ActivityLogRow {
  id: string;
  actor_name: string | null;
  action: string;
  changes: any;
  created_at: string;
}

export function ActivityTimeline({ serviceId, limit = 12 }: { serviceId?: string; limit?: number }) {
  const [rows, setRows] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!serviceId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data } = await supabase
          .from("activity_logs")
          .select("id, actor_name, action, changes, created_at")
          .eq("entity_id", serviceId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (!cancelled) setRows((data as ActivityLogRow[]) ?? []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [serviceId, limit]);

  return (
    <WorkspacePanel
      title="Activity"
      icon={<Activity className="h-4 w-4" />}
      bodyClassName="p-0"
    >
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground px-4 py-4">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-border/50 max-h-80 overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <p className="text-sm text-foreground">
                <span className="font-medium">{r.actor_name || "System"}</span>{" "}
                <span className="text-muted-foreground">{r.action}</span>
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                {displayDate(r.created_at, "MMM dd, yyyy · hh:mm a")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </WorkspacePanel>
  );
}

export default ActivityTimeline;
