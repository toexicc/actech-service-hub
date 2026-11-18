import { describe, it, expect } from "vitest";
import { quoteTotals, nextQuotationNo, lineFromService, type QuoteLine } from "./companyQuotation";

const line = (costs: number[], qty = 1): QuoteLine => ({
  serviceId: "X", serial: "", model: "", issue: "", partsRequested: "", notes: "", quantity: qty,
  solutions: costs.map((c) => ({ name: "p", cost: c })),
});

describe("company quotation totals", () => {
  it("matches the Shopee sheet: 9,350 VAT-inclusive", () => {
    const t = quoteTotals({ lines: [line([5850, 3500])], discount: 0, vatIncluded: true });
    expect(t.finalAmount).toBe(9350);
    expect(t.subTotal).toBe(8348.21);
    expect(t.vat).toBe(1001.79);
  });
  it("applies discount before VAT split and multiplies quantity", () => {
    const t = quoteTotals({ lines: [line([2900], 2)], discount: 800, vatIncluded: false });
    expect(t.finalAmount).toBe(5000);
    expect(t.vat).toBe(0);
  });
  it("numbers quotations per day", () => {
    expect(nextQuotationNo(new Date(2026, 10, 18), 2)).toBe("CQ-261118-003");
  });
  it("prefills from selected breakdown rows", () => {
    const l = lineFromService({ service_id: "AC1", quoted_breakdown: [
      { name: "LCD Replacement", cost: 5850, selected: true },
      { name: "Keyboard", cost: 2900, selected: false },
    ], diagnosis_warranty: "LCD Replacement - 45 Days" });
    expect(l.solutions).toEqual([{ name: "LCD Replacement", cost: 5850, warranty: "45 Days" }]);
  });
});
