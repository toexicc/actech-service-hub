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
  /** Non-status work events that still count as real output. */
  event?:
    | "payment"
    | "release"
    | "void"
    | "ai_diagnosis"
    | "ai_report"
    | "quotation"
    | "photos_diagnosis"
    | "photos_report"
    | "backjob"
    | "approval";


  /** Person who performed the logged action (from activity_logs.actor_name). */
  actor?: string;
  /** Role stored on the log row, when present. */
  role?: string;
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
const WAITING_PARTS_RE = /waiting\s*for\s*parts[^a-z]*(on|off|enabled|disabled)/i;
/** POS payment entries, e.g. "POS: Recorded Full Payment of Php 6500.00 via Cash (TXN…)". */
const PAYMENT_RE = /^POS:\s*Recorded\b.*\bpayment\b/i;
/** Device release confirmations from the release queue or a manual release. */
const RELEASE_EVENT_RE = /device\s+released\s+to\s+client/i;
/** A voided transaction cancels the payment credit for that ticket. */
const VOID_RE = /^voided\s+transaction\b/i;
/** AI diagnosis / report generation (a real diagnosis-stage work event). */
const AI_DIAGNOSIS_RE = /(format with ai \(ai diagnosis\)|ai diagnosis (updated|generated))/i;
const AI_REPORT_RE = /(format with ai \(ai service report\)|ai (service )?report (updated|generated))/i;
/** Quotation generated / regenerated / stored. */
const QUOTATION_RE = /service quotation (form )?(generated|updated|auto-regenerated|document stored)/i;
/** Photo uploads on the diagnosis or device report galleries. */
const PHOTO_RE = /(diagnosis|device report)\s+photos?\b.*\b(uploaded|added)/i;
/** Backjob raised on a ticket. */
const BACKJOB_RE = /^marked as backjob/i;
/** Client approval captured on the public tracker. */
const APPROVAL_RE = /client approved on \/track/i;



export const parseStatusLog = (row: any): StatusLogEntry | null => {
  const action = String(row?.action ?? "");
  const serviceId = String(row?.entity_id ?? "").trim();
  if (!serviceId) return null;
  const actor = String(row?.actor_name ?? "").trim() || undefined;
  const role = String(row?.changes?.role ?? "").trim() || undefined;
  const m = action.match(STATUS_RE);
  if (m) {
    return {
      serviceId,
      createdAt: row.created_at,
      from: m[1].trim(),
      to: m[2].trim(),
      actor,
      role,
    };
  }
  const w = action.match(WAITING_PARTS_RE);
  if (w) {
    const flag = w[1].toLowerCase();
    return {
      serviceId,
      createdAt: row.created_at,
      waitingParts: flag === "on" || flag === "enabled" ? "on" : "off",
      actor,
      role,
    };
  }
  if (/^New service created/i.test(action)) {
    return { serviceId, createdAt: row.created_at, created: true, actor, role };
  }
  if (PAYMENT_RE.test(action)) {
    return { serviceId, createdAt: row.created_at, event: "payment", actor, role };
  }
  if (RELEASE_EVENT_RE.test(action)) {
    return { serviceId, createdAt: row.created_at, event: "release", actor, role };
  }
  if (VOID_RE.test(action)) {
    return { serviceId, createdAt: row.created_at, event: "void", actor, role };
  }
  if (PHOTO_RE.test(action)) {
    const isReport = /device report/i.test(action);
    return {
      serviceId,
      createdAt: row.created_at,
      event: isReport ? "photos_report" : "photos_diagnosis",
      actor,
      role,
    };
  }
  if (QUOTATION_RE.test(action)) {
    return { serviceId, createdAt: row.created_at, event: "quotation", actor, role };
  }
  if (AI_REPORT_RE.test(action)) {
    return { serviceId, createdAt: row.created_at, event: "ai_report", actor, role };
  }
  if (AI_DIAGNOSIS_RE.test(action)) {
    return { serviceId, createdAt: row.created_at, event: "ai_diagnosis", actor, role };
  }
  if (BACKJOB_RE.test(action)) {
    return { serviceId, createdAt: row.created_at, event: "backjob", actor, role };
  }
  if (APPROVAL_RE.test(action)) {
    return { serviceId, createdAt: row.created_at, event: "approval", actor, role };
  }

  return null;

};

/* ------------------------------------------------------------------
 * Actor output (who actually moves tickets)
 * ------------------------------------------------------------------ */

export interface ActorOutput {
  name: string;
  role: string;
  moves: number;
  ticketsTouched: number;
  diagnosed: number;
  toRepair: number;
  released: number;
  /** Payment events recorded by this person (voided ones excluded). */
  paid: number;
  /** Device hand-over events confirmed by this person. */
  handedOver: number;
  /** AI diagnosis generations (diagnosis stage support work). */
  aiDiagnosis: number;
  /** AI service report generations (repair stage support work). */
  aiReports: number;
  /** Quotations generated or regenerated. */
  quotations: number;
  /** Diagnosis photo batches uploaded. */
  photos: number;
  /** Device report photo batches uploaded. */
  reportPhotos: number;
  /** Backjobs raised by this person. */
  backjobs: number;
  /** Client approvals captured on the public tracker. */
  approvals: number;
  completed: number;
  drivenEndToEnd: number;
  assignedUntouched: number;
}

const norm = (s: any) => String(s ?? "").trim().toLowerCase();

/** Automated actors must never appear on a staff leaderboard. */
const SYSTEM_ACTOR_RE = /^system\b/i;

/**
 * Resolves the many ways one person shows up in the log to a single identity:
 * a trailing " - Management" style suffix is stripped, login emails are matched
 * against the staff directory, and a short first name is merged into a
 * directory full name when it matches exactly one person.
 */
export const makeActorResolver = (
  staff: Array<{ name?: string; username?: string; role?: string }> = [],
) => {
  const byKey = new Map<string, string>();
  const fullNames: string[] = [];
  staff.forEach((p) => {
    const name = String(p.name ?? "").trim();
    if (!name) return;
    fullNames.push(name);
    byKey.set(norm(name), name);
    const username = String(p.username ?? "").trim();
    if (username) {
      byKey.set(norm(username), name);
      byKey.set(norm(username.split("@")[0]), name);
    }
  });

  return (raw: string): string => {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) return trimmed;
    const stripped = trimmed.replace(/\s*[-–]\s*(admin|administrator|management|technician|tech|staff)\s*$/i, "").trim() || trimmed;
    const direct = byKey.get(norm(stripped)) || byKey.get(norm(stripped.split("@")[0]));
    if (direct) return direct;
    const short = norm(stripped);
    const prefixMatches = fullNames.filter((n) => norm(n).startsWith(`${short} `));
    if (short && prefixMatches.length === 1) return prefixMatches[0];
    return stripped;
  };
};

const CONFIRMED = new Set(["confirmed diagnosis"]);
const TO_REPAIR = new Set(["waiting to proceed", "proceed repair", "ongoing service"]);
const RELEASE = new Set(["done repair - for release", "done repair - advise client"]);
const DONE = new Set(["completed"]);




/**
 * Measures real output from the activity-log status transitions instead of
 * assignment fields: how many moves each person made, how many tickets they
 * touched, and which tickets they carried all the way to Completed.
 *
 * Moves are scoped by *when they happened* (the log timestamp inside `period`),
 * so work done this week on an older ticket still counts. `services` supplies
 * the assignment fields used for the "assigned but untouched" idle check.
 */
export const buildActorOutput = (
  logs: StatusLogEntry[],
  services: any[],
  staff: Array<{ name?: string; username?: string; role?: string }> = [],
  period?: Period | null,
): ActorOutput[] => {
  const resolve = makeActorResolver(staff);
  const isPerson = (name?: string) => !!name && !SYSTEM_ACTOR_RE.test(name.trim());

  const inWindow = (raw: any): boolean => {
    if (!period?.start || !period?.end) return true;
    const d = toDate(raw);
    return !!d && d >= period.start && d <= period.end;
  };

  // Payments later voided on the same ticket by the same person don't count.
  const voided = new Set<string>();
  logs.forEach((l) => {
    if (l.event !== "void" || !l.actor) return;
    voided.add(`${norm(resolve(l.actor))}|${String(l.serviceId || "").trim()}`);
  });

  const relevant = logs.filter(
    (l) =>
      (!!l.to || !!l.created || (!!l.event && l.event !== "void")) &&
      isPerson(l.actor) &&
      inWindow(l.createdAt),
  );

  const roleByName = new Map<string, string>();
  staff.forEach((p) => {
    const role = String(p.role ?? "").trim();
    if (!role) return;
    if (p.name) roleByName.set(norm(p.name), role);
    if (p.username) roleByName.set(norm(p.username), role);
  });

  interface Acc {
    name: string;
    role: string;
    moves: number;
    tickets: Set<string>;
    diagnosed: number;
    toRepair: number;
    released: number;
    paid: number;
    handedOver: number;
    aiDiagnosis: number;
    aiReports: number;
    quotations: number;
    photos: number;
    reportPhotos: number;
    backjobs: number;
    approvals: number;
    completed: number;
    completedTickets: Set<string>;
  }
  const map = new Map<string, Acc>();
  const get = (rawName: string, role?: string): Acc => {
    const name = resolve(rawName);
    const key = norm(name);
    let e = map.get(key);
    if (!e) {
      e = {
        name,
        role: roleByName.get(key) || role || "",
        moves: 0,
        tickets: new Set(),
        diagnosed: 0,
        toRepair: 0,
        released: 0,
        paid: 0,
        handedOver: 0,
        aiDiagnosis: 0,
        aiReports: 0,
        quotations: 0,
        photos: 0,
        reportPhotos: 0,
        backjobs: 0,
        approvals: 0,
        completed: 0,
        completedTickets: new Set(),
      };
      map.set(key, e);
    }
    if (!e.role) e.role = roleByName.get(key) || role || "";
    return e;
  };

  relevant.forEach((l) => {
    const id = String(l.serviceId || "").trim();
    if (!id) return;
    const e = get(l.actor!, l.role);
    if (l.event === "payment" && voided.has(`${norm(e.name)}|${id}`)) return;
    e.moves += 1;
    e.tickets.add(id);
    if (l.created) {
      e.diagnosed += 1;
      return;
    }
    if (l.event) {
      // Diagnosis-stage support work rolls into Diagnosed; report-stage support
      // work rolls into Released, so the chart matches the leaderboard totals.
      if (l.event === "ai_diagnosis") { e.aiDiagnosis += 1; e.diagnosed += 1; }
      if (l.event === "quotation") { e.quotations += 1; e.diagnosed += 1; }
      if (l.event === "photos_diagnosis") { e.photos += 1; e.diagnosed += 1; }
      if (l.event === "ai_report") { e.aiReports += 1; e.released += 1; }
      if (l.event === "photos_report") { e.reportPhotos += 1; e.released += 1; }
      if (l.event === "backjob") e.backjobs += 1;
      if (l.event === "approval") e.approvals += 1;
      if (l.event === "payment") e.paid += 1;
      if (l.event === "release") e.handedOver += 1;
      // Only payment and hand-over close a ticket in practice.
      if (
        (l.event === "payment" || l.event === "release") &&
        !e.completedTickets.has(id)
      ) {
        e.completed += 1;
        e.completedTickets.add(id);
      }
      return;
    }
    const to = norm(l.to);
    if (CONFIRMED.has(to)) e.diagnosed += 1;
    if (TO_REPAIR.has(to)) e.toRepair += 1;
    if (RELEASE.has(to)) e.released += 1;
    if (DONE.has(to) && !e.completedTickets.has(id)) {
      e.completed += 1;
      e.completedTickets.add(id);
    }
  });

  // Driven end-to-end: closed the ticket AND made at least one earlier move on
  // it (counted across the whole log, not just the period).
  const movesPerActorTicket = new Map<string, number>();
  logs.forEach((l) => {
    if ((!l.to && l.event !== "payment" && l.event !== "release") || !isPerson(l.actor)) return;
    const id = String(l.serviceId || "").trim();
    if (!id) return;
    const key = `${norm(resolve(l.actor!))}|${id}`;
    movesPerActorTicket.set(key, (movesPerActorTicket.get(key) || 0) + 1);
  });




  // Assignment fields, used only for the idle check.
  const assigned = new Map<string, Set<string>>();
  services.forEach((s) => {
    const id = String(s.serviceId || "").trim();
    if (!id) return;
    const names = [s.adminRep, s.receivingStaff, s.technician]
      .flatMap((v) => String(v ?? "").split(","))
      .map((n) => n.trim())
      .filter(Boolean);
    names.forEach((n) => {
      if (!isPerson(n)) return;
      const key = norm(resolve(n));
      const set = assigned.get(key) || new Set<string>();
      set.add(id);
      assigned.set(key, set);
      get(n);
    });
  });


  return Array.from(map.entries())
    .map(([key, v]) => {
      const driven = Array.from(v.completedTickets).filter(
        (id) => (movesPerActorTicket.get(`${key}|${id}`) || 0) > 1,
      ).length;
      const assignedIds = assigned.get(key) || new Set<string>();
      const untouched = Array.from(assignedIds).filter((id) => !v.tickets.has(id)).length;
      return {
        name: v.name,
        role: v.role,
        moves: v.moves,
        ticketsTouched: v.tickets.size,
        diagnosed: v.diagnosed,
        toRepair: v.toRepair,
        released: v.released,
        aiDiagnosis: v.aiDiagnosis,
        aiReports: v.aiReports,
        quotations: v.quotations,
        photos: v.photos,
        reportPhotos: v.reportPhotos,
        backjobs: v.backjobs,
        approvals: v.approvals,
        paid: v.paid,
        handedOver: v.handedOver,

        completed: v.completed,
        drivenEndToEnd: driven,
        assignedUntouched: untouched,
      };
    })
    .sort((a, b) => b.moves - a.moves || b.completed - a.completed);
};

export interface ServiceTiming {
  serviceId: string;
  /** Total productive hours from intake to completion (null when not completed). */
  totalHours: number | null;
  /** Hours spent in each status before leaving it (paused stages included). */
  stageHours: Record<string, number>;
  /** Working hours excluded because the ticket was paused. */
  pausedHours: number;
  fromLogs: boolean;
}

/**
 * Builds per-service timings. Uses the parsed activity log timeline when
 * available and falls back to date_received -> date_completed otherwise.
 * All durations count working time only (10:00-19:00 Manila, minus the 1.5h
 * daily break, skipping Sundays and shop closed dates).
 *
 * The turnaround clock pauses while the ticket sits in a non-productive status
 * (see PAUSED_STATUSES) and while the Waiting for Parts flag is on.
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
    let pausedHours = 0;
    let fromLogs = false;

    const transitions = entries.filter((e) => e.to);
    if (transitions.length) {
      fromLogs = true;
      const firstStamp =
        toDate(entries[0].createdAt) && received && received < toDate(entries[0].createdAt)!
          ? received
          : toDate(entries[0].createdAt);

      const completedTransition = [...transitions]
        .reverse()
        .find((t) => classifyStatus(t.to) === "completed");
      const endStamp = completedTransition ? toDate(completedTransition.createdAt) : null;

      // Waiting-for-Parts windows, closed at the end boundary when still open.
      const partWindows: { start: Date; end: Date }[] = [];
      let openWindow: Date | null = null;
      entries.forEach((e) => {
        if (!e.waitingParts) return;
        const at = toDate(e.createdAt);
        if (!at) return;
        if (e.waitingParts === "on") {
          if (!openWindow) openWindow = at;
        } else if (openWindow) {
          partWindows.push({ start: openWindow, end: at });
          openWindow = null;
        }
      });
      if (openWindow && endStamp && endStamp > openWindow) {
        partWindows.push({ start: openWindow, end: endStamp });
      }

      const pausedByParts = (from: Date, to: Date) =>
        partWindows.reduce((sum, w) => {
          const a = new Date(Math.max(+from, +w.start));
          const b = new Date(Math.min(+to, +w.end));
          return b > a ? sum + workingHoursBetween(a, b, closed) : sum;
        }, 0);

      let counted = 0;
      let cursor = firstStamp;
      let reachedEnd = false;

      const walk = (segmentEnd: Date | null, stageName: string) => {
        if (!cursor || !segmentEnd || segmentEnd < cursor) return;
        const stage = stageName.trim() || "Pending Diagnosis";
        const hrs = workingHoursBetween(cursor, segmentEnd, closed);
        stageHours[stage] = (stageHours[stage] || 0) + hrs;
        if (isPausedStatus(stage)) {
          pausedHours += hrs;
        } else {
          const parts = Math.min(hrs, pausedByParts(cursor, segmentEnd));
          pausedHours += parts;
          counted += Math.max(0, hrs - parts);
        }
        cursor = segmentEnd;
      };

      for (const t of transitions) {
        const at = toDate(t.createdAt);
        walk(at, t.from || "Pending Diagnosis");
        if (endStamp && at && +at === +endStamp) {
          reachedEnd = true;
          break;
        }
      }

      if (endStamp && firstStamp && reachedEnd) totalHours = counted;
    }

    if (totalHours === null && classifyStatus(s.status) === "completed") {
      const end = toDate(s.dateCompleted || s.lastUpdated);
      if (received && end && end >= received) {
        totalHours = workingHoursBetween(received, end, closed);
        fromLogs = false;
      }
    }




    out.set(id, { serviceId: id, totalHours, stageHours, pausedHours, fromLogs });
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
