import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ServicePaymentsSummary {
  /** Sum of recorded payment transactions (refunds subtracted). */
  transactionsPaid: number;
  /** Individual payment rows for display. */
  payments: {
    id: string;
    transactionId: string;
    type: string;
    amount: number;
    paymentMethod: string;
    date: string;
  }[];
}

export const isRefundType = (type: string) => /refund/i.test(type || "");
export const isPaymentType = (type: string) =>
  /payment|deposit|down\s*payment|balance|installment/i.test(type || "");

export const summarizePayments = (rows: any[]): ServicePaymentsSummary => {
  const payments = (rows ?? [])
    .filter((r) => isPaymentType(r.type) || isRefundType(r.type))
    .map((r) => ({
      id: r.id,
      transactionId: r.transaction_id ?? "",
      type: r.type ?? "",
      amount: Number(r.amount ?? 0),
      paymentMethod: r.payment_method ?? "",
      date: r.transaction_date ?? r.created_at ?? "",
    }));

  const transactionsPaid = payments.reduce(
    (sum, p) => sum + (isRefundType(p.type) ? -p.amount : p.amount),
    0,
  );

  return { transactionsPaid, payments };
};

/**
 * Actual money received for a service, from the POS transactions ledger.
 * Authenticated (staff) contexts read the table directly.
 */
export const useServicePayments = (serviceId: string | undefined) =>
  useQuery({
    queryKey: ["servicePayments", serviceId],
    queryFn: async (): Promise<ServicePaymentsSummary> => {
      if (!serviceId) return { transactionsPaid: 0, payments: [] };
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("service_id", serviceId)
        .order("transaction_date", { ascending: true });
      if (error) return { transactionsPaid: 0, payments: [] };
      return summarizePayments(data ?? []);
    },
    enabled: !!serviceId,
    staleTime: 30 * 1000,
  });

/**
 * Public (anonymous) variant used by the /track page. Reads through an edge
 * function backed by the service role so no anon table access is needed.
 */
export const usePublicServicePayments = (serviceId: string | undefined) =>
  useQuery({
    queryKey: ["publicServicePayments", serviceId],
    queryFn: async (): Promise<ServicePaymentsSummary> => {
      if (!serviceId) return { transactionsPaid: 0, payments: [] };
      const { data, error } = await supabase.functions.invoke("get-service-payments", {
        body: { serviceId },
      });
      if (error || !data) return { transactionsPaid: 0, payments: [] };
      return {
        transactionsPaid: Number((data as any).transactionsPaid ?? 0),
        payments: ((data as any).payments ?? []) as ServicePaymentsSummary["payments"],
      };
    },
    enabled: !!serviceId,
    staleTime: 30 * 1000,
  });

export interface PaymentTotals {
  total: number;
  paid: number;
  balance: number;
}

/** Shared derivation so /track, /manage-client and /service-update agree. */
export const derivePaymentTotals = (
  finalCost: number,
  initialPayment: number,
  transactionsPaid: number,
): PaymentTotals => {
  const total = Number(finalCost) || 0;
  const paid = Math.max(0, (Number(initialPayment) || 0) + (Number(transactionsPaid) || 0));
  return {
    total,
    paid,
    balance: Math.max(0, total - paid),
  };
};
