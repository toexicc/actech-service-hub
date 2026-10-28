import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ClipboardCheck, Inbox, Package, Truck, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInventory } from "@/hooks/useInventory";
import { useStockMovements, TYPE_LABEL } from "./StockMovementsPanel";
import { usePartRequestsAll } from "./PartRequestsInbox";
import { format } from "date-fns";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Inventory-focused summary used on the Inventory Overview tab and the Admin + Inventory dashboard. */
export function InventoryOverview() {
  const navigate = useNavigate();
  const { data: items = [] } = useInventory();
  const { data: moves = [] } = useStockMovements();
  const { data: requests = [] } = usePartRequestsAll();
  const { data: partsTickets = [] } = useQuery({
    queryKey: ["inventory-overview-parts-tickets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("service_id, client_name, model, waiting_for_parts, parts_ordered, waiting_parts_note_tech, last_updated")
        .or("waiting_for_parts.eq.true,parts_ordered.eq.true")
        .not("status", "in", "(Completed,Cancelled,RTO,\"RTO - Client\",\"RTO - ACTech\")")
        .limit(200);
      return data ?? [];
    },
    staleTime: 60 * 1000,
  });

  const stats = useMemo(() => {
    const low = items.filter((i) => i.status === "Low Stock" || i.status === "Out of Stock" || (i.quantity <= 2 && i.status === "In Stock"));
    const forOrdering = items.filter((i) => i.status === "For Ordering");
    const value = items.reduce((s, i) => s + i.quantity * (parseFloat(String(i.costPerUnit ?? "0")) || 0), 0);
    const pending = moves.filter((m) => m.status === "pending").length;
    const openReq = requests.filter((r) => !["Received", "Released to technician", "Cancelled"].includes(r.status));
    const since = Date.now() - 30 * 86400000;
    const used = new Map<string, { name: string; qty: number }>();
    moves.forEach((m) => {
      if (m.movement_type !== "stock_out" || new Date(m.created_at).getTime() < since) return;
      const k = m.part_id ?? m.part_name ?? "?";
      const cur = used.get(k) ?? { name: m.part_name ?? k, qty: 0 };
      cur.qty += -m.delta;
      used.set(k, cur);
    });
    const topUsed = [...used.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
    return { low, forOrdering, value, pending, openReq, topUsed };
  }, [items, moves, requests]);

  const ordered = partsTickets.filter((t: any) => t.parts_ordered);
  const waiting = partsTickets.filter((t: any) => t.waiting_for_parts && !t.parts_ordered);

  const cards = [
    { label: "Low / out of stock", value: stats.low.length, icon: AlertTriangle, to: "/inventory-management?tab=items" },
    { label: "For ordering", value: stats.forOrdering.length, icon: Package, to: "/inventory-management?tab=items" },
    { label: "Pending approvals", value: stats.pending, icon: ClipboardCheck, to: "/inventory-management?tab=movements" },
    { label: "Open part requests", value: stats.openReq.length, icon: Inbox, to: "/inventory-management?tab=requests" },
    { label: "Tickets: parts ordered", value: ordered.length, icon: Truck, to: "/service-tracker" },
    { label: "Stock value", value: peso(stats.value), icon: Wallet, to: "/inventory-management?tab=items" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <button key={c.label} type="button" onClick={() => navigate(c.to)} className="rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent">
            <c.icon className="mb-1 h-4 w-4 text-muted-foreground" />
            <div className="text-xl font-semibold">{c.value}</div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Reorder Suggestions</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {stats.low.length === 0 && <p className="text-muted-foreground">Nothing is running low.</p>}
            {stats.low.slice(0, 8).map((i) => (
              <div key={i.partId} className="flex justify-between gap-2 border-b py-1 last:border-0">
                <span className="truncate">{i.partName} <span className="text-muted-foreground">{i.model}</span></span>
                <span className="shrink-0 font-mono">{i.quantity} left</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Waiting for parts ({waiting.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {waiting.length === 0 && <p className="text-muted-foreground">No tickets waiting.</p>}
            {waiting.slice(0, 8).map((t: any) => (
              <button key={t.service_id} type="button" onClick={() => navigate(`/manage-client?serviceId=${encodeURIComponent(t.service_id)}`)} className="block w-full border-b py-1 text-left last:border-0 hover:bg-accent">
                <span className="font-mono text-xs">{t.service_id}</span> · {t.client_name} · {t.model}
                {t.waiting_parts_note_tech && <div className="truncate text-xs text-muted-foreground">{t.waiting_parts_note_tech}</div>}
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Most Used</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {stats.topUsed.length === 0 && <p className="text-muted-foreground">No stock used yet.</p>}
            {stats.topUsed.map((u) => (
              <div key={u.name} className="flex justify-between border-b py-1 last:border-0"><span className="truncate">{u.name}</span><span className="font-mono">{u.qty}</span></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Recent Stock Movements</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {moves.length === 0 && <p className="text-muted-foreground">No movements yet.</p>}
            {moves.slice(0, 8).map((m) => (
              <div key={m.id} className="flex justify-between gap-2 border-b py-1 last:border-0">
                <span className="truncate">{TYPE_LABEL[m.movement_type] ?? m.movement_type}: {m.part_name} <span className="text-muted-foreground">· {m.actor_name}</span></span>
                <span className="shrink-0 text-xs text-muted-foreground">{format(new Date(m.created_at), "MM/dd h:mm a")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
