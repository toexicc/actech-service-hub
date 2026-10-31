import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACTION_LABEL, PickupAction } from "@/lib/pickupLog";

const fmt = (iso: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.month}/${p.day}/${p.year} - ${p.hour === "24" ? "00" : p.hour}:${p.minute}:${p.second}`;
};

interface Row { id: string; created_at: string; actor_name: string | null; action: string; entity_id: string | null; changes: Record<string, unknown> | null }

const detail = (r: Row) => {
  const c = r.changes || {};
  const parts: string[] = [];
  if (c.client_name) parts.push(String(c.client_name));
  if (c.date) parts.push(String(c.date));
  if (c.from && c.to) parts.push(`${c.from} → ${c.to}`);
  if (c.reason) parts.push(`Reason: ${c.reason}`);
  if (c.cost !== undefined && c.cost !== null) parts.push(`Cost ₱${Number(c.cost).toLocaleString()}`);
  if (Array.isArray(c.fields)) parts.push(`Changed: ${(c.fields as string[]).join(", ")}`);
  return parts.join(" · ");
};

export const PickupLogs = () => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [action, setAction] = useState("all");
  const [who, setWho] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pickup_logs", from, to],
    queryFn: async () => {
      let qq = supabase.from("activity_logs").select("id,created_at,actor_name,action,entity_id,changes").eq("entity_type", "pickup").order("created_at", { ascending: false }).limit(1000);
      if (from) qq = qq.gte("created_at", `${from}T00:00:00+08:00`);
      if (to) qq = qq.lte("created_at", `${to}T23:59:59+08:00`);
      const { data, error } = await qq;
      if (error) throw error;
      return (data || []) as Row[];
    },
    staleTime: 30_000,
  });

  const people = useMemo(() => [...new Set(rows.map((r) => r.actor_name).filter(Boolean))] as string[], [rows]);
  const filtered = rows.filter((r) =>
    (action === "all" || r.action === action) && (who === "all" || r.actor_name === who) &&
    (!q || `${r.actor_name} ${detail(r)}`.toLowerCase().includes(q.toLowerCase())));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const shown = filtered.slice(page * 10, page * 10 + 10);

  return (
    <Card><CardContent className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input className="w-full sm:w-64" placeholder="Search logs…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <Input type="date" className="w-40" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
        <Input type="date" className="w-40" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
        <Select value={action} onValueChange={(v) => { setAction(v); setPage(0); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All actions</SelectItem>{Object.entries(ACTION_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={who} onValueChange={(v) => { setWho(v); setPage(0); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Everyone</SelectItem>{people.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">When</th><th className="pr-3">Who</th><th className="pr-3">Action</th><th>Details</th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} className="py-4 text-muted-foreground">Loading…</td></tr>}
            {!isLoading && shown.length === 0 && <tr><td colSpan={4} className="py-4 text-muted-foreground">No logs yet.</td></tr>}
            {shown.map((r) => (
              <tr key={r.id} className="border-b last:border-0 align-top">
                <td className="py-2 pr-3 whitespace-nowrap">{fmt(r.created_at)}</td>
                <td className="pr-3">{r.actor_name || "—"}</td>
                <td className="pr-3 whitespace-nowrap">{ACTION_LABEL[r.action as PickupAction] || r.action}</td>
                <td>{detail(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2 text-sm">
        <span className="text-muted-foreground">Page {page + 1} of {pages}</span>
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
        <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
    </CardContent></Card>
  );
};
