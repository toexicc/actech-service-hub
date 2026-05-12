// Apply inventory delta when a service's parts_used changes.
// Decrements inventory_parts (or fast_moving_parts) on use, increments on return,
// and writes a row to part_logs for each change.
import { supabase } from "@/integrations/supabase/client";

interface PartCount {
  id: string; // Part ID (e.g. "P-001" or "FM-002")
  name?: string;
  quantity: number;
}

const parsePartsString = (raw: string): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!raw || !raw.trim()) return out;
  raw.split(",").forEach((seg) => {
    const m = seg.trim().match(/^(.+?)\s*\((?:x\s*)?(\d+)\)$/i);
    if (!m) return;
    const id = m[1].trim();
    const qty = parseInt(m[2], 10) || 0;
    if (id && qty > 0) out[id] = (out[id] || 0) + qty;
  });
  return out;
};

const adjustOne = async (
  partId: string,
  delta: number, // negative = used, positive = returned
  meta: { serviceId: string; performerId?: string | null; performerName?: string },
) => {
  // Try inventory_parts first
  let table: "inventory_parts" | "fast_moving_parts" = "inventory_parts";
  let row: { id: string; quantity: number } | null = null;

  const { data: invRow } = await supabase
    .from("inventory_parts")
    .select("id,quantity")
    .eq("part_id", partId)
    .maybeSingle();
  if (invRow) {
    row = invRow as any;
  } else {
    const { data: fmRow } = await supabase
      .from("fast_moving_parts")
      .select("id,quantity")
      .eq("part_id", partId)
      .maybeSingle();
    if (fmRow) {
      row = fmRow as any;
      table = "fast_moving_parts";
    }
  }
  if (!row) return; // unknown part; skip

  const newQty = Math.max(0, (row.quantity || 0) + delta);
  await supabase.from(table).update({ quantity: newQty }).eq("id", row.id);

  await supabase.from("part_logs").insert({
    part_id: partId,
    action: delta < 0 ? "Used" : "Returned",
    quantity: Math.abs(delta),
    service_id: meta.serviceId,
    performed_by: meta.performerId || null,
    performed_by_name: meta.performerName || null,
    notes: delta < 0 ? "Deducted on service update" : "Restored on service edit",
  });
};

export const applyPartsDelta = async (opts: {
  serviceId: string;
  prevPartsString: string;
  newParts: PartCount[];
  performerId?: string | null;
  performerName?: string;
}) => {
  const prev = parsePartsString(opts.prevPartsString);
  const next: Record<string, number> = {};
  opts.newParts.forEach((p) => {
    if (!p.id) return;
    next[p.id] = (next[p.id] || 0) + (p.quantity || 0);
  });

  const ids = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const id of ids) {
    const before = prev[id] || 0;
    const after = next[id] || 0;
    const diff = after - before; // positive = newly used → decrement; negative = returned → increment
    if (diff === 0) continue;
    await adjustOne(id, -diff, {
      serviceId: opts.serviceId,
      performerId: opts.performerId,
      performerName: opts.performerName,
    });
  }
};
