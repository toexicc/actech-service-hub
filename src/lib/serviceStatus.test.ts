import { describe, expect, it } from "vitest";
import { isOnHold, isOverdueEligible } from "./serviceStatus";

describe("On Hold toggle", () => {
  it("toggle on means on hold", () => expect(isOnHold({ status: "Proceed Repair", isOnHold: true })).toBe(true));
  it("legacy On Hold status still counts", () => expect(isOnHold({ status: "On Hold" })).toBe(true));
  it("neither means not on hold", () => expect(isOnHold({ status: "Proceed Repair" })).toBe(false));
  it("on-hold tickets are never overdue", () => expect(isOverdueEligible({ status: "Proceed Repair", isOnHold: true })).toBe(false));
  it("same ticket off hold can be overdue", () => expect(isOverdueEligible({ status: "Proceed Repair" })).toBe(true));
});
