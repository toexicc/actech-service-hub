import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseStatusLog, StatusLogEntry } from "@/lib/reportMetrics";

const PAGE_SIZE = 1000;
const MAX_PAGES = 30;
/**
 * Default window when the caller does not ask for a specific period. Reports
 * passes the selected period start (or null for "All time") so historical
 * reviews are complete instead of silently truncated.
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
export const useServiceStatusLogs = (since?: Date | null) => {
  const explicit = since !== undefined;
  const sinceIso = explicit
    ? (since ? since.toISOString() : null)
    : new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return useQuery({
    queryKey: ["activity-logs", "service-status", sinceIso ?? "all"],
    queryFn: async (): Promise<StatusLogEntry[]> => {
      const out: StatusLogEntry[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE_SIZE;
        let q = supabase
          .from("activity_logs")
          .select("action, entity_id, created_at, actor_name, changes")
          .eq("entity_type", "service");
        if (sinceIso) q = q.gte("created_at", sinceIso);
        const { data, error } = await q
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


