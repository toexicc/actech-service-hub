// Inserts notification rows with service-role and fans out OneSignal pushes.
// Callable from anonymous contexts (e.g. /track) so client approvals can
// reliably notify assigned admins/technicians.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ONESIGNAL_APP_ID = "0ba186cc-b8d9-4573-83f1-cc2ea6b9e841";

interface Recipient {
  userId: string;
  title: string;
  message: string;
  serviceId?: string;
}

const sendPush = async (apiKey: string, externalIds: string[], title: string, message: string, data: Record<string, unknown>) => {
  if (!externalIds.length) return;
  await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Basic ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      include_aliases: { external_id: externalIds },
      target_channel: "push",
      headings: { en: title },
      contents: { en: message },
      data,
    }),
  }).catch(() => {});
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const oneSignalKey = Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const recipients: Recipient[] = Array.isArray(body?.recipients) ? body.recipients : [];
    if (!recipients.length) {
      return new Response(JSON.stringify({ error: "recipients required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = recipients
      .filter((r) => r.userId && r.title && r.message)
      .map((r) => ({
        recipient_id: r.userId,
        title: r.title,
        message: r.message,
        category: "service",
        service_id: r.serviceId ?? null,
      }));

    if (rows.length) {
      await supabase.from("notifications").insert(rows);
    }

    if (oneSignalKey) {
      // Group pushes by identical title+message to send a single OneSignal call per group
      const groups = new Map<string, { ids: string[]; title: string; message: string; serviceId?: string }>();
      for (const r of recipients) {
        const k = `${r.title}::${r.message}`;
        const g = groups.get(k) ?? { ids: [], title: r.title, message: r.message, serviceId: r.serviceId };
        g.ids.push(r.userId);
        groups.set(k, g);
      }
      await Promise.all(
        Array.from(groups.values()).map((g) =>
          sendPush(oneSignalKey, g.ids, g.title, g.message, g.serviceId ? { serviceId: g.serviceId } : {}),
        ),
      );
    }

    return new Response(JSON.stringify({ ok: true, inserted: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
