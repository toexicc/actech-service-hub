// Sends a OneSignal push to a specific external user id (auth.users.id).
// Used so assigned techs/admins receive notifications even when offline.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ONESIGNAL_APP_ID = "0ba186cc-b8d9-4573-83f1-cc2ea6b9e841";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Require an authenticated caller
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ONESIGNAL_REST_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    const body = await req.json().catch(() => ({}));
    const { userId, userIds, title, message, data, url } = body ?? {};

    const externalIds: string[] = Array.isArray(userIds)
      ? userIds.filter((v: unknown) => typeof v === "string" && v.length > 0)
      : (typeof userId === "string" && userId.length > 0 ? [userId] : []);

    if (externalIds.length === 0 || !title || !message) {
      return new Response(
        JSON.stringify({ error: "userId(s), title and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload: Record<string, unknown> = {
      app_id: ONESIGNAL_APP_ID,
      include_aliases: { external_id: externalIds },
      target_channel: "push",
      headings: { en: String(title) },
      contents: { en: String(message) },
      data: data ?? {},
    };
    if (url) payload.url = url;

    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: res.ok, result }), {
      status: res.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
