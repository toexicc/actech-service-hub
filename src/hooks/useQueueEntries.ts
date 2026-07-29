import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type QueueStatus = "waiting" | "proceed" | "completed" | "cancelled";

export interface QueueEntry {
  id: string;
  queue_number: number;
  display_code: string;
  status: QueueStatus;
  client_name: string;
  contact_number: string | null;
  device_type: string | null;
  brand: string | null;
  model: string | null;
  chief_complaint: string | null;
  form_payload: Record<string, any>;
  service_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Subscribe to queue_entries. `activeOnly` returns only waiting + proceed
 * (used by /queue public board and the Intake tab); admins can pass false
 * to see the full history (useful for debugging).
 */
export function useQueueEntries(opts: { activeOnly?: boolean } = {}) {
  const activeOnly = opts.activeOnly ?? true;
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    let query = supabase
      .from("queue_entries")
      .select("*")
      .order("created_at", { ascending: true });
    if (activeOnly) query = query.in("status", ["waiting", "proceed"]);
    const { data, error } = await query;
    if (error) {
      setError(error.message);
      setEntries([]);
    } else {
      setError(null);
      setEntries((data ?? []) as QueueEntry[]);
    }
    setLoading(false);
  }, [activeOnly]);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel("queue_entries_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries" },
        () => {
          refetch();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return { entries, loading, error, refetch };
}

export async function moveQueueEntry(id: string, status: QueueStatus) {
  return supabase.from("queue_entries").update({ status }).eq("id", id);
}
