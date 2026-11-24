// Part requests and returns: technicians and staff ask for parts from a ticket (Service Update or
// Manage Client), or ask to return parts that are on it. Inventory staff or management approve:
// a request takes the stock and adds the part (approve_part_request); a return takes the part off the
// ticket and puts it back in stock, unless it's defective (approve_part_return). The database logs
// every step on the ticket with who asked and who approved.

export const REQUEST_STATUSES = ["Requested", "For Ordering", "Ordering", "Ordered", "Received", "Approved", "Cancelled"] as const;

/** Statuses inventory staff set by hand while a part is sourced. "Approved" only comes from approving. */
export const MANUAL_REQUEST_STATUSES = ["Requested", "For Ordering", "Ordering", "Ordered", "Received"] as const;

const CLOSED = new Set(["Approved", "Released to technician", "Cancelled"]);

/** Still waiting on inventory (not approved or cancelled). */
export const isOpenRequest = (status: string | null | undefined): boolean => !CLOSED.has(String(status ?? ""));

/** Approved and on the ticket ("Released to technician" is the old name). */
export const isApprovedRequest = (status: string | null | undefined): boolean =>
  status === "Approved" || status === "Released to technician";

/** A new request waits for inventory when there's enough on hand; otherwise it needs ordering. */
export const initialRequestStatus = (onHand: number | null | undefined, quantity: number): "Requested" | "For Ordering" =>
  onHand != null && onHand >= Math.max(1, quantity) ? "Requested" : "For Ordering";

/** Parts lock once the repair is done (Done Repair onward) and on closed tickets; changes then need someone else's approval. */
export const PARTS_LOCKED_STATUSES = [
  "Done Repair - Under Observation",
  "Done Repair - Observation",
  "Done Repair - For Release",
  "Done Repair - Advise Client",
  "Completed",
  "Cancelled",
  "RTO",
  "RTO - ACTech",
  "RTO - Client",
] as const;

export const isPartsLocked = (status: string | null | undefined): boolean =>
  (PARTS_LOCKED_STATUSES as readonly string[]).includes(String(status ?? "").trim());

/** Cancelled and RTO tickets can't get new parts (returns are still allowed). */
export const noPartAdditions = (status: string | null | undefined): boolean =>
  ["Cancelled", "RTO", "RTO - ACTech", "RTO - Client"].includes(String(status ?? "").trim());

export type ReturnReason = "unused" | "wrong_entry" | "defective";

export const RETURN_REASONS: { value: ReturnReason; label: string; effect: string }[] = [
  { value: "unused", label: "Not used", effect: "Goes back into stock." },
  { value: "wrong_entry", label: "Wrong entry", effect: "Recorded by mistake. Goes back into stock." },
  { value: "defective", label: "Defective", effect: "Set aside for the supplier. Doesn't go back into stock." },
];

export const returnReasonLabel = (reason: string | null | undefined): string =>
  RETURN_REASONS.find((r) => r.value === reason)?.label ?? "Return";

/** Where a defective part is with the supplier. */
export const DEFECT_STATUSES = ["Waiting to send", "Sent to supplier", "Replaced", "Credited", "Disposed"] as const;

export const isDefectSettled = (status: string | null | undefined): boolean =>
  status === "Replaced" || status === "Credited" || status === "Disposed";

/**
 * Ticket log entries about parts (requests, returns, approvals, direct adds, defective parts, stock changes,
 * Waiting for Parts, technician parts notes). Globs as the database filter uses them: * matches anything.
 */
export const PARTS_LOG_PATTERNS = ["Part*", "Defective*part*", "Waiting*for*Parts*", "Technician*parts*update*", "Stock*change*"] as const;

const escapeRegex = (text: string) => text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
const globToRegex = (glob: string) => new RegExp("^" + glob.split("*").map(escapeRegex).join(".*") + "$", "is");
const PARTS_LOG_REGEXES = PARTS_LOG_PATTERNS.map(globToRegex);

export const isPartsLogAction = (action: string | null | undefined): boolean => {
  const a = String(action ?? "");
  return PARTS_LOG_REGEXES.some((r) => r.test(a));
};

/** The same entries as a filter for the activity log query (`.or(...)`). */
export const partsLogFilter = (): string => PARTS_LOG_PATTERNS.map((p) => `action.ilike.${p}`).join(",");

/** How many of a part can still be returned: on the ticket, minus returns already waiting. */
export const returnableQty = (onTicket: number, pendingReturns: number): number => Math.max(0, onTicket - pendingReturns);

/** The status in words, for the person who asked. */
export const requestStatusText = (status: string, kind: string = "request"): string =>
  kind === "return"
    ? ({
        Requested: "Waiting for approval",
        Approved: "Approved, taken off this ticket",
        Cancelled: "Cancelled",
      } as Record<string, string>)[status] ?? status
    : ({
    Requested: "Waiting for inventory",
    "For Ordering": "Needs ordering",
    Ordering: "Being ordered",
    Ordered: "Ordered",
    Received: "Arrived, waiting for inventory to release it",
    Approved: "Approved, on this ticket",
    "Released to technician": "Approved, on this ticket",
    Cancelled: "Cancelled",
  } as Record<string, string>)[status] ?? status;

export type RequestTone = "waiting" | "ordering" | "ready" | "done" | "cancelled";

export const requestTone = (status: string): RequestTone => {
  if (isApprovedRequest(status)) return "done";
  if (status === "Cancelled") return "cancelled";
  if (status === "Received") return "ready";
  if (status === "For Ordering" || status === "Ordering" || status === "Ordered") return "ordering";
  return "waiting";
};

export type StockLevel = "in" | "low" | "out" | "order";

/** Stock as a requester sees it: in stock, low, out, or out but already ordered. */
export const stockLevel = (onHand: number, status?: string | null): StockLevel => {
  if (onHand <= 0) return status === "On Order" ? "order" : "out";
  return status === "Low Stock" ? "low" : "in";
};

export const stockText = (onHand: number, status?: string | null): string => {
  switch (stockLevel(onHand, status)) {
    case "out":
      return "Out of stock";
    case "order":
      return "On order";
    case "low":
      return `Low · ${onHand} left`;
    default:
      return `In stock · ${onHand}`;
  }
};

/** Every word typed must appear somewhere in the part's details (SKU, name, brand, model…). */
export const matchesPartSearch = (fields: Array<string | null | undefined>, search: string): boolean => {
  const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = fields.filter(Boolean).join(" ").toLowerCase();
  return tokens.every((t) => hay.includes(t));
};

/** Request number shown to staff, e.g. RQ7712345678 (unique per request). */
export const newRequestId = (now: number = Date.now(), rand: number = Math.random()): string =>
  `RQ${String(now).slice(-9)}${Math.floor(rand * 90) + 10}`;

/** A ticket's parts used as a list, whether it arrives as an array or a "ID (2), …" string. */
export const partsUsedText = (partsUsed: string | string[] | null | undefined): string =>
  Array.isArray(partsUsed) ? partsUsed.filter(Boolean).join(", ") : String(partsUsed ?? "");
