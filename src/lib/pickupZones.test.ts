import { describe, expect, it } from "vitest";
import { cityMatchesDate, zoneForCity, zoneForDate } from "./pickupZones";

describe("pickup zones", () => {
  it("Quezon City on Monday matches", () => expect(cityMatchesDate("Quezon City", "2026-11-02")).toBe(true));
  it("Makati on Monday mismatches", () => expect(cityMatchesDate("Makati", "2026-11-02")).toBe(false));
  it("Taguig on Saturday matches", () => expect(cityMatchesDate("Taguig", "2026-11-07")).toBe(true));
  it("Sunday has no zone", () => {
    expect(zoneForDate("2026-11-08")).toBeNull();
    expect(cityMatchesDate("Taguig", "2026-11-08")).toBeNull();
  });
  it("unknown city has no zone", () => expect(zoneForCity("Cavite")).toBeNull());
});
