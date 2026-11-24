import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { newRequestId, type ReturnReason } from "@/lib/partRequests";

export interface PartRequestRow {
  id: string;
  request_id: string;
  part_id: string | null;
  part_name: string | null;
  brand: string | null;
  device_model: string | null;
  quantity: number;
  status: string;
  service_id: string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  notes: string | null;
  acknowledged_at: string | null;
  acknowledged_by_name: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string | null;
  /** "request" (add a part) or "return" (take a part off the ticket). */
  kind: string;
  return_reason: ReturnReason | null;
  /** Made after the repair was done, when the ticket's parts were locked. */
  after_lock: boolean;
  defect_status: string | null;
  defect_note: string | null;
  defect_updated_at: string | null;
  defect_updated_by_name: string | null;
}

const COLUMNS =
  "id,request_id,part_id,part_name,brand,device_model,quantity,status,service_id,requested_by,requested_by_name,notes,acknowledged_at,acknowledged_by_name,approved_at,approved_by_name,cancelled_at,cancelled_reason,created_at,updated_at,kind,return_reason,after_lock,defect_status,defect_note,defect_updated_at,defect_updated_by_name";

/** Every request, newest first (Inventory → Requests and the overview). */
export const usePartRequestsAll = () =>
  useQuery({
    queryKey: ["part-requests", "inbox"],
    queryFn: async (): Promise<PartRequestRow[]> => {
      const { data, error } = await (supabase as any)
        .from("part_requests")
        .select(COLUMNS)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as PartRequestRow[];
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

/** One ticket's requests, newest first. */
export const useTicketPartRequests = (serviceId: string | null | undefined) =>
  useQuery({
    queryKey: ["part-requests", "ticket", serviceId ?? ""],
    enabled: !!serviceId,
    queryFn: async (): Promise<PartRequestRow[]> => {
      const { data, error } = await (supabase as any)
        .from("part_requests")
        .select(COLUMNS)
        .eq("service_id", serviceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PartRequestRow[];
    },
    staleTime: 15 * 1000,
    refetchInterval: 60 * 1000,
  });

/** Refresh what a request change touches: requests, stock, logs and movements. Ticket pages reload themselves. */
export const useRefreshAfterRequest = () => {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["part-requests"] });
    qc.invalidateQueries({ queryKey: ["partRequests"] });
    qc.invalidateQueries({ queryKey: ["inventory"] });
    qc.invalidateQueries({ queryKey: ["inventoryLogs"] });
    qc.invalidateQueries({ queryKey: ["stock-movements"] });
    qc.invalidateQueries({ queryKey: ["ticket-summaries"] });
  };
};

const ticketLink = (serviceId: string) => `/service-update?serviceId=${encodeURIComponent(serviceId)}`;

const notify = async (r: PartRequestRow, title: string, message: string, actorId?: string | null) => {
  if (!r.requested_by || r.requested_by === actorId) return;
  await (supabase as any).from("notifications").insert({
    recipient_id: r.requested_by,
    recipient_name: r.requested_by_name,
    category: "part_request",
    title,
    message,
    service_id: r.service_id,
    link: r.service_id ? ticketLink(r.service_id) : "/parts-availability",
  });
};

const label = (r: Pick<PartRequestRow, "quantity" | "part_name" | "part_id">) =>
  `${r.quantity}× ${r.part_name || r.part_id || "part"}`;

// Every request and return event (added, cancelled, declined, status changes, approvals, defective updates)
// is written to the ticket's activity log by the database, with who did it.

export interface NewPartRequest {
  serviceId: string;
  /** "return" to take a part off the ticket (needs returnReason); default "request". */
  kind?: "request" | "return";
  returnReason?: ReturnReason | null;
  partId?: string | null;
  partName: string;
  brand?: string | null;
  deviceModel?: string | null;
  quantity: number;
  notes?: string | null;
  status?: "Requested" | "For Ordering";
  requestedBy: string | null;
  requestedByName: string;
}

export async function createPartRequest(input: NewPartRequest): Promise<PartRequestRow> {
  const { data, error } = await (supabase as any)
    .from("part_requests")
    .insert({
      request_id: newRequestId(),
      service_id: input.serviceId,
      part_id: input.partId || null,
      part_name: input.partName,
      brand: input.brand || null,
      device_model: input.deviceModel || null,
      quantity: Math.max(1, Math.floor(input.quantity) || 1),
      notes: input.notes?.trim() || null,
      status: input.status ?? "Requested",
      kind: input.kind ?? "request",
      return_reason: input.kind === "return" ? input.returnReason ?? null : null,
      requested_by: input.requestedBy,
      requested_by_name: input.requestedByName,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as PartRequestRow;
}

export interface ApproveResult {
  service_id: string;
  part_id: string;
  quantity: number;
  stock_left: number;
  parts_used: string[];
}

/** Takes the stock and adds the part to the ticket (inventory staff and management only). */
export async function approvePartRequest(id: string, partId?: string | null, quantity?: number | null): Promise<ApproveResult> {
  const { data, error } = await (supabase as any).rpc("approve_part_request", {
    _id: id,
    _part_id: partId || null,
    _quantity: quantity ?? null,
  });
  if (error) throw new Error(error.message);
  return data as ApproveResult;
}

export interface ReturnResult {
  service_id: string;
  part_id: string;
  quantity: number;
  reason: ReturnReason;
  stock_after: number | null;
  parts_used: string[];
}

/** Takes the part off the ticket; back into stock unless it's defective (inventory staff and management only). */
export async function approvePartReturn(id: string): Promise<ReturnResult> {
  const { data, error } = await (supabase as any).rpc("approve_part_return", { _id: id });
  if (error) throw new Error(error.message);
  return data as ReturnResult;
}

/** Defective list: where the part is with the supplier (Sent to supplier, Replaced, Credited, Disposed). */
export async function setDefectStatus(id: string, status: string, note?: string | null): Promise<void> {
  const { error } = await (supabase as any).rpc("set_defect_status", { _id: id, _status: status, _note: note ?? null });
  if (error) throw new Error(error.message);
}

/** Cancel (by the requester) or decline (by inventory, with a reason the requester sees). */
export async function cancelPartRequest(
  r: PartRequestRow,
  opts: { reason: string; byName: string; byId?: string | null; declined: boolean },
): Promise<void> {
  const reason = opts.reason.trim() || (opts.declined ? "Declined" : "Cancelled by requester");
  const { error } = await (supabase as any)
    .from("part_requests")
    .update({ status: "Cancelled", cancelled_at: new Date().toISOString(), cancelled_reason: reason })
    .eq("id", r.id);
  if (error) throw new Error(error.message);
  if (opts.declined) {
    await notify(r, r.kind === "return" ? "Part return declined" : "Part request declined", `${opts.byName} declined ${label(r)}${r.service_id ? ` for ${r.service_id}` : ""}: ${reason}`, opts.byId);
  }
}

/** Ordering progress set by inventory staff (For Ordering, Ordered, Received…); tells the requester. */
export async function setPartRequestStatus(
  r: PartRequestRow,
  status: string,
  opts: { byName: string; byId?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (!r.acknowledged_at) {
    patch.acknowledged_at = new Date().toISOString();
    patch.acknowledged_by_name = opts.byName;
  }
  const { error } = await (supabase as any).from("part_requests").update(patch).eq("id", r.id);
  if (error) throw new Error(error.message);
  await notify(r, "Part request update", `${label(r)}${r.service_id ? ` for ${r.service_id}` : ""} is now: ${status}.`, opts.byId);
}

/** Inventory has seen the request. */
export async function acknowledgePartRequest(r: PartRequestRow, opts: { byName: string; byId?: string | null }): Promise<void> {
  const { error } = await (supabase as any)
    .from("part_requests")
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by_name: opts.byName })
    .eq("id", r.id);
  if (error) throw new Error(error.message);
  const ret = r.kind === "return";
  await notify(
    r,
    ret ? "Part return update" : "Part request update",
    `${opts.byName} has seen your ${ret ? "return of" : "request for"} ${label(r)}${r.service_id ? ` (${r.service_id})` : ""}.`,
    opts.byId,
  );
}
