import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, addDays } from "date-fns";

export interface PickupEntry {
  id: string;
  schedule_date: string;
  kind: string;
  client_name: string;
  service_id: string | null;
  contact_number: string | null;
  city: string | null;
  address: string | null;
  time_window: string | null;
  notes: string | null;
  status: string;
  reschedule_reason: string | null;
  rescheduled_from: string | null;
  completed_at: string | null;
  created_by_name: string | null;
  cost: number | null;
}

export const usePickupSchedules = (month: Date) => {
  const from = format(addDays(startOfMonth(month), -7), "yyyy-MM-dd");
  const to = format(addDays(endOfMonth(month), 7), "yyyy-MM-dd");
  const qc = useQueryClient();
  const key = ["pickup_schedules", from, to];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickup_schedules")
        .select("*")
        .gte("schedule_date", from)
        .lte("schedule_date", to)
        .order("schedule_date")
        .order("time_window");
      if (error) throw error;
      return (data || []) as PickupEntry[];
    },
    staleTime: 30_000,
  });
  return { ...q, refresh: () => qc.invalidateQueries({ queryKey: ["pickup_schedules"] }) };
};

export const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary",
  rescheduled: "bg-accent text-accent-foreground",
  done: "bg-secondary text-secondary-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
};
