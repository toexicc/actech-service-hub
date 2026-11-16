import { describe, expect, it } from "vitest";
import { lateMinutes } from "./attendanceHours";

// Manila is UTC+8, so 10:00 AM Manila = 02:00 UTC.
describe("lateMinutes (no grace period — 10:01 AM or later is late)", () => {
  it("is not late at exactly 10:00 AM", () => {
    expect(lateMinutes("2026-11-16T02:00:00Z")).toBe(0);
  });

  it("is not late before 10:00 AM", () => {
    expect(lateMinutes("2026-11-16T01:45:00Z")).toBe(0);
  });

  it("is 1 minute late at 10:01 AM", () => {
    expect(lateMinutes("2026-11-16T02:01:00Z")).toBe(1);
  });

  it("is 12 minutes late at 10:12 AM (previously covered by the grace period)", () => {
    expect(lateMinutes("2026-11-16T02:12:00Z")).toBe(12);
  });

  it("handles missing time-in", () => {
    expect(lateMinutes(null)).toBe(0);
  });
});
