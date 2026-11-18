/** Pure helpers for Company Repairs quotations / billing statements. */

export interface QuoteSolution {
  name: string;
  cost: number;
  warranty?: string;
}

export interface QuoteLine {
  serviceId: string;
  serial: string;
  model: string;
  issue: string;
  partsRequested: string;
  solutions: QuoteSolution[];
  notes: string;
  quantity: number;
}

export interface QuotePayload {
  customerName: string;
  companyName: string;
  date: string; // ISO
  lines: QuoteLine[];
  timeframe: string;
  discount: number;
  vatIncluded: boolean;
  warranty: string;
}

export const VAT_RATE = 0.12;

export const DEFAULT_TIMEFRAME =
  "• Parts are subject to availability and are made to order.\n" +
  "• Estimated Parts Lead Time: 1–4 weeks\n" +
  "• Once the part arrives: 3–5 working days for installation, repair, and testing";

export const lineUnitPrice = (l: QuoteLine) =>
  round2(l.solutions.reduce((s, x) => s + (Number(x.cost) || 0), 0));

export const lineAmount = (l: QuoteLine) => round2(lineUnitPrice(l) * Math.max(1, l.quantity || 1));

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Prices are VAT-inclusive (same as the Shopee sheet):
 * Final = sum(amounts) - discount; Sub Total = Final / 1.12; VAT = Final - Sub Total.
 * When VAT is off, Sub Total = Final and VAT = 0.
 */
export const quoteTotals = (p: Pick<QuotePayload, "lines" | "discount" | "vatIncluded">) => {
  const gross = round2(p.lines.reduce((s, l) => s + lineAmount(l), 0));
  const discount = round2(Math.max(0, Number(p.discount) || 0));
  const finalAmount = round2(Math.max(0, gross - discount));
  const subTotal = p.vatIncluded ? round2(finalAmount / (1 + VAT_RATE)) : finalAmount;
  const vat = round2(finalAmount - subTotal);
  return { gross, discount, subTotal, vat, finalAmount };
};

/** CQ-YYMMDD-NNN, NNN = count of quotations already issued today + 1. */
export const nextQuotationNo = (date: Date, existingToday: number) => {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `CQ-${yy}${mm}${dd}-${String(existingToday + 1).padStart(3, "0")}`;
};

interface ServiceLike {
  service_id: string;
  serial_number?: string | null;
  brand?: string | null;
  model?: string | null;
  chief_complaint?: string | null;
  issue_description?: string | null;
  quoted_breakdown?: unknown;
  diagnosis_warranty?: string | null;
  service_cost?: number | null;
  final_cost?: number | null;
}

/** Prefill a quotation line from a ticket's quoted breakdown. */
export const lineFromService = (s: ServiceLike): QuoteLine => {
  const rows = Array.isArray(s.quoted_breakdown) ? (s.quoted_breakdown as Record<string, unknown>[]) : [];
  const picked = rows.filter((r) => r && r.selected !== false && String(r.name ?? "").trim());
  let solutions: QuoteSolution[] = picked.map((r) => ({
    name: String(r.name),
    cost: Number(r.cost) || 0,
    warranty: matchWarranty(String(r.name), s.diagnosis_warranty),
  }));
  if (!solutions.length) {
    const total = Number(s.final_cost) || Number(s.service_cost) || 0;
    solutions = total > 0 ? [{ name: "Repair", cost: total, warranty: s.diagnosis_warranty ?? "" }] : [];
  }
  return {
    serviceId: s.service_id,
    serial: s.serial_number ?? "",
    model: [s.brand, s.model].filter(Boolean).join(" "),
    issue: s.chief_complaint || s.issue_description || "",
    partsRequested: solutions.map((x) => x.name.replace(/\s*replacement.*$/i, "")).join(", "),
    solutions,
    notes: "",
    quantity: 1,
  };
};

const matchWarranty = (name: string, warranty?: string | null) => {
  if (!warranty) return "";
  const lines = warranty.split(/\n|;/).map((x) => x.trim()).filter(Boolean);
  const key = name.toLowerCase().split(" ")[0];
  const hit = lines.find((l) => l.toLowerCase().includes(key));
  const src = hit ?? (lines.length === 1 ? lines[0] : "");
  return src.includes(" - ") ? src.split(" - ").slice(1).join(" - ").trim() : src;
};

export const QUOTATION_REQUEST_OPTIONS = ["RFQ", "Quotation Sent", "Approved", "Declined"] as const;
