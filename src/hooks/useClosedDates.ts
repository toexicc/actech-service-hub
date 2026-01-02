import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";

export interface ClosedDate {
  rowIndex: number;
  id: string;
  startDate: string;
  endDate: string;
  type: "Emergency" | "Holiday" | "Operations" | "Others";
  customType: string;
  description: string;
  createdBy: string;
  createdAt: string;
  lastUpdated: string;
}

async function fetchClosedDates(): Promise<ClosedDate[]> {
  const url = `${GOOGLE_SHEETS_SCRIPT_URL}?action=getClosedDates`;
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status === "success") {
    return data.data || [];
  }
  
  throw new Error(data.message || "Failed to fetch closed dates");
}

export function useClosedDates() {
  return useQuery({
    queryKey: ["closedDates"],
    queryFn: fetchClosedDates,
    staleTime: 5 * 60 * 1000,
  });
}

export function useInvalidateClosedDates() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["closedDates"] });
}
