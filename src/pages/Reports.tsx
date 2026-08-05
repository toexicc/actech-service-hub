import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServices, useCompletedServices } from "@/hooks/useServices";
import { useClosedDates } from "@/hooks/useClosedDates";
import { useServiceStatusLogs } from "@/hooks/useServiceStatusLogs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { classifyStatus } from "@/lib/serviceStatus";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  BarChart3,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Wrench,
  Smartphone,
  AlertTriangle,
  CalendarIcon,
  Users,
  Receipt,
} from "lucide-react";
import {
  Period,
  monthPeriod,
  lastMonths,
  previousPeriod,
  inPeriod,
  toDate,
  peso,
  compactPeso,
  formatHours,
  pct,
  delta,
  pickBucketMode,
  bucketKey,
  bucketLabel,
  buildTimings,
  bucketTurnaround,
  avg,
  startOfDay,
  endOfDay,
} from "@/lib/reportMetrics";

type FilterMode = "month" | "range" | "preset";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--info))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--accent-foreground))",
  "hsl(var(--muted-foreground))",
];

const axisProps = {
  stroke: "hsl(var(--muted-foreground))",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
};

const Panel = ({
  title,
  icon,
  hint,
  className,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <Card className={cn("border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl rounded-2xl", className)}>
    <CardHeader className="pb-2">
      <CardTitle className="flex items-center gap-2 text-base">
        {icon}
        {title}
      </CardTitle>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const KpiCard = ({
  label,
  value,
  sub,
  change,
  tone = "primary",
  icon,
  invert,
}: {
  label: string;
  value: string;
  sub?: string;
  change?: number | null;
  tone?: string;
  icon?: React.ReactNode;
  invert?: boolean;
}) => {
  const good = change === null || change === undefined ? null : invert ? change <= 0 : change >= 0;
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
          <div className="mt-1 flex items-center gap-2">
            {change !== null && change !== undefined && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-semibold",
                  good ? "text-success" : "text-destructive",
                )}
              >
                {good ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(change).toFixed(1)}%
              </span>
            )}
            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
          </div>
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              tone === "success" && "bg-success/10 text-success",
              tone === "warning" && "bg-warning/10 text-warning",
              tone === "destructive" && "bg-destructive/10 text-destructive",
              tone === "info" && "bg-info/10 text-info",
              tone === "primary" && "bg-primary/10 text-primary",
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

const Reports = () => {
  const months = useMemo(() => lastMonths(12), []);
  const [mode, setMode] = useState<FilterMode>("month");
  const [monthKey, setMonthKey] = useState(`${months[0].year}-${months[0].month}`);
  const [preset, setPreset] = useState<"7" | "30" | "90" | "year" | "all">("30");
  const [rangeFrom, setRangeFrom] = useState<Date | undefined>();
  const [rangeTo, setRangeTo] = useState<Date | undefined>();

  const { data: activeData = [], isLoading: loadingActive } = useServices();
  const { data: completedData = [], isLoading: loadingCompleted } = useCompletedServices();
  const { data: statusLogs = [], isLoading: loadingLogs } = useServiceStatusLogs();

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", "reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("type, amount, category, status, payment_method, transaction_date")
        .limit(5000);
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        type: t.type,
        amount: Number(t.amount ?? 0),
        category: t.category ?? "",
        status: t.status ?? "",
        paymentMethod: t.payment_method ?? "",
        transactionDate: t.transaction_date,
      }));
    },
    staleTime: 30 * 1000,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", "reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, category, expense_date")
        .limit(5000);
      if (error) throw error;
      return (data ?? []).map((e: any) => ({
        amount: Number(e.amount ?? 0),
        category: e.category ?? "Uncategorized",
        expenseDate: e.expense_date,
      }));
    },
    staleTime: 30 * 1000,
  });

  const period: Period = useMemo(() => {
    if (mode === "month") {
      const [y, m] = monthKey.split("-").map((n) => parseInt(n, 10));
      return monthPeriod(y, m);
    }
    if (mode === "range") {
      if (rangeFrom && rangeTo) {
        return {
          start: startOfDay(rangeFrom),
          end: endOfDay(rangeTo),
          label: `${rangeFrom.toLocaleDateString("en-US")} – ${rangeTo.toLocaleDateString("en-US")}`,
        };
      }
      return { start: null, end: null, label: "Pick a date range" };
    }
    if (preset === "all") return { start: null, end: null, label: "All time" };
    if (preset === "year") {
      const now = new Date();
      return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(now), label: `${now.getFullYear()}` };
    }
    const now = new Date();
    const start = new Date();
    start.setDate(start.getDate() - parseInt(preset, 10));
    return { start: startOfDay(start), end: endOfDay(now), label: `Last ${preset} days` };
  }, [mode, monthKey, preset, rangeFrom, rangeTo]);

  const allServices = useMemo(
    () => [...(activeData as any[]), ...(completedData as any[])],
    [activeData, completedData],
  );

  // Durations count working time only (10:00-19:00 Manila minus a 1.5h break),
  // and skip days the shop was closed.
  const closedDayKeys = useMemo(
    () => (closedDates ?? []).map((c) => String(c.startDate).slice(0, 10)).filter(Boolean),
    [closedDates],
  );

  const timings = useMemo(
    () => buildTimings(allServices, statusLogs as any[], closedDayKeys),
    [allServices, statusLogs, closedDayKeys],
  );


  const buildReport = (p: Period) => {
    const scoped = allServices.filter((s) => inPeriod(s.dateReceived || s.timestamp || s.lastUpdated, p));
    const completed = scoped.filter((s) => classifyStatus(s.status) === "completed");
    const active = scoped.filter((s) => classifyStatus(s.status) === "active");
    const closed = scoped.filter((s) => classifyStatus(s.status) === "closed");

    const turnaroundHours = completed
      .map((s) => timings.get(String(s.serviceId))?.totalHours)
      .filter((h): h is number => typeof h === "number" && h > 0);
    const logBacked = completed.filter((s) => timings.get(String(s.serviceId))?.fromLogs).length;

    const salesTx = (transactions as any[]).filter(
      (t) =>
        inPeriod(t.transactionDate, p) &&
        String(t.type || "").toLowerCase() !== "expense" &&
        String(t.status || "").toLowerCase() !== "void" &&
        String(t.status || "").toLowerCase() !== "voided",
    );
    const txRevenue = salesTx.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const scopedExpenses = (expenses as any[]).filter((e) => inPeriod(e.expenseDate, p));
    const totalExpenses = scopedExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const serviceRevenue = completed.reduce((sum, s) => sum + Number(s.finalCost || s.totalCost || 0), 0);
    const partsCost = completed.reduce((sum, s) => sum + Number(s.partsCost || 0), 0);
    const discounts = completed.reduce((sum, s) => sum + Number(s.discount || 0), 0);
    const grossRevenue = txRevenue || serviceRevenue;
    const netRevenue = grossRevenue - totalExpenses - (txRevenue ? 0 : partsCost);

    const onTimeCount = completed.filter((s) => {
      const target = toDate(s.targetDate);
      const end = toDate(s.dateCompleted || s.lastUpdated);
      return target && end ? end <= target : false;
    }).length;
    const withTarget = completed.filter((s) => !!toDate(s.targetDate)).length;

    return {
      scoped,
      completed,
      active,
      closed,
      salesTx,
      scopedExpenses,
      completionRate: scoped.length ? (completed.length / scoped.length) * 100 : 0,
      avgTurnaround: avg(turnaroundHours),
      turnaroundHours,
      logBacked,
      onTimeRate: withTarget ? (onTimeCount / withTarget) * 100 : 0,
      serviceRevenue,
      grossRevenue,
      partsCost,
      discounts,
      totalExpenses,
      netRevenue,
      avgTicket: completed.length ? serviceRevenue / completed.length : 0,
    };
  };

  const report = useMemo(
    () => buildReport(period),
    [period, allServices, timings, transactions, expenses],
  );
  const prev = useMemo(() => {
    const pp = previousPeriod(period);
    return pp ? buildReport(pp) : null;
  }, [period, allServices, timings, transactions, expenses]);

  /* ---------------- derived chart datasets ---------------- */

  const trend = useMemo(() => {
    const fallback = report.scoped.map((s) => toDate(s.dateReceived || s.timestamp)).filter(Boolean) as Date[];
    const bmode = pickBucketMode(period, fallback);
    const map = new Map<string, { received: number; completed: number; revenue: number }>();
    const touch = (key: string) => {
      if (!map.has(key)) map.set(key, { received: 0, completed: 0, revenue: 0 });
      return map.get(key)!;
    };
    report.scoped.forEach((s) => {
      const d = toDate(s.dateReceived || s.timestamp);
      if (d) touch(bucketKey(d, bmode)).received += 1;
    });
    report.completed.forEach((s) => {
      const d = toDate(s.dateCompleted || s.lastUpdated);
      if (d) touch(bucketKey(d, bmode)).completed += 1;
    });
    report.salesTx.forEach((t: any) => {
      const d = toDate(t.transactionDate);
      if (d) touch(bucketKey(d, bmode)).revenue += Number(t.amount || 0);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => ({ name: bucketLabel(key, bmode), ...v }));
  }, [report, period]);

  const financeTrend = useMemo(() => {
    const fallback = report.salesTx.map((t: any) => toDate(t.transactionDate)).filter(Boolean) as Date[];
    const bmode = pickBucketMode(period, fallback);
    const map = new Map<string, { revenue: number; expenses: number }>();
    const touch = (key: string) => {
      if (!map.has(key)) map.set(key, { revenue: 0, expenses: 0 });
      return map.get(key)!;
    };
    report.salesTx.forEach((t: any) => {
      const d = toDate(t.transactionDate);
      if (d) touch(bucketKey(d, bmode)).revenue += Number(t.amount || 0);
    });
    report.scopedExpenses.forEach((e: any) => {
      const d = toDate(e.expenseDate);
      if (d) touch(bucketKey(d, bmode)).expenses += Number(e.amount || 0);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => ({ name: bucketLabel(key, bmode), ...v, net: v.revenue - v.expenses }));
  }, [report, period]);

  const stageHours = useMemo(() => {
    const totals = new Map<string, number[]>();
    report.scoped.forEach((s) => {
      const t = timings.get(String(s.serviceId));
      if (!t) return;
      Object.entries(t.stageHours).forEach(([stage, hrs]) => {
        const arr = totals.get(stage) || [];
        arr.push(hrs);
        totals.set(stage, arr);
      });
    });
    return Array.from(totals.entries())
      .filter(([stage]) => classifyStatus(stage) !== "completed")
      .map(([stage, list]) => ({ stage, hours: avg(list), tickets: list.length }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8);
  }, [report, timings]);

  const turnaroundDist = useMemo(() => bucketTurnaround(report.turnaroundHours), [report]);

  const technicians = useMemo(() => {
    const map = new Map<string, { completed: number; active: number; revenue: number; hours: number[]; onTime: number; withTarget: number }>();
    report.scoped.forEach((s) => {
      const techs = String(s.technician || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      techs.forEach((t) => {
        const e = map.get(t) || { completed: 0, active: 0, revenue: 0, hours: [], onTime: 0, withTarget: 0 };
        const cls = classifyStatus(s.status);
        if (cls === "completed") {
          e.completed += 1;
          e.revenue += Number(s.finalCost || s.totalCost || 0);
          const hrs = timings.get(String(s.serviceId))?.totalHours;
          if (typeof hrs === "number" && hrs > 0) e.hours.push(hrs);
          const target = toDate(s.targetDate);
          const end = toDate(s.dateCompleted || s.lastUpdated);
          if (target) {
            e.withTarget += 1;
            if (end && end <= target) e.onTime += 1;
          }
        } else if (cls === "active") {
          e.active += 1;
        }
        map.set(t, e);
      });
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        completed: v.completed,
        active: v.active,
        revenue: v.revenue,
        avgHours: avg(v.hours),
        onTime: v.withTarget ? (v.onTime / v.withTarget) * 100 : 0,
      }))
      .sort((a, b) => b.completed - a.completed || b.revenue - a.revenue);
  }, [report, timings]);

  const countBy = (list: any[], get: (s: any) => string, limit = 8) => {
    const map = new Map<string, number>();
    list.forEach((s) => {
      const key = (get(s) || "Unspecified").trim() || "Unspecified";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count, share: list.length ? (count / list.length) * 100 : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  };

  const devices = useMemo(() => countBy(report.scoped, (s) => s.deviceType), [report]);
  const brands = useMemo(() => countBy(report.scoped, (s) => s.brand), [report]);
  const statuses = useMemo(() => countBy(report.scoped, (s) => s.status, 20), [report]);
  const priorities = useMemo(() => countBy(report.scoped, (s) => s.priority, 6), [report]);
  const sources = useMemo(() => countBy(report.scoped, (s) => s.source || "Walk In", 6), [report]);
  const expenseMix = useMemo(() => {
    const map = new Map<string, number>();
    report.scopedExpenses.forEach((e: any) => {
      const key = (e.category || "Uncategorized").trim() || "Uncategorized";
      map.set(key, (map.get(key) || 0) + Number(e.amount || 0));
    });
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [report]);

  const intakeByHour = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    report.scoped.forEach((s) => {
      const d = toDate(s.dateReceived || s.timestamp);
      if (d) buckets[d.getHours()].count += 1;
    });
    return buckets.filter((b) => b.hour >= 6 && b.hour <= 22);
  }, [report]);

  const isLoading = loadingActive || loadingCompleted || loadingLogs;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <BarChart3 className="h-6 w-6 text-primary" />
              Reports &amp; Analytics
            </h1>
            <p className="text-sm text-muted-foreground">
              {period.label}
              {prev ? " · compared with the preceding period" : ""}
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={mode === "month" ? monthKey : "__other"}
              onValueChange={(v) => {
                if (v !== "__other") {
                  setMonthKey(v);
                  setMode("month");
                }
              }}
            >
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant={mode === "range" ? "default" : "outline"} size="sm" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {mode === "range" && rangeFrom && rangeTo ? period.label : "Date range"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: rangeFrom, to: rangeTo }}
                  onSelect={(r: any) => {
                    setRangeFrom(r?.from);
                    setRangeTo(r?.to);
                    setMode("range");
                  }}
                  numberOfMonths={2}
                  className="pointer-events-auto p-3"
                />
              </PopoverContent>
            </Popover>

            <div className="flex flex-wrap gap-1">
              {([
                { k: "7", l: "7d" },
                { k: "30", l: "30d" },
                { k: "90", l: "90d" },
                { k: "year", l: "YTD" },
                { k: "all", l: "All" },
              ] as const).map((p) => (
                <Button
                  key={p.k}
                  size="sm"
                  variant={mode === "preset" && preset === p.k ? "default" : "outline"}
                  onClick={() => {
                    setPreset(p.k as any);
                    setMode("preset");
                  }}
                >
                  {p.l}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Tickets"
            value={String(report.scoped.length)}
            change={prev ? delta(report.scoped.length, prev.scoped.length) : null}
            icon={<Wrench className="h-5 w-5" />}
          />
          <KpiCard
            label="Completion rate"
            value={pct(report.completionRate)}
            sub={`${report.completed.length} done`}
            change={prev ? delta(report.completionRate, prev.completionRate) : null}
            tone="success"
            icon={<CheckCircle className="h-5 w-5" />}
          />
          <KpiCard
            label="Avg. turnaround"
            value={formatHours(report.avgTurnaround)}
            sub={`${report.logBacked}/${report.completed.length} from logs`}
            change={prev ? delta(report.avgTurnaround, prev.avgTurnaround) : null}
            invert
            tone="info"
            icon={<Clock className="h-5 w-5" />}
          />
          <KpiCard
            label="On-time delivery"
            value={pct(report.onTimeRate)}
            change={prev ? delta(report.onTimeRate, prev.onTimeRate) : null}
            tone="warning"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
          <KpiCard
            label="Net revenue"
            value={peso(report.netRevenue)}
            change={prev ? delta(report.netRevenue, prev.netRevenue) : null}
            tone="success"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <KpiCard
            label="Avg. ticket value"
            value={peso(report.avgTicket)}
            change={prev ? delta(report.avgTicket, prev.avgTicket) : null}
            tone="primary"
            icon={<Receipt className="h-5 w-5" />}
          />
        </div>

        {/* Volume & revenue */}
        <Panel
          title="Ticket volume vs revenue"
          icon={<BarChart3 className="h-4 w-4" />}
          hint="Tickets received and completed per period, with collected revenue overlaid."
          className="mb-6"
        >
          <div className="h-[320px]">
            {trend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity in this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" {...axisProps} />
                  <YAxis yAxisId="left" {...axisProps} allowDecimals={false} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    {...axisProps}
                    tickFormatter={(v) => compactPeso(v as number)}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: any, n: any) => (n === "revenue" ? peso(v) : v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="received" name="Received" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="completed" name="Completed" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="hsl(var(--info))"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        {/* Turnaround */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Panel
            title="Where time is spent (avg. hours per stage)"
            icon={<Clock className="h-4 w-4" />}
            hint="Derived from status-change activity logs."
          >
            <div className="h-[300px]">
              {stageHours.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not enough log history yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageHours} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" {...axisProps} tickFormatter={(v) => `${Number(v).toFixed(1)}h`} />
                    <YAxis type="category" dataKey="stage" {...axisProps} width={150} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => formatHours(v)} />
                    <Bar dataKey="hours" name="Avg. hours" fill="hsl(var(--info))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          <Panel title="Turnaround distribution" icon={<Clock className="h-4 w-4" />} hint="Completed tickets grouped by total time to completion.">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={turnaroundDist}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" name="Tickets" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Fastest {formatHours(Math.min(...(report.turnaroundHours.length ? report.turnaroundHours : [0])))} · slowest{" "}
              {formatHours(Math.max(...(report.turnaroundHours.length ? report.turnaroundHours : [0])))}
            </p>
          </Panel>
        </div>

        {/* Financials */}
        <Panel
          title="Revenue, expenses & net profit"
          icon={<TrendingUp className="h-4 w-4" />}
          className="mb-6"
        >
          <div className="h-[300px]">
            {financeTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No financial activity in this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={financeTrend}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={(v) => compactPeso(v as number)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => peso(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="hsl(var(--success))"
                    fill="url(#revFill)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name="Expenses"
                    stroke="hsl(var(--destructive))"
                    fill="url(#expFill)"
                    strokeWidth={2}
                  />
                  <Line type="monotone" dataKey="net" name="Net" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Gross revenue", value: peso(report.grossRevenue) },
              { label: "Service revenue (completed)", value: peso(report.serviceRevenue) },
              { label: "Parts cost", value: peso(report.partsCost) },
              { label: "Discounts given", value: peso(report.discounts) },
              { label: "Expenses", value: peso(report.totalExpenses) },
              { label: "Net revenue", value: peso(report.netRevenue) },
            ].map((row) => (
              <div key={row.label} className="rounded-xl border border-border/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{row.label}</p>
                <p className="mt-1 text-lg font-semibold">{row.value}</p>
              </div>
            ))}
          </div>
        </Panel>

        {/* Technicians */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Technician output" icon={<Users className="h-4 w-4" />}>
            <div className="h-[300px]">
              {technicians.length === 0 ? (
                <p className="text-sm text-muted-foreground">No technician activity in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={technicians.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" {...axisProps} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" {...axisProps} width={130} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="completed" name="Completed" stackId="a" fill="hsl(var(--success))" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="active" name="Active" stackId="a" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          <Panel title="Technician leaderboard" icon={<Users className="h-4 w-4" />}>
            {technicians.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Technician</TableHead>
                      <TableHead className="text-right">Done</TableHead>
                      <TableHead className="text-right">Active</TableHead>
                      <TableHead className="text-right">Avg. time</TableHead>
                      <TableHead className="text-right">On-time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {technicians.slice(0, 10).map((t) => (
                      <TableRow key={t.name}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-right">{t.completed}</TableCell>
                        <TableCell className="text-right">{t.active}</TableCell>
                        <TableCell className="text-right">{formatHours(t.avgHours)}</TableCell>
                        <TableCell className="text-right">{t.completed ? pct(t.onTime) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Panel>
        </div>

        {/* Mix */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Devices serviced" icon={<Smartphone className="h-4 w-4" />}>
            <div className="h-[300px]">
              {devices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No devices in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={devices}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={65}
                      outerRadius={105}
                      paddingAngle={2}
                    >
                      {devices.map((d, i) => (
                        <Cell key={d.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          <Panel title="Top brands" icon={<Smartphone className="h-4 w-4" />}>
            <div className="h-[300px]">
              {brands.length === 0 ? (
                <p className="text-sm text-muted-foreground">No brand data in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={brands}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" {...axisProps} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis {...axisProps} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" name="Tickets" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>
        </div>

        {/* Funnel + operational */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Where tickets are now" icon={<Wrench className="h-4 w-4" />}>
            {statuses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
            ) : (
              <div className="space-y-3">
                {statuses.map((s) => (
                  <div key={s.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground">
                        {s.count} · {s.share.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={s.share} className="h-2" />
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Operational mix" icon={<BarChart3 className="h-4 w-4" />}>
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Priority</p>
                <div className="flex flex-wrap gap-2">
                  {priorities.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No data</span>
                  ) : (
                    priorities.map((p) => (
                      <Badge key={p.name} variant="outline" className="rounded-full">
                        {p.name} · {p.count}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Intake source</p>
                <div className="flex flex-wrap gap-2">
                  {sources.map((p) => (
                    <Badge key={p.name} variant="secondary" className="rounded-full">
                      {p.name} · {p.count}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Busiest intake hours</p>
                <div className="h-[150px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={intakeByHour}>
                      <XAxis dataKey="hour" {...axisProps} tickFormatter={(h) => `${h}:00`} interval={2} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={(h) => `${h}:00`} />
                      <Bar dataKey="count" name="Tickets" fill="hsl(var(--info))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {expenseMix.length > 0 && (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Top expense categories</p>
                  <div className="space-y-1">
                    {expenseMix.map((e) => (
                      <div key={e.name} className="flex items-center justify-between text-sm">
                        <span>{e.name}</span>
                        <span className="font-semibold">{peso(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </div>

        {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading the latest records…</p>}
      </div>
    </DashboardLayout>
  );
};

export default Reports;
