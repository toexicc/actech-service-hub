import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Extract service item names from the "Service Breakdown" block of the AI diagnosis. */
const parseServicesFromDiagnosis = (text: string): string => {
  const lines = String(text ?? "").split("\n");
  const out: string[] = [];
  let inSection = false;
  for (const line of lines) {
    const bare = line.replace(/[*_#>`]/g, "").trim();
    if (/^service breakdown\b/i.test(bare)) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;
    if (!bare) continue;
    if (/^(to proceed|summary|recommendations?|findings?|cause)/i.test(bare)) break;
    const cleaned = bare.replace(/^[-*•\d.\s]+/, "");
    const name = cleaned.split(/\s[-—]\s/)[0].trim();
    if (name && !/^php\b/i.test(name)) out.push(name);
  }
  return out.join(", ");
};

const manilaStamp = () =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    const serviceId = typeof body?.serviceId === "string" ? body.serviceId.trim() : "";
    const approved = body?.approved;
    const reason = typeof body?.reason === "string" ? body.reason.slice(0, 1000) : "";
    // Ownership challenge: the client must prove they hold the phone number on
    // file. /track is a public page, so the service ID alone is not a secret.
    const verification = typeof body?.verification === "string" ? body.verification.slice(0, 32) : "";

    if (!serviceId || serviceId.length > 64 || typeof approved !== "boolean") {
      return json({ error: "serviceId (string) and approved (boolean) are required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: row, error: fetchError } = await admin
      .from("services")
      .select("*")
      .eq("service_id", serviceId)
      .maybeSingle();

    if (fetchError) return json({ error: fetchError.message }, 500);
    if (!row) return json({ error: "Service not found" }, 404);

    // --- Verify the requester actually owns this ticket ---------------------
    // The only accepted proof is the last 4 digits of the contact number on
    // file. The client name is printed on the public /track page, so it can
    // never serve as proof of identity.
    const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
    const phoneOnFile = digits(row.contact_number);

    if (phoneOnFile.length < 4) {
      return json(
        {
          error:
            "No contact number is on file for this ticket, so we cannot confirm your identity online. Please contact the shop to approve.",
        },
        403,
      );
    }
    if (!verification.trim()) {
      return json({ error: "Enter the last 4 digits of your contact number to confirm." }, 400);
    }

    const suppliedDigits = digits(verification);
    const phoneMatch =
      suppliedDigits.length >= 4 &&
      (suppliedDigits.endsWith(phoneOnFile.slice(-4)) || phoneOnFile.endsWith(suppliedDigits));

    if (!phoneMatch) {
      return json({ error: "The digits entered do not match the contact number on file." }, 403);
    }


    const status = String(row.status ?? "");
    if (status !== "Waiting to Proceed") {
      return json({ error: `This service is no longer awaiting your approval (status: ${status}).` }, 409);
    }

    const stamp = manilaStamp();
    const clientName = row.client_name || "Client";
    const tag = approved
      ? `Approved by ${clientName} on ${stamp}`
      : `Declined by ${clientName} on ${stamp}: ${reason}`;
    const newAdminNotes = [row.internal_admin_notes, tag].filter(Boolean).join("\n");

    const services = approved ? parseServicesFromDiagnosis(row.diagnosis || "") : "";
    const nowIso = new Date().toISOString();

    const update: Record<string, unknown> = {
      internal_admin_notes: newAdminNotes,
      last_updated: nowIso,
    };
    if (approved) {
      update.status = "Proceed Repair";
      update.client_approved_at = nowIso;
      if (services) update.service = services;
      if (!row.service_date) update.service_date = nowIso.slice(0, 10);
    }

    const { error: updateError } = await admin
      .from("services")
      .update(update)
      .eq("service_id", serviceId);

    if (updateError) return json({ error: updateError.message }, 500);

    // Notify assigned admins + technicians.
    try {
      const names: string[] = [
        ...(Array.isArray(row.admin_reps) ? row.admin_reps : []),
        ...(Array.isArray(row.technicians) ? row.technicians : []),
      ]
        .map((n: string) => String(n ?? "").trim())
        .filter(Boolean);

      if (names.length) {
        const { data: profiles } = await admin.from("profiles").select("id, name");
        const norm = (n: string) => n.split(" - ")[0].trim().toLowerCase();
        const seen = new Set<string>();
        const rows = names
          .map((n) => (profiles ?? []).find((p: any) => norm(p.name || "") === norm(n)))
          .filter((p: any) => p?.id && !seen.has(p.id) && seen.add(p.id))
          .map((p: any) => ({
            recipient_id: p.id,
            recipient_name: p.name,
            category: "service",
            title: approved
              ? `Service ${serviceId}: Proceed Repair`
              : `Service ${serviceId} Declined`,
            message: approved
              ? `${clientName} approved the diagnosis for ${serviceId}. Service will proceed to repair.`
              : `${clientName} declined the diagnosis for ${serviceId}. Reason: ${reason || "(none provided)"}.`,
            service_id: serviceId,
          }));
        if (rows.length) await admin.from("notifications").insert(rows);
      }
    } catch {
      // notification failures must not fail the approval
    }

    return json({
      success: true,
      status: approved ? "Proceed Repair" : status,
      service: services,
      adminNotes: newAdminNotes,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
