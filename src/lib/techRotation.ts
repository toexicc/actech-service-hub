import { supabase } from "@/integrations/supabase/client";

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Days since epoch on the Manila calendar. */
export const manilaDayNumber = (now: number = Date.now()) =>
  Math.floor((now + MANILA_OFFSET_MS) / 86_400_000);

/** UTC ISO timestamp of today's Manila midnight. */
export const manilaDayStartIso = (now: number = Date.now()) =>
  new Date(manilaDayNumber(now) * 86_400_000 - MANILA_OFFSET_MS).toISOString();

/**
 * Daily round-robin pick: fewest tickets today, then assigned longest ago
 * (never-assigned first), then a roster order that rotates by day.
 */
export const pickRoundRobin = (
  names: string[],
  loadCount: Map<string, number>,
  lastAt: Map<string, number>,
  dayNumber: number,
): string => {
  const roster = [...names].sort((a, b) => a.localeCompare(b));
  const n = roster.length;
  const offset = n ? ((dayNumber % n) + n) % n : 0;
  const rank = new Map(roster.map((name, i) => [name, (i - offset + n) % n]));
  return [...names].sort((a, b) => {
    const la = loadCount.get(a) ?? 0;
    const lb = loadCount.get(b) ?? 0;
    if (la !== lb) return la - lb;
    const ta = lastAt.get(a) ?? -1;
    const tb = lastAt.get(b) ?? -1;
    if (ta !== tb) return ta - tb;
    return (rank.get(a) ?? 0) - (rank.get(b) ?? 0);
  })[0];
};

/** Tickets created today per technician, and when each last received one. */
export const fetchTodayAssignments = async () => {
  const { data } = await supabase
    .from("services")
    .select("technicians,created_at")
    .gte("created_at", manilaDayStartIso());
  const loadCount = new Map<string, number>();
  const lastAt = new Map<string, number>();
  (data ?? []).forEach((r: any) => {
    const t = new Date(r.created_at).getTime();
    (r.technicians ?? []).forEach((name: string) => {
      const key = String(name).trim();
      if (!key) return;
      loadCount.set(key, (loadCount.get(key) ?? 0) + 1);
      lastAt.set(key, Math.max(lastAt.get(key) ?? -1, t));
    });
  });
  return { loadCount, lastAt };
};
