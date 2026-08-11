import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseStatusLog, StatusLogEntry } from "@/lib/reportMetrics";

const PAGE_SIZE = 1000;
const MAX_PAGES = 30;

/**
 * Loads service activity logs and parses them into status-transition entries
 * used to derive turnaround / stage timings and the output leaderboard on the
 * Reports page.
 *
 * Fetched in pages so a large log never gets silently truncated by the API row
 * cap, and errors are surfaced to the caller instead of looking like "no data".
 */
export const useServiceStatusLogs = () => {
  return useQuery({
    queryKey: ["activity-logs", "service-status"],
    queryFn: async (): Promise<StatusLogEntry[]> => {
      const out: StatusLogEntry[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE_SIZE;
        const { data, error } = await supabase
          .from("activity_logs")
          .select("action, entity_id, created_at, actor_name, changes")
          .eq("entity_type", "service")
          .order("created_at", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const rows = data ?? [];
        rows.forEach((r) => {
          const parsed = parseStatusLog(r);
          if (parsed) out.push(parsed);
        });
        if (rows.length < PAGE_SIZE) break;
      }
      return out;
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
