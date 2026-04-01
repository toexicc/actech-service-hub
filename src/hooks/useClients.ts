import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";

export interface ClientRecord {
  clientId: string;
  clientName: string;
  username: string;
  contactNumber: string;
  email: string;
  serviceId: string;
}

interface ClientInquiry {
  inquiryId: string;
  clientName: string;
  contactNumber: string;
  email: string;
  deviceType: string;
  deviceBrand: string;
  deviceModel: string;
  issueDescription: string;
  status: string;
  assignedTo: string;
  dateSubmitted: string;
  lastUpdated: string;
  remarks: string;
}

const fetchClients = async (): Promise<ClientRecord[]> => {
  const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getClients`);
  const data = await response.json();
  if (data.status === "success" && data.clients) {
    return data.clients;
  }
  throw new Error("Failed to load clients");
};

const fetchClientInquiries = async (): Promise<ClientInquiry[]> => {
  const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getClientInquiries`);
  const data = await response.json();
  if (data.status === "success" && data.inquiries) {
    return data.inquiries;
  }
  throw new Error("Failed to load inquiries");
};

export const useClients = () => {
  return useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useClientInquiries = () => {
  return useQuery({
    queryKey: ["clientInquiries"],
    queryFn: fetchClientInquiries,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

export const useInvalidateClients = () => {
  const queryClient = useQueryClient();
  return {
    invalidateClients: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
    invalidateInquiries: () => queryClient.invalidateQueries({ queryKey: ["clientInquiries"] }),
  };
};
