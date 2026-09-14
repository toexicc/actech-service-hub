import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseManilaDate } from "@/lib/timezone";

export interface DisbursedPeriod {
  staffName: string;
  start: string;
  end: string;
  label: string;
}

/**
 * Cut-offs already paid out. Allocations for tickets inside a paid cut-off are
 * frozen so a later edit cannot silently change a payout that already went out.
 */
export const useDisbursedPeriods = () =>
  useQuery({
    queryKey: ["disbursedPeriods"],
    queryFn: async (): Promise<DisbursedPeriod[]> => {
      const { data } = await supabase
        .from("salary_disbursements")
        .select("staff_name, period_start, period_end, period_label")
        .order("period_end", { ascending: false })
        .limit(500);
      return (data ?? []).map((r: any) => ({
        staffName: r.staff_name ?? "",
        start: r.period_start ?? "",
        end: r.period_end ?? "",
        label: r.period_label ?? "",
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

const dayValue = (iso: string) => {
  const d = parseManilaDate(iso);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/**
 * True when the completion date falls inside a cut-off already disbursed to any
 * of the ticket's technicians.
 */
export const findPaidOutPeriod = (
  periods: DisbursedPeriod[],
  completedAt: string | undefined,
  technicians: string[],
): DisbursedPeriod | null => {
  const day = dayValue(completedAt || "");
  if (!day) return null;
  const techs = technicians.map((t) => (t || "").trim().toLowerCase()).filter(Boolean);
  if (!techs.length) return null;
  return (
    periods.find((p) => {
      if (!techs.includes(p.staffName.trim().toLowerCase())) return false;
      const start = dayValue(p.start);
      const end = dayValue(p.end);
      if (start === null || end === null) return false;
      return day >= start && day <= end;
    }) ?? null
  );
};
