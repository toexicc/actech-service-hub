import { useEffect, useState } from "react";
import { Activity, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { displayDate } from "@/lib/timezone";
import { WorkspacePanel } from "./WorkspacePanel";
import { Button } from "@/components/ui/button";

interface ActivityLogRow {
  id: string;
  actor_name: string | null;
  action: string;
  changes: any;
  created_at: string;
}

const roleOf = (changes: any): string => {
  const r = changes && typeof changes === "object" ? changes.role : null;
  if (!r || r === "system") return "";
  return String(r);
};

/** Field-diff entries stored alongside the log (label -> {from,to}). */
const detailEntries = (changes: any): Array<[string, { from?: string; to?: string } | any]> => {
  if (!changes || typeof changes !== "object") return [];
  return Object.entries(changes).filter(([k]) => k !== "role");
};

function LogItem({ row }: { row: ActivityLogRow }) {
  const [open, setOpen] = useState(false);
  const role = roleOf(row.changes);
  const details = detailEntries(row.changes);

  return (
    <li className="px-4 py-3">
      <p className="text-sm text-foreground">
        <span className="font-medium">{row.actor_name || "System"}</span>
        {role && (
          <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground">({role})</span>
        )}{" "}
        <span className="text-muted-foreground">{row.action}</span>
      </p>
      <div className="mt-1 flex items-center gap-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {displayDate(row.created_at, "MMM dd, yyyy · hh:mm a")}
        </p>
        {details.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary hover:underline"
          >
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Details
          </button>
        )}
      </div>
      {open && details.length > 0 && (
        <div className="mt-2 space-y-1 rounded-lg border border-border/60 bg-background/60 p-2">
          {details.map(([label, value]) => (
            <div key={label} className="text-xs">
              <span className="font-medium text-foreground">{label}: </span>
              {value && typeof value === "object" && ("from" in value || "to" in value) ? (
                <span className="text-muted-foreground">
                  {String((value as any).from ?? "(empty)")} → {String((value as any).to ?? "(empty)")}
                </span>
              ) : (
                <span className="text-muted-foreground break-words">{String(value ?? "")}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

export function ActivityTimeline({ serviceId, limit = 40 }: { serviceId?: string; limit?: number }) {
  const [rows, setRows] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [take, setTake] = useState(limit);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    setTake(limit);
  }, [serviceId, limit]);

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
          .limit(take + 1);
        const list = (data as ActivityLogRow[]) ?? [];
        if (!cancelled) {
          setHasMore(list.length > take);
          setRows(list.slice(0, take));
        }
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
  }, [serviceId, take]);

  return (
    <WorkspacePanel
      title="Activity"
      icon={<Activity className="h-4 w-4" />}
      bodyClassName="p-0"
    >
      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground px-4 py-4">No activity yet.</p>
      ) : (
        <>
          <ul className="divide-y divide-border/50 max-h-96 overflow-y-auto">
            {rows.map((r) => (
              <LogItem key={r.id} row={r} />
            ))}
          </ul>
          {hasMore && (
            <div className="p-3">
              <Button variant="outline" size="sm" className="w-full" onClick={() => setTake((t) => t + 40)}>
                Load more activity
              </Button>
            </div>
          )}
        </>
      )}
    </WorkspacePanel>
  );
}

export default ActivityTimeline;
