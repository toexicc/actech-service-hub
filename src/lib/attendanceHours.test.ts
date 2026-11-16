import { describe, expect, it } from "vitest";
import { lateMinutes, lateThresholdFor, NO_GRACE_START_DATE } from "./attendanceHours";

// Manila is UTC+8, so 10:00 AM Manila = 02:00 UTC.
// No-grace rule applies only from NO_GRACE_START_DATE (2026-11-17) onward;
// earlier attendance keeps the old 10-minute grace period.

describe("lateThresholdFor", () => {
  it("uses the 10:10 threshold before the no-grace start date", () => {
    expect(lateThresholdFor("2026-11-16")).toBe("10:10");
  });

  it("uses the 10:00 threshold from the no-grace start date onward", () => {
    expect(lateThresholdFor(NO_GRACE_START_DATE)).toBe("10:00");
    expect(lateThresholdFor("2026-11-18")).toBe("10:00");
  });
});

describe("lateMinutes before the no-grace start date (10-minute grace)", () => {
  it("is not late at 10:10 AM", () => {
    expect(lateMinutes("2026-11-16T02:10:00Z")).toBe(0);
  });

  it("is 2 minutes late at 10:12 AM", () => {
    expect(lateMinutes("2026-11-16T02:12:00Z")).toBe(2);
  });
});

describe("lateMinutes from the no-grace start date onward (10:01 AM or later is late)", () => {
  it("is not late at exactly 10:00 AM", () => {
    expect(lateMinutes("2026-11-17T02:00:00Z")).toBe(0);
  });

  it("is not late before 10:00 AM", () => {
    expect(lateMinutes("2026-11-17T01:45:00Z")).toBe(0);
  });

  it("is 1 minute late at 10:01 AM", () => {
    expect(lateMinutes("2026-11-17T02:01:00Z")).toBe(1);
  });

  it("is 12 minutes late at 10:12 AM (no grace period)", () => {
    expect(lateMinutes("2026-11-17T02:12:00Z")).toBe(12);
  });

  it("handles missing time-in", () => {
    expect(lateMinutes(null)).toBe(0);
  });
});
