/**
 * Cross-checks attendance logs against technician ticket assignments for a day,
 * so management can spot missing time-ins/outs and work logged by staff who
 * were never clocked in.
 */

export interface ReconcileAttendanceRow {
  staff_id: string;
  staff_name: string;
  log_date: string;
  time_in: string | null;
  time_out: string | null;
}

export interface ReconcileStaff {
  userId?: string;
  name: string;
  department?: string;
  status?: string;
}

export interface ReconcileService {
  serviceId?: string;
  technicians?: string[];
  dateReceived?: any;
  lastUpdated?: any;
  status?: string;
}

export interface ReconcileEntry {
  name: string;
  staffId: string | null;
  /** Attendance log found for the day. */
  timeIn: string | null;
  timeOut: string | null;
  hasLog: boolean;
  /** Tickets this person is assigned to that moved on the day. */
  tickets: string[];
  /** Flags describing what management needs to fix. */
  issues: string[];
  /** True when the technician has no staff profile at all. */
  unknownStaff: boolean;
}

/** Loose name key so "Juan Dela Cruz - Mobile" matches "Juan Dela Cruz". */
export const nameKey = (raw: string): string =>
  String(raw ?? "")
    .split(" - ")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const dayKey = (raw: any): string => {
  if (!raw) return "";
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  // Manila calendar day (UTC+8, no DST).
  return new Date(d.getTime() + 8 * 3600000).toISOString().slice(0, 10);
};

/**
 * Build one row per person who either logged attendance or touched a ticket on
 * the given Manila date.
 */
export const reconcileAttendance = (
  date: string,
  attendance: ReconcileAttendanceRow[],
  staff: ReconcileStaff[],
  services: ReconcileService[],
): ReconcileEntry[] => {
  const day = date.slice(0, 10);

  const logsByKey = new Map<string, ReconcileAttendanceRow>();
  attendance
    .filter((r) => dayKey(r.log_date) === day)
    .forEach((r) => logsByKey.set(nameKey(r.staff_name), r));

  const profilesByKey = new Map<string, ReconcileStaff>();
  staff.forEach((s) => profilesByKey.set(nameKey(s.name), s));

  // Tickets that moved on the day, grouped by assigned technician.
  const ticketsByKey = new Map<string, Set<string>>();
  services.forEach((s) => {
    const touched = dayKey(s.lastUpdated) === day || dayKey(s.dateReceived) === day;
    if (!touched) return;
    (s.technicians ?? []).forEach((raw) => {
      const key = nameKey(raw);
      if (!key) return;
      const set = ticketsByKey.get(key) ?? new Set<string>();
      if (s.serviceId) set.add(String(s.serviceId));
      ticketsByKey.set(key, set);
    });
  });

  const keys = new Set<string>([...logsByKey.keys(), ...ticketsByKey.keys()]);

  const entries: ReconcileEntry[] = Array.from(keys).map((key) => {
    const log = logsByKey.get(key) ?? null;
    const profile = profilesByKey.get(key) ?? null;
    const tickets = Array.from(ticketsByKey.get(key) ?? []);
    const issues: string[] = [];

    if (!log && tickets.length) issues.push("Worked on tickets but has no attendance log");
    if (log && !log.time_in) issues.push("Missing time in");
    if (log && log.time_in && !log.time_out) issues.push("Missing time out");
    if (log?.time_in && tickets.length === 0) issues.push("Clocked in but no ticket activity");
    if (!profile) issues.push("No staff profile found for this name");

    return {
      name: log?.staff_name || profile?.name || key,
      staffId: log?.staff_id || profile?.userId || null,
      timeIn: log?.time_in ?? null,
      timeOut: log?.time_out ?? null,
      hasLog: !!log,
      tickets,
      issues,
      unknownStaff: !profile,
    };
  });

  return entries.sort((a, b) => {
    if (a.issues.length !== b.issues.length) return b.issues.length - a.issues.length;
    return a.name.localeCompare(b.name);
  });
};
