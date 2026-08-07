/**
 * Keeps the stored Service Quotation Form in sync with what the client
 * actually approved on /track.
 *
 * Quotation PDFs are produced client-side (jsPDF), so regeneration happens
 * here: whenever a staff page loads a ticket whose client approval is newer
 * than the stored quotation file, the form is rebuilt from the finalized
 * `quoted_breakdown` lines (approved services with their chosen option,
 * unapproved lines marked "Not approved" and excluded from the total) and
 * uploaded over the previous file.
 */

import { supabase } from "@/integrations/supabase/client";
import { generateQuotationPDF, type BreakdownItem } from "@/lib/quotationPdfGenerator";
import { uploadServicePdf } from "@/lib/servicePdfStorage";
import { logSystemTicketActivity } from "@/lib/activityLogger";

import {
  lineDisplayName,
  lineEffectiveCost,
  normalizeQuotedBreakdown,
  vatAmount,
  computeFinalCost,
  type QuotedLine,
} from "@/lib/serviceApproval";

const money = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dateLabel = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
};

/**
 * Breakdown rows for a quotation that hasn't been approved yet: every line is
 * listed, and option variants are indented under their service name.
 */
export const quotedLineItems = (lines: QuotedLine[]): BreakdownItem[] => {
  const items: BreakdownItem[] = [];
  lines.forEach((line) => {
    if (line.options?.length) {
      items.push({ label: line.name });
      line.options.forEach((opt, i) => {
        items.push({
          label: `Option ${String.fromCharCode(65 + i)} - ${opt.label}`,
          amount: money(opt.cost),
          isOption: true,
          selected: !!line.selectedOption && opt.label === line.selectedOption,
        });
      });
      return;
    }
    const cost = lineEffectiveCost(line);
    items.push({ label: line.name, amount: money(cost) });
  });
  return items;
};

/** Breakdown rows for the PDF: approved lines priced, the rest marked. */
export const approvedBreakdownItems = (lines: QuotedLine[]): BreakdownItem[] => {
  const items: BreakdownItem[] = [];
  lines.forEach((line) => {
    const approved = !!line.selected;
    if (line.options?.length) {
      items.push({ label: line.name, muted: !approved, amount: approved ? undefined : "Not approved" });
      line.options.forEach((opt, i) => {
        const chosen = approved && opt.label === line.selectedOption;
        items.push({
          label: `Option ${String.fromCharCode(65 + i)} - ${opt.label}`,
          amount: money(opt.cost),
          isOption: true,
          selected: chosen,
          muted: !chosen,
        });
      });
      return;
    }
    items.push({
      label: line.name,
      amount: approved ? money(lineEffectiveCost(line)) : "Not approved",
      muted: !approved,
    });
  });
  return items;
};

export interface QuotationSyncResult {
  regenerated: boolean;
}

/**
 * Regenerate + replace the quotation PDF when the client's approval is newer
 * than the stored file. Safe to call on every ticket load: it no-ops when
 * there is no approval, no quoted lines, or the file is already current.
 */
export const syncApprovedQuotation = async (
  serviceId: string,
): Promise<QuotationSyncResult> => {
  if (!serviceId) return { regenerated: false };

  const { data: row } = await supabase
    .from("services")
    .select("*")
    .eq("service_id", serviceId)
    .maybeSingle();
  if (!row?.client_approved_at) return { regenerated: false };

  const lines = normalizeQuotedBreakdown((row as any).quoted_breakdown);
  if (!lines.length) return { regenerated: false };

  // Nothing to do when the stored quotation is already newer than the approval.
  const { data: files } = await supabase
    .from("service_files")
    .select("uploaded_at")
    .eq("service_id", serviceId)
    .eq("kind", "quotation" as any)
    .order("uploaded_at", { ascending: false })
    .limit(1);
  const storedAt = files?.[0]?.uploaded_at ? new Date(files[0].uploaded_at).getTime() : 0;
  const approvedAt = new Date(row.client_approved_at).getTime();
  if (!storedAt) return { regenerated: false }; // never generated: staff generates it manually
  if (storedAt >= approvedAt) return { regenerated: false };

  const approvedTotal = lines.reduce(
    (sum, l) => sum + (l.selected ? lineEffectiveCost(l) : 0),
    0,
  );
  const discount = Number((row as any).discount ?? 0) || 0;
  const vatRequested = !!(row as any).vat_requested;
  const vat = vatAmount(approvedTotal, discount, vatRequested);
  const finalCost = computeFinalCost(approvedTotal, discount, vatRequested);
  const approvedNames = lines.filter((l) => l.selected).map(lineDisplayName);

  const blob = await generateQuotationPDF({
    serviceId,
    timestamp: dateLabel(row.client_approved_at),
    adminRep: (row.admin_reps ?? [])[0] ?? "Admin",
    technician: (row.technicians ?? []).join(", "),
    receivingStaff: row.receiving_staff ?? "",
    clientType: row.client_type ?? "",
    priority: row.priority ?? "",
    clientName: row.client_name ?? "",
    username: row.username ?? row.client_name ?? "",
    phone: String(row.contact_number ?? ""),
    email: row.email ?? "",
    deviceType: row.device_type ?? "",
    serial: row.serial_number ?? "",
    brand: row.brand ?? "",
    color: row.color ?? "",
    model: row.model ?? "",
    memory: row.memory ?? "",
    technicianDiagnosis: row.diagnosis || (row as any).technician_diagnosis || "N/A",
    serviceSummary: approvedNames.join(", ") || row.service || "N/A",
    serviceCost: money(approvedTotal),
    partsUsed: (row.parts_used ?? []).join(", ") || "N/A",
    discount: money(discount),
    vat: vat > 0 ? money(vat) : undefined,
    totalCost: money(finalCost),
    serviceBreakdown: approvedBreakdownItems(lines),
    approvalStamp: `Client-approved quotation — ${row.client_name ?? "Client"}, ${dateLabel(
      row.client_approved_at,
    )}. Only the approved services above are included in the total.`,
    isUpdated: true,
  } as any);

  const uploaded = await uploadServicePdf({
    serviceId,
    clientName: row.client_name ?? "",
    kind: "quotation",
    blob,
  });
  if (uploaded) {
    logSystemTicketActivity(
      serviceId,
      "Service Quotation Form auto-regenerated from the client's approved services",
      {
        "Approved services": approvedNames.join(", ") || "(none)",
        "Approved total": money(approvedTotal),
        Discount: money(discount),
        ...(vat > 0 ? { VAT: money(vat) } : {}),
        "Final cost": money(finalCost),
      },
      "System (Quotation Sync)",
    );
  }
  return { regenerated: !!uploaded };
};

