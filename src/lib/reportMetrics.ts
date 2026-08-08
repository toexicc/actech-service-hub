/**
 * Pure helpers for the Reports page: date bucketing, log-derived stage timings,
 * turnaround in hours and period-over-period deltas.
 */
import { parseManilaDate } from "@/lib/timezone";
import { classifyStatus } from "@/lib/serviceStatus";

export interface StatusLogEntry {
  serviceId: string;
  createdAt: string;
  from?: string;
  to?: string;
  created?: boolean;
  /** "on" / "off" when the entry is a Waiting-for-Parts toggle event. */
  waitingParts?: "on" | "off";
}

/**
 * Statuses where the shop is not actively working the ticket — the turnaround
 * clock is paused while a ticket sits in any of these.
 */
export const PAUSED_STATUSES = new Set(
  [
    "Waiting to Proceed",
    "Done Repair - Advise Client",
    "On Hold",
    "Cancelled",
    "RTO",
  ].map((s) => s.toLowerCase()),
);

export const isPausedStatus = (status?: string | null) =>
  PAUSED_STATUSES.has(String(status ?? "").trim().toLowerCase());


/* ------------------------------------------------------------------
 * Business-hours math (Manila shop shift)
 * ------------------------------------------------------------------ */

/** Shop shift, Manila time. */
export const SHIFT_START_HOUR = 10; // 10:00 AM
export const SHIFT_END_HOUR = 19; // 7:00 PM
/** Unpaid break deducted per full working day. */
export const BREAK_HOURS = 1.5;
/** Productive hours in a full working day (9h shift - 1.5h break). */
export const WORKDAY_HOURS = SHIFT_END_HOUR - SHIFT_START_HOUR - BREAK_HOURS;

const MANILA_OFFSET_MS = 8 * 3600000;

/** Manila calendar day key (yyyy-mm-dd) for an instant. */
const manilaDayKey = (ms: number): string => new Date(ms + MANILA_OFFSET_MS).toISOString().slice(0, 10);

/** Sunday check on the Manila calendar day that starts at `dayStartUtc`. */
const isManilaSunday = (dayStartUtc: number): boolean =>
  new Date(dayStartUtc + MANILA_OFFSET_MS + 1).getUTCDay() === 0;

/**
 * Working hours between two instants, counting only the 10:00-19:00 Manila
 * shift, skipping Sundays and shop closed dates and deducting the 1.5h daily
 * break (pro-rated for partial days). Time outside the shift is not counted.
 */
export const workingHoursBetween = (
  start: Date | null | undefined,
  end: Date | null | undefined,
  closedDates: Iterable<string> = [],
): number => {
  if (!start || !end) return 0;
  const from = start.getTime();
  const to = end.getTime();
  if (!(to > from)) return 0;

  const closed = new Set(Array.from(closedDates).map((d) => String(d).slice(0, 10)));
  const shiftMs = (SHIFT_END_HOUR - SHIFT_START_HOUR) * 3600000;
  let total = 0;

  // Walk Manila calendar days from the start day to the end day.
  let dayStartUtc = Date.UTC(
    new Date(from + MANILA_OFFSET_MS).getUTCFullYear(),
    new Date(from + MANILA_OFFSET_MS).getUTCMonth(),
    new Date(from + MANILA_OFFSET_MS).getUTCDate(),
  ) - MANILA_OFFSET_MS;
  const lastDayKey = manilaDayKey(to);

  for (let guard = 0; guard < 3650; guard++) {
    const key = manilaDayKey(dayStartUtc + 1);
    const shiftOpen = dayStartUtc + SHIFT_START_HOUR * 3600000;
    const shiftClose = dayStartUtc + SHIFT_END_HOUR * 3600000;
    if (!closed.has(key) && !isManilaSunday(dayStartUtc)) {
      const overlap = Math.min(to, shiftClose) - Math.max(from, shiftOpen);
      if (overlap > 0) {
        // Deduct the break in proportion to how much of the shift was used.
        total += (overlap / shiftMs) * (shiftMs / 3600000 - BREAK_HOURS);
      }
    }

    if (key >= lastDayKey) break;
    dayStartUtc += 24 * 3600000;
  }

  return Math.max(0, total);
};

/** Working hours expressed as shop days (7.5 productive hours each). */
export const workingDaysFromHours = (hours: number) => (WORKDAY_HOURS ? hours / WORKDAY_HOURS : 0);


export const toDate = (raw: any): Date | null => {
  if (!raw) return null;
  const d = typeof raw === "string" && raw.length <= 10 ? parseManilaDate(raw) : new Date(raw);
  return d && !isNaN(d.getTime()) ? d : null;
};

/** Php currency formatting. */
export const peso = (n: number) =>
  `Php ${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const compactPeso = (n: number) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(Math.round(v));
};

/** Hours -> "45m" / "6h 20m" / "2d 4h" (only crosses to days above 24h). */
export const formatHours = (hours?: number | null): string => {
  if (hours === null || hours === undefined || !isFinite(hours) || hours <= 0) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  return h ? `${d}d ${h}h` : `${d}d`;
};

export const pct = (n: number) => `${(isFinite(n) ? n : 0).toFixed(1)}%`;

export const delta = (current: number, previous: number): number | null => {
  if (!isFinite(previous) || previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

/* ------------------------------------------------------------------ */
/* Periods                                                             */
/* ------------------------------------------------------------------ */

export interface Period {
  start: Date | null;
  end: Date | null;
  label: string;
}

export const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

export const monthPeriod = (year: number, month: number): Period => {
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return {
    start,
    end,
    label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
};

export const lastMonths = (count: number): { year: number; month: number; label: string }[] => {
  const out: { year: number; month: number; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    });
  }
  return out;
};

export const previousPeriod = (p: Period): Period | null => {
  if (!p.start || !p.end) return null;
  const span = p.end.getTime() - p.start.getTime();
  const end = new Date(p.start.getTime() - 1);
  const start = new Date(end.getTime() - span);
  return { start, end, label: "Previous period" };
};

export const inPeriod = (raw: any, p: Period): boolean => {
  if (!p.start || !p.end) return true;
  const d = toDate(raw);
  return !!d && d >= p.start && d <= p.end;
};

/* ------------------------------------------------------------------ */
/* Bucketing                                                           */
/* ------------------------------------------------------------------ */

export type BucketMode = "day" | "week" | "month";

export const pickBucketMode = (p: Period, fallbackDates: Date[]): BucketMode => {
  let start = p.start;
  let end = p.end;
  if (!start || !end) {
    const times = fallbackDates.map((d) => d.getTime()).filter(Boolean);
    if (!times.length) return "month";
    start = new Date(Math.min(...times));
    end = new Date(Math.max(...times));
  }
  const days = (end.getTime() - start.getTime()) / 86400000;
  if (days <= 45) return "day";
  if (days <= 200) return "week";
  return "month";
};

export const bucketKey = (d: Date, mode: BucketMode): string => {
  if (mode === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (mode === "week") {
    const x = startOfDay(d);
    x.setDate(x.getDate() - x.getDay());
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const bucketLabel = (key: string, mode: BucketMode): string => {
  const parts = key.split("-").map((n) => parseInt(n, 10));
  if (mode === "month") {
    return new Date(parts[0], parts[1] - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const base = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return mode === "week" ? `wk ${base}` : base;
};

/* ------------------------------------------------------------------ */
/* Log-derived timelines                                               */
/* ------------------------------------------------------------------ */

const STATUS_RE = /Status:\s*(.+?)\s*(?:→|->)\s*([^,]+)/;

export const parseStatusLog = (row: any): StatusLogEntry | null => {
  const action = String(row?.action ?? "");
  const serviceId = String(row?.entity_id ?? "").trim();
  if (!serviceId) return null;
  const m = action.match(STATUS_RE);
  if (m) {
    return {
      serviceId,
      createdAt: row.created_at,
      from: m[1].trim(),
      to: m[2].trim(),
    };
  }
  if (/^New service created/i.test(action)) {
    return { serviceId, createdAt: row.created_at, created: true };
  }
  return null;
};

export interface ServiceTiming {
  serviceId: string;
  /** Total hours from intake to completion (null when not completed). */
  totalHours: number | null;
  /** Hours spent in each status before leaving it. */
  stageHours: Record<string, number>;
  fromLogs: boolean;
}

/**
 * Builds per-service timings. Uses the parsed activity log timeline when
 * available and falls back to date_received -> date_completed otherwise.
 * All durations count working time only (10:00-19:00 Manila, minus the 1.5h
 * daily break, skipping shop closed dates).
 */
export const buildTimings = (
  services: any[],
  logs: StatusLogEntry[],
  closedDates: Iterable<string> = [],
): Map<string, ServiceTiming> => {
  const byService = new Map<string, StatusLogEntry[]>();
  logs.forEach((l) => {
    const arr = byService.get(l.serviceId) || [];
    arr.push(l);
    byService.set(l.serviceId, arr);
  });
  byService.forEach((arr) =>
    arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
  );

  const closed = new Set(Array.from(closedDates).map((d) => String(d).slice(0, 10)));
  const out = new Map<string, ServiceTiming>();

  services.forEach((s) => {
    const id = String(s.serviceId || "").trim();
    if (!id) return;
    const entries = byService.get(id) || [];
    const received = toDate(s.dateReceived || s.timestamp);
    const stageHours: Record<string, number> = {};

    let totalHours: number | null = null;
    let fromLogs = false;

    const transitions = entries.filter((e) => e.to);
    if (transitions.length) {
      fromLogs = true;
      const firstStamp =
        toDate(entries[0].createdAt) && received && received < toDate(entries[0].createdAt)!
          ? received
          : toDate(entries[0].createdAt);

      let cursor = firstStamp;
      transitions.forEach((t) => {
        const at = toDate(t.createdAt);
        if (cursor && at && at >= cursor) {
          const stage = (t.from || "Pending Diagnosis").trim();
          const hrs = workingHoursBetween(cursor, at, closed);
          stageHours[stage] = (stageHours[stage] || 0) + hrs;
        }
        cursor = at || cursor;
      });

      const completedTransition = [...transitions]
        .reverse()
        .find((t) => classifyStatus(t.to) === "completed");
      if (completedTransition && firstStamp) {
        const end = toDate(completedTransition.createdAt);
        if (end && end >= firstStamp) totalHours = workingHoursBetween(firstStamp, end, closed);
      }
    }

    if (totalHours === null && classifyStatus(s.status) === "completed") {
      const end = toDate(s.dateCompleted || s.lastUpdated);
      if (received && end && end >= received) {
        totalHours = workingHoursBetween(received, end, closed);
        fromLogs = false;
      }
    }



    out.set(id, { serviceId: id, totalHours, stageHours, fromLogs });
  });

  return out;
};

export const TURNAROUND_BUCKETS = [
  { label: "< 4h", min: 0, max: 4 },
  { label: "4–24h", min: 4, max: 24 },
  { label: "1–3d", min: 24, max: 72 },
  { label: "3–7d", min: 72, max: 168 },
  { label: "7d+", min: 168, max: Infinity },
];

export const bucketTurnaround = (hoursList: number[]) =>
  TURNAROUND_BUCKETS.map((b) => ({
    label: b.label,
    count: hoursList.filter((h) => h >= b.min && h < b.max).length,
  }));

export const avg = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
