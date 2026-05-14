// Public edge function: returns a short-lived signed URL for a service's
// intake or quotation PDF so unauthenticated visitors on /track can view it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKETS: Record<string, string> = {
  intake: "intake-forms",
  quotation: "quotation-forms",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const serviceId = url.searchParams.get("serviceId") ?? "";
    const kind = (url.searchParams.get("kind") ?? "intake") as "intake" | "quotation";
    if (!serviceId || !BUCKETS[kind]) {
      return new Response(JSON.stringify({ url: null }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Try the service_files index first.
    const { data: rows } = await supabase
      .from("service_files")
      .select("storage_path, bucket")
      .eq("service_id", serviceId)
      .eq("kind", kind)
      .order("uploaded_at", { ascending: false })
      .limit(1);

    if (rows && rows.length > 0) {
      const f = rows[0] as { storage_path: string; bucket: string };
      const { data: signed } = await supabase.storage
        .from(f.bucket)
        .createSignedUrl(f.storage_path, 60 * 60);
      if (signed?.signedUrl) {
        return new Response(JSON.stringify({ url: signed.signedUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fallback: list the bucket folder for this service.
    const bucket = BUCKETS[kind];
    const { data: list } = await supabase.storage
      .from(bucket)
      .list(serviceId, { limit: 50, sortBy: { column: "created_at", order: "desc" } });
    if (list && list.length > 0) {
      const pdf = list.find((f: any) => f.name?.toLowerCase().endsWith(".pdf")) ?? list[0];
      if (pdf?.name) {
        const { data: signed } = await supabase.storage
          .from(bucket)
          .createSignedUrl(`${serviceId}/${pdf.name}`, 60 * 60);
        if (signed?.signedUrl) {
          return new Response(JSON.stringify({ url: signed.signedUrl }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    return new Response(JSON.stringify({ url: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ url: null, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
