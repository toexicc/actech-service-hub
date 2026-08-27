import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface InventoryItem {
  partId: string;
  partName: string;
  deviceType: string;
  brand: string;
  model: string;
  partType?: string;
  color?: string;
  quantity: number;
  dateOrdered?: string;
  supplier?: string;
  costPerUnit?: string;
  status: string;
  lastUpdated: string;
  remarks: string;
  qrCode?: string;
}

interface InventoryLog {
  logId: string;
  partId: string;
  partName: string;
  deviceType: string;
  transactionType: string;
  quantityChanged: string;
  previousQuantity: string;
  newQuantity: string;
  dateTime: string;
  remarks: string;
  username: string;
  role: string;
}

const fetchInventory = async (): Promise<InventoryItem[]> => {
  const { data, error } = await supabase
    .from("inventory_parts")
    .select("part_id, part_name, category, brand, device_model, part_type, color, quantity, date_ordered, supplier, cost_price, status, notes, updated_at, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    partId: r.part_id ?? "",
    partName: r.part_name ?? "",
    deviceType: r.category ?? "",
    brand: r.brand ?? "",
    model: r.device_model ?? "",
    partType: r.part_type ?? "",
    color: r.color ?? "",
    quantity: Number(r.quantity ?? 0),
    dateOrdered: r.date_ordered ?? "",
    supplier: r.supplier ?? "",
    costPerUnit: String(r.cost_price ?? 0),
    status: r.status ?? "In Stock",
    lastUpdated: r.updated_at ?? "",
    remarks: r.notes ?? "",
    qrCode: r.part_id ?? "",
  }));
};

const fetchInventoryLogs = async (): Promise<InventoryLog[]> => {
  const [{ data, error }, { data: parts }, { data: fastParts }] = await Promise.all([
    supabase
      .from("part_logs")
      .select("id, part_id, action, quantity, notes, performed_by_name, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("inventory_parts").select("part_id,part_name,category").limit(2000),
    supabase.from("fast_moving_parts").select("part_id,part_name,category").limit(2000),
  ]);
  if (error) throw error;

  const lookup = new Map<string, { name: string; type: string }>();
  [...(parts ?? []), ...(fastParts ?? [])].forEach((p: any) => {
    lookup.set(p.part_id, { name: p.part_name ?? "", type: p.category ?? "" });
  });

  return (data ?? []).map((r: any) => {
    const meta = lookup.get(r.part_id ?? "");
    return {
      logId: r.id,
      partId: r.part_id ?? "",
      partName: meta?.name ?? "",
      deviceType: meta?.type ?? "",
      transactionType: r.action ?? "",
      quantityChanged: String(r.quantity ?? 0),
      previousQuantity: "",
      newQuantity: "",
      dateTime: r.created_at ?? "",
      remarks: r.notes ?? "",
      username: r.performed_by_name ?? "",
      role: "",
    };
  });
};

export const useInventory = (enabled: boolean = true) => useQuery({
  queryKey: ["inventory"],
  queryFn: fetchInventory,
  enabled,
  staleTime: 2 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
});

export const useInventoryLogs = () => useQuery({
  queryKey: ["inventoryLogs"],
  queryFn: fetchInventoryLogs,
  staleTime: 2 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
});

export const useInvalidateInventory = () => {
  const queryClient = useQueryClient();
  return {
    invalidateInventory: () => queryClient.invalidateQueries({ queryKey: ["inventory"] }),
    invalidateLogs: () => queryClient.invalidateQueries({ queryKey: ["inventoryLogs"] }),
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventoryLogs"] });
    },
  };
};
