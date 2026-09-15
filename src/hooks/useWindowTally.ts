import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { buildMoneyReconciliation, type ReconTicket, type ReconTx } from "@/lib/moneyReconciliation";

const manilaStart = (d: Date) => `${format(d, "yyyy-MM-dd")}T00:00:00+08:00`;
const manilaEnd = (d: Date) => `${format(d, "yyyy-MM-dd")}T23:59:59+08:00`;

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * The figures behind the shared tally line: tickets completed inside the
 * window, what that work was worth, and what was actually collected on it.
 * One query key so all pages showing the same window share one fetch.
 */
export const useWindowTally = (start?: Date, end?: Date) => {
  const enabled = !!start && !!end;
  const fromIso = start ? manilaStart(start) : "";
  const toIso = end ? manilaEnd(end) : "";

  return useQuery({
    queryKey: ["windowTally", fromIso, toIso],
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data: svc, error: svcErr } = await supabase
        .from("services")
        .select("service_id,service_cost,discount,parts_cost")
        .eq("status", "Completed")
        .gte("date_completed", fromIso)
        .lte("date_completed", toIso)
        .limit(2000);
      if (svcErr) throw svcErr;

      const tickets: ReconTicket[] = (svc ?? []).map((r: any) => ({
        serviceId: r.service_id ?? "",
        quotedPrice: Number(r.service_cost ?? 0),
        discount: Number(r.discount ?? 0),
        partsCost: Number(r.parts_cost ?? 0),
      }));

      const { data: txWin, error: txErr } = await supabase
        .from("transactions")
        .select("service_id,type,status,amount")
        .gte("transaction_date", fromIso)
        .lte("transaction_date", toIso)
        .limit(5000);
      if (txErr) throw txErr;
      const windowTx: ReconTx[] = (txWin ?? []).map((r: any) => ({
        serviceId: r.service_id ?? "",
        type: r.type ?? "",
        status: r.status ?? "",
        amount: Number(r.amount ?? 0),
      }));

      const ids = tickets.map((t) => t.serviceId).filter(Boolean);
      const ticketTx: ReconTx[] = [];
      for (const group of chunk(ids, 200)) {
        const { data: rows, error } = await supabase
          .from("transactions")
          .select("service_id,type,status,amount")
          .in("service_id", group)
          .limit(5000);
        if (error) throw error;
        (rows ?? []).forEach((r: any) =>
          ticketTx.push({
            serviceId: r.service_id ?? "",
            type: r.type ?? "",
            status: r.status ?? "",
            amount: Number(r.amount ?? 0),
          }),
        );
      }

      return buildMoneyReconciliation(tickets, windowTx, ticketTx);
    },
  });
};
