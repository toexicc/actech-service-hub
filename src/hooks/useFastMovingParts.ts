import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FastMovingPart {
  partId: string;
  requestedBy: string;
  serviceId: string;
  partName: string;
  deviceType: string;
  brand: string;
  model: string;
  partType?: string;
  quantity: string;
  dateNeeded: string;
  dateOrdered: string;
  dateReceived: string;
  supplier: string;
  cost: string;
  status: string;
  lastUpdated: string;
  remarks: string;
}

const parseNotes = (notes: string) => {
  const out: Record<string, string> = {};
  (notes || "").split("|").forEach((p) => {
    const [k, ...rest] = p.split(":");
    if (k && rest.length) out[k.trim()] = rest.join(":").trim();
  });
  return out;
};

const fetchPartRequests = async (): Promise<FastMovingPart[]> => {
  // Read from part_requests (the canonical Pre-Ordered Parts source)
  const { data, error } = await supabase
    .from("part_requests")
    .select("id, request_id, part_name, brand, device_model, quantity, status, service_id, requested_by_name, notes, updated_at, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((r: any) => {
    const meta = parseNotes(r.notes ?? "");
    return {
      partId: r.request_id ?? r.id ?? "",
      requestedBy: r.requested_by_name ?? "",
      serviceId: r.service_id ?? "",
      partName: r.part_name ?? "",
      deviceType: meta["Device Type"] ?? "",
      brand: r.brand ?? "",
      model: r.device_model ?? "",
      partType: meta["Part Type"] ?? "",
      quantity: String(r.quantity ?? 0),
      dateNeeded: meta["Date Needed"] ?? "",
      dateOrdered: "",
      dateReceived: "",
      supplier: "",
      cost: "",
      status: r.status ?? "For Ordering",
      lastUpdated: r.updated_at ?? "",
      remarks: r.notes ?? "",
    };
  });
};

export const useFastMovingParts = (enabled: boolean = true) => useQuery({
  queryKey: ["fastMovingParts"],
  queryFn: fetchPartRequests,
  enabled,
  staleTime: 60 * 1000,
  gcTime: 5 * 60 * 1000,
});

export const useInvalidateFastMovingParts = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["fastMovingParts"] });
};
