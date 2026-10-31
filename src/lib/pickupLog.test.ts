import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { parseCost, shouldLogView } from "./pickupLog";

describe("pickup log rules", () => {
  it("parses cost with commas", () => expect(parseCost("16,500.00")).toBe(16500));
  it("blank cost is null", () => expect(parseCost("")).toBeNull());
  it("logs first view", () => expect(shouldLogView(undefined, 1000)).toBe(true));
  it("skips repeat view within 5 minutes", () => expect(shouldLogView(0, 4 * 60 * 1000)).toBe(false));
  it("logs again after 5 minutes", () => expect(shouldLogView(0, 5 * 60 * 1000)).toBe(true));
});
