import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const isRefundType = (t: string) => /refund/i.test(t || "");
const isPaymentType = (t: string) =>
  /payment|deposit|down\s*payment|balance|installment/i.test(t || "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const serviceId = String(body?.serviceId ?? "").trim();
    // Service IDs look like AC + 11 digits
    if (!/^[A-Za-z0-9-]{4,32}$/.test(serviceId)) {
      return new Response(JSON.stringify({ error: "Invalid serviceId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await admin
      .from("transactions")
      .select("id, transaction_id, type, amount, payment_method, transaction_date, created_at")
      .eq("service_id", serviceId)
      .order("transaction_date", { ascending: true });

    if (error) throw error;

    const payments = (data ?? [])
      .filter((r: any) => isPaymentType(r.type) || isRefundType(r.type))
      .map((r: any) => ({
        id: r.id,
        transactionId: r.transaction_id ?? "",
        type: r.type ?? "",
        amount: Number(r.amount ?? 0),
        paymentMethod: r.payment_method ?? "",
        date: r.transaction_date ?? r.created_at ?? "",
      }));

    const transactionsPaid = payments.reduce(
      (sum: number, p: any) => sum + (isRefundType(p.type) ? -p.amount : p.amount),
      0,
    );

    return new Response(JSON.stringify({ transactionsPaid, payments }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
