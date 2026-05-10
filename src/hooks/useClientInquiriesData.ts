import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ClientInquiry {
  rowIndex: number;
  id: string;
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
  const { data, error } = await supabase
    .from("client_inquiries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((r: any, idx: number) => ({
    rowIndex: idx,
    id: r.id,
    clientId: "",
    serviceId: r.service_id ?? "",
    timestamp: r.created_at ?? "",
    name: r.client_name ?? "",
    address: "",
    contactNumber: r.contact_number ?? "",
    modeOfTransfer: r.mode_of_transfer ?? "",
    device: [r.device_type, r.brand, r.model].filter(Boolean).join(" "),
    initialDiagnosis: r.issue_description ?? "",
    quotation: "",
    pickUpDate: "",
    directChatLink: "",
    aiStatus: r.ai_toggle ?? "",
    preOrder: r.pre_order ?? "",
    initialPayment: String(r.initial_payment ?? 0),
    partId: r.part_id ?? "",
  }));
};

export const useClientInquiriesData = (enabled: boolean = true) => useQuery({
  queryKey: ["clientInquiriesData"],
  queryFn: fetchClientInquiriesData,
  enabled,
  staleTime: 30 * 1000,
  gcTime: 5 * 60 * 1000,
  refetchInterval: enabled ? 30000 : false,
});

export const useInvalidateClientInquiriesData = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["clientInquiriesData"] });
};
