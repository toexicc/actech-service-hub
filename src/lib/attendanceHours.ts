/**
 * Attendance worked-time helpers.
 * The shop has a fixed unpaid lunch break (12:00 - 13:00 Manila), so a full
 * 10:00 AM - 7:00 PM shift counts as 8 hours, not 9.
 */

const MANILA_OFFSET_MIN = 8 * 60;
const LUNCH_START_MIN = 12 * 60; // 12:00 PM Manila
const LUNCH_END_MIN = 13 * 60; // 1:00 PM Manila

/** Minutes since Manila midnight for an ISO timestamp. */
const manilaMinutes = (iso: string) => {
  const shifted = new Date(new Date(iso).getTime() + MANILA_OFFSET_MIN * 60000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes() + shifted.getUTCSeconds() / 60;
};

/** Full shift length in hours after the unpaid lunch break. */
export const FULL_SHIFT_HOURS = 8;

/** Worked minutes between time in / out, minus any overlap with lunch. */
export const workedMinutes = (ti: string | null, to: string | null): number => {
  if (!ti || !to) return 0;
  const startMs = new Date(ti).getTime();
  const endMs = new Date(to).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;

  let mins = (endMs - startMs) / 60000;

  const start = manilaMinutes(ti);
  const end = start + mins;
  const overlap = Math.max(0, Math.min(end, LUNCH_END_MIN) - Math.max(start, LUNCH_START_MIN));
  mins -= overlap;

  return Math.max(0, mins);
};

/** Worked hours as a decimal number (lunch excluded). */
export const workedHours = (ti: string | null, to: string | null): number => workedMinutes(ti, to) / 60;

/** Human readable "8h 05m" (lunch excluded). */
export const formatWorkedTime = (ti: string | null, to: string | null): string => {
  const mins = Math.round(workedMinutes(ti, to));
  if (!ti || !to || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
};
