import { supabase } from "@/integrations/supabase/client";

export const VIEW_THROTTLE_MS = 5 * 60 * 1000;

export type PickupAction =
  | "pickup_viewed" | "pickup_created" | "pickup_updated"
  | "pickup_cancelled" | "pickup_deleted" | "pickup_done" | "pickup_rescheduled";

export const ACTION_LABEL: Record<PickupAction, string> = {
  pickup_viewed: "Viewed schedule",
  pickup_created: "Created",
  pickup_updated: "Edited",
  pickup_cancelled: "Cancelled",
  pickup_deleted: "Deleted",
  pickup_done: "Marked done",
  pickup_rescheduled: "Rescheduled",
};

/** Strip everything but digits and dot; returns null for blank/invalid. */
export const parseCost = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[^0-9.]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** True when a view for this rider+date should be logged (once per 5 min). */
export const shouldLogView = (lastAt: number | undefined, now: number) =>
  lastAt === undefined || now - lastAt >= VIEW_THROTTLE_MS;

export const logPickup = async (action: PickupAction, entityId: string, changes: Record<string, unknown>) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: name } = await supabase.rpc("get_my_name");
    await supabase.from("activity_logs").insert({
      actor_id: user?.id ?? null, actor_name: (name as string) || null,
      action, entity_type: "pickup", entity_id: entityId, changes: changes as never,
    });
  } catch { /* logging must never block the flow */ }
};

const KEY = "pickup_view_log";
export const logViewThrottled = (date: string) => {
  let map: Record<string, number> = {};
  try { map = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { /* ignore */ }
  const now = Date.now();
  if (!shouldLogView(map[date], now)) return;
  map[date] = now;
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* ignore */ }
  void logPickup("pickup_viewed", date, { date });
};
