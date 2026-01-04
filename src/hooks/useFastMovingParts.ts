import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";

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
  const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getFastMovingParts`);
  const data = await response.json();
  if (data.status === "success" && data.parts) {
    return data.parts;
  }
  throw new Error("Failed to load fast moving parts");
};

export const useFastMovingParts = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ["fastMovingParts"],
    queryFn: fetchFastMovingParts,
    enabled,
    staleTime: 1 * 60 * 1000, // 1 minute - parts change frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useInvalidateFastMovingParts = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["fastMovingParts"] });
};
