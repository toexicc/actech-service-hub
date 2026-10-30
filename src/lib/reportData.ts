import type { Period } from "./reportMetrics";

const calendarKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Picker dates are calendar days, not instants in the browser's timezone. */
export const reportBounds = (period: Period) => ({
  start: period.start ? new Date(`${calendarKey(period.start)}T00:00:00+08:00`).toISOString() : null,
  end: period.end ? new Date(`${calendarKey(period.end)}T23:59:59.999+08:00`).toISOString() : null,
});

export const inReportPeriod = (raw: unknown, period: Period): boolean => {
  if (!period.start || !period.end) return true;
  if (!raw) return false;
  const value = String(raw);
  const instant = new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value).getTime();
  const bounds = reportBounds(period);
  return bounds.start !== null && bounds.end !== null &&
    instant >= new Date(bounds.start).getTime() && instant <= new Date(bounds.end).getTime();
};

/** Every request stays within the Data API cap; never trust a larger limit. */
export const fetchReportPages = async <T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> => {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
};