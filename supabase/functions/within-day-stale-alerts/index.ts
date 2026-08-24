// Alerts assigned admins + technicians when a "Within the Day" ticket has had
// no movement for 3 hours. Re-alerts every 3 hours while the ticket stays idle.
// Driven by pg_cron (every 30 minutes).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLOSED = new Set([
  "completed",
  "cancelled",
  "on hold",
  "rto",
  "rto - actech",
  "rto - client",
]);

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const now = Date.now();
    const cutoff = new Date(now - THREE_HOURS_MS).toISOString();

    const { data: services, error } = await supabase
      .from("services")
      .select("service_id, client_name, status, priority, technicians, admin_reps, last_updated")
      .eq("priority", "Within the Day")
      .lt("last_updated", cutoff);
    if (error) throw new Error(error.message);

    const stale = (services ?? []).filter((s: any) => !CLOSED.has(norm(s.status)));
    if (stale.length === 0) return json({ ok: true, checked: 0, alerts: 0 });

    // Staff directory to map assignment names -> auth user ids.
    const { data: profiles } = await supabase.from("profiles").select("id, name, username");
    const idByName = new Map<string, string>();
    (profiles ?? []).forEach((p: any) => {
      if (p.name) idByName.set(norm(p.name), p.id);
      if (p.username) idByName.set(norm(p.username), p.id);
      if (p.username) idByName.set(norm(String(p.username).split("@")[0]), p.id);
    });

    const ids = stale.map((s: any) => s.service_id);
    // Existing stale alerts, used to keep the cadence at one per 3-hour window.
    const { data: recent } = await supabase
      .from("notifications")
      .select("service_id, created_at, title")
      .in("service_id", ids)
      .eq("title", "Within the Day ticket idle")
      .gte("created_at", cutoff);
    const alertedRecently = new Set((recent ?? []).map((n: any) => String(n.service_id)));

    const rows: any[] = [];
    let alerted = 0;

    stale.forEach((s: any) => {
      if (alertedRecently.has(String(s.service_id))) return;
      const hours = Math.floor((now - new Date(s.last_updated).getTime()) / (60 * 60 * 1000));
      const names: string[] = [
        ...(Array.isArray(s.technicians) ? s.technicians : []),
        ...(Array.isArray(s.admin_reps) ? s.admin_reps : []),
      ].filter(Boolean);

      const recipients = Array.from(
        new Set(names.map((n) => idByName.get(norm(n))).filter(Boolean) as string[]),
      );
      if (recipients.length === 0) return;

      alerted += 1;
      recipients.forEach((uid) => {
        rows.push({
          recipient_id: uid,
          category: "services",
          title: "Within the Day ticket idle",
          message: `${s.service_id} (${s.client_name}) is a Within the Day ticket with no movement for ${hours} hour${hours === 1 ? "" : "s"}. Current status: ${s.status}.`,
          service_id: s.service_id,
          link: `/manage-client?serviceId=${s.service_id}`,
          is_read: false,
        });
      });
    });

    if (rows.length > 0) {
      const { error: insertErr } = await supabase.from("notifications").insert(rows);
      if (insertErr) throw new Error(insertErr.message);
    }

    return json({ ok: true, checked: stale.length, alerts: alerted, notifications: rows.length });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
