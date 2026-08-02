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
 * Staff availability for a given day: a person counts as available when they
 * have timed in for the day and are not on an approved leave.
 * Used to keep absent / on-leave technicians out of assignment dropdowns.
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
        /** True when the person timed in today and is not on leave. */
        isAvailable: (name: string) => {
          const n = normName(name);
          if (!n) return false;
          return presentNames.has(n) && !onLeaveNames.has(n);
        },
        isOnLeave: (name: string) => onLeaveNames.has(normName(name)),
        hasAttendanceToday: presentNames.size > 0,
      };
    },
    staleTime: 60 * 1000,
  });
};
