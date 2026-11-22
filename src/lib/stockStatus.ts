// Stock status for inventory parts, worked out from quantity and re-order level
// (the same rule the old inventory Google Sheet used):
//   quantity 0 or less            -> "Out of Stock"
//   quantity at/below re-order    -> "Low Stock"
//   otherwise                     -> "In Stock"
// "On Order" and "For Ordering" are order-workflow flags people set on purpose,
// so they are kept until the part is received or the flag is changed.

export const STOCK_STATUSES = ["In Stock", "Low Stock", "Out of Stock", "On Order", "For Ordering"] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

const ORDER_FLAGS = new Set(["On Order", "For Ordering"]);

export const isOrderFlag = (status?: string | null): boolean => ORDER_FLAGS.has(String(status ?? "").trim());

export function deriveStockStatus(
  quantity: number | string | null | undefined,
  reorderLevel?: number | string | null,
  storedStatus?: string | null,
): StockStatus {
  const flag = String(storedStatus ?? "").trim();
  if (ORDER_FLAGS.has(flag)) return flag as StockStatus;
  const qty = Number(quantity) || 0;
  if (qty <= 0) return "Out of Stock";
  const level = Math.max(0, Number(reorderLevel) || 0);
  if (qty <= level) return "Low Stock";
  return "In Stock";
}

export const isLowOrOut = (status: string): boolean => status === "Low Stock" || status === "Out of Stock";
