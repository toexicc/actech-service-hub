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
    // Richer payload: each picked line with the chosen sub-option and its price.
    const selectedLines: { name: string; label: string; option: string; cost: number }[] = Array.isArray(
      body?.selectedLines,
    )
      ? body.selectedLines
          .map((l: any) => ({
            name: String(l?.name ?? "").trim().slice(0, 200),
            label: String(l?.label ?? l?.name ?? "").trim().slice(0, 240),
            option: String(l?.option ?? "").trim().slice(0, 120),
            cost: Math.max(0, Number(l?.cost ?? 0) || 0),
          }))
          .filter((l: any) => l.name)
          .slice(0, 50)
      : [];


    if (!serviceId || serviceId.length > 64 || typeof approved !== "boolean") {
      return json({ error: "serviceId (string) and approved (boolean) are required" }, 400);
    }
    if (!approved && !reason.trim()) {
      return json({ error: "Please provide a reason for declining." }, 400);
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
    const quoted = Array.isArray(row.quoted_breakdown)
      ? row.quoted_breakdown
          .map((line: any) => ({
            name: String(line?.name ?? "").trim(),
            cost: Math.max(0, Number(line?.cost ?? 0) || 0),
            selected: line?.selected === undefined ? true : !!line.selected,
            required: !!line?.required,
            options: Array.isArray(line?.options)
              ? line.options
                  .map((o: any) => ({
                    label: String(o?.label ?? "").trim(),
                    cost: Math.max(0, Number(o?.cost ?? 0) || 0),
                  }))
                  .filter((o: any) => o.label)
              : undefined,
            selectedOption: String(line?.selectedOption ?? "").trim(),
          }))
          .filter((line: any) => line.name)
      : [];

    const allItems = quoted.length ? quoted.map((line: any) => line.name) : parseServicesFromDiagnosis(row.diagnosis || "");

    // Anything the client already confirmed in an earlier (partial) approval
    // stays approved when the shop re-opens the checklist.
    const previouslyApproved: string[] = Array.isArray(row.approved_services)
      ? row.approved_services.map((s: any) => String(s ?? "")).filter(Boolean)
      : [];
    const prevKeys = new Set(previouslyApproved.map(norm));

    // Loose pick matching: the page may send the plain name or the
    // "Name (Option)" label, and shop edits can drift the wording.
    const pickTokens = [
      ...selectedLines.map((l) => l.name),
      ...selectedLines.map((l) => l.label),
      ...selectedServices,
    ]
      .map(norm)
      .filter(Boolean);
    const isPicked = (name: string) => {
      const key = norm(name);
      if (!key) return false;
      return pickTokens.some((t) => t === key || t.includes(key) || key.includes(t));
    };
    const optionFor = (name: string) => {
      const key = norm(name);
      const hit = selectedLines.find((l) => norm(l.name) === key || norm(l.label).includes(key));
      return hit?.option ?? "";
    };
    const labelFor = (name: string, option: string) => (option ? `${name} (${option})` : name);

    // Determine approved vs pending items.
    let approvedItems: string[] = [];
    let pendingItems: string[] = [];
    let relined: any[] = [];
    if (approved) {
      if (quoted.length) {
        relined = quoted.map((l: any) => {
          const keep = !!l.required || prevKeys.has(norm(l.name)) || isPicked(l.name);
          const option = l.options?.length ? optionFor(l.name) || l.selectedOption || "" : "";
          const optionCost = l.options?.length
            ? l.options.find((o: any) => norm(o.label) === norm(option))?.cost ?? 0
            : 0;
          return {
            name: l.name,
            cost: l.options?.length ? optionCost : l.cost,
            selected: keep,
            required: !!l.required,
            ...(l.options?.length ? { options: l.options, selectedOption: option } : {}),
          };
        });
        approvedItems = relined.filter((l) => l.selected).map((l) => labelFor(l.name, l.selectedOption ?? ""));
        pendingItems = relined.filter((l) => !l.selected).map((l) => l.name);
        if (approvedItems.length === 0) {
          return json({ error: "Please select at least one service to approve." }, 400);
        }
        const missingOption = relined.find((l) => l.selected && l.options?.length && !l.selectedOption);
        if (missingOption) {
          return json({ error: `Please choose an option for "${missingOption.name}".` }, 400);
        }
      } else if (allItems.length === 0) {
        // No parseable breakdown: treat as a plain full approval.
        approvedItems = selectedServices;
      } else if (allItems.length === 1) {
        approvedItems = allItems;
      } else {
        approvedItems = allItems.filter((i) => prevKeys.has(norm(i)) || isPicked(i));
        pendingItems = allItems.filter((i) => !(prevKeys.has(norm(i)) || isPicked(i)));
        if (approvedItems.length === 0) {
          return json({ error: "Please select at least one service to approve." }, 400);
        }
      }
    }

    // Required (locked) lines are what gate the advance. When they are all
    // approved the ticket proceeds even if optional lines stay pending.
    const hasRequired = relined.some((l) => !!l.required);
    const requiredPending = relined.filter(
      (l) => l.required && (!l.selected || (l.options?.length && !l.selectedOption)),
    );
    const isPartial = approved && pendingItems.length > 0;
    const blockAdvance = approved && (hasRequired ? requiredPending.length > 0 : pendingItems.length > 0);



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

      // Recost the ticket from the finalized quotation lines when the shop
      // published one, so the client's selection drives the quoted amount.
      if (relined.length) {
        const total = relined.reduce((sum, l) => sum + (l.selected ? Number(l.cost) || 0 : 0), 0);
        update.quoted_breakdown = relined;
        const discount = Number(row.discount ?? 0) || 0;
        update.service_cost = total;
        update.final_cost = Math.max(0, total - discount);
      }
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
      quotedBreakdown: update.quoted_breakdown ?? quoted,
      serviceCost: update.service_cost ?? row.service_cost,
      finalCost: update.final_cost ?? row.final_cost,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
