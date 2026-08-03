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

/**
 * Extract service item names from the "Service Breakdown" block of the AI diagnosis.
 * Mirrors parseServiceBreakdownItems() in src/lib/serviceApproval.ts — keep both in sync.
 */
const parseServicesFromDiagnosis = (text: string): string[] => {
  if (!text) return [];
  const lines = String(text).split(/\r?\n/);
  const startIdx = lines.findIndex((l) =>
    /service\s*breakdown\s*:?/i.test(l.replace(/[*_#>`]/g, "")),
  );
  if (startIdx === -1) return [];
  const out: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const raw = lines[i].replace(/[*_#>`]/g, "").trim();
    if (!raw) {
      if (out.length) break;
      continue;
    }
    if (/^(to proceed|summary|recommendations?|findings?|cause|warranty|writing rules)/i.test(raw)) break;
    const cleaned = raw.replace(/^[-*•\d.\s]+/, "");
    const name = cleaned.split(/\s[-—]\s/)[0].trim();
    if (name && !/^php\b/i.test(name)) out.push(name);
  }
  return out;
};

/** Loose comparison key so client/server spacing or punctuation drift can't break matching. */
const norm = (s: string) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();


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
    const selectedServices: string[] = Array.isArray(body?.selectedServices)
      ? body.selectedServices
          .filter((s: unknown) => typeof s === "string")
          .map((s: string) => s.trim().slice(0, 200))
          .filter(Boolean)
          .slice(0, 50)
      : [];

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

    const status = String(row.status ?? "");
    const alreadyAnswered = !!row.client_approved_at;

    // Repeat submissions (double tap, retry after a flaky network) must not look
    // like an error — report the state the ticket is already in.
    if (alreadyAnswered && (row.approval_locked || status !== "Waiting to Proceed")) {
      return json({
        success: true,
        alreadyRecorded: true,
        status,
        partial: !!row.approval_locked,
        approvedServices: Array.isArray(row.approved_services) ? row.approved_services : [],
        pendingServices: Array.isArray(row.pending_services) ? row.pending_services : [],
        service: row.service ?? "",
        adminNotes: row.internal_admin_notes ?? "",
      });
    }

    if (status !== "Waiting to Proceed") {
      return json({ error: `This service is no longer awaiting your approval (status: ${status}).` }, 409);
    }
    if (row.approval_locked) {
      return json(
        { error: "Approval is on hold while the shop confirms your selection. Please contact the shop." },
        409,
      );
    }

    const stamp = manilaStamp();
    const clientName = row.client_name || "Client";
    const allItems = parseServicesFromDiagnosis(row.diagnosis || "");

    // Determine approved vs pending items.
    let approvedItems: string[] = [];
    let pendingItems: string[] = [];
    if (approved) {
      if (allItems.length === 0) {
        // No parseable breakdown: treat as a plain full approval, and keep any
        // client selection as the recorded approved list.
        approvedItems = selectedServices;
      } else if (allItems.length === 1 || selectedServices.length === 0) {
        // Single-item breakdown, or no checklist shown -> approve everything.
        approvedItems = allItems;
      } else {
        const picked = new Set(selectedServices.map(norm));
        approvedItems = allItems.filter((i) => picked.has(norm(i)));
        pendingItems = allItems.filter((i) => !picked.has(norm(i)));

        // Fallback: names drifted between what the page showed and what the
        // ticket now stores — match by position instead of rejecting.
        if (approvedItems.length === 0) {
          const idxPicked = new Set(
            selectedServices
              .map((s) => allItems.findIndex((i) => norm(i).includes(norm(s)) || norm(s).includes(norm(i))))
              .filter((i) => i >= 0),
          );
          if (idxPicked.size > 0) {
            approvedItems = allItems.filter((_, i) => idxPicked.has(i));
            pendingItems = allItems.filter((_, i) => !idxPicked.has(i));
          }
        }

        if (approvedItems.length === 0) {
          return json({ error: "Please select at least one service to approve." }, 400);
        }
      }
    }


    const isPartial = approved && pendingItems.length > 0;

    const tag = approved
      ? (approvedItems.length
          ? `${clientName} approved services : ${approvedItems.join(", ")} on ${stamp}`
          : `Approved by ${clientName} on ${stamp}`) +
        (isPartial ? `. Pending Approval on ${pendingItems.join(", ")}` : "")
      : `Declined by ${clientName} on ${stamp}: ${reason}`;

    const newAdminNotes = [row.internal_admin_notes, tag].filter(Boolean).join("\n");

    const nowIso = new Date().toISOString();

    const update: Record<string, unknown> = {
      internal_admin_notes: newAdminNotes,
      last_updated: nowIso,
    };
    if (approved) {
      update.approved_services = approvedItems;
      update.pending_services = pendingItems;
      update.client_approved_at = nowIso;
      if (approvedItems.length) update.service = approvedItems.join(", ");
      if (!row.service_date) update.service_date = nowIso.slice(0, 10);
      if (isPartial) {
        // Stay in Waiting to Proceed; lock further client responses until an
        // admin re-opens the approval.
        update.approval_locked = true;
      } else {
        update.status = "Proceed Repair";
      }
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
        const title = !approved
          ? `Service ${serviceId} Declined`
          : isPartial
          ? `Service ${serviceId}: Partial Approval — action needed`
          : `Service ${serviceId}: Proceed Repair`;
        const message = !approved
          ? `${clientName} declined the diagnosis for ${serviceId}. Reason: ${reason || "(none provided)"}.`
          : isPartial
          ? `${clientName} approved only: ${approvedItems.join(", ")} for ${serviceId}. Pending approval: ${pendingItems.join(", ")}. Confirm with the client, then move it to Proceed Repair manually.`
          : `${clientName} approved the diagnosis for ${serviceId}. Service will proceed to repair.`;

        const rows = names
          .map((n) => (profiles ?? []).find((p: any) => norm(p.name || "") === norm(n)))
          .filter((p: any) => p?.id && !seen.has(p.id) && seen.add(p.id))
          .map((p: any) => ({
            recipient_id: p.id,
            recipient_name: p.name,
            category: "service_update",
            title,
            message,
            service_id: serviceId,
          }));
        if (rows.length) await admin.from("notifications").insert(rows);
      }
    } catch {
      // notification failures must not fail the approval
    }

    return json({
      success: true,
      status: approved && !isPartial ? "Proceed Repair" : status,
      partial: isPartial,
      approvedServices: approvedItems,
      pendingServices: pendingItems,
      service: approvedItems.join(", "),
      adminNotes: newAdminNotes,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
