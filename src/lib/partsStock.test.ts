import { describe, expect, it } from "vitest";
import { findShortfalls, formatPartsUsed, parsePartsUsed } from "./partsStock";

const stock = [
  { id: "BAT-APL-IP11-OEM", name: "Battery - iPhone 11 - OEM", quantity: 1 },
  { id: "LCD-A1278-OEM", name: "LCD - MacBook Pro 13-inch A1278 - OEM", quantity: 0 },
  { id: "SPK-APL-A2141-OEM", name: "Speaker - MacBook Pro 16-inch Intel - A2141 - OEM", quantity: 3 },
];

describe("parsePartsUsed", () => {
  it("reads ids and quantities", () => {
    expect(parsePartsUsed("BAT-APL-IP11-OEM (2), LCD-A1465-2015-OEM (x1), junk")).toEqual({
      "BAT-APL-IP11-OEM": 2,
      "LCD-A1465-2015-OEM": 1,
    });
    expect(parsePartsUsed("")).toEqual({});
  });
});

describe("formatPartsUsed", () => {
  it("writes ids for stock parts and names for the rest", () => {
    expect(
      formatPartsUsed([
        { id: "BAT-APL-IP11-OEM", name: "Battery", quantity: 2 },
        { id: null, name: "Customer-supplied screen", quantity: 1 },
        { id: "X", name: "Zero", quantity: 0 },
      ]),
    ).toEqual(["BAT-APL-IP11-OEM (2)", "Customer-supplied screen (1)"]);
  });
});

describe("findShortfalls", () => {
  it("flags parts that take more than is in stock", () => {
    expect(findShortfalls("", { "BAT-APL-IP11-OEM": 2, "SPK-APL-A2141-OEM": 1 }, stock)).toEqual([
      { id: "BAT-APL-IP11-OEM", name: "Battery - iPhone 11 - OEM", needed: 2, inStock: 1 },
    ]);
  });

  it("only counts what was added since the last save", () => {
    expect(findShortfalls("BAT-APL-IP11-OEM (2)", { "BAT-APL-IP11-OEM": 2 }, stock)).toEqual([]);
    expect(findShortfalls("bat-apl-ip11-oem (1)", { "BAT-APL-IP11-OEM": 2 }, stock)).toEqual([]);
    expect(findShortfalls("BAT-APL-IP11-OEM (1)", { "BAT-APL-IP11-OEM": 3 }, stock)).toEqual([
      { id: "BAT-APL-IP11-OEM", name: "Battery - iPhone 11 - OEM", needed: 2, inStock: 1 },
    ]);
  });

  it("flags out-of-stock parts and ignores parts it does not know", () => {
    expect(findShortfalls("", { "LCD-A1278-OEM": 1, "UNKNOWN": 5 }, stock).map((s) => s.id)).toEqual(["LCD-A1278-OEM"]);
  });
});
