import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ServiceRecord {
  serviceId: string;
  clientId: string;
  clientName: string;
  contactNumber: string;
  email?: string;
  address?: string;
  deviceType: string;
  deviceBrand: string;
  deviceModel: string;
  serialNumber: string;
  issueDescription: string;
  diagnosis: string;
  technicianDiagnosis?: string;
  diagnosisBreakdownText?: string;
  diagnosisWarranty?: string;
  diagnosisOtherNotes?: string;
  diagnosisSummary?: string;

  clientApprovedAt?: string;
  autoApproveDiagnosis?: boolean;
  waitingForParts?: boolean;
  waitingPartsNote?: string;
  isBackjob?: boolean;
  rushFee?: boolean;
  rtoReason?: string;
  vatRequested?: boolean;

  approvalLocked?: boolean;
  approvedServices?: string[];
  pendingServices?: string[];
  quotedBreakdown?: any[];

  status: string;
  technician: string;
  technicianAssigned: string;
  dateReceived: string;
  targetDate: string;
  estimatedCompletion: string;
  repairTimeFrame?: string;
  dateCompleted?: string;
  partsUsed: string;
  laborCost: string;
  totalCost: string;
  paymentStatus: string;
  remarks: string;
  lastUpdated: string;
  service?: string;
  timestamp?: string;
  internalAdminNotes?: string;
  internalTechnicianNotes?: string;
  technicianDepartment?: string;
  brand?: string;
  device?: string;
  adminRep?: string;
  adminRepresentative?: string;
  receivingStaff?: string;
  serviceCost?: string;
  modeOfTransfer?: string;
  initialPayment?: string;
  aiReport?: string;
  aiToggle?: string;
  preOrder?: string;
  partId?: string;
  // Phase 1: full intake fields
  username?: string;
  devicePassword?: string;
  color?: string;
  memory?: string;
  colorMemory?: string;
  chiefComplaint?: string;
  deviceNotes?: string;
  technicianReport?: string;
  finalCost?: string;
  partsCost?: string;
  estimatedCost?: string;
  serviceDate?: string;
  discount?: string;
  clientType?: string;
  priority?: string;
  conditions?: Record<string, boolean>;
  signaturePath?: string;
  deviceAnnotationPath?: string;
  annotationNotes?: string;
  source?: string;
}

/**
 * Legacy rows sometimes stored the model as "<device type> <brand> <model>".
 * Strip the device type / brand prefixes so the model renders on its own.
 */
export const cleanDeviceModel = (model?: string | null, deviceType?: string | null, brand?: string | null): string => {
  let out = String(model ?? "").trim();
  if (!out) return "";
  for (const prefix of [deviceType, brand, deviceType, brand]) {
    const p = String(prefix ?? "").trim();
    if (!p) continue;
    if (out.toLowerCase().startsWith(p.toLowerCase())) {
      out = out.slice(p.length).trim();
    }
  }
  return out;
};

export const mapServiceRow = (r: any): ServiceRecord => ({
  serviceId: r.service_id ?? "",
  clientId: r.client_id ?? "",
  clientName: r.client_name ?? "",
  contactNumber: r.contact_number ?? "",
  email: r.email ?? "",
  address: r.address ?? "",
  deviceType: r.device_type ?? "",
  deviceBrand: r.brand ?? "",
  deviceModel: cleanDeviceModel(r.model, r.device_type, r.brand),
  serialNumber: r.serial_number ?? "",
  issueDescription: r.issue_description ?? "",
  diagnosis: r.diagnosis ?? "",
  diagnosisBreakdownText: (r as any).diagnosis_breakdown_text ?? "",
  diagnosisWarranty: (r as any).diagnosis_warranty ?? "",
  diagnosisOtherNotes: (r as any).diagnosis_other_notes ?? "",
  diagnosisSummary: (r as any).diagnosis_summary ?? "",
  technicianDiagnosis: r.technician_diagnosis ?? "",

  clientApprovedAt: r.client_approved_at ?? "",
  autoApproveDiagnosis: !!r.auto_approve_diagnosis,
  waitingForParts: !!(r as any).waiting_for_parts,
  waitingPartsNote: (r as any).waiting_parts_note ?? "",
  isBackjob: !!(r as any).is_backjob,
  rushFee: !!(r as any).rush_fee,
  serviceDate: (r as any).service_date ?? "",
  rtoReason: (r as any).rto_reason ?? "",
  vatRequested: !!(r as any).vat_requested,

  approvalLocked: !!r.approval_locked,
  approvedServices: Array.isArray(r.approved_services) ? r.approved_services : [],
  pendingServices: Array.isArray(r.pending_services) ? r.pending_services : [],
  quotedBreakdown: Array.isArray((r as any).quoted_breakdown) ? (r as any).quoted_breakdown : [],

  status: r.status ?? "",
  technician: Array.isArray(r.technicians) ? r.technicians.join(", ") : (r.technicians ?? ""),
  technicianAssigned: Array.isArray(r.technicians) ? r.technicians.join(", ") : "",
  dateReceived: r.date_received ?? "",
  targetDate: r.target_date ?? "",
  estimatedCompletion: r.estimated_completion ?? "",
  repairTimeFrame: (r as any).repair_time_frame ?? "",
  dateCompleted: r.date_completed ?? "",
  partsUsed: Array.isArray(r.parts_used) ? r.parts_used.join(", ") : "",
  laborCost: String(r.labor_cost ?? 0),
  totalCost: String(r.total_cost ?? 0),
  paymentStatus: r.payment_status ?? "",
  remarks: r.remarks ?? "",
  lastUpdated: r.last_updated ?? "",
  service: r.service ?? "",
  timestamp: r.created_at ?? "",
  internalAdminNotes: r.internal_admin_notes ?? "",
  internalTechnicianNotes: r.internal_technician_notes ?? "",
  technicianDepartment: Array.isArray(r.technician_departments) ? r.technician_departments.join(", ") : "",
  brand: r.brand ?? "",
  device: r.device_type ?? "",
  adminRep: Array.isArray(r.admin_reps) ? r.admin_reps.join(", ") : "",
  adminRepresentative: Array.isArray(r.admin_reps) ? r.admin_reps.join(", ") : "",
  receivingStaff: r.receiving_staff ?? "",
  serviceCost: String(r.service_cost ?? 0),
  modeOfTransfer: r.mode_of_transfer ?? "",
  initialPayment: String(r.initial_payment ?? 0),
  aiReport: r.ai_report ?? "",
  aiToggle: r.ai_toggle ?? "",
  preOrder: r.pre_order ?? "",
  partId: r.part_id ?? "",
  username: r.username ?? "",
  devicePassword: r.device_password ?? "",
  color: r.color ?? "",
  memory: r.memory ?? "",
  colorMemory: [r.color, r.memory].filter(Boolean).join(" | "),
  chiefComplaint: r.chief_complaint ?? "",
  deviceNotes: r.device_notes ?? "",
  technicianReport: r.technician_report ?? "",
  finalCost: String(r.final_cost ?? 0),
  partsCost: String(r.parts_cost ?? 0),
  estimatedCost: String(r.estimated_cost ?? 0),
  discount: String(r.discount ?? 0),
  clientType: r.client_type ?? "",
  priority: r.priority ?? "",
  conditions: (r.conditions && typeof r.conditions === "object") ? r.conditions : {},
  signaturePath: r.signature_path ?? "",
  deviceAnnotationPath: r.device_annotation_path ?? "",
  annotationNotes: r.device_annotation_notes ?? "",
  source: r.source ?? "",
});

/**
 * Columns the list views (tracker, dashboards, cards, reports) actually render.
 * The heavy free-text columns (AI diagnosis, technician report, internal notes,
 * annotations, quoted breakdown, conditions) are deliberately excluded — the
 * detail pages load those per ticket. Selecting `*` here downloaded the entire
 * table (~6 KB per row) on every refresh, which is the main egress cost.
 */
const LIST_COLUMNS = [
  "service_id","client_id","client_name","contact_number","email",
  "device_type","brand","model","serial_number","color","memory",
  "service","status","priority","client_type","source",
  "technicians","technician_departments","admin_reps","receiving_staff",
  "date_received","service_date","target_date","estimated_completion",
  "date_completed","repair_time_frame","last_updated","created_at",
  "parts_used","labor_cost","service_cost","total_cost","final_cost",
  "parts_cost","estimated_cost","discount","initial_payment","payment_status",
  "mode_of_transfer","remarks","ai_toggle","pre_order","part_id",
  "drive_folder_url","device_report_folder_url","username",
  "waiting_for_parts","is_backjob","rush_fee","vat_requested","rto_reason",
  "approval_locked","approved_services","pending_services",
  "client_approved_at","auto_approve_diagnosis",
].join(",");

/**
 * Completed tickets older than this are no longer part of day-to-day work; they
 * stay reachable through Completed Services, the CSV export and Reports, each of
 * which runs its own date-scoped query. Keeping them out of the shared list stops
 * the backlog from being re-downloaded by every session, every day.
 */
const COMPLETED_WINDOW_DAYS = 60;

/**
 * Single authoritative fetch for every active ticket (plus recently completed
 * ones). All tracker / dashboard views are derived from this one cache entry so a
 * view can never render a partial list because a second request failed
 * independently.
 */
const fetchServiceRows = async (): Promise<ServiceRecord[]> => {
  const since = new Date(Date.now() - COMPLETED_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [active, recentDone] = await Promise.all([
    supabase
      .from("services")
      .select(LIST_COLUMNS)
      .neq("status", "Completed")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("services")
      .select(LIST_COLUMNS)
      .eq("status", "Completed")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);
  if (active.error) throw active.error;
  if (recentDone.error) throw recentDone.error;
  const rows = [...(active.data ?? []), ...(recentDone.data ?? [])];
  rows.sort((a: any, b: any) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  return rows.map(mapServiceRow);
};

const useServiceRows = <T,>(select: (rows: ServiceRecord[]) => T) =>
  useQuery({
    queryKey: ["services"],
    queryFn: fetchServiceRows,
    // Realtime invalidation keeps this fresh; the long stale window stops
    // every mount/navigation from re-downloading the list.
    staleTime: 60 * 1000,
    gcTime: 15 * 60 * 1000,
    select,
  });


const isCompleted = (s: ServiceRecord) =>
  (s.status || "").trim().toLowerCase().includes("completed");

/** Tickets still in the workflow (everything that is not Completed). */
export const useServices = () =>
  useServiceRows((rows) => rows.filter((r) => !isCompleted(r)));

export const useCompletedServices = () =>
  useServiceRows((rows) => rows.filter(isCompleted));

/** Active + completed services combined (used by the Service Tracker tabs). */
export const useAllServices = () => useServiceRows((rows) => rows);


export const useInvalidateServices = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["services"] });
};

