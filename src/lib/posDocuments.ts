/**
 * Builds and stores the two client-facing POS documents for a ticket:
 * the running Official Receipt and (optionally) the A5 Warranty Card.
 *
 * Both are regenerated from the ticket's own record so the figures always match
 * /track, /manage-client and the POS ledger.
 */

import { supabase } from "@/integrations/supabase/client";
import { generateReceiptPDF, type ReceiptLine } from "@/lib/receiptPdfGenerator";
import { generateWarrantyCardPDF, type WarrantyLine } from "@/lib/warrantyCardGenerator";
import { uploadServicePdf } from "@/lib/servicePdfStorage";
import { logTicketActivity } from "@/lib/activityLogger";
import { summarizePayments, derivePaymentTotals } from "@/hooks/useServicePayments";
import {
  normalizeQuotedBreakdown,
  lineDisplayName,
  lineEffectiveCost,
  effectiveDiscount,
  rushAmount,
  vatAmount,
  computeFinalCost,
} from "@/lib/serviceApproval";

const TRACK_BASE = "https://actechrepair-service.com/track";

export const WARRANTY_TERM_PRESETS = ["3 months", "1 month", "30 days", "45 days", "6 months", "No warranty"];

export interface ApprovedLine {
  /** Display name, including the chosen option. */
  label: string;
  amount: number;
}

const SERVICE_COLUMNS =
  "service_id, client_name, contact_number, email, address, device_type, brand, model, serial_number, color, memory, " +
  "quoted_breakdown, service_cost, discount, vat_requested, rush_fee, final_cost, initial_payment, " +
  "technicians, admin_reps, receiving_staff, warranty_terms, released_at, service_date, diagnosis_summary";

/** Approved (client-ticked) quotation lines with their effective amounts. */
export const approvedLinesOf = (quotedBreakdown: unknown): ApprovedLine[] =>
  normalizeQuotedBreakdown(quotedBreakdown)
    .filter((l) => l.selected)
    .map((l) => ({ label: lineDisplayName(l), amount: lineEffectiveCost(l) }));

/** Reads just what the payment UI needs: approved lines + saved warranty terms. */
export const fetchTicketDocumentContext = async (serviceId: string) => {
  if (!serviceId) return null;
  const { data } = await supabase
    .from("services")
    .select("quoted_breakdown, warranty_terms")
    .eq("service_id", serviceId)
    .maybeSingle();
  if (!data) return null;
  const terms = (data as any).warranty_terms;
  return {
    approvedLines: approvedLinesOf((data as any).quoted_breakdown),
    warrantyTerms: (terms && typeof terms === "object" ? terms : {}) as Record<string, string>,
  };
};

export interface RegenerateArgs {
  serviceId: string;
  /** Staff who processed the payment. */
  actorName: string;
  /** Line label -> warranty term. */
  warrantyTerms?: Record<string, string>;
  /** Staff asked for a warranty card (only honoured when fully paid). */
  createWarranty?: boolean;
}

export interface RegenerateResult {
  receipt: boolean;
  warranty: boolean;
  /** Reason the warranty card was skipped, when it was. */
  warrantySkipped?: string;
  /** Reason the invoice-receipt was skipped, when it was. */
  receiptSkipped?: string;
}

/**
 * Regenerates the invoice-receipt and the warranty card, both only once the
 * ticket is fully paid. Never throws — callers treat it as best effort.
 */
export const regenerateTicketDocuments = async (
  args: RegenerateArgs,
): Promise<RegenerateResult> => {
  const { serviceId, actorName, warrantyTerms, createWarranty } = args;
  const out: RegenerateResult = { receipt: false, warranty: false };
  if (!serviceId || serviceId === "MANUAL") return out;

  const { data: svc } = await supabase
    .from("services")
    .select(SERVICE_COLUMNS)
    .eq("service_id", serviceId)
    .maybeSingle();
  if (!svc) return out;
  const s = svc as any;

  const { data: txns } = await supabase
    .from("transactions")
    .select("*")
    .eq("service_id", serviceId)
    .order("transaction_date", { ascending: true });
  const summary = summarizePayments(txns ?? []);

  const lines = normalizeQuotedBreakdown(s.quoted_breakdown);
  const approved: ReceiptLine[] = lines
    .filter((l) => l.selected)
    .map((l) => ({ label: lineDisplayName(l), amount: lineEffectiveCost(l) }));

  const subtotal = approved.reduce((sum, l) => sum + l.amount, 0);
  const serviceCost = Number(s.service_cost ?? 0) || subtotal;
  const discount = effectiveDiscount(lines, Number(s.discount ?? 0) || 0);
  const rush = rushAmount(serviceCost, discount, !!s.rush_fee);
  const vat = vatAmount(serviceCost, discount, !!s.vat_requested, !!s.rush_fee);
  const storedFinal = Number(s.final_cost ?? 0) || 0;
  const finalCost =
    storedFinal > 0
      ? storedFinal
      : computeFinalCost(serviceCost, discount, !!s.vat_requested, !!s.rush_fee);

  const totals = derivePaymentTotals(
    finalCost,
    Number(s.initial_payment ?? 0) || 0,
    summary.transactionsPaid,
  );

  const now = new Date().toISOString();
  const clientName = String(s.client_name ?? "");
  const technician = Array.isArray(s.technicians) ? s.technicians.join(", ") : "";
  const adminRep = Array.isArray(s.admin_reps) ? s.admin_reps.join(", ") : "";

  const fullyPaid = finalCost > 0 && totals.balance <= 0.01;

  // ------------------------------------------------------------- receipt
  if (!fullyPaid) {
    out.receiptSkipped = "Service Invoice - Receipt is created once the ticket is fully paid.";
  }
  try {
    if (!fullyPaid) throw new Error("not fully paid");
    const blob = await generateReceiptPDF({
      serviceId,
      timestamp: now,
      receivedBy: actorName,
      adminRep,
      technician,
      clientName,
      phone: String(s.contact_number ?? ""),
      email: String(s.email ?? ""),
      address: String(s.address ?? ""),
      deviceType: String(s.device_type ?? ""),
      brand: String(s.brand ?? ""),
      model: String(s.model ?? ""),
      color: String(s.color ?? ""),
      memory: String(s.memory ?? ""),
      serial: String(s.serial_number ?? ""),
      lines: approved,
      serviceSummary: String(s.diagnosis_summary ?? ""),
      subtotal: subtotal || serviceCost,
      discount,
      rushFee: rush,
      vat,
      finalCost,
      payments: summary.payments.map((p) => ({
        date: p.date,
        method: p.paymentMethod,
        type: p.type,
        amount: p.amount,
        reference: p.transactionId,
      })),
      paid: totals.paid,
      balance: totals.balance,
      trackUrl: `${TRACK_BASE}/${encodeURIComponent(serviceId)}`,
    });
    const stored = await uploadServicePdf({ serviceId, clientName, kind: "receipt", blob });
    out.receipt = !!stored;
  } catch {
    out.receipt = false;
  }

  // Logged here so it lands on the timeline and Reports even when no warranty
  // card is requested (the warranty guards below can return early).
  if (out.receipt) logTicketActivity(serviceId, "Service Invoice - Receipt generated");

  // -------------------------------------------------------- warranty card
  const savedTerms =
    s.warranty_terms && typeof s.warranty_terms === "object"
      ? (s.warranty_terms as Record<string, string>)
      : {};
  const mergedTerms: Record<string, string> = { ...savedTerms, ...(warrantyTerms ?? {}) };

  // Make sure every approved line has an explicit term stored, so a later
  // regeneration reproduces exactly the same card.
  approved.forEach((l) => {
    const chosen = (mergedTerms[l.label] ?? "").trim();
    mergedTerms[l.label] = chosen || WARRANTY_TERM_PRESETS[0];
  });

  if (approved.length || (warrantyTerms && Object.keys(warrantyTerms).length)) {
    await supabase.from("services").update({ warranty_terms: mergedTerms }).eq("service_id", serviceId);
  }

  if (!createWarranty) return out;
  if (finalCost <= 0 || totals.balance > 0.01) {
    out.warrantySkipped = "Warranty card is created once the ticket is fully paid.";
    return out;
  }

  try {
    const wLines: WarrantyLine[] = approved.map((l) => ({
      label: l.label,
      amount: l.amount,
      term: mergedTerms[l.label] || "No warranty",
    }));
    const blob = await generateWarrantyCardPDF({
      serviceId,
      timestamp: s.released_at || now,
      clientName,
      phone: String(s.contact_number ?? ""),
      email: String(s.email ?? ""),
      deviceType: String(s.device_type ?? ""),
      brand: String(s.brand ?? ""),
      model: String(s.model ?? ""),
      serial: String(s.serial_number ?? ""),
      color: String(s.color ?? ""),
      memory: String(s.memory ?? ""),
      lines: wLines,
      total: totals.paid,
      releasedBy: actorName,
    });
    const stored = await uploadServicePdf({ serviceId, clientName, kind: "warranty", blob });
    out.warranty = !!stored;
  } catch {
    out.warranty = false;
  }

  // Document generation is real closing work, so it lands on the ticket
  // timeline and counts on the Reports output leaderboard.
  if (out.warranty) logTicketActivity(serviceId, "Warranty Card generated");

  return out;
};
