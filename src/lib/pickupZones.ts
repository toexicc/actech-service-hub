export const NORTH = [
  "Quezon City", "Caloocan", "Valenzuela", "Malabon", "Navotas",
  "Mandaluyong", "San Juan", "Pasig", "Marikina", "Antipolo",
] as const;

export const SOUTH = [
  "Manila", "Makati", "Pasay", "Parañaque", "Las Piñas",
  "Muntinlupa", "Taguig", "Pateros",
] as const;

export type PickupZone = "north" | "south";

export const ZONE_LABEL: Record<PickupZone, string> = {
  north: "MWF · North Side",
  south: "TTHS · South Side",
};

export function zoneForCity(city: string | null | undefined): PickupZone | null {
  const n = (city || "").trim().toLocaleLowerCase();
  if (!n) return null;
  if (NORTH.some((v) => v.toLocaleLowerCase() === n)) return "north";
  if (SOUTH.some((v) => v.toLocaleLowerCase() === n)) return "south";
  return null;
}

export function zoneForDate(date: Date | string): PickupZone | null {
  // Date-only strings are calendar days in Manila, not UTC instants.
  const value = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T12:00:00+08:00`)
    : new Date(date);
  if (Number.isNaN(value.getTime())) return null;
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Manila" }).format(value);
  if (["Mon", "Wed", "Fri"].includes(wd)) return "north";
  if (["Tue", "Thu", "Sat"].includes(wd)) return "south";
  return null;
}

export function cityMatchesDate(city: string | null | undefined, date: Date | string): boolean | null {
  const c = zoneForCity(city);
  const d = zoneForDate(date);
  return c && d ? c === d : null;
}
