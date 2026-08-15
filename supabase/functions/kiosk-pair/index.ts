// Kiosk device pairing for the /attendance kiosk.
// Management-only. Pairs the CALLING device (returns a one-time secret key that the
// device stores locally) and records the caller's public IP as the allowed shop IP.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const callerIp = (req: Request) => {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const first = fwd.split(",")[0]?.trim();
  return first || req.headers.get("cf-connecting-ip") || "";
};

async function sha256(v: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ error: "unauthorized" }, 401);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isManagement = (roles ?? []).some((r: any) => r.role === "management");
    if (!isManagement) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const ip = callerIp(req);

    if (action === "whoami") {
      return json({ ip });
    }

    if (action === "list") {
      const { data, error } = await admin
        .from("kiosk_devices")
        .select("id, label, purpose, allowed_ip, is_active, last_seen_at, last_seen_ip, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ devices: data ?? [], ip });
    }

    if (action === "pair") {
      const label = String(body?.label ?? "").trim();
      if (!label || label.length > 80) return json({ error: "invalid_label" }, 400);
      const allowedIp = String(body?.allowed_ip ?? ip).trim();
      if (!allowedIp) return json({ error: "no_ip_detected" }, 400);

      const secret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const { data, error } = await admin
        .from("kiosk_devices")
        .insert({
          label,
          purpose: "attendance",
          token_hash: await sha256(secret),
          allowed_ip: allowedIp,
          created_by: user.id,
        })
        .select("id, label, allowed_ip, is_active")
        .maybeSingle();
      if (error) throw error;
      // The secret is returned exactly once; only its hash is stored.
      return json({ device: data, secret, ip });
    }

    if (action === "set_active") {
      const id = String(body?.id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid_id" }, 400);
      const { error } = await admin
        .from("kiosk_devices")
        .update({ is_active: !!body?.is_active })
        .eq("id", id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "set_ip") {
      const id = String(body?.id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid_id" }, 400);
      const nextIp = String(body?.allowed_ip ?? ip).trim();
      if (!nextIp) return json({ error: "no_ip_detected" }, 400);
      const { error } = await admin
        .from("kiosk_devices")
        .update({ allowed_ip: nextIp })
        .eq("id", id);
      if (error) throw error;
      return json({ success: true, allowed_ip: nextIp });
    }

    if (action === "delete") {
      const id = String(body?.id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid_id" }, 400);
      const { error } = await admin.from("kiosk_devices").delete().eq("id", id);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "invalid_action" }, 400);
  } catch (err) {
    return json({ error: "server_error", message: String((err as any)?.message || err) }, 500);
  }
});
