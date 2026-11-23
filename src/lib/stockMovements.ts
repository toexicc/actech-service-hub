// Labels and filters for stock movements (Inventory → Movements and the Inventory overview).

export const TYPE_LABEL: Record<string, string> = {
  added: "New part",
  removed: "Part removed",
  stock_in: "Stock in",
  stock_out: "Stock out",
};

/** Movements copied from the old Google Sheet: approved, by this actor, with placeholder times. */
export const FROM_SHEET = "Google Sheet";

interface MovementLike {
  movement_type: string;
  service_id: string | null;
  status: string;
}

/** What happened, in words: a stock-out tied to a ticket is a part used on that ticket. */
export const movementLabel = (m: Pick<MovementLike, "movement_type" | "service_id">): string => {
  if (m.service_id && m.movement_type === "stock_out") return "Used on ticket";
  if (m.service_id && m.movement_type === "stock_in") return "Returned from ticket";
  return TYPE_LABEL[m.movement_type] ?? m.movement_type;
};

export type MovementView = "all" | "tickets" | "in" | "out" | "pending";

/** Which summary card a movement belongs to. New and removed parts only show under All. */
export const movementInView = (m: MovementLike, view: MovementView): boolean => {
  switch (view) {
    case "tickets":
      return !!m.service_id;
    case "in":
      return m.movement_type === "stock_in" && !m.service_id;
    case "out":
      return m.movement_type === "stock_out" && !m.service_id;
    case "pending":
      return m.status === "pending";
    default:
      return true;
  }
};

/** Date-picker days (yyyy-MM-dd) are Manila days, whatever the browser's timezone. */
export const manilaDayBounds = (from?: string, to?: string) => ({
  from: from ? `${from}T00:00:00+08:00` : undefined,
  to: to ? `${to}T23:59:59.999+08:00` : undefined,
});
