import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface LeaveRecord {
  id: string;
  staffId: string;
  staffName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: string;
  notes: string | null;
}

const normName = (n: string) => String(n ?? "").split(" - ")[0].trim().toLowerCase();

/**
 * Assignment availability for a given day: approved leave is the only
 * attendance-related exclusion. Callers supply the active technician roster;
 * absence or time-in timing must not remove anyone from that roster.
 */
export const useStaffAvailability = (day: Date = new Date()) => {
  const dayKey = format(day, "yyyy-MM-dd");
  return useQuery({
    queryKey: ["staffAvailability", dayKey],
    queryFn: async () => {
      const [{ data: logs }, { data: leaves }] = await Promise.all([
        supabase.from("attendance_logs").select("staff_id, staff_name, time_in").eq("log_date", dayKey),
        supabase
          .from("staff_leaves")
          .select("*")
          .lte("start_date", dayKey)
          .gte("end_date", dayKey)
          .eq("status", "approved"),
      ]);

      const presentNames = new Set<string>();
      const presentIds = new Set<string>();
      (logs ?? []).forEach((l: any) => {
        if (!l.time_in) return;
        presentIds.add(l.staff_id);
        presentNames.add(normName(l.staff_name));
      });

      const onLeaveNames = new Set<string>();
      const onLeaveIds = new Set<string>();
      (leaves ?? []).forEach((l: any) => {
        onLeaveIds.add(l.staff_id);
        onLeaveNames.add(normName(l.staff_name));
      });

      return {
        presentIds,
        presentNames,
        onLeaveIds,
        onLeaveNames,
        leaves: (leaves ?? []).map((l: any) => ({
          id: l.id,
          staffId: l.staff_id,
          staffName: l.staff_name,
          leaveType: l.leave_type,
          startDate: l.start_date,
          endDate: l.end_date,
          status: l.status,
          notes: l.notes,
        })) as LeaveRecord[],
        /** True for a named roster member not on approved leave, even if absent. */
        isAvailable: (name: string) => {
          const n = normName(name);
          if (!n) return false;
          return !onLeaveNames.has(n);
        },
        isOnLeave: (name: string) => onLeaveNames.has(normName(name)),
        hasAttendanceToday: presentNames.size > 0,
      };
    },
    staleTime: 60 * 1000,
  });
};

/** Refresh availability after attendance / leave records change. */
export const useInvalidateAvailability = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["staffAvailability"] });
};

