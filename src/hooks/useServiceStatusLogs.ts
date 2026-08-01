import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseStatusLog, StatusLogEntry } from "@/lib/reportMetrics";

/**
 * Loads service activity logs and parses them into status-transition entries
 * used to derive turnaround / stage timings on the Reports page.
 */
export const useServiceStatusLogs = () => {
  return useQuery({
    queryKey: ["activity-logs", "service-status"],
    queryFn: async (): Promise<StatusLogEntry[]> => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("action, entity_id, entity_type, created_at")
        .eq("entity_type", "service")
        .order("created_at", { ascending: true })
        .limit(10000);
      if (error) throw error;
      return (data ?? [])
        .map(parseStatusLog)
        .filter((e): e is StatusLogEntry => !!e);
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
