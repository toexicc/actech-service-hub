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

const fetchFastMovingParts = async (): Promise<FastMovingPart[]> => {
  const { data, error } = await supabase
    .from("fast_moving_parts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    partId: r.part_id ?? "",
    requestedBy: "",
    serviceId: "",
    partName: r.part_name ?? "",
    deviceType: r.category ?? "",
    brand: r.brand ?? "",
    model: r.device_model ?? "",
    partType: "",
    quantity: String(r.quantity ?? 0),
    dateNeeded: "",
    dateOrdered: "",
    dateReceived: "",
    supplier: "",
    cost: String(r.cost_price ?? 0),
    status: r.status ?? "In Stock",
    lastUpdated: r.updated_at ?? "",
    remarks: r.notes ?? "",
  }));
};

export const useFastMovingParts = (enabled: boolean = true) => useQuery({
  queryKey: ["fastMovingParts"],
  queryFn: fetchFastMovingParts,
  enabled,
  staleTime: 60 * 1000,
  gcTime: 5 * 60 * 1000,
});

export const useInvalidateFastMovingParts = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["fastMovingParts"] });
};
