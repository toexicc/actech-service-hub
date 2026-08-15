import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type QueueStatus = "waiting" | "proceed" | "completed" | "cancelled";

export type QueueKind = "intake" | "release";

export interface QueueEntry {
  id: string;
  kind: QueueKind;
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

type Listener = { onChange: () => void; onStatus: (s: RealtimeState) => void };
export type RealtimeState = "connecting" | "live" | "reconnecting" | "offline";

/**
 * Single shared realtime channel for queue_entries across the whole session.
 * Every hook instance registers a listener; the channel is created on the first
 * subscriber and torn down when the last one unmounts.
 */
const listeners = new Set<Listener>();
let channel: RealtimeChannel | null = null;
let channelState: RealtimeState = "connecting";
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;

function setState(next: RealtimeState) {
  channelState = next;
  listeners.forEach((l) => l.onStatus(next));
}

function notifyChange() {
  listeners.forEach((l) => l.onChange());
}

function teardown() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (channel) {
    const c = channel;
    channel = null;
    supabase.removeChannel(c);
  }
}

function scheduleRetry() {
  if (retryTimer || listeners.size === 0) return;
  retryAttempt += 1;
  const delay = Math.min(30000, 1000 * 2 ** (retryAttempt - 1));
  setState("reconnecting");
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (listeners.size === 0) return;
    teardown();
    ensureChannel();
    notifyChange();
  }, delay);
}

function ensureChannel() {
  // Guard: never create/subscribe a second channel while one exists.
  if (channel) return;
  setState(retryAttempt > 0 ? "reconnecting" : "connecting");
  const c = supabase.channel("queue_entries_shared");
  // All `.on()` registrations must happen before `.subscribe()`.
  c.on(
    "postgres_changes",
    { event: "*", schema: "public", table: "queue_entries" },
    () => notifyChange(),
  );
  channel = c;
  c.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      retryAttempt = 0;
      setState("live");
      notifyChange();
    } else if (
      status === "CHANNEL_ERROR" ||
      status === "TIMED_OUT" ||
      status === "CLOSED"
    ) {
      if (listeners.size > 0) scheduleRetry();
      else setState("offline");
    }
  });
}

function addListener(l: Listener) {
  listeners.add(l);
  ensureChannel();
  l.onStatus(channelState);
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) {
      teardown();
      retryAttempt = 0;
      channelState = "connecting";
    }
  };
}

/**
 * Subscribe to queue_entries. `activeOnly` returns only waiting + proceed
 * (used by /queue public board and the Intake tab); admins can pass false
 * to see the full history (useful for debugging).
 */
export function useQueueEntries(opts: { activeOnly?: boolean; kind?: QueueKind } = {}) {
  const activeOnly = opts.activeOnly ?? true;
  const kind = opts.kind;
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeState, setRealtimeState] =
    useState<RealtimeState>(channelState);
  const mounted = useRef(true);

  const refetch = useCallback(async () => {
    let query = supabase
      .from("queue_entries")
      .select("*")
      .order("created_at", { ascending: true });
    if (activeOnly) query = query.in("status", ["waiting", "proceed"]);
    if (kind) query = query.eq("kind", kind);
    const { data, error } = await query;
    if (!mounted.current) return;
    if (error) {
      setError("We couldn't load the queue right now. Retrying…");
      setEntries([]);
    } else {
      setError(null);
      setEntries((data ?? []) as QueueEntry[]);
    }
    setLoading(false);
  }, [activeOnly, kind]);

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const unsubscribe = addListener({
      onChange: () => refetchRef.current(),
      onStatus: (s) => {
        if (mounted.current) setRealtimeState(s);
      },
    });
    return unsubscribe;
  }, []);

  // Fallback polling: fast while realtime is degraded, slow safety net when live.
  useEffect(() => {
    const delay = realtimeState === "live" ? 30000 : 15000;
    const id = setInterval(() => refetchRef.current(), delay);
    return () => clearInterval(id);
  }, [realtimeState]);

  return {
    entries,
    loading,
    error,
    refetch,
    realtimeState,
    realtimeMessage:
      realtimeState === "reconnecting"
        ? "Live updates interrupted — reconnecting…"
        : realtimeState === "offline"
          ? "Live updates unavailable. Showing periodically refreshed data."
          : null,
  };
}

export async function moveQueueEntry(id: string, status: QueueStatus) {
  return supabase.from("queue_entries").update({ status }).eq("id", id);
}

/**
 * Put a cancelled (or completed) submission back on the board as a brand new
 * waiting entry — returning walk-ins keep their details and get a fresh queue
 * number instead of re-typing the intake form.
 */
export async function requeueEntry(entry: QueueEntry) {
  return supabase
    .from("queue_entries")
    .insert({
      kind: entry.kind,
      status: "waiting",
      client_name: entry.client_name,
      contact_number: entry.contact_number,
      device_type: entry.device_type,
      brand: entry.brand,
      model: entry.model,
      chief_complaint: entry.chief_complaint,
      form_payload: entry.form_payload ?? {},
    } as any)
    .select()
    .single();
}

