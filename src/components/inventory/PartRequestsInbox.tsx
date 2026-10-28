import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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
  requested_by_name: string | null;
  requested_by: string | null;
  notes: string | null;
  acknowledged_at: string | null;
  acknowledged_by_name: string | null;
  created_at: string;
}

const STATUSES = ["For Ordering", "Ordering", "Ordered", "Received", "Released to technician", "Cancelled"];
const OPEN = (s: string) => !["Received", "Released to technician", "Cancelled"].includes(s);

export const usePartRequestsAll = () =>
  useQuery({
    queryKey: ["part-requests", "inbox"],
    queryFn: async (): Promise<PartRequestRow[]> => {
      const { data, error } = await supabase
        .from("part_requests")
        .select("id,request_id,part_id,part_name,brand,device_model,quantity,status,service_id,requested_by_name,requested_by,notes,acknowledged_at,acknowledged_by_name,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as PartRequestRow[];
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

export function PartRequestsInbox({ stockByPart, compact = false }: { stockByPart?: Map<string, number>; compact?: boolean }) {
  const { data: rows = [], isLoading } = usePartRequestsAll();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [view, setView] = useState<"new" | "open" | "all">("open");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (view === "new" && (r.acknowledged_at || !OPEN(r.status))) return false;
      if (view === "open" && !OPEN(r.status)) return false;
      if (!q) return true;
      return [r.request_id, r.part_name, r.service_id, r.requested_by_name, r.device_model].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [rows, view, search]);

  const newCount = rows.filter((r) => !r.acknowledged_at && OPEN(r.status)).length;

  const notifyRequester = async (r: PartRequestRow, msg: string) => {
    if (!r.requested_by) return;
    await supabase.from("notifications").insert({
      recipient_id: r.requested_by,
      recipient_name: r.requested_by_name,
      category: "part_request",
      title: "Part request update",
      message: msg,
      service_id: r.service_id,
      link: "/request-for-parts",
    });
  };

  const update = async (r: PartRequestRow, patch: Record<string, unknown>, msg: string) => {
    const { error } = await supabase.from("part_requests").update(patch).eq("id", r.id);
    if (error) {
      toast({ title: "Could not update request", description: error.message, variant: "destructive" });
      return;
    }
    await notifyRequester(r, msg);
    qc.invalidateQueries({ queryKey: ["part-requests"] });
    qc.invalidateQueries({ queryKey: ["partRequests"] });
  };

  const acknowledge = (r: PartRequestRow) =>
    update(r, { acknowledged_at: new Date().toISOString(), acknowledged_by_name: profile?.name ?? null },
      `${profile?.name ?? "Inventory"} received your request for ${r.part_name ?? "a part"}${r.service_id ? ` (${r.service_id})` : ""}.`);

  const setStatus = (r: PartRequestRow, status: string) =>
    update(r, { status, ...(r.acknowledged_at ? {} : { acknowledged_at: new Date().toISOString(), acknowledged_by_name: profile?.name ?? null }) },
      `${r.part_name ?? "Your part"}${r.service_id ? ` for ${r.service_id}` : ""} is now: ${status}.`);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-lg">
          Part requests {newCount > 0 && <Badge className="ml-2">{newCount} new</Badge>}
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          {(["new", "open", "all"] as const).map((v) => (
            <Button key={v} size="sm" variant={view === v ? "default" : "outline"} onClick={() => setView(v)} className="capitalize">{v}</Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!compact && <Input placeholder="Search part, ticket, technician…" value={search} onChange={(e) => setSearch(e.target.value)} />}
        {isLoading && <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && filtered.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No requests here.</p>}
        <div className="space-y-2">
          {filtered.slice(0, compact ? 6 : 200).map((r) => {
            const onHand = r.part_id ? stockByPart?.get(r.part_id) : undefined;
            return (
              <div key={r.id} className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.quantity}× {r.part_name || r.part_id || "Part"}</span>
                    <Badge variant="outline">{r.status}</Badge>
                    {!r.acknowledged_at && OPEN(r.status) && <Badge>New</Badge>}
                    {onHand !== undefined && <Badge variant="secondary">On hand: {onHand}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[r.brand, r.device_model].filter(Boolean).join(" ")}
                    {r.service_id && (
                      <button type="button" className="ml-1 font-mono underline" onClick={() => navigate(`/manage-client?serviceId=${encodeURIComponent(r.service_id!)}`)}>
                        {r.service_id}
                      </button>
                    )}
                    {" · "}{r.requested_by_name || "—"} · {format(new Date(r.created_at), "MM/dd/yyyy h:mm a")}
                  </div>
                  {r.notes && <p className="text-xs">{r.notes}</p>}
                  {r.acknowledged_by_name && <p className="text-xs text-muted-foreground">Received by {r.acknowledged_by_name}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {!r.acknowledged_at && OPEN(r.status) && <Button size="sm" onClick={() => acknowledge(r)}>Receive request</Button>}
                  <Select value={r.status} onValueChange={(v) => setStatus(r, v)}>
                    <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[...new Set([r.status, ...STATUSES])].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
