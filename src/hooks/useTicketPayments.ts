import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isRefundTx, isSalesTx, type ReconTx } from "@/lib/moneyReconciliation";

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * Payments actually received per ticket, in one bulk query for the whole
 * visible list (never per row). Refunds are subtracted.
 */
export const useTicketPayments = (serviceIds: string[]) => {
  const ids = Array.from(new Set(serviceIds.filter(Boolean))).sort();
  return useQuery({
    queryKey: ["ticketPayments", ids],
    enabled: ids.length > 0,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const totals: Record<string, number> = {};
      for (const group of chunk(ids, 200)) {
        const { data, error } = await supabase
          .from("transactions")
          .select("service_id,type,status,amount")
          .in("service_id", group)
          .limit(5000);
        if (error) throw error;
        (data ?? []).forEach((r: any) => {
          const tx: ReconTx = {
            serviceId: r.service_id ?? "",
            type: r.type ?? "",
            status: r.status ?? "",
            amount: Number(r.amount ?? 0),
          };
          if (!tx.serviceId) return;
          if (isSalesTx(tx)) totals[tx.serviceId] = (totals[tx.serviceId] ?? 0) + tx.amount;
          else if (isRefundTx(tx)) totals[tx.serviceId] = (totals[tx.serviceId] ?? 0) - tx.amount;
        });
      }
      return totals;
    },
  });
};
