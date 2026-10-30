import { describe, expect, it } from "vitest";
import { fetchReportPages, inReportPeriod, reportBounds } from "./reportData";

const cutoff = { start: new Date(2026, 9, 16), end: new Date(2026, 9, 31), label: "October 16–End" };

describe("report cutoff data", () => {
  it("loads records past the 1000-row API cap", async () => {
    const records = Array.from({ length: 2304 }, (_, id) => ({ id, amount: id === 2303 ? 403228.04 : 0 }));
    const rows = await fetchReportPages(async (from, to) => ({ data: records.slice(from, to + 1), error: null }));
    expect(rows).toHaveLength(2304);
    expect(rows.reduce((total, row) => total + row.amount, 0)).toBe(403228.04);
  });
  it("uses October 16–31 Manila boundaries", () => {
    expect(reportBounds(cutoff)).toEqual({ start: "2026-10-15T16:00:00.000Z", end: "2026-10-31T15:59:59.999Z" });
    expect(inReportPeriod("2026-10-15T16:00:00Z", cutoff)).toBe(true);
    expect(inReportPeriod("2026-10-15T15:59:59Z", cutoff)).toBe(false);
    expect(inReportPeriod("2026-10-31T16:00:00Z", cutoff)).toBe(false);
  });
  it("includes completed work from an older intake date", () => {
    const ticket = { received: "2026-07-01T02:00:00Z", completed: "2026-10-20T02:00:00Z", partsCost: 28790 };
    expect(inReportPeriod(ticket.received, cutoff)).toBe(false);
    expect([ticket].filter((t) => inReportPeriod(t.completed, cutoff)).reduce((sum, t) => sum + t.partsCost, 0)).toBe(28790);
  });
  it("fails instead of returning partial financial totals on page errors", async () => {
    await expect(fetchReportPages(async () => ({ data: null, error: new Error("Unavailable") }))).rejects.toThrow("Unavailable");
  });
});