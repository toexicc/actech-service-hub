import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Table -> React Query keys that should be invalidated when the table changes.
 * Subscriptions are created once (at the app shell) and torn down on unmount.
 *
 * Keys are intentionally narrow: a ticket edit must not also refetch unrelated
 * caches (breakdowns, inventory logs, ...), because each refetch is real egress.
 */
const TABLE_KEYS: Record<string, string[][]> = {
  services: [["services"]],
  part_requests: [["partRequests"], ["part-requests"]],
  inventory_parts: [["inventory"]],
  fast_moving_parts: [["fastMovingParts"]],
  transactions: [["transactions"]],
  expenses: [["expenses"]],
  client_inquiries: [["clientInquiriesData"]],
  clients: [["clients"]],
  service_breakdowns: [["serviceBreakdowns"], ["allServiceBreakdowns"]],
  queue_entries: [["queueEntries"]],
  activity_logs: [["activityLogs"]],
};

/** Coalesce bursts of row changes into a single invalidation per key. */
const FLUSH_MS = 2000;

export const useRealtimeInvalidate = (enabled: boolean = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const pending = new Map<string, string[]>();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      timer = null;
      // Skip work while the tab is in the background; the visibility handler
      // flushes once the user comes back.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const keys = Array.from(pending.values());
      pending.clear();
      keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    };

    const schedule = (keys: string[][]) => {
      keys.forEach((key) => pending.set(key.join("|"), key));
      if (!timer) timer = setTimeout(flush, FLUSH_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && pending.size > 0) flush();
    };
    document.addEventListener("visibilitychange", onVisible);

    const channel = supabase.channel("app-realtime-invalidate");

    Object.entries(TABLE_KEYS).forEach(([table, keys]) => {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => schedule(keys)
      );
    });

    channel.subscribe();

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
};
