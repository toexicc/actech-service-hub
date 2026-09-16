import { supabase } from "@/integrations/supabase/client";

export interface ActivityLog {
  logId?: string;
  serviceId: string;
  username: string;
  role: string;
  timestamp: string;
  activity: string;
}

const actorName = (): string => {
  try {
    return (
      sessionStorage.getItem("userFullName") ||
      sessionStorage.getItem("username") ||
      "System"
    );
  } catch {
    return "System";
  }
};

/**
 * Keep log payloads small: long before/after text blocks (AI diagnosis,
 * reports, notes) previously made activity_logs the largest table in the
 * database and every read of the timeline expensive.
 */
const MAX_ACTION = 500;
const MAX_DETAIL = 300;

const trimDetails = (details?: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {};
  Object.entries(details ?? {}).forEach(([k, v]) => {
    if (typeof v === "string") {
      const s = v.replace(/\s+/g, " ").trim();
      out[k] = s.length > MAX_DETAIL ? `${s.slice(0, MAX_DETAIL)}…` : s;
    } else if (v && typeof v === "object") {
      const s = JSON.stringify(v);
      out[k] = s.length > MAX_DETAIL ? `${s.slice(0, MAX_DETAIL)}…` : v;
    } else {
      out[k] = v;
    }
  });
  return out;
};

const PENDING_KEY = "pendingActivityLogs";
const MAX_PENDING = 50;

const readPending = (): any[] => {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

const writePending = (rows: any[]) => {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(rows.slice(-MAX_PENDING)));
  } catch {
    /* storage full or unavailable — nothing else to do */
  }
};

const insertRows = async (rows: any[]): Promise<boolean> => {
  if (!rows.length) return true;
  const { error } = await supabase.from("activity_logs").insert(rows);
  return !error;
};

/**
 * Inserts a log row. If the session has expired the request is rejected by the
 * database security rules, so the session is refreshed and the write retried;
 * if it still fails the entry is buffered locally and flushed with the next
 * successful write instead of being lost from the timeline.
 */
const sendLog = async (
  log: Omit<ActivityLog, "logId" | "timestamp"> & { details?: Record<string, any> },
) => {
  const action = String(log.activity ?? "");
  let row: any;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    row = {
      action: action.length > MAX_ACTION ? `${action.slice(0, MAX_ACTION)}…` : action,
      actor_id: session?.user?.id ?? null,
      actor_name: log.username,
      entity_type: "service",
      entity_id: log.serviceId,
      changes: { role: log.role || null, ...trimDetails(log.details) },
    };
  } catch {
    return false;
  }

  try {
    const pending = readPending();
    if (await insertRows([...pending, row])) {
      if (pending.length) writePending([]);
      return true;
    }

    // Most likely cause: the access token expired mid-action, so the request
    // arrived as anonymous. Refresh and try once more.
    await supabase.auth.refreshSession();
    const { data: { session: fresh } } = await supabase.auth.getSession();
    if (fresh?.user?.id) row.actor_id = fresh.user.id;
    if (fresh && (await insertRows([...pending, row]))) {
      if (pending.length) writePending([]);
      return true;
    }

    writePending([...pending, row]);
    return false;
  } catch {
    try {
      writePending([...readPending(), row]);
    } catch {
      /* ignore */
    }
    return false;
  }

};


export const logActivity = sendLog;

export const logActivityAsync = (
  log: Omit<ActivityLog, "logId" | "timestamp"> & { details?: Record<string, any> },
) => {
  setTimeout(() => { sendLog(log); }, 0);
};

const currentRole = (): string => {
  try {
    return sessionStorage.getItem("userRole") || "system";
  } catch {
    return "system";
  }
};

const preview = (text?: string, len = 160): string => {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  return t.length > len ? `${t.slice(0, len)}…` : t;
};

/**
 * Generic ticket-scoped log with optional structured detail. Used by
 * /manage-client and /service-update so every action lands on one timeline.
 */
export const logTicketActivity = (
  serviceId: string,
  activity: string,
  details?: Record<string, any>,
) => {
  if (!serviceId) return;
  logActivityAsync({ serviceId, username: actorName(), role: currentRole(), activity, details });
};

/**
 * Automatic (non-human) ticket event. Attributed to a named system actor so a
 * human action is never mistaken for an automated one on the timeline.
 */

export const logSystemTicketActivity = (
  serviceId: string,
  activity: string,
  details?: Record<string, any>,
  source = "System",
) => {
  if (!serviceId) return;
  logActivityAsync({
    serviceId,
    username: source,
    role: "system",
    activity,
    details,
  });
};


/** Log a click of a "Format with AI" button (diagnosis or report). */
export const logAiFormatActivity = (
  serviceId: string,
  kind: "diagnosis" | "report",
  opts: { source?: string; before?: string; after?: string } = {},
) => {
  const label = kind === "diagnosis" ? "AI Diagnosis" : "AI Service Report";
  logTicketActivity(serviceId, `Clicked Format with AI (${label})`, {
    ai: kind,
    page: opts.source,
    inputLength: (opts.before || "").length,
    outputLength: (opts.after || "").length,
    outputPreview: preview(opts.after),
  });
};

/** Log a manual edit of an AI-generated field. */
export const logAiEditActivity = (
  serviceId: string,
  kind: "diagnosis" | "report",
  phase: "opened" | "saved",
  opts: { before?: string; after?: string } = {},
) => {
  const label = kind === "diagnosis" ? "AI Diagnosis" : "AI Service Report";
  logTicketActivity(
    serviceId,
    phase === "opened" ? `Opened ${label} for manual editing` : `Manually edited ${label}`,
    phase === "saved"
      ? { from: preview(opts.before), to: preview(opts.after) }
      : undefined,
  );
};

/** How a field should be compared so cosmetic differences are ignored. */
export type DiffKind = "text" | "number" | "bool" | "list" | "date";

const normText = (v: any): string => String(v ?? "").replace(/\s+/g, " ").trim();

const normNumber = (v: any): string => {
  const raw = normText(v).replace(/[^0-9.\-]/g, "");
  const n = Number(raw);
  if (raw === "" || Number.isNaN(n)) return "";
  // Round to centavos so 16500 and 16500.00 compare equal.
  return String(Math.round(n * 100) / 100);
};

const normBool = (v: any): string => {
  if (typeof v === "boolean") return v ? "yes" : "no";
  const s = normText(v).toLowerCase();
  if (["yes", "true", "1", "on"].includes(s)) return "yes";
  if (["no", "false", "0", "off", ""].includes(s)) return "no";
  return s;
};

const normList = (v: any): string => {
  const items = Array.isArray(v) ? v.map((x) => normText(x)) : normText(v).split(/\s*,\s*/);
  return items
    .map((s) => s.toLowerCase())
    .filter(Boolean)
    .sort()
    .join(", ");
};

const normDate = (v: any): string => {
  const s = normText(v);
  if (!s) return "";
  const d = new Date(s.includes("-") && /^\d{2}-\d{2}-\d{4}$/.test(s)
    ? `${s.slice(6)}-${s.slice(0, 2)}-${s.slice(3, 5)}`
    : s);
  return Number.isNaN(d.getTime()) ? s.toLowerCase() : d.toISOString().slice(0, 10);
};

const normalizeBy = (kind: DiffKind | undefined, v: any): string => {
  switch (kind) {
    case "number":
      return normNumber(v);
    case "bool":
      return normBool(v);
    case "list":
      return normList(v);
    case "date":
      return normDate(v);
    default:
      return normText(v);
  }
};

/**
 * Build "field: old → new" strings, skipping fields whose value only differs
 * cosmetically (number formatting, list order, spacing, date spelling).
 */
export const diffFields = (
  fields: Array<{
    label: string;
    before: any;
    after: any;
    format?: (v: any) => string;
    kind?: DiffKind;
  }>,
): { summaries: string[]; details: Record<string, { from: string; to: string }> } => {
  const summaries: string[] = [];
  const details: Record<string, { from: string; to: string }> = {};
  fields.forEach(({ label, before, after, format, kind }) => {
    if (normalizeBy(kind, before) === normalizeBy(kind, after)) return;
    const fmt = (v: any) => {
      const out = format ? format(v) : String(v ?? "");
      const s = out.replace(/\s+/g, " ").trim();
      return s === "" ? "(empty)" : s;
    };
    const a = fmt(before);
    const b = fmt(after);
    if (a === b) return;
    summaries.push(`${label}: ${preview(a, 60)} → ${preview(b, 60)}`);
    details[label] = { from: preview(a, 400), to: preview(b, 400) };
  });
  return { summaries, details };
};

interface BreakdownLine {
  name?: string;
  cost?: any;
  selected?: any;
  required?: any;
}

const peso = (v: any): string => {
  const n = Number(normNumber(v) || 0);
  return `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
};

const byName = (lines: any): Map<string, BreakdownLine> => {
  const map = new Map<string, BreakdownLine>();
  (Array.isArray(lines) ? lines : []).forEach((l: any) => {
    const key = normText(l?.name).toLowerCase();
    if (key) map.set(key, l as BreakdownLine);
  });
  return map;
};

/**
 * Human-readable diff of the quoted service breakdown. Returns only the lines
 * that actually moved, so a re-save of the same list logs nothing.
 */
export const diffBreakdown = (
  before: any,
  after: any,
  label = "Service Breakdown",
): { summaries: string[]; details: Record<string, string> } => {
  const prev = byName(before);
  const next = byName(after);
  const parts: string[] = [];

  next.forEach((line, key) => {
    const old = prev.get(key);
    const name = normText(line.name);
    if (!old) {
      parts.push(`added "${name}" ${peso(line.cost)}`);
      return;
    }
    if (normNumber(old.cost) !== normNumber(line.cost)) {
      parts.push(`"${name}" ${peso(old.cost)} → ${peso(line.cost)}`);
    }
    if (normBool(old.selected) !== normBool(line.selected)) {
      parts.push(`"${name}" ${normBool(line.selected) === "yes" ? "selected" : "unselected"}`);
    }
    if (normBool(old.required) !== normBool(line.required)) {
      parts.push(`"${name}" marked ${normBool(line.required) === "yes" ? "required" : "optional"}`);
    }
  });

  prev.forEach((line, key) => {
    if (!next.has(key)) parts.push(`removed "${normText(line.name)}"`);
  });

  if (!parts.length) return { summaries: [], details: {} };
  const text = parts.join("; ");
  return {
    summaries: [`${label}: ${preview(text, 140)}`],
    details: { [label]: preview(text, 400) },
  };
};


export const logSystemActivity = (activity: string) => {
  const username = actorName();
  const role = sessionStorage.getItem("userRole") || "system";
  logActivityAsync({ serviceId: "SYSTEM", username, role, activity });
};

export const logAuthActivity = (username: string, activity: string, role: string = "unknown") => {
  logActivityAsync({ serviceId: "AUTH", username, role, activity });
};

export const logStaffActivity = (activity: string, targetStaffName?: string) => {
  const username = actorName();
  const role = sessionStorage.getItem("userRole") || "system";
  logActivityAsync({
    serviceId: "STAFF",
    username,
    role,
    activity: targetStaffName ? `${activity}: ${targetStaffName}` : activity,
  });
};

export const logInventoryActivity = (partId: string, activity: string) => {
  const username = actorName();
  const role = sessionStorage.getItem("userRole") || "system";
  logActivityAsync({ serviceId: `INV-${partId}`, username, role, activity });
};

export const logInquiryActivity = (inquiryId: string, activity: string) => {
  const username = actorName();
  const role = sessionStorage.getItem("userRole") || "system";
  logActivityAsync({ serviceId: `INQ-${inquiryId}`, username, role, activity });
};

export const getServiceLogs = async (serviceId: string, limit: number = 10): Promise<ActivityLog[]> => {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("entity_id", serviceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    logId: r.id,
    serviceId: r.entity_id ?? "",
    username: r.actor_name ?? "",
    role: "",
    timestamp: r.created_at,
    activity: r.action,
  }));
};
