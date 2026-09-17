import { supabase } from "@/integrations/supabase/client";
import { normalizeDeviceValue, type DeviceValueKind } from "@/lib/deviceNameCase";

export type { DeviceValueKind };

/**
 * Looks up saved brands / models / colours / storage sizes that match what the
 * user is typing. Models can be narrowed to a brand so Apple tickets suggest
 * Apple models first.
 */
export const searchDeviceCatalog = async (
  kind: DeviceValueKind,
  term: string,
  brand?: string,
): Promise<string[]> => {
  const cleaned = term.trim();
  let query = supabase
    .from("device_catalog")
    .select("value, brand, usage_count")
    .eq("kind", kind)
    .order("usage_count", { ascending: false })
    .limit(40);
  if (cleaned) query = query.ilike("value", `%${cleaned}%`);

  const { data } = await query;
  const rows = (data ?? []) as { value: string; brand: string | null; usage_count: number }[];

  const wantedBrand = (brand ?? "").trim().toLowerCase();
  const ranked = rows
    .map((r) => ({
      value: r.value,
      score:
        (wantedBrand && (r.brand ?? "").toLowerCase() === wantedBrand ? 1000 : 0) +
        (r.usage_count ?? 0),
    }))
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of ranked) {
    const key = r.value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r.value);
    if (out.length >= 8) break;
  }
  return out;
};

/** Remembers a value so it shows up as a suggestion next time. */
export const rememberDeviceValue = async (
  kind: DeviceValueKind,
  rawValue: string,
  brand?: string,
): Promise<void> => {
  const value = normalizeDeviceValue(rawValue, kind);
  if (!value) return;
  const ownerBrand = kind === "model" ? normalizeDeviceValue(brand ?? "", "brand") || null : null;

  const { data: existing } = await supabase
    .from("device_catalog")
    .select("id, usage_count")
    .eq("kind", kind)
    .ilike("value", value)
    .limit(20);

  const match = (existing ?? []).at(0) as { id: string; usage_count: number } | undefined;
  if (match) {
    await supabase
      .from("device_catalog")
      .update({ usage_count: (match.usage_count ?? 1) + 1 })
      .eq("id", match.id);
    return;
  }

  await supabase.from("device_catalog").insert({ kind, value, brand: ownerBrand });
};

/** Fire-and-forget save of all four device fields from an intake submission. */
export const rememberDeviceFields = (fields: {
  brand?: string;
  model?: string;
  color?: string;
  memory?: string;
}) => {
  const tasks: Promise<void>[] = [];
  if (fields.brand) tasks.push(rememberDeviceValue("brand", fields.brand));
  if (fields.model) tasks.push(rememberDeviceValue("model", fields.model, fields.brand));
  if (fields.color) tasks.push(rememberDeviceValue("color", fields.color));
  if (fields.memory) tasks.push(rememberDeviceValue("storage", fields.memory));
  void Promise.allSettled(tasks);
};
