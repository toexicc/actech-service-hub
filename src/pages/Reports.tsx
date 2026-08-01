import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useServices, useCompletedServices } from "@/hooks/useServices";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { classifyStatus } from "@/lib/serviceStatus";
import { parseManilaDate } from "@/lib/timezone";
import {
  BarChart3,
  CheckCircle,
  Clock,
  TrendingUp,
  Wrench,
  Smartphone,
  AlertTriangle,
} from "lucide-react";

type RangeKey = "7" | "30" | "90" | "all";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "all", label: "All time" },
];

const peso = (n: number) =>
  `Php ${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toDate = (raw: any): Date | null => {
  if (!raw) return null;
  const d = typeof raw === "string" && raw.length <= 10 ? parseManilaDate(raw) : new Date(raw);
  return d && !isNaN(d.getTime()) ? d : null;
};

const Reports = () => {
  const [range, setRange] = useState<RangeKey>("30");
  const { data: activeData = [], isLoading: loadingActive } = useServices();
  const { data: completedData = [], isLoading: loadingCompleted } = useCompletedServices();
  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("type, amount, transaction_date")
        .limit(5000);
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        type: t.type,
        amount: Number(t.amount ?? 0),
        transactionDate: t.transaction_date,
      }));
    },
    staleTime: 30 * 1000,
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, expense_date")
        .limit(5000);
      if (error) throw error;
      return (data ?? []).map((e: any) => ({
        amount: Number(e.amount ?? 0),
        expenseDate: e.expense_date,
      }));
    },
    staleTime: 30 * 1000,
  });

  const cutoff = useMemo(() => {
    if (range === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - parseInt(range, 10));
    d.setHours(0, 0, 0, 0);
    return d;
  }, [range]);

  const inRange = (raw: any) => {
    if (!cutoff) return true;
    const d = toDate(raw);
    return !!d && d >= cutoff;
  };

  const report = useMemo(() => {
    const all = [...(activeData as any[]), ...(completedData as any[])];
    const scoped = all.filter((s) => inRange(s.dateReceived || s.createdAt || s.lastUpdated));

    const completed = scoped.filter((s) => classifyStatus(s.status) === "completed");
    const active = scoped.filter((s) => classifyStatus(s.status) === "active");
    const closed = scoped.filter((s) => classifyStatus(s.status) === "closed");

    // Completion rate = completed / (completed + closed + active)
    const completionRate = scoped.length ? (completed.length / scoped.length) * 100 : 0;

    // Average turnaround (days received -> completed)
    const turnarounds: number[] = [];
    completed.forEach((s) => {
      const start = toDate(s.dateReceived || s.createdAt);
      const end = toDate(s.dateCompleted || s.lastUpdated);
      if (start && end && end >= start) {
        turnarounds.push((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }
    });
    const avgTurnaround = turnarounds.length
      ? turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length
      : 0;
    const onTimeCount = completed.filter((s) => {
      const target = toDate(s.targetDate);
      const end = toDate(s.dateCompleted || s.lastUpdated);
      return target && end ? end <= target : false;
    }).length;
    const withTarget = completed.filter((s) => !!toDate(s.targetDate)).length;
    const onTimeRate = withTarget ? (onTimeCount / withTarget) * 100 : 0;

    // Technician leaderboard
    const techMap = new Map<string, { completed: number; active: number; revenue: number; days: number[] }>();
    scoped.forEach((s) => {
      const techs: string[] = Array.isArray(s.technicians) && s.technicians.length
        ? s.technicians
        : String(s.technician || "").split(",");
      techs
        .map((t) => String(t || "").trim())
        .filter(Boolean)
        .forEach((t) => {
          const entry = techMap.get(t) || { completed: 0, active: 0, revenue: 0, days: [] };
          const cls = classifyStatus(s.status);
          if (cls === "completed") {
            entry.completed += 1;
            entry.revenue += Number(s.finalCost || s.totalCost || 0);
            const start = toDate(s.dateReceived || s.createdAt);
            const end = toDate(s.dateCompleted || s.lastUpdated);
            if (start && end && end >= start) entry.days.push((end.getTime() - start.getTime()) / 86400000);
          } else if (cls === "active") {
            entry.active += 1;
          }
          techMap.set(t, entry);
        });
    });
    const technicians = Array.from(techMap.entries())
      .map(([name, v]) => ({
        name,
        completed: v.completed,
        active: v.active,
        revenue: v.revenue,
        avgDays: v.days.length ? v.days.reduce((a, b) => a + b, 0) / v.days.length : 0,
      }))
      .sort((a, b) => b.completed - a.completed || b.revenue - a.revenue);

    // Device mix
    const deviceMap = new Map<string, number>();
    scoped.forEach((s) => {
      const key = String(s.deviceType || "Unspecified").trim() || "Unspecified";
      deviceMap.set(key, (deviceMap.get(key) || 0) + 1);
    });
    const devices = Array.from(deviceMap.entries())
      .map(([name, count]) => ({ name, count, share: scoped.length ? (count / scoped.length) * 100 : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Brand mix
    const brandMap = new Map<string, number>();
    scoped.forEach((s) => {
      const key = String(s.brand || "Unspecified").trim() || "Unspecified";
      brandMap.set(key, (brandMap.get(key) || 0) + 1);
    });
    const brands = Array.from(brandMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Status distribution
    const statusMap = new Map<string, number>();
    scoped.forEach((s) => {
      const key = String(s.status || "Unknown");
      statusMap.set(key, (statusMap.get(key) || 0) + 1);
    });
    const statuses = Array.from(statusMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Money
    const serviceRevenue = completed.reduce((sum, s) => sum + Number(s.finalCost || s.totalCost || 0), 0);
    const partsCost = completed.reduce((sum, s) => sum + Number(s.partsCost || 0), 0);
    const discounts = completed.reduce((sum, s) => sum + Number(s.discount || 0), 0);

    const salesTx = (transactions as any[]).filter(
      (t) => inRange(t.transactionDate || t.date) && String(t.type || "").toLowerCase() !== "expense"
    );
    const txRevenue = salesTx.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const scopedExpenses = (expenses as any[]).filter((e) => inRange(e.expenseDate || e.date));
    const totalExpenses = scopedExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const grossRevenue = txRevenue || serviceRevenue;
    const netRevenue = grossRevenue - totalExpenses - (txRevenue ? 0 : partsCost);
    const avgTicket = completed.length ? serviceRevenue / completed.length : 0;

    return {
      total: scoped.length,
      completed: completed.length,
      active: active.length,
      closed: closed.length,
      completionRate,
      avgTurnaround,
      onTimeRate,
      technicians,
      devices,
      brands,
      statuses,
      serviceRevenue,
      grossRevenue,
      totalExpenses,
      netRevenue,
      partsCost,
      discounts,
      avgTicket,
    };
  }, [activeData, completedData, transactions, expenses, cutoff]);

  const isLoading = loadingActive || loadingCompleted;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Reports &amp; Analytics
            </h1>
            <p className="text-sm text-muted-foreground">
              Operational and financial overview across the whole system.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <Button
                key={r.key}
                size="sm"
                variant={range === r.key ? "default" : "outline"}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Headline metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard
            label="Completion rate"
            value={`${report.completionRate.toFixed(1)}%`}
            tone="success"
            icon={<CheckCircle className="h-5 w-5" />}
          />
          <StatCard
            label="Avg. turnaround"
            value={`${report.avgTurnaround.toFixed(1)} days`}
            tone="primary"
            icon={<Clock className="h-5 w-5" />}
          />
          <StatCard
            label="On-time delivery"
            value={`${report.onTimeRate.toFixed(1)}%`}
            tone="warning"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
          <StatCard
            label="Net revenue"
            value={peso(report.netRevenue)}
            tone="success"
            icon={<TrendingUp className="h-5 w-5" />}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard label="Tickets in range" value={report.total} tone="primary" icon={<Wrench className="h-5 w-5" />} />
          <StatCard label="Completed" value={report.completed} tone="success" icon={<CheckCircle className="h-5 w-5" />} />
          <StatCard label="Still active" value={report.active} tone="warning" icon={<Clock className="h-5 w-5" />} />
          <StatCard label="Cancelled / RTO / On Hold" value={report.closed} tone="destructive" icon={<AlertTriangle className="h-5 w-5" />} />
        </div>

        {/* Financials */}
        <Card className="mb-6 border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl rounded-2xl">
          <CardHeader>
            <CardTitle>Financial summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Gross revenue", value: peso(report.grossRevenue) },
                { label: "Service revenue (completed)", value: peso(report.serviceRevenue) },
                { label: "Average ticket value", value: peso(report.avgTicket) },
                { label: "Parts cost", value: peso(report.partsCost) },
                { label: "Discounts given", value: peso(report.discounts) },
                { label: "Expenses", value: peso(report.totalExpenses) },
              ].map((row) => (
                <div key={row.label} className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{row.label}</p>
                  <p className="text-lg font-semibold mt-1">{row.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Technician leaderboard */}
          <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl rounded-2xl">
            <CardHeader>
              <CardTitle>Top technicians</CardTitle>
            </CardHeader>
            <CardContent>
              {report.technicians.length === 0 ? (
                <p className="text-sm text-muted-foreground">No technician activity in this range.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Technician</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">Active</TableHead>
                      <TableHead className="text-right">Avg. days</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.technicians.slice(0, 10).map((t) => (
                      <TableRow key={t.name}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-right">{t.completed}</TableCell>
                        <TableCell className="text-right">{t.active}</TableCell>
                        <TableCell className="text-right">{t.avgDays ? t.avgDays.toFixed(1) : "—"}</TableCell>
                        <TableCell className="text-right">{peso(t.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Device mix */}
          <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" /> Devices serviced
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.devices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No devices in this range.</p>
              ) : (
                report.devices.map((d) => (
                  <div key={d.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{d.name}</span>
                      <span className="text-muted-foreground">
                        {d.count} · {d.share.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={d.share} className="h-2" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Brands */}
          <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl rounded-2xl">
            <CardHeader>
              <CardTitle>Top brands</CardTitle>
            </CardHeader>
            <CardContent>
              {report.brands.length === 0 ? (
                <p className="text-sm text-muted-foreground">No brand data in this range.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {report.brands.map((b) => (
                    <span
                      key={b.name}
                      className="rounded-full border border-border/60 px-3 py-1 text-sm"
                    >
                      {b.name} <span className="text-muted-foreground">· {b.count}</span>
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status distribution */}
          <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl rounded-2xl">
            <CardHeader>
              <CardTitle>Where tickets are now</CardTitle>
            </CardHeader>
            <CardContent>
              {report.statuses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
              ) : (
                <div className="space-y-2">
                  {report.statuses.map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-sm">
                      <span>{s.name}</span>
                      <span className="font-semibold">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {isLoading && (
          <p className="text-sm text-muted-foreground mt-6">Loading the latest records…</p>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Reports;
