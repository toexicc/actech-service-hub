import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  const { data, error } = await supabase
    .from("closed_dates")
    .select("*")
    .order("closed_date", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((r: any, idx: number) => ({
    rowIndex: idx,
    id: r.id,
    startDate: r.closed_date ?? "",
    endDate: r.closed_date ?? "",
    type: "Holiday",
    customType: "",
    description: r.reason ?? "",
    createdBy: r.created_by ?? "",
    createdAt: r.created_at ?? "",
    lastUpdated: r.created_at ?? "",
  }));
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
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ["closedDates"] });
  };
}
