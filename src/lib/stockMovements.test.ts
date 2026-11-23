import { describe, expect, it } from "vitest";
import { manilaDayBounds, movementInView, movementLabel, type MovementView } from "./stockMovements";

const used = { movement_type: "stock_out", service_id: "AC171126018", status: "approved" };
const returned = { movement_type: "stock_in", service_id: "AC171126018", status: "approved" };
const delivery = { movement_type: "stock_in", service_id: null, status: "approved" };
const recount = { movement_type: "stock_out", service_id: null, status: "approved" };
const pendingUse = { movement_type: "stock_out", service_id: "AC181126003", status: "pending" };
const newPart = { movement_type: "added", service_id: null, status: "approved" };

describe("movementLabel", () => {
  it("names ticket stock-outs and returns by what happened", () => {
    expect(movementLabel(used)).toBe("Used on ticket");
    expect(movementLabel(returned)).toBe("Returned from ticket");
  });

  it("keeps the plain labels when there's no ticket", () => {
    expect(movementLabel(delivery)).toBe("Stock in");
    expect(movementLabel(recount)).toBe("Stock out");
    expect(movementLabel(newPart)).toBe("New part");
    expect(movementLabel({ movement_type: "something_else", service_id: null })).toBe("something_else");
  });
});

describe("movementInView", () => {
  const rows = [used, returned, delivery, recount, pendingUse, newPart];
  const count = (view: MovementView) => rows.filter((r) => movementInView(r, view)).length;

  it("puts every movement under All", () => {
    expect(count("all")).toBe(rows.length);
  });

  it("splits ticket movements from plain stock in and out", () => {
    expect(count("tickets")).toBe(3);
    expect(count("in")).toBe(1);
    expect(count("out")).toBe(1);
    expect(movementInView(newPart, "in")).toBe(false);
    expect(movementInView(newPart, "out")).toBe(false);
  });

  it("lists only pending changes under Pending", () => {
    expect(count("pending")).toBe(1);
    expect(movementInView(pendingUse, "pending")).toBe(true);
  });
});

describe("manilaDayBounds", () => {
  it("covers whole Manila days", () => {
    expect(manilaDayBounds("2026-11-09", "2026-11-21")).toEqual({
      from: "2026-11-09T00:00:00+08:00",
      to: "2026-11-21T23:59:59.999+08:00",
    });
  });

  it("leaves a missing end open", () => {
    expect(manilaDayBounds("", "2026-11-21").from).toBe(undefined);
    expect(manilaDayBounds("2026-11-09").to).toBe(undefined);
  });

  it("puts a movement at 12:03 PM Manila on Nov 21 inside that day", () => {
    const b = manilaDayBounds("2026-11-21", "2026-11-21");
    const t = Date.parse("2026-11-21T04:03:01Z");
    expect(t >= Date.parse(b.from!) && t <= Date.parse(b.to!)).toBe(true);
    expect(Date.parse("2026-11-20T15:59:59Z") < Date.parse(b.from!)).toBe(true);
  });
});
