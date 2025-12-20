import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";

interface ServiceRecord {
  serviceId: string;
  clientId: string;
  clientName: string;
  contactNumber: string;
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
}

const fetchAllServices = async (): Promise<ServiceRecord[]> => {
  const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getAllOngoingServices`);
  const data = await response.json();
  if (data.status === "success" && data.services) {
    return data.services;
  }
  throw new Error("Failed to load services");
};

export const useServices = () => {
  return useQuery({
    queryKey: ["services"],
    queryFn: fetchAllServices,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000,
  });
};

export const useInvalidateServices = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["services"] });
};
