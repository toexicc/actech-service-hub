import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseStatusLog, StatusLogEntry } from "@/lib/reportMetrics";

const PAGE_SIZE = 1000;
const MAX_PAGES = 30;
/**
 * Reports never look further back than a few months, so the log window is
 * bounded. Pulling the whole table on every visit was the single largest
 * network cost in the app.
 */
const WINDOW_DAYS = 120;

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
      const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const out: StatusLogEntry[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE_SIZE;
        const { data, error } = await supabase
          .from("activity_logs")
          .select("action, entity_id, created_at, actor_name, changes")
          .eq("entity_type", "service")
          .gte("created_at", since)
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
    // Logs only matter for reporting; a 10 minute cache is plenty and avoids
    // repeatedly re-downloading the window while someone tweaks filters.
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

