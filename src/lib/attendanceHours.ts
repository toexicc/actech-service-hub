/**
 * Attendance worked-time helpers.
 * The shop has a fixed unpaid lunch break (12:00 - 13:00 Manila), so a full
 * 10:00 AM - 7:00 PM shift counts as 8 hours, not 9.
 *
 * Rules:
 * - Hours are counted from 10:00 AM; earlier taps don't add time.
 * - 10-minute grace period: tap-ins up to 10:10 AM are not late.
 * - Lateness (past 10:10 AM) is deducted separately via lateMinutes — it does
 *   NOT reduce worked hours or overtime.
 * - Approved overtime counts everything past 7:00 PM, regardless of tap-in time.
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

/** Shift starts at 10:00 AM Manila; earlier taps don't count toward hours. */
const SHIFT_START_MIN = 10 * 60;

/** Shift ends at 7:00 PM Manila; approved overtime counts everything past it. */
const SHIFT_END_MIN = 19 * 60;

/** 10-minute grace period: tap-ins up to 10:10 AM are not late. */
const GRACE_MIN = 10;

/** Worked minutes between time in / out (counted from 10:00 AM), minus lunch.
 *  Lateness is not penalised here — it is deducted separately via lateMinutes. */
export const workedMinutes = (ti: string | null, to: string | null): number => {
  if (!ti || !to) return 0;
  let startMs = new Date(ti).getTime();
  const endMs = new Date(to).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  const tiMin = manilaMinutes(ti);
  if (tiMin < SHIFT_START_MIN) startMs += (SHIFT_START_MIN - tiMin) * 60000;
  if (endMs <= startMs) return 0;

  let mins = (endMs - startMs) / 60000;

  const start = Math.max(tiMin, SHIFT_START_MIN);
  const end = start + mins;
  const overlap = Math.max(0, Math.min(end, LUNCH_END_MIN) - Math.max(start, LUNCH_START_MIN));
  mins -= overlap;

  return Math.max(0, mins);
};

/** Approved overtime hours: all time past 7:00 PM, once approved. */
export const overtimeHours = (
  ti: string | null,
  to: string | null,
  overtimeStatus?: string | null,
): number => {
  if (!isOvertimeApproved(overtimeStatus)) return 0;
  if (!ti || !to) return 0;
  const toMin = manilaMinutes(to);
  return Math.max(0, (toMin - SHIFT_END_MIN) / 60);
};

/** Late minutes beyond the 10-minute grace period (past 10:10 AM). */
export const lateMinutes = (ti: string | null): number => {
  if (!ti) return 0;
  const tiMin = manilaMinutes(ti);
  return Math.max(0, tiMin - (SHIFT_START_MIN + GRACE_MIN));
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

/** Overtime only counts once management approves it. */
export const isOvertimeApproved = (overtimeStatus?: string | null) =>
  String(overtimeStatus || "").toLowerCase() === "approved";

/**
 * Hours that actually count for pay: extra time beyond the normal shift is only
 * included when the overtime request was approved, otherwise it is capped at the
 * standard 8-hour shift.
 */
export const payableHours = (
  ti: string | null,
  to: string | null,
  overtimeStatus?: string | null,
): number => {
  const hrs = workedHours(ti, to);
  return isOvertimeApproved(overtimeStatus) ? hrs : Math.min(hrs, FULL_SHIFT_HOURS);
};

/** Human readable payable time ("8h 00m"), overtime only when approved. */
export const formatPayableTime = (
  ti: string | null,
  to: string | null,
  overtimeStatus?: string | null,
): string => {
  const mins = Math.round(payableHours(ti, to, overtimeStatus) * 60);
  if (!ti || !to || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
};
