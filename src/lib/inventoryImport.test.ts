import { describe, expect, it } from "vitest";
import {
  buildImportPlan,
  deriveDeviceType,
  parseCsv,
  parseNumber,
  splitCondition,
  toInsertRecord,
  toUpdatePatch,
  type ExistingPart,
} from "./inventoryImport";

// Shaped like the Google Sheet's "Inventory Dashboard" tab downloaded as CSV:
// title rows first, then the header, then products.
const SHEET_CSV = [
  "INVENTORY DASHBOARD,,,,,,,,,,,,,",
  ",No. of Products,3,,,,,,,,,,,",
  ",,,,,,,,,,,,,",
  "#,SKU,Product Name,Part,Brand,Model Code,Condition,Cost per Unit,Price per Unit,Initial Qty.,Re-Order Level,Current Qty. in Stock,Status,Total Sold",
  '1,BAT-APL-IP11-OEM,Battery - iPhone 11 - OEM,Battery,Apple,iPhone 11,OEM,,,3,2,5,In Stock,2',
  '2,HSG-APL-IP15P-WHT,Housing - iPhone 15 Pro - White,Housing,Apple,iPhone 15 Pro,White,"₱1,800.00",,1,,1,In Stock,0',
  '3,LCD-A1278-OEM,LCD - MacBook Pro 13-inch A1278 - OEM,LCD,Apple,A1278,OEM,,,2,2,0,No Stock,2',
  ",,,,,,,,,,,,,",
].join("\r\n");

const existing = (over: Partial<ExistingPart> = {}): ExistingPart => ({
  partId: "BAT-APL-IP11-OEM",
  partName: "Battery - iPhone 11 - OEM",
  deviceType: "Mobile (iPhone)",
  brand: "Apple",
  model: "iPhone 11",
  partType: "OEM",
  color: "",
  quantity: 5,
  reorderLevel: 2,
  costPerUnit: "0",
  sellingPrice: 0,
  supplier: "",
  remarks: "",
  storedStatus: "In Stock",
  ...over,
});

describe("parseCsv", () => {
  it("reads quoted cells with commas, quotes and line breaks", () => {
    const rows = parseCsv('﻿a,"b, c","say ""hi""","two\nlines"\r\n1,2,3,4');
    expect(rows).toEqual([
      ["a", "b, c", 'say "hi"', "two\nlines"],
      ["1", "2", "3", "4"],
    ]);
  });

  it("detects tab-separated files", () => {
    expect(parseCsv("SKU\tProduct Name\nX\tY")).toEqual([["SKU", "Product Name"], ["X", "Y"]]);
  });
});

describe("parseNumber", () => {
  it("reads peso amounts and blanks", () => {
    expect(parseNumber("₱1,800.00")).toBe(1800);
    expect(parseNumber("")).toBeNull();
    expect(Number.isNaN(parseNumber("#VALUE!"))).toBe(true);
    expect(Number.isNaN(parseNumber("abc"))).toBe(true);
  });
});

describe("splitCondition", () => {
  it("puts grades in Part Type and colours in Color", () => {
    expect(splitCondition("OEM", "x")).toEqual({ partType: "OEM", color: "" });
    expect(splitCondition("ORIG", "x")).toEqual({ partType: "Original", color: "" });
    expect(splitCondition("Original (Black)", "x")).toEqual({ partType: "Original", color: "Black" });
    expect(splitCondition("White Titanium", "x")).toEqual({ partType: "", color: "White Titanium" });
  });

  it("takes the product name's last part when the condition was typed wrong", () => {
    expect(splitCondition("nch (A1895) - Silver", "Whole Unit - iPad Pro 12.9-inch (A1895) - Silver")).toEqual({ partType: "", color: "Silver" });
    expect(splitCondition("Universal USB-C - OEM", "USB-C Cable - Universal USB-C - OEM")).toEqual({ partType: "OEM", color: "" });
  });
});

describe("deriveDeviceType", () => {
  it("maps product names to the app's device types", () => {
    expect(deriveDeviceType("LCD - MacBook Pro 13-inch A1278 - OEM", "Apple")).toBe("Laptop (Mac)");
    expect(deriveDeviceType("Battery - iPhone 11 - OEM", "Apple")).toBe("Mobile (iPhone)");
    expect(deriveDeviceType("LCD - iPad Air 4 - OEM", "Apple")).toBe("iPad");
    expect(deriveDeviceType("Battery - Apple Watch Series 2 42mm - OEM", "Apple")).toBe("Apple Watch");
    expect(deriveDeviceType("LCD - Pixel 9 - OEM", "Google")).toBe("Mobile (Android)");
    expect(deriveDeviceType("LCD - Galaxy Tab S6 Lite - OEM", "Samsung")).toBe("Tablet (Android)");
    expect(deriveDeviceType("Battery - Acer Predator Helios 300 - N20C3 - OEM", "Acer")).toBe("Laptop (Windows)");
    expect(deriveDeviceType("Battery - Nintendo Switch V1 - OEM", "Nintendo")).toBe("Gaming Consoles");
    expect(deriveDeviceType("Hinge Metal Screw - OEM", "N/A")).toBe("Others");
  });
});

describe("buildImportPlan (sheet layout)", () => {
  it("finds the header below the title rows and reads Current Qty, not Initial Qty", () => {
    const plan = buildImportPlan(SHEET_CSV, [], "details");
    expect(plan.layout).toBe("sheet");
    expect(plan.headerRowNumber).toBe(4);
    expect(plan.errors).toEqual([]);
    expect(plan.creates.map((c) => [c.partId, c.quantity])).toEqual([
      ["BAT-APL-IP11-OEM", 5],
      ["HSG-APL-IP15P-WHT", 1],
      ["LCD-A1278-OEM", 0],
    ]);
    const housing = plan.creates[1];
    expect(housing).toMatchObject({ deviceType: "Mobile (iPhone)", color: "White", partType: "", cost: 1800, reorderLevel: null });
  });

  it("leaves existing parts alone when nothing differs", () => {
    const plan = buildImportPlan(SHEET_CSV, [existing()], "stock");
    expect(plan.unchanged).toBe(1);
    expect(plan.updates).toEqual([]);
    expect(plan.creates).toHaveLength(2);
  });

  it("changes quantities only in stock-count mode", () => {
    const parts = [existing({ quantity: 9 })];
    expect(buildImportPlan(SHEET_CSV, parts, "details").updates).toEqual([]);
    const stock = buildImportPlan(SHEET_CSV, parts, "stock");
    expect(stock.updates).toHaveLength(1);
    expect(stock.updates[0]).toMatchObject({ quantityFrom: 9, quantityTo: 5, changes: [] });
  });

  it("updates changed details but never clears a value with a blank cell", () => {
    const parts = [existing({ partId: "HSG-APL-IP15P-WHT", partName: "Housing 15 Pro White", supplier: "Ashtel", reorderLevel: 3, costPerUnit: "1800", model: "iPhone 15 Pro", color: "White", partType: "" })];
    const plan = buildImportPlan(SHEET_CSV, parts, "details");
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].changes.map((c) => c.field)).toEqual(["partName"]);
  });

  it("matches SKUs regardless of letter case", () => {
    const plan = buildImportPlan(SHEET_CSV, [existing({ partId: "bat-apl-ip11-oem" })], "details");
    expect(plan.creates.map((c) => c.partId)).not.toContain("BAT-APL-IP11-OEM");
  });

  it("reports duplicate SKUs, missing SKUs and negative quantities", () => {
    const csv = [
      "SKU,Product Name,Current Qty. in Stock",
      "A-1,Part A,1",
      "A-1,Part A again,2",
      ",Part without SKU,3",
      "B-1,Part B,-1",
      "C-1,Part C,#VALUE!",
      "D-1,Part D,4",
    ].join("\n");
    const plan = buildImportPlan(csv, [], "details");
    expect(plan.creates.map((c) => c.partId)).toEqual(["D-1"]);
    expect(plan.errors.map((e) => [e.rowNumber, e.message])).toEqual([
      [2, "Same SKU on rows 2, 3"],
      [3, "Same SKU on rows 2, 3"],
      [4, '"Part without SKU" has no SKU'],
      [5, "Negative quantity (-1) — recount this part first"],
      [6, "Quantity is not a whole number"],
    ]);
    expect(plan.rowsRead).toBe(6);
  });

  it("explains a file with no usable header", () => {
    expect(() => buildImportPlan("a,b\n1,2", [], "details")).toThrow(/No header row found/);
  });
});

describe("buildImportPlan (app layout)", () => {
  it("reads the app's own CSV download", () => {
    const csv = [
      "Part ID,Part Name,Device Type,Brand,Model,Color,Part Type,Quantity,Re-Order Level,Cost per Unit,Selling Price,Supplier,Date Ordered,Status,Last Updated,Remarks",
      'PRT1,LCD,Laptop (Mac),Apple,A2337,,OEM,4,1,0,0,,,On Order,11/20/2026,"Ordered: 4 units"',
    ].join("\n");
    const plan = buildImportPlan(csv, [], "details");
    expect(plan.layout).toBe("app");
    expect(plan.creates[0]).toMatchObject({ partId: "PRT1", deviceType: "Laptop (Mac)", partType: "OEM", quantity: 4, reorderLevel: 1, statusFlag: "On Order", remarks: "Ordered: 4 units" });
  });
});

describe("database records", () => {
  it("builds an insert with the derived stock status", () => {
    const plan = buildImportPlan(SHEET_CSV, [], "details");
    expect(toInsertRecord(plan.creates[0])).toMatchObject({ part_id: "BAT-APL-IP11-OEM", quantity: 5, reorder_level: 2, status: "In Stock", category: "Mobile (iPhone)" });
    expect(toInsertRecord(plan.creates[2])).toMatchObject({ quantity: 0, status: "Out of Stock" });
  });

  it("patches only what changed, plus the status that follows", () => {
    const plan = buildImportPlan(SHEET_CSV, [existing({ quantity: 9, partName: "Old name" })], "stock");
    const patch = toUpdatePatch(plan.updates[0]);
    expect(patch).toMatchObject({ part_name: "Battery - iPhone 11 - OEM", quantity: 5, status: "In Stock" });
    expect(Object.keys(patch).sort()).toEqual(["part_name", "quantity", "status", "updated_at"]);
  });
});
