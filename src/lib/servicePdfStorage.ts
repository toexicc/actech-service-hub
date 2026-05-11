import { supabase } from "@/integrations/supabase/client";

export type ServicePdfKind = "intake" | "quotation";

const BUCKETS: Record<ServicePdfKind, string> = {
  intake: "intake-forms",
  quotation: "quotation-forms",
};

const sanitize = (s: string) => (s || "").replace(/[^a-zA-Z0-9]/g, "_");

/**
 * Upload a generated PDF blob to its dedicated Supabase Storage bucket
 * and record an entry in `service_files` so the "View PDF" buttons can
 * resolve a signed URL later.
 */
export const uploadServicePdf = async (params: {
  serviceId: string;
  clientName?: string;
  kind: ServicePdfKind;
  blob: Blob;
}): Promise<{ path: string; bucket: string } | null> => {
  const { serviceId, clientName, kind, blob } = params;
  if (!serviceId || !blob) return null;
  const bucket = BUCKETS[kind];
  const ts = Date.now();
  const fileName = `${sanitize(serviceId)}_${sanitize(clientName ?? "")}_${ts}.pdf`;
  const path = `${serviceId}/${fileName}`;

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: "application/pdf", upsert: true });
  if (upErr) return null;

  const { data: userRes } = await supabase.auth.getUser();
  await supabase.from("service_files").insert({
    service_id: serviceId,
    kind: kind as any,
    bucket,
    storage_path: path,
    filename: fileName,
    mime_type: "application/pdf",
    size_bytes: blob.size,
    uploaded_by: userRes?.user?.id ?? null,
  });
  return { path, bucket };
};

/**
 * Returns a short-lived signed URL for the most recent PDF of the given
 * kind for a service, or null if none exists.
 */
export const getServicePdfSignedUrl = async (
  serviceId: string,
  kind: ServicePdfKind = "intake",
): Promise<string | null> => {
  if (!serviceId) return null;

  // First try the indexed service_files table.
  const { data, error } = await supabase
    .from("service_files")
    .select("storage_path, bucket")
    .eq("service_id", serviceId)
    .eq("kind", kind as any)
    .order("uploaded_at", { ascending: false })
    .limit(1);
  if (!error && data && data.length > 0) {
    const f = data[0];
    const { data: signed } = await supabase.storage
      .from(f.bucket)
      .createSignedUrl(f.storage_path, 60 * 60);
    if (signed?.signedUrl) return signed.signedUrl;
  }

  // Fallback: directly inspect the storage bucket for any PDF saved
  // under this service's folder. Quotations may have been generated
  // before the service_files row existed (legacy uploads).
  const bucket = BUCKETS[kind];
  const { data: list } = await supabase.storage
    .from(bucket)
    .list(serviceId, { limit: 50, sortBy: { column: "created_at", order: "desc" } });
  if (list && list.length > 0) {
    const pdf = list.find((f) => f.name?.toLowerCase().endsWith(".pdf")) ?? list[0];
    if (pdf?.name) {
      const { data: signed } = await supabase.storage
        .from(bucket)
        .createSignedUrl(`${serviceId}/${pdf.name}`, 60 * 60);
      if (signed?.signedUrl) return signed.signedUrl;
    }
  }

  return null;
};
