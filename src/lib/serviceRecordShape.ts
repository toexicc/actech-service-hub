import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { mapServiceRow } from "@/hooks/useServices";

/**
 * Build the sheet-shaped payload the workspace pages consume directly from a
 * Supabase service row. Supabase is the source of truth: the legacy Google
 * Sheets payload is only used to fill in fields that have no database column
 * (Drive folder URLs, legacy PDF links, etc.).
 */
export const supabaseRowToSheetShape = (sb: ReturnType<typeof mapServiceRow>) => ({
  serviceId: sb.serviceId,
  clientId: sb.clientId,
  clientName: sb.clientName,
  contactNumber: sb.contactNumber,
  phone: sb.contactNumber,
  email: sb.email,
  address: sb.address,
  deviceType: sb.deviceType,
  brand: sb.brand,
  // Device Model must be the model value only - never a composite of
  // device type / brand / model.
  device: sb.deviceModel,
  model: sb.deviceModel,
  deviceModel: sb.deviceModel,
  serialNumber: sb.serialNumber,
  issueDescription: sb.issueDescription,
  status: sb.status,
  technician: sb.technician,
  technicianDepartment: sb.technicianDepartment,
  adminRep: sb.adminRep,
  receivingStaff: sb.receivingStaff,
  dateReceived: sb.dateReceived,
  dateCompleted: sb.dateCompleted,
  targetDate: sb.targetDate ? format(new Date(sb.targetDate), "MM-dd-yyyy") : "",
  service: sb.service,
  timeFrame: sb.estimatedCompletion,
  estimatedCompletion: sb.estimatedCompletion,
  repairTimeFrame: (sb as any).repairTimeFrame || "",
  serviceCost: sb.serviceCost,
  finalCost: sb.finalCost,
  partsCost: sb.partsCost,
  estimatedCost: sb.estimatedCost,
  discount: sb.discount,
  laborCost: sb.laborCost,
  totalCost: sb.totalCost,
  partsUsed: sb.partsUsed,
  paymentStatus: sb.paymentStatus,
  modeOfTransfer: sb.modeOfTransfer,
  initialPayment: sb.initialPayment,
  aiReport: sb.aiReport,
  aiDiagnosis: sb.diagnosis,
  diagnosisWarranty: (sb as any).diagnosisWarranty || "",
  diagnosisOtherNotes: (sb as any).diagnosisOtherNotes || "",
  diagnosisSummary: (sb as any).diagnosisSummary || "",
  technicianDiagnosis: sb.technicianDiagnosis || sb.diagnosis,

  technicianReport: sb.technicianReport,
  username: sb.username,
  devicePassword: sb.devicePassword,
  color: sb.color,
  memory: sb.memory,
  colorMemory: sb.colorMemory,
  chiefComplaint: sb.chiefComplaint,
  deviceNotes: sb.deviceNotes,
  clientType: sb.clientType,
  priority: sb.priority,
  conditions: sb.conditions,
  adminNotes: sb.remarks,
  adminNotesInternal: sb.internalAdminNotes,
  technicianNotesInternal: sb.internalTechnicianNotes,
  preOrder: sb.preOrder,
  partId: sb.partId,
  signaturePath: sb.signaturePath,
  deviceAnnotationPath: sb.deviceAnnotationPath,
  annotationNotes: (sb as any).annotationNotes || "",
  clientApprovedAt: (sb as any).clientApprovedAt || "",
  autoApproveDiagnosis: !!(sb as any).autoApproveDiagnosis,
  waitingForParts: !!(sb as any).waitingForParts,
  vatRequested: !!(sb as any).vatRequested,
  approvalLocked: !!(sb as any).approvalLocked,
  approvedServices: Array.isArray((sb as any).approvedServices) ? (sb as any).approvedServices : [],
  pendingServices: Array.isArray((sb as any).pendingServices) ? (sb as any).pendingServices : [],
  quotedBreakdown: Array.isArray((sb as any).quotedBreakdown) ? (sb as any).quotedBreakdown : [],
  source: sb.source,
  lastUpdated: sb.lastUpdated,
  timestamp: sb.timestamp,
});

/**
 * Keys the database always wins on - even when the database value is empty -
 * so that clearing a field through the details editor is reflected on screen
 * instead of falling back to the stale spreadsheet value.
 */
const AUTHORITATIVE_KEYS = new Set<string>([
  "clientName",
  "clientId",
  "username",
  "contactNumber",
  "phone",
  "email",
  "address",
  "deviceType",
  "brand",
  "device",
  "model",
  "deviceModel",
  "serialNumber",
  "color",
  "memory",
  "colorMemory",
  "devicePassword",
  "clientType",
  "priority",
  "service",
  "timeFrame",
  "estimatedCompletion",
  "repairTimeFrame",
  "targetDate",
  "deviceNotes",
  "conditions",
  "status",
  "technician",
  "adminRep",
  "chiefComplaint",
  "technicianDiagnosis",
  "aiDiagnosis",
  "diagnosisWarranty",
  "diagnosisOtherNotes",
  "diagnosisSummary",

  "aiReport",
  "technicianReport",
  "serviceCost",
  "discount",
  "finalCost",
  "partsCost",
  "adminNotes",
  "adminNotesInternal",
  "technicianNotesInternal",
  "autoApproveDiagnosis",
  "waitingForParts",
  "vatRequested",
  "approvalLocked",
  "quotedBreakdown",
  "approvedServices",
  "pendingServices",
]);

const isEmpty = (v: any) =>
  v === undefined ||
  v === null ||
  v === "" ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

/**
 * Merge a Supabase row over the legacy sheet payload with Supabase winning.
 */
export const mergeSupabaseOverSheet = (
  sb: ReturnType<typeof mapServiceRow>,
  sheetData: any,
): any => {
  const dbShape = supabaseRowToSheetShape(sb);
  const merged: any = { ...(sheetData || {}) };
  Object.entries(dbShape).forEach(([key, value]) => {
    if (AUTHORITATIVE_KEYS.has(key) || !isEmpty(value)) {
      merged[key] = value;
    }
  });
  return merged;
};

/**
 * Fetch a service row and merge it over any legacy sheet payload.
 */
export const mergeWithSupabase = async (serviceId: string, sheetData: any): Promise<any> => {
  try {
    const { data: row } = await supabase
      .from("services")
      .select("*")
      .eq("service_id", serviceId)
      .maybeSingle();
    if (!row) return sheetData;
    return mergeSupabaseOverSheet(mapServiceRow(row), sheetData);
  } catch {
    return sheetData;
  }
};
