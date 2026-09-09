/**
 * Lets staff correct a ticket's quoted service lines straight from the payment
 * screen (POS page and the in-page payment modal), then writes the corrections
 * back onto the ticket so the totals, receipt and warranty card all agree.
 */

import { supabase } from "@/integrations/supabase/client";
import { logActivityAsync } from "@/lib/activityLogger";
import {
  normalizeQuotedBreakdown,
  lineDisplayName,
  lineEffectiveCost,
  quotedSelectedTotal,
  effectiveDiscount,
  rushAmount,
  vatAmount,
  computeFinalCost,
  type QuotedLine,
} from "@/lib/serviceApproval";

export interface TicketLinesContext {
  lines: QuotedLine[];
  discount: number;
  vatRequested: boolean;
  rushFee: boolean;
  serviceCost: number;
  finalCost: number;
  clientApproved: boolean;
}

export interface LineTotals {
  subtotal: number;
  discount: number;
  rush: number;
  vat: number
  finalCost: number;
}

const peso = (n: number) =>
  `Php ${(Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Live totals for the edited lines, using the ticket's discount / rush / VAT flags. */
export const computeLineTotals = (
  lines: QuotedLine[],
  discount: number,
  vatRequested: boolean,
  rushFee: boolean,
): LineTotals => {
  const subtotal = quotedSelectedTotal(lines);
  const eff = effectiveDiscount(lines, discount);
  return {
    subtotal,
    discount: eff,
    rush: rushAmount(subtotal, eff, rushFee),
    vat: vatAmount(subtotal, eff, vatRequested, rushFee),
    finalCost: computeFinalCost(subtotal, eff, vatRequested, rushFee),
  };
};

/** Read the ticket's quoted lines and pricing flags. */
export const fetchTicketLinesContext = async (
  serviceId: string,
): Promise<TicketLinesContext | null> => {
  if (!serviceId || serviceId === "MANUAL") return null;
  const { data } = await supabase
    .from("services")
    .select(
      "quoted_breakdown, discount, vat_requested, rush_fee, service_cost, final_cost, client_approved_at",
    )
    .eq("service_id", serviceId)
    .maybeSingle();
  if (!data) return null;
  const s = data as any;
  return {
    lines: normalizeQuotedBreakdown(s.quoted_breakdown),
    discount: Number(s.discount ?? 0) || 0,
    vatRequested: !!s.vat_requested,
    rushFee: !!s.rush_fee,
    serviceCost: Number(s.service_cost ?? 0) || 0,
    finalCost: Number(s.final_cost ?? 0) || 0,
    clientApproved: !!s.client_approved_at,
  };
};

const sameLines = (a: QuotedLine[], b: QuotedLine[]) =>
  JSON.stringify(
    a.map((l) => [lineDisplayName(l), lineEffectiveCost(l), !!l.selected]),
  ) ===
  JSON.stringify(
    b.map((l) => [lineDisplayName(l), lineEffectiveCost(l), !!l.selected]),
  );

export interface SaveLinesArgs {
  serviceId: string;
  lines: QuotedLine[];
  original: QuotedLine[];
  discount: number;
  vatRequested: boolean;
  rushFee: boolean;
  actorName: string;
  actorRole?: string;
}

export interface SaveLinesResult {
  changed: boolean;
  finalCost: number;
}

/** Human-readable diff of what changed between two line sets. */
const diffLines = (before: QuotedLine[], after: QuotedLine[]): Record<string, string> => {
  const out: Record<string, string> = {};
  const beforeMap = new Map(before.map((l) => [lineDisplayName(l), l]));
  const afterMap = new Map(after.map((l) => [lineDisplayName(l), l]));

  after.forEach((l) => {
    const label = lineDisplayName(l);
    const prev = beforeMap.get(label);
    if (!prev) {
      out[`Added: ${label}`] = `${peso(lineEffectiveCost(l))}${l.selected ? "" : " (not included)"}`;
      return;
    }
    if (lineEffectiveCost(prev) !== lineEffectiveCost(l)) {
      out[`Price: ${label}`] = `${peso(lineEffectiveCost(prev))} → ${peso(lineEffectiveCost(l))}`;
    }
    if (!!prev.selected !== !!l.selected) {
      out[`Included: ${label}`] = l.selected ? "No → Yes" : "Yes → No";
    }
  });

  before.forEach((l) => {
    const label = lineDisplayName(l);
    if (!afterMap.has(label)) out[`Removed: ${label}`] = peso(lineEffectiveCost(l));
  });

  return out;
};

/**
 * Persist the corrected lines onto the ticket and recompute its costs. Returns
 * the recomputed final cost so callers can gate the payment on it.
 */
export const saveTicketServiceLines = async (
  args: SaveLinesArgs,
): Promise<SaveLinesResult> => {
  const { serviceId, lines, original, discount, vatRequested, rushFee, actorName, actorRole } = args;
  const totals = computeLineTotals(lines, discount, vatRequested, rushFee);
  if (!serviceId || serviceId === "MANUAL") return { changed: false, finalCost: totals.finalCost };

  if (sameLines(original, lines)) return { changed: false, finalCost: totals.finalCost };

  const approvedNames = lines.filter((l) => l.selected).map(lineDisplayName);
  const pendingNames = lines.filter((l) => !l.selected).map(lineDisplayName);

  const { error } = await supabase
    .from("services")
    .update({
      quoted_breakdown: lines as any,
      service_cost: totals.subtotal,
      final_cost: totals.finalCost,
      service: approvedNames.join(", "),
      approved_services: approvedNames,
      pending_services: pendingNames,
      last_updated: new Date().toISOString(),
    } as any)
    .eq("service_id", serviceId);
  if (error) throw error;

  logActivityAsync({
    serviceId,
    username: actorName,
    role: actorRole || "",
    activity: `POS: Updated service lines — final cost ${peso(totals.finalCost)}`,
    details: {
      ...diffLines(original, lines),
      "Services subtotal": peso(totals.subtotal),
      ...(totals.discount > 0 ? { Discount: peso(totals.discount) } : {}),
      ...(totals.rush > 0 ? { "Rush fee": peso(totals.rush) } : {}),
      ...(totals.vat > 0 ? { VAT: peso(totals.vat) } : {}),
      "Final cost": peso(totals.finalCost),
    },
  });

  return { changed: true, finalCost: totals.finalCost };
};
