import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Table -> React Query keys that should be invalidated when the table changes.
 * Subscriptions are created once (at the app shell) and torn down on unmount.
 */
const TABLE_KEYS: Record<string, string[][]> = {
  services: [["services"], ["doneServices"], ["techServices"], ["allServiceBreakdowns"]],
  part_requests: [["partRequests"], ["part-requests"]],
  inventory_parts: [["inventory"], ["inventoryLogs"]],
  fast_moving_parts: [["fastMovingParts"]],
  transactions: [["transactions"]],
  expenses: [["expenses"]],
  client_inquiries: [["clientInquiriesData"], ["clientInquiries"]],
  clients: [["clients"]],
  service_breakdowns: [["serviceBreakdowns"], ["allServiceBreakdowns"]],
};

export const useRealtimeInvalidate = (enabled: boolean = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase.channel("app-realtime-invalidate");

    Object.entries(TABLE_KEYS).forEach(([table, keys]) => {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => {
          keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
        }
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
};
