import { pickRoundRobin } from "@/lib/techRotation";

export type AssignRow = { department: string; override?: string };

/**
 * Assigns each company device on its own, in row order, using the same daily
 * round-robin as the regular intake. Counts update after every pick so a batch
 * spreads across the eligible technicians of each row's department.
 * Returns null for a row whose department has nobody available.
 */
export const planCompanyAssignments = (
  rows: AssignRow[],
  poolsByDept: Record<string, string[]>,
  loadCount: Map<string, number>,
  lastAt: Map<string, number>,
  dayNumber: number,
  now: number = Date.now(),
): (string | null)[] => {
  const load = new Map(loadCount);
  const last = new Map(lastAt);
  return rows.map((r, i) => {
    const pool = poolsByDept[r.department] ?? [];
    const pick = r.override && pool.includes(r.override) ? r.override : pool.length ? pickRoundRobin(pool, load, last, dayNumber) : null;
    if (pick) { load.set(pick, (load.get(pick) ?? 0) + 1); last.set(pick, now + i); }
    return pick;
  });
};
