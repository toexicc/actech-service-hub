/**
 * One shared cut-off definition so Completed Services, the POS Transaction
 * Tracker, Reports and Salary Disbursement all read the same window.
 *
 * Cut-offs follow payroll: 1-15 and 16-end of month (Manila calendar dates).
 */

export type CutoffHalf = "first" | "second";

/** "YYYY-MM" for the current Manila month. */
export const currentCutoffMonth = (): string => {
  const now = new Date(Date.now() + 8 * 60 * 60000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Current half of the month in Manila. */
export const currentCutoffHalf = (): CutoffHalf => {
  const now = new Date(Date.now() + 8 * 60 * 60000);
  return now.getUTCDate() <= 15 ? "first" : "second";
};

/** Local Date objects for the first and last calendar day of the cut-off. */
export const cutoffRange = (month: string, half: CutoffHalf): { start: Date; end: Date } => {
  const [y, m] = month.split("-").map((n) => parseInt(n, 10));
  const year = Number.isFinite(y) ? y : new Date().getFullYear();
  const monthIdx = (Number.isFinite(m) ? m : 1) - 1;
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  const startDay = half === "first" ? 1 : 16;
  const endDay = half === "first" ? 15 : lastDay;
  return {
    start: new Date(year, monthIdx, startDay),
    end: new Date(year, monthIdx, endDay),
  };
};

/** "September 1 - 15, 2026" style label for a cut-off. */
export const cutoffLabel = (month: string, half: CutoffHalf): string => {
  const { start, end } = cutoffRange(month, half);
  const monthName = start.toLocaleString("en-US", { month: "long" });
  return `${monthName} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
};

/** Recent months (newest first) for the month picker. */
export const recentCutoffMonths = (count = 18): string[] => {
  const now = new Date(Date.now() + 8 * 60 * 60000);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
};

/** Human label for a "YYYY-MM" month key. */
export const monthLabel = (month: string): string => {
  const [y, m] = month.split("-").map((n) => parseInt(n, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return month;
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
};

/** localStorage key shared by every page that offers cut-off presets. */
export const CUTOFF_STORAGE_KEY = "payoutCutoff";
