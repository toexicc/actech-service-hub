import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    const { data: userData } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    const caller = userData.user;
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", caller.id);
    if (!(roles ?? []).some((row) => row.role === "management")) {
      return json({ error: "Only management can permanently delete services" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const serviceId = String(body?.serviceId ?? "").trim();
    if (!serviceId) return json({ error: "Service ID is required" }, 400);

    const { data: service } = await admin
      .from("services")
      .select("service_id, signature_path, device_annotation_path")
      .eq("service_id", serviceId)
      .maybeSingle();
    if (!service) return json({ error: "Service not found" }, 404);

    const { data: files } = await admin
      .from("service_files")
      .select("bucket, storage_path")
      .eq("service_id", serviceId);

    const storageFiles = [...(files ?? [])];
    if (service.signature_path) storageFiles.push({ bucket: "signatures", storage_path: service.signature_path });
    if (service.device_annotation_path) storageFiles.push({ bucket: "annotations", storage_path: service.device_annotation_path });

    const deletions: Array<[string, string]> = [
      ["service_breakdowns", "service_id"],
      ["transactions", "service_id"],
      ["part_logs", "service_id"],
      ["part_requests", "service_id"],
      ["notifications", "service_id"],
      ["salary_deductions", "service_id"],
      ["client_inquiries", "service_id"],
      ["queue_entries", "service_id"],
    ];
    for (const [table, column] of deletions) {
      const { error } = await admin.from(table).delete().eq(column, serviceId);
      if (error) throw error;
    }

    await admin.from("activity_logs").delete().eq("entity_type", "service").eq("entity_id", serviceId);
    const { error: serviceError } = await admin.from("services").delete().eq("service_id", serviceId);
    if (serviceError) throw serviceError;

    for (const file of storageFiles) {
      if (!file.bucket || !file.storage_path) continue;
      await admin.storage.from(file.bucket).remove([file.storage_path]);
    }

    const { data: profile } = await admin.from("profiles").select("name, username").eq("id", caller.id).maybeSingle();
    await admin.from("activity_logs").insert({
      actor_id: caller.id,
      actor_name: profile?.name || profile?.username || "Management",
      action: "Permanently deleted service",
      entity_type: "service_deletion",
      entity_id: serviceId,
      changes: { service_id: serviceId, permanent: true },
    });

    return json({ ok: true, serviceId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Delete failed" }, 500);
  }
});