import { describe, expect, it } from "vitest";
import { planCompanyAssignments } from "./companyIntakeAssign";

const pools = { Laptop: ["Alquin", "Jefferson"], Phone: ["Mark"] };

describe("planCompanyAssignments", () => {
  it("sends each device to its own department's technicians", () => {
    const out = planCompanyAssignments([{ department: "Phone" }, { department: "Laptop" }], pools, new Map(), new Map(), 0);
    expect(out[0]).toBe("Mark");
    expect(["Alquin", "Jefferson"]).toContain(out[1]);
  });
  it("spreads a batch across technicians in the same department", () => {
    const out = planCompanyAssignments([{ department: "Laptop" }, { department: "Laptop" }, { department: "Laptop" }, { department: "Laptop" }], pools, new Map(), new Map(), 0);
    expect(out.filter((n) => n === "Alquin")).toHaveLength(2);
    expect(out.filter((n) => n === "Jefferson")).toHaveLength(2);
  });
  it("gives the next device to whoever has fewer tickets today", () => {
    const out = planCompanyAssignments([{ department: "Laptop" }], pools, new Map([["Alquin", 3], ["Jefferson", 1]]), new Map(), 0);
    expect(out[0]).toBe("Jefferson");
  });
  it("flags a device when nobody in its department is available", () => {
    expect(planCompanyAssignments([{ department: "Tablet" }], pools, new Map(), new Map(), 0)).toEqual([null]);
  });
  it("keeps a manual technician choice and counts it", () => {
    const out = planCompanyAssignments([{ department: "Laptop", override: "Alquin" }, { department: "Laptop" }], pools, new Map(), new Map(), 0);
    expect(out).toEqual(["Alquin", "Jefferson"]);
  });
});
