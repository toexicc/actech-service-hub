import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { canAddInterimRound, nextRound } from "./interimRounds";

describe("interim rounds", () => {
  it("cannot add a round while one is pending", () =>
    expect(canAddInterimRound([{ round: 1, status: "approved" }, { round: 2, status: "pending" }])).toBe(false));
  it("can add after an approved round", () => expect(canAddInterimRound([{ round: 1, status: "approved" }])).toBe(true));
  it("can add after a declined round", () => expect(canAddInterimRound([{ round: 1, status: "declined" }])).toBe(true));
  it("first report uses the normal flow, not Add another", () => expect(canAddInterimRound([])).toBe(false));
  it("next round follows the highest", () => expect(nextRound([{ round: 1, status: "approved" }, { round: 3, status: "declined" }])).toBe(4));
});
