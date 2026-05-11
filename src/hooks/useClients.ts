import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientRecord {
  clientId: string;
  clientName: string;
  username: string;
  contactNumber: string;
  email: string;
  serviceId: string;
  address?: string;
}

export interface ClientInquiry {
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
  const [{ data, error }, { data: svcs }] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("services")
      .select("client_id, service_id, created_at")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);
  if (error) throw error;
  const svcMap = new Map<string, string[]>();
  for (const s of svcs ?? []) {
    if (!s.client_id || !s.service_id) continue;
    const arr = svcMap.get(s.client_id) ?? [];
    arr.push(s.service_id);
    svcMap.set(s.client_id, arr);
  }
  return (data ?? []).map((r: any) => ({
    clientId: r.client_id ?? "",
    clientName: r.name ?? "",
    username: r.name ?? "",
    contactNumber: r.contact_number ?? "",
    email: r.email ?? "",
    serviceId: (svcMap.get(r.client_id) ?? []).join(", "),
    address: r.address ?? "",
  }));
};

const fetchClientInquiries = async (): Promise<ClientInquiry[]> => {
  const { data, error } = await supabase
    .from("client_inquiries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    inquiryId: r.inquiry_id ?? "",
    clientName: r.client_name ?? "",
    contactNumber: r.contact_number ?? "",
    email: r.email ?? "",
    deviceType: r.device_type ?? "",
    deviceBrand: r.brand ?? "",
    deviceModel: r.model ?? "",
    issueDescription: r.issue_description ?? "",
    status: r.status ?? "",
    assignedTo: "",
    dateSubmitted: r.created_at ?? "",
    lastUpdated: r.updated_at ?? "",
    remarks: r.notes ?? "",
  }));
};

export const useClients = () => useQuery({
  queryKey: ["clients"],
  queryFn: fetchClients,
  staleTime: 2 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  refetchOnMount: "always",
});

export const useClientInquiries = () => useQuery({
  queryKey: ["clientInquiries"],
  queryFn: fetchClientInquiries,
  staleTime: 60 * 1000,
  gcTime: 5 * 60 * 1000,
  refetchOnMount: "always",
});

export const useInvalidateClients = () => {
  const queryClient = useQueryClient();
  return {
    invalidateClients: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
    invalidateInquiries: () => queryClient.invalidateQueries({ queryKey: ["clientInquiries"] }),
  };
};
