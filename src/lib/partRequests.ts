// Part requests: technicians and staff ask for parts from a ticket (Service Update or Manage Client).
// Inventory staff or management approve a request, which takes the stock and adds the part to the
// ticket's parts used in one step (database function approve_part_request).

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

/** The status in words, for the person who asked. */
export const requestStatusText = (status: string): string =>
  ({
    Requested: "Waiting for inventory",
    "For Ordering": "Needs ordering",
    Ordering: "Being ordered",
    Ordered: "Ordered",
    Received: "Arrived, waiting for inventory to release it",
    Approved: "Approved, on this ticket",
    "Released to technician": "Approved, on this ticket",
    Cancelled: "Cancelled",
  })[status] ?? status;

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
