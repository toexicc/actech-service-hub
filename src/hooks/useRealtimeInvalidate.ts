import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Table -> React Query keys that should be invalidated when the table changes.
 * Subscriptions are created once (at the app shell) and torn down on unmount.
 */
const TABLE_KEYS: Record<string, string[][]> = {
  services: [["services"], ["done-services"], ["service-breakdowns"]],
  part_requests: [["part-requests"], ["partRequests"]],
  inventory_parts: [["inventory"]],
  fast_moving_parts: [["fast-moving-parts"], ["fastMovingParts"]],
  transactions: [["transactions"]],
  expenses: [["expenses"]],
  client_inquiries: [["client-inquiries"], ["clientInquiries"]],
  clients: [["clients"]],
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
