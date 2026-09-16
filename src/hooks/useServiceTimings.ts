import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseStatusLog, buildTimings, StatusLogEntry, ServiceTiming } from "@/lib/reportMetrics";
import { useClosedDates } from "@/hooks/useClosedDates";

/**
 * Working-time durations for a small set of tickets (one page of a list).
 * Keeps the log fetch scoped to the visible ticket IDs so listing pages stay
 * cheap, unlike the full reporting log window.
 */
export const useServiceTimings = (services: any[]) => {
  const ids = Array.from(
    new Set((services || []).map((s) => String(s?.serviceId || "").trim()).filter(Boolean)),
  ).sort();
  const { data: closedDates = [] } = useClosedDates();

  const { data: logs = [] } = useQuery({
    queryKey: ["serviceTimingLogs", ids.join(",")],
    queryFn: async (): Promise<StatusLogEntry[]> => {
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("activity_logs")
        .select("action, entity_id, created_at, actor_name, changes")
        .eq("entity_type", "service")
        .in("entity_id", ids)
        .order("created_at", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data ?? [])
        .map((r) => parseStatusLog(r))
        .filter((e): e is StatusLogEntry => !!e);
    },
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const timings: Map<string, ServiceTiming> = buildTimings(
    services || [],
    logs,
    closedDates.map((d) => d.startDate),
  );

  return timings;
};

/** "2d 3h" style label for productive working hours. */
export const formatWorkingDuration = (hours: number | null | undefined): string | null => {
  if (hours === null || hours === undefined || !isFinite(hours)) return null;
  const total = Math.max(0, hours);
  const days = Math.floor(total / 8);
  const rest = Math.round(total - days * 8);
  return days <= 0 ? `${rest}h` : `${days}d ${rest}h`;
};
