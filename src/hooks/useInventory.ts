import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";

interface InventoryItem {
  partId: string;
  partName: string;
  deviceType: string;
  brand: string;
  model: string;
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
  const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getInventoryFull`);
  const data = await response.json();
  if (data.status === "success" && data.inventory) {
    return data.inventory;
  }
  throw new Error("Failed to load inventory");
};

const fetchInventoryLogs = async (): Promise<InventoryLog[]> => {
  const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getInventoryLogs`);
  const data = await response.json();
  if (data.status === "success" && data.logs) {
    return data.logs;
  }
  throw new Error("Failed to load inventory logs");
};

export const useInventory = () => {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: fetchInventory,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useInventoryLogs = () => {
  return useQuery({
    queryKey: ["inventoryLogs"],
    queryFn: fetchInventoryLogs,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

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
