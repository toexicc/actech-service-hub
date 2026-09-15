import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildMoneyReconciliation,
  type ReconTicket,
  type ReconTx,
} from "@/lib/moneyReconciliation";

const peso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Manila start/end-of-day ISO bounds for a calendar day. */
const manilaStart = (d: Date) => `${format(d, "yyyy-MM-dd")}T00:00:00+08:00`;
const manilaEnd = (d: Date) => `${format(d, "yyyy-MM-dd")}T23:59:59+08:00`;

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

interface Props {
  start?: Date;
  end?: Date;
  /** Extra note rendered under the walk. */
  note?: string;
}

/**
 * The bridge between quoted ticket value (Completed Services), cash collected
 * (Transaction Tracker) and the period figures on Reports.
 */
export const MoneyReconciliationPanel = ({ start, end, note }: Props) => {
  const enabled = !!start && !!end;
  const fromIso = start ? manilaStart(start) : "";
  const toIso = end ? manilaEnd(end) : "";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["moneyReconciliation", fromIso, toIso],
    enabled,
    staleTime: 2 * 60 * 1000,
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

  const rows = useMemo(() => {
    if (!data) return [];
    return [
      { label: `Quoted value of ${data.ticketCount} tickets completed in window`, value: data.quoted },
      { label: "less discounts", value: -data.discounts },
      { label: "= billable value of completed work", value: data.billable, strong: true },
      { label: "less balance still unpaid on those tickets", value: -data.unpaid },
      { label: "payments in window for tickets completed earlier / elsewhere", value: data.cashFromOtherTickets },
      { label: "= cash collected in window (Transaction Tracker sales)", value: data.cashCollected, strong: true },
      { label: "less refunds", value: -data.refunds },
      { label: "less parts consumed on completed tickets", value: -data.partsConsumed },
      { label: "less other expenses paid in window", value: -data.otherExpenses },
      { label: "= operating profit", value: data.operatingProfit, strong: true },
    ];
  }, [data]);

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-4 w-4" /> Reconciliation — how these pages tie together
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!enabled ? (
          <p className="text-sm text-muted-foreground">
            Pick a start and end date above to see the walk from quoted ticket value to cash collected.
          </p>
        ) : isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Building the reconciliation…
          </p>
        ) : isError || !data ? (
          <p className="text-sm text-destructive">Couldn't build the reconciliation for this range.</p>
        ) : (
          <>
            <div className="divide-y divide-border/60">
              {rows.map((r) => (
                <div key={r.label} className="flex min-w-0 items-center justify-between gap-4 py-2">
                  <span
                    className={`min-w-0 break-words text-sm ${r.strong ? "font-semibold" : "text-muted-foreground"}`}
                  >
                    {r.label}
                  </span>
                  <span
                    className={`shrink-0 tabular-nums text-sm ${r.strong ? "font-bold" : ""} ${
                      r.value < 0 ? "text-red-600" : ""
                    }`}
                  >
                    {peso(r.value)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Parts purchased in this window (Parts Inventory spend) was {peso(data.partsPurchased)} — that is stock
              bought, which is different from the {peso(data.partsConsumed)} of parts actually used on completed
              tickets. {note ?? ""}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MoneyReconciliationPanel;
