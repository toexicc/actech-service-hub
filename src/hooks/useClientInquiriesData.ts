import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";

interface ClientInquiry {
  rowIndex: number;
  clientId: string;
  serviceId: string;
  timestamp: string;
  name: string;
  address: string;
  contactNumber: string;
  modeOfTransfer: string;
  device: string;
  initialDiagnosis: string;
  quotation: string;
  pickUpDate: string;
  directChatLink: string;
  aiStatus?: string;
  preOrder?: string;
  initialPayment?: string;
  partId?: string;
}

const fetchClientInquiriesData = async (): Promise<ClientInquiry[]> => {
  const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getClientInquiries`);
  const result = await response.json();
  if (result.status === "success") {
    return result.data || [];
  }
  throw new Error("Failed to fetch inquiries");
};

export const useClientInquiriesData = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ["clientInquiriesData"],
    queryFn: fetchClientInquiriesData,
    enabled,
    staleTime: 30 * 1000, // 30 seconds - inquiries change frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: enabled ? 30000 : false, // Auto-refresh every 30 seconds
  });
};

export const useInvalidateClientInquiriesData = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["clientInquiriesData"] });
};
