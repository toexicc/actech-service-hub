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
  status: string;
  technician: string;
  technicianAssigned: string;
  dateReceived: string;
  targetDate: string;
  estimatedCompletion: string;
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
}

export const mapServiceRow = (r: any): ServiceRecord => ({
  serviceId: r.service_id ?? "",
  clientId: r.client_id ?? "",
  clientName: r.client_name ?? "",
  contactNumber: r.contact_number ?? "",
  email: r.email ?? "",
  address: r.address ?? "",
  deviceType: r.device_type ?? "",
  deviceBrand: r.brand ?? "",
  deviceModel: r.model ?? "",
  serialNumber: r.serial_number ?? "",
  issueDescription: r.issue_description ?? "",
  diagnosis: r.diagnosis ?? "",
  status: r.status ?? "",
  technician: Array.isArray(r.technicians) ? r.technicians.join(", ") : (r.technicians ?? ""),
  technicianAssigned: Array.isArray(r.technicians) ? r.technicians.join(", ") : "",
  dateReceived: r.date_received ?? "",
  targetDate: r.target_date ?? "",
  estimatedCompletion: r.estimated_completion ?? "",
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
});

const fetchAllServices = async (): Promise<ServiceRecord[]> => {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .neq("status", "Done")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map(mapServiceRow);
};

export const useServices = () => {
  return useQuery({
    queryKey: ["services"],
    queryFn: fetchAllServices,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

export const useInvalidateServices = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["services"] });
};
