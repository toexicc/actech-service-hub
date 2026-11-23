import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { deriveStockStatus } from "@/lib/stockStatus";

export interface InventoryItem {
  partId: string;
  partName: string;
  deviceType: string;
  brand: string;
  model: string;
  partType?: string;
  color?: string;
  quantity: number;
  reorderLevel: number;
  dateOrdered?: string;
  supplier?: string;
  costPerUnit?: string;
  sellingPrice?: number;
  /** Worked out from quantity and re-order level (see lib/stockStatus). */
  status: string;
  /** The status column as saved; only "On Order" / "For Ordering" matter now. */
  storedStatus: string;
  lastUpdated: string;
  remarks: string;
  qrCode?: string;
}

// The API returns at most 1,000 rows per request, so read in pages until a short page comes back.
// A second sort key keeps the paging stable when many rows share one created_at (bulk imports).
const PAGE_SIZE = 1000;
const fetchAllRows = async (table: "inventory_parts" | "fast_moving_parts", columns: string): Promise<any[]> => {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select(columns)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
};

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
  const data = await fetchAllRows(
    "inventory_parts",
    "id, part_id, part_name, category, brand, device_model, part_type, color, quantity, reorder_level, date_ordered, supplier, cost_price, selling_price, status, notes, updated_at, created_at",
  );
  return data.map((r: any) => {
    const quantity = Number(r.quantity ?? 0);
    const reorderLevel = Number(r.reorder_level ?? 0);
    const storedStatus = r.status ?? "In Stock";
    return {
      partId: r.part_id ?? "",
      partName: r.part_name ?? "",
      deviceType: r.category ?? "",
      brand: r.brand ?? "",
      model: r.device_model ?? "",
      partType: r.part_type ?? "",
      color: r.color ?? "",
      quantity,
      reorderLevel,
      dateOrdered: r.date_ordered ?? "",
      supplier: r.supplier ?? "",
      costPerUnit: String(r.cost_price ?? 0),
      sellingPrice: Number(r.selling_price ?? 0),
      status: deriveStockStatus(quantity, reorderLevel, storedStatus),
      storedStatus,
      lastUpdated: r.updated_at ?? "",
      remarks: r.notes ?? "",
      qrCode: r.part_id ?? "",
    };
  });
};

const fetchInventoryLogs = async (): Promise<InventoryLog[]> => {
  const [{ data, error }, parts, fastParts] = await Promise.all([
    supabase
      .from("part_logs")
      .select("id, part_id, action, quantity, notes, performed_by_name, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    // Name lookups only: a failure here should not hide the logs themselves.
    fetchAllRows("inventory_parts", "id, part_id, part_name, category, created_at").catch(() => []),
    fetchAllRows("fast_moving_parts", "id, part_id, part_name, category, created_at").catch(() => []),
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
      // Stock changes write movements by database trigger, so Movements and the overview refresh too.
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    },
  };
};
