import { describe, it, expect } from "vitest";
import { pickRoundRobin } from "./techRotation";

const names = ["Mark", "Jefferson", "Aries"];

describe("daily technician rotation", () => {
  it("gives the next ticket to whoever has the fewest today", () => {
    const load = new Map([["Aries", 2], ["Jefferson", 1], ["Mark", 2]]);
    expect(pickRoundRobin(names, load, new Map(), 0)).toBe("Jefferson");
  });
  it("on a tie, picks whoever was assigned longest ago", () => {
    const load = new Map([["Aries", 1], ["Jefferson", 1], ["Mark", 1]]);
    const last = new Map([["Aries", 300], ["Jefferson", 100], ["Mark", 200]]);
    expect(pickRoundRobin(names, load, last, 0)).toBe("Jefferson");
  });
  it("rotates 1 each: Aries, Jefferson, Mark, then repeats", () => {
    const load = new Map<string, number>();
    const last = new Map<string, number>();
    const picks: string[] = [];
    for (let i = 0; i < 6; i++) {
      const p = pickRoundRobin(names, load, last, 0);
      picks.push(p);
      load.set(p, (load.get(p) ?? 0) + 1);
      last.set(p, i);
    }
    expect(picks).toEqual(["Aries", "Jefferson", "Mark", "Aries", "Jefferson", "Mark"]);
  });
  it("the first pick of the day is not always the alphabetical first", () => {
    expect(pickRoundRobin(names, new Map(), new Map(), 1)).toBe("Jefferson");
  });
});
