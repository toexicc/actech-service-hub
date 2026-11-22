import { describe, expect, it } from "vitest";
import { deriveStockStatus, isLowOrOut } from "./stockStatus";

describe("deriveStockStatus", () => {
  it("is Out of Stock at 0 or below", () => {
    expect(deriveStockStatus(0, 2, "In Stock")).toBe("Out of Stock");
    expect(deriveStockStatus(-1, 0, null)).toBe("Out of Stock");
  });

  it("is Low Stock at or below the re-order level", () => {
    expect(deriveStockStatus(1, 2)).toBe("Low Stock");
    expect(deriveStockStatus(2, 2)).toBe("Low Stock");
  });

  it("is In Stock above the re-order level", () => {
    expect(deriveStockStatus(3, 2)).toBe("In Stock");
  });

  it("treats a blank or zero re-order level as no low-stock warning (like the sheet)", () => {
    expect(deriveStockStatus(1, 0)).toBe("In Stock");
    expect(deriveStockStatus(1, null)).toBe("In Stock");
  });

  it("ignores a stale typed status", () => {
    expect(deriveStockStatus(10, 2, "Out of Stock")).toBe("In Stock");
    expect(deriveStockStatus(0, 2, "In Stock")).toBe("Out of Stock");
  });

  it("keeps order-workflow flags", () => {
    expect(deriveStockStatus(0, 2, "On Order")).toBe("On Order");
    expect(deriveStockStatus(5, 2, "For Ordering")).toBe("For Ordering");
  });

  it("reads numbers given as text", () => {
    expect(deriveStockStatus("2", "2")).toBe("Low Stock");
  });
});

describe("isLowOrOut", () => {
  it("flags low and out of stock only", () => {
    expect(isLowOrOut("Low Stock")).toBe(true);
    expect(isLowOrOut("Out of Stock")).toBe(true);
    expect(isLowOrOut("In Stock")).toBe(false);
    expect(isLowOrOut("On Order")).toBe(false);
  });
});
