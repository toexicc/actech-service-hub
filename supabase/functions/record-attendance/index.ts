// Kiosk attendance recording: verifies a staff password and writes a Time In / Time Out row.
// Uses service role for the insert; verifies password via a transient signInWithPassword call
// on a separate client instance so no session is persisted.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Asia/Manila offset in minutes (UTC+8, no DST).
const MANILA_OFFSET_MIN = 8 * 60;

function manilaParts(d: Date) {
  const ms = d.getTime() + MANILA_OFFSET_MIN * 60 * 1000;
  const u = new Date(ms);
  return {
    date: u.toISOString().slice(0, 10),
    hour: u.getUTCHours(),
    minute: u.getUTCMinutes(),
  };
}

function callerIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const first = fwd.split(",")[0]?.trim();
  return first || req.headers.get("cf-connecting-ip") || "";
}

async function sha256(v: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { staffId, password, action } = body ?? {};
    if (!staffId || !password || !["in", "out"].includes(action)) {
      return new Response(JSON.stringify({ error: "invalid_input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const kioskId = req.headers.get("x-kiosk-device") || body?.kioskDeviceId || "";
    const kioskKey = req.headers.get("x-kiosk-key") || body?.kioskKey || "";
    const ip = callerIp(req);

    const gate = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (!kioskId || !kioskKey) {
      return new Response(JSON.stringify({ error: "device_not_paired" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: device } = await gate
      .from("kiosk_devices")
      .select("id, token_hash, allowed_ip, is_active")
      .eq("id", kioskId)
      .maybeSingle();

    if (!device || !device.is_active || device.token_hash !== (await sha256(kioskKey))) {
      return new Response(JSON.stringify({ error: "device_not_allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (device.allowed_ip && device.allowed_ip !== ip) {
      return new Response(JSON.stringify({ error: "network_not_allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await gate
      .from("kiosk_devices")
      .update({ last_seen_at: new Date().toISOString(), last_seen_ip: ip })
      .eq("id", device.id);


    const admin0 = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Resolve the real auth email for this staff via service role.
    const { data: userResp, error: userErr } = await admin0.auth.admin.getUserById(staffId);
    if (userErr || !userResp?.user?.email) {
      return new Response(JSON.stringify({ error: "credential_mismatch" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const email = userResp.user.email;

    // Verify password using a transient client (no persistence).
    const verifier = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signin, error: signinErr } = await verifier.auth
      .signInWithPassword({ email, password });
    if (signinErr || !signin.user) {
      return new Response(JSON.stringify({ error: "invalid_credentials" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (signin.user.id !== staffId) {
      return new Response(JSON.stringify({ error: "credential_mismatch" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Immediately discard the transient session.
    await verifier.auth.signOut();

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Resolve staff name
    const { data: prof } = await admin
      .from("profiles")
      .select("name")
      .eq("id", staffId)
      .maybeSingle();
    const staffName = prof?.name || email;

    const now = new Date();
    const { date, hour, minute } = manilaParts(now);
    const logDate = date;

    // Late if Time In after 10:00 AM Manila; Overtime if Time Out after 7:00 PM Manila.
    const lateNow = action === "in" && (hour > 10 || (hour === 10 && minute > 0));
    const overtimeNow = action === "out" && (hour > 19 || (hour === 19 && minute > 0));

    // Upsert: one row per staff per day.
    const { data: existing } = await admin
      .from("attendance_logs")
      .select("*")
      .eq("staff_id", staffId)
      .eq("log_date", logDate)
      .maybeSingle();

    let result;
    if (!existing) {
      const insertRow: any = {
        staff_id: staffId,
        staff_name: staffName,
        log_date: logDate,
      };
      if (action === "in") {
        insertRow.time_in = now.toISOString();
        insertRow.is_late = lateNow;
      } else {
        insertRow.time_out = now.toISOString();
        insertRow.is_overtime = overtimeNow;
      }
      const { data, error } = await admin
        .from("attendance_logs")
        .insert(insertRow)
        .select()
        .maybeSingle();
      if (error) throw error;
      result = data;
    } else {
      const update: any = {};
      if (action === "in") {
        if (existing.time_in) {
          return new Response(
            JSON.stringify({ error: "already_timed_in" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        update.time_in = now.toISOString();
        update.is_late = lateNow;
      } else {
        if (existing.time_out) {
          return new Response(
            JSON.stringify({ error: "already_timed_out" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        update.time_out = now.toISOString();
        update.is_overtime = overtimeNow;
      }
      const { data, error } = await admin
        .from("attendance_logs")
        .update(update)
        .eq("id", existing.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      result = data;
    }

    return new Response(
      JSON.stringify({
        success: true,
        record: result,
        late: lateNow,
        overtime: overtimeNow,
        staffName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "server_error", message: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
