// Public edge function: returns short-lived signed URLs for a service's photos
// (device report / diagnosis) so unauthenticated visitors on /track can view them.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KINDS = ["device_report", "diagnosis_photo"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const url = new URL(req.url);
    const serviceId = (url.searchParams.get("serviceId") ?? "").trim();
    const kind = (url.searchParams.get("kind") ?? "device_report") as (typeof KINDS)[number];
    if (!serviceId || !KINDS.includes(kind)) return json({ photos: [] }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rows } = await supabase
      .from("service_files")
      .select("id, storage_path, bucket")
      .eq("service_id", serviceId)
      .eq("kind", kind)
      .order("uploaded_at", { ascending: true });

    const photos: { id: string; url: string }[] = [];
    for (const r of rows ?? []) {
      const f = r as { id: string; storage_path: string; bucket: string };
      const { data: signed } = await supabase.storage
        .from(f.bucket)
        .createSignedUrl(f.storage_path, 60 * 60);
      if (signed?.signedUrl) photos.push({ id: f.id, url: signed.signedUrl });
    }

    return json({ photos });
  } catch (e) {
    return json({ photos: [], error: String(e) }, 500);
  }
});
