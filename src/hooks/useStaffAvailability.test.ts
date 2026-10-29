import { beforeEach, describe, expect, it, vi } from "vitest";

const records = vi.hoisted(() => ({
  attendance: [] as { staff_id: string; staff_name: string; time_in: string | null }[],
  leaves: [] as { staff_id: string; staff_name: string }[],
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryFn: () => Promise<unknown> }) => options.queryFn(),
  useQueryClient: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const query = {
        select: () => query,
        lte: () => query,
        gte: () => query,
        eq: (_column: string, value: string) => table === "attendance_logs"
          ? Promise.resolve({ data: records.attendance })
          : Promise.resolve({ data: value === "approved" ? records.leaves : [] }),
      };
      return query;
    },
  },
}));

import { useStaffAvailability } from "./useStaffAvailability";

// The mocked query hook executes the real availability query without a browser.
const availability = () => useStaffAvailability(new Date("2026-10-29T09:49:00Z")) as unknown as Promise<{
  isAvailable: (name: string) => boolean;
}>;

describe("technician attendance eligibility", () => {
  beforeEach(() => {
    records.attendance = [];
    records.leaves = [];
  });

  it("excludes an absent technician when another has timed in", async () => {
    records.attendance = [{ staff_id: "early", staff_name: "Early Technician", time_in: "2026-10-29T01:00:00Z" }];
    const result = await availability();
    expect(result.isAvailable("Absent Technician")).toBe(false);
    expect(result.isAvailable("Early Technician")).toBe(true);
  });

  it("excludes technicians before anyone has timed in", async () => {
    expect((await availability()).isAvailable("Active Technician")).toBe(false);
  });

  it("excludes approved leave even when the technician timed in", async () => {
    records.attendance = [{ staff_id: "leave", staff_name: "Leave Technician", time_in: "2026-10-29T01:00:00Z" }];
    records.leaves = [{ staff_id: "leave", staff_name: "Leave Technician" }];
    expect((await availability()).isAvailable("Leave Technician")).toBe(false);
  });
});