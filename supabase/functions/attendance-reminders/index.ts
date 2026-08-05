import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * Attendance reminders for management accounts.
 *
 * Modes (driven by pg_cron, Manila time):
 *  - "in"      09:45 -> remind management to log attendance IN
 *  - "out"     19:00 -> remind management to log attendance OUT
 *  - "missing" 20:00 -> flag staff with missing time in/out for the day
 */

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const manilaDay = (d = new Date()) => new Date(d.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);

type Mode = "in" | "out" | "missing";

const resolveMode = (raw: unknown): Mode => {
  const v = String(raw ?? "").toLowerCase();
  if (v === "in" || v === "out" || v === "missing") return v;
  // Fall back to the Manila hour when no explicit mode is supplied.
  const hour = new Date(Date.now() + MANILA_OFFSET_MS).getUTCHours();
  if (hour < 12) return "in";
  if (hour < 20) return "out";
  return "missing";
};

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

    let payload: Record<string, unknown> = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }
    const mode = resolveMode(payload.mode);
    const day = typeof payload.date === "string" ? payload.date.slice(0, 10) : manilaDay();

    // Management + admin recipients.
    const { data: roleRows, error: roleErr } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "management"]);
    if (roleErr) throw new Error(roleErr.message);

    const recipientIds = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id).filter(Boolean)));
    if (recipientIds.length === 0) return json({ ok: true, mode, sent: 0, reason: "no management accounts" });

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, status")
      .in("id", recipientIds);
    const nameById = new Map<string, string>((profiles ?? []).map((p: any) => [p.id, p.name]));

    let title = "";
    let message = "";
    let skip = false;

    if (mode === "in") {
      title = "Log attendance: Time In";
      message = `Shift starts at 10:00 AM. Please record today's Time In for all staff (${day}).`;
    } else if (mode === "out") {
      title = "Log attendance: Time Out";
      message = `Shift ends at 7:00 PM. Please record today's Time Out for all staff (${day}).`;
    } else {
      // Missing-log sweep for the day.
      const { data: activeStaff } = await supabase
        .from("profiles")
        .select("id, name, status")
        .neq("status", "inactive");

      const { data: logs } = await supabase
        .from("attendance_logs")
        .select("staff_id, staff_name, time_in, time_out")
        .eq("log_date", day);

      const { data: leaves } = await supabase
        .from("staff_leaves")
        .select("staff_id, status, start_date, end_date")
        .lte("start_date", day)
        .gte("end_date", day)
        .eq("status", "approved");
      const onLeave = new Set((leaves ?? []).map((l: any) => l.staff_id));

      const logByStaff = new Map<string, any>((logs ?? []).map((l: any) => [l.staff_id, l]));

      const noLog: string[] = [];
      const noOut: string[] = [];
      (activeStaff ?? []).forEach((p: any) => {
        if (onLeave.has(p.id)) return;
        const log = logByStaff.get(p.id);
        if (!log || !log.time_in) noLog.push(p.name);
        else if (!log.time_out) noOut.push(p.name);
      });

      if (noLog.length === 0 && noOut.length === 0) {
        skip = true;
      } else {
        const parts: string[] = [];
        if (noLog.length) parts.push(`No time in: ${noLog.join(", ")}`);
        if (noOut.length) parts.push(`No time out: ${noOut.join(", ")}`);
        title = "Missing attendance logs";
        message = `${day} — ${parts.join(" | ")}`;
      }
    }

    if (skip) return json({ ok: true, mode, sent: 0, reason: "no missing logs" });

    const rows = recipientIds.map((id) => ({
      recipient_id: id,
      recipient_name: nameById.get(id) ?? null,
      category: "others",
      title,
      message,
      link: "/attendance-overview",
      is_read: false,
    }));

    const { error: insertErr } = await supabase.from("notifications").insert(rows);
    if (insertErr) throw new Error(insertErr.message);

    return json({ ok: true, mode, sent: rows.length });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
