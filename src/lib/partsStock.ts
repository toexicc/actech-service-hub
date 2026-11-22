// Stock checks for the parts list on a ticket ("PART-ID (qty), …").
// Saving a ticket's parts only deducts what was added since the last save, so a part
// that was already on the ticket does not need stock again.

export interface StockedPart {
  id: string;
  name?: string;
  quantity: number;
}

export interface StockShortfall {
  id: string;
  name: string;
  needed: number; // extra pieces this save would take
  inStock: number;
}

/** Reads "ID (2), Other ID (x1)" into { ID: 2, "Other ID": 1 }. */
export function parsePartsUsed(raw: string | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  String(raw ?? "")
    .split(",")
    .forEach((seg) => {
      const m = seg.trim().match(/^(.+?)\s*\((?:x\s*)?(\d+)\)$/i);
      if (!m) return;
      const qty = parseInt(m[2], 10) || 0;
      if (qty > 0) out[m[1].trim()] = (out[m[1].trim()] || 0) + qty;
    });
  return out;
}

/** The parts-used lines saved on a ticket: "ID (qty)" for stock parts, "Name (qty)" for anything not in stock. */
export function formatPartsUsed(parts: Array<{ id?: string | null; name: string; quantity: number }>): string[] {
  return parts.filter((p) => p.quantity > 0).map((p) => `${p.id || p.name} (${p.quantity})`);
}

/** Parts that this save would take more of than the stock on hand. */
export function findShortfalls(
  previousPartsUsed: string | null | undefined,
  selected: Record<string, number>,
  stock: StockedPart[],
): StockShortfall[] {
  const before = parsePartsUsed(previousPartsUsed);
  const beforeById = new Map(Object.entries(before).map(([k, v]) => [k.toLowerCase(), v]));
  const out: StockShortfall[] = [];
  Object.entries(selected).forEach(([id, qty]) => {
    const item = stock.find((s) => s.id === id);
    if (!item) return;
    const needed = (qty || 0) - (beforeById.get(id.toLowerCase()) || 0);
    if (needed > 0 && needed > (item.quantity || 0)) {
      out.push({ id, name: item.name || id, needed, inStock: Math.max(0, item.quantity || 0) });
    }
  });
  return out;
}
