import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RemoteChange {
  /** Server last_updated timestamp of the change. */
  lastUpdated: string;
  /** Human labels of the fields that changed remotely. */
  changedFields: string[];
  /** New status when the status changed remotely, otherwise undefined. */
  newStatus?: string;
}

const WATCHED_FIELDS: Array<{ key: string; label: string }> = [
  { key: "status", label: "Status" },
  { key: "technicians", label: "Technician" },
  { key: "admin_reps", label: "Admin rep" },
  { key: "service_cost", label: "Service cost" },
  { key: "discount", label: "Discount" },
  { key: "final_cost", label: "Final cost" },
  { key: "technician_diagnosis", label: "Technician diagnosis" },
  { key: "diagnosis", label: "AI diagnosis" },
  { key: "technician_report", label: "Technician report" },
  { key: "ai_report", label: "AI report" },
  { key: "client_approved_at", label: "Client approval" },
  { key: "approval_locked", label: "Approval hold" },
  { key: "auto_approve_diagnosis", label: "Pre-approval" },
  { key: "parts_used", label: "Parts used" },
  { key: "payment_status", label: "Payment status" },
  { key: "target_date", label: "Estimated target date" },
];

/**
 * Only the fields the watcher diffs (plus the row keys). Selecting `*` here
 * downloaded the whole ticket - AI diagnosis, reports, notes - three times per
 * ticket open, purely to compare 16 values.
 */
const WATCH_COLUMNS = ["service_id", "last_updated", ...WATCHED_FIELDS.map((f) => f.key)].join(",");

const norm = (v: any) => (Array.isArray(v) ? v.join(", ") : v === null || v === undefined ? "" : String(v));

const diffRows = (prev: any, next: any): string[] => {
  if (!prev) return [];
  return WATCHED_FIELDS.filter((f) => norm(prev[f.key]) !== norm(next[f.key])).map((f) => f.label);
};

/**
 * Watches a single service row for changes made elsewhere (other users, POS
 * auto-complete, client approval on /track) and reports them so the ticket
 * pages can either refresh silently or surface an indicator.
 */
export function useServiceLiveWatch(serviceId: string | null | undefined, active: boolean = true) {
  const [change, setChange] = useState<RemoteChange | null>(null);
  const [isLive, setIsLive] = useState(false);
  const baselineRef = useRef<any>(null);
  const selfWritesRef = useRef<Set<string>>(new Set());

  /** Called by the page after it (re)loads or saves, to reset the baseline. */
  const syncBaseline = useCallback(async (markSelfWrite?: string) => {
    if (markSelfWrite) selfWritesRef.current.add(markSelfWrite);
    if (!serviceId) return;
    const { data } = await supabase.from("services").select(WATCH_COLUMNS).eq("service_id", serviceId).maybeSingle();
    if (data) baselineRef.current = data;
    setChange(null);
  }, [serviceId]);

  const dismiss = useCallback(() => {
    setChange(null);
  }, []);

  const handleRow = useCallback((row: any) => {
    if (!row) return;
    const stamp = String(row.last_updated ?? "");
    if (selfWritesRef.current.has(stamp)) {
      baselineRef.current = row;
      return;
    }
    const prev = baselineRef.current;
    const fields = diffRows(prev, row);
    baselineRef.current = row;
    if (!prev || fields.length === 0) return;
    setChange({
      lastUpdated: stamp,
      changedFields: fields,
      newStatus: norm(prev.status) !== norm(row.status) ? String(row.status ?? "") : undefined,
    });
  }, []);

  // Seed the baseline whenever the watched ticket changes.
  useEffect(() => {
    baselineRef.current = null;
    selfWritesRef.current = new Set();
    setChange(null);
    if (!serviceId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("services").select(WATCH_COLUMNS).eq("service_id", serviceId).maybeSingle();
      if (!cancelled && data) baselineRef.current = data;
    })();
    return () => { cancelled = true; };
  }, [serviceId]);

  // Realtime subscription scoped to this single row.
  useEffect(() => {
    if (!serviceId || !active) {
      setIsLive(false);
      return;
    }
    const channel = supabase
      .channel(`service-watch-${serviceId}`)
      .on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "services", filter: `service_id=eq.${serviceId}` },
        (payload: any) => handleRow(payload.new),
      )
      .subscribe((status: string) => setIsLive(status === "SUBSCRIBED"));

    return () => {
      setIsLive(false);
      supabase.removeChannel(channel);
    };
  }, [serviceId, active, handleRow]);

  // Fallback poll when the tab regains focus (covers dropped sockets).
  useEffect(() => {
    if (!serviceId || !active) return;
    const check = async () => {
      const { data } = await supabase.from("services").select(WATCH_COLUMNS).eq("service_id", serviceId).maybeSingle();
      if (data) handleRow(data);
    };
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [serviceId, active, handleRow]);

  return { change, isLive, dismiss, syncBaseline };
}
