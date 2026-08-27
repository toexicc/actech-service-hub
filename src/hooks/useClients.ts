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
      .select("client_id, name, username, contact_number, email, address, created_at")
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
    username: r.username ?? "",
    contactNumber: r.contact_number ?? "",
    email: r.email ?? "",
    serviceId: (svcMap.get(r.client_id) ?? []).join(", "),
    address: r.address ?? "",
  }));
};

const fetchClientInquiries = async (): Promise<ClientInquiry[]> => {
  const { data, error } = await supabase
    .from("client_inquiries")
    .select("inquiry_id, client_name, contact_number, email, device_type, brand, model, issue_description, status, notes, created_at, updated_at")
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

});

export const useClientInquiries = () => useQuery({
  queryKey: ["clientInquiries"],
  queryFn: fetchClientInquiries,
  staleTime: 60 * 1000,
  gcTime: 5 * 60 * 1000,

});

export const useInvalidateClients = () => {
  const queryClient = useQueryClient();
  return {
    invalidateClients: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
    invalidateInquiries: () => queryClient.invalidateQueries({ queryKey: ["clientInquiries"] }),
  };
};

export interface EnsureClientInput {
  clientId?: string | null;
  name: string;
  /** Device/account username captured on the intake form. */
  username?: string | null;
  contactNumber?: string | null;
  email?: string | null;
  address?: string | null;
}

/**
 * Finds an existing customer record (by client ID, then contact number, then
 * name+email) or creates one, returning the client ID to stamp on the service.
 */
export const ensureClient = async (input: EnsureClientInput): Promise<string> => {
  const name = (input.name || "").trim();
  const phone = (input.contactNumber || "").trim();
  const email = (input.email || "").trim();
  const username = (input.username || "").trim();

  // Keeps the username fresh on records created before it was captured.
  const backfill = async (clientId: string, existingUsername?: string | null) => {
    if (username && !(existingUsername || "").trim()) {
      await supabase.from("clients").update({ username }).eq("client_id", clientId);
    }
    return clientId;
  };

  if (input.clientId) {
    const { data } = await supabase
      .from("clients")
      .select("client_id, username")
      .eq("client_id", input.clientId)
      .maybeSingle();
    if (data?.client_id) return backfill(data.client_id, data.username);
  }

  // A shared phone number (family / same household) is NOT enough to reuse a
  // customer profile - the name or email must line up too, otherwise two
  // different people end up merged under one client ID.
  if (phone) {
    const { data } = await supabase
      .from("clients")
      .select("client_id, username, name, email")
      .eq("contact_number", phone)
      .limit(20);
    const norm = (v: any) => String(v ?? "").trim().toLowerCase();
    const match = (data ?? []).find(
      (c: any) =>
        (name && norm(c.name) === norm(name)) ||
        (email && norm(c.email) === norm(email)),
    );
    if (match?.client_id) return backfill(match.client_id, match.username);
  }


  if (!phone && name && email) {
    const { data } = await supabase
      .from("clients")
      .select("client_id, username")
      .eq("name", name)
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (data?.client_id) return backfill(data.client_id, data.username);
  }

  const newId = input.clientId || `CL${Date.now()}`;
  const { error } = await supabase.from("clients").insert({
    client_id: newId,
    name: name || "Unknown",
    username: username || null,
    contact_number: phone || null,
    email: email || null,
    address: input.address || null,
  });
  if (error) throw error;
  return newId;
};

export interface UpdateClientInput {
  clientId: string;
  name: string;
  username?: string | null;
  contactNumber?: string | null;
  email?: string | null;
  address?: string | null;
}

export const updateClient = async (input: UpdateClientInput) => {
  const { error } = await supabase
    .from("clients")
    .update({
      name: input.name,
      username: input.username || null,
      contact_number: input.contactNumber || null,
      email: input.email || null,
      address: input.address || null,
    })
    .eq("client_id", input.clientId);
  if (error) throw error;
};


