import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { useServices, type ServiceRecord } from "@/hooks/useServices";
import { useWorkbench } from "@/components/workbench/WorkbenchContext";
import { useNavigate } from "react-router-dom";
import { format, startOfDay } from "date-fns";
import { CalendarDays, ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const parseTargetDate = (raw: string | undefined): Date | null => {
  if (!raw) return null;
  // Accept "MM/DD/YYYY", "M/D/YYYY", "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [y, m, d] = raw.slice(0, 10).split("-").map((n) => parseInt(n, 10));
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }
  const parts = raw.split(/[-/]/);
  if (parts.length < 3) return null;
  const [mm, dd, yy] = parts.map((n) => parseInt(n, 10));
  if (!mm || !dd || !yy) return null;
  const dt = new Date(yy, mm - 1, dd);
  dt.setHours(0, 0, 0, 0);
  return dt;
};

interface Props {
  role?: string | null;
  userFullName?: string;
}

export const DueDateCalendar = ({ role, userFullName }: Props) => {
  const navigate = useNavigate();
  const { openTab } = useWorkbench();
  const { data: allServices = [] } = useServices();
  const [selected, setSelected] = useState<Date>(startOfDay(new Date()));

  const isTechnician = role === "technician";

  const services = useMemo(() => {
    const active = allServices.filter((s: ServiceRecord) => {
      const st = (s.status || "").toLowerCase();
      return !st.includes("completed") && !st.includes("cancelled");
    });
    return isTechnician && userFullName
      ? active.filter((s) => s.technician === userFullName)
      : active;
  }, [allServices, isTechnician, userFullName]);

  // Map date -> services list
  const dueMap = useMemo(() => {
    const map = new Map<string, ServiceRecord[]>();
    for (const s of services) {
      const dt = parseTargetDate(s.targetDate);
      if (!dt) continue;
      const key = format(dt, "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [services]);

  const dueDates = useMemo(() => {
    return Array.from(dueMap.keys()).map((k) => {
      const [y, m, d] = k.split("-").map((n) => parseInt(n, 10));
      return new Date(y, m - 1, d);
    });
  }, [dueMap]);

  const selectedKey = format(selected, "yyyy-MM-dd");
  const dueOnSelected = dueMap.get(selectedKey) ?? [];

  const handleOpen = (s: ServiceRecord) => {
    const path = isTechnician
      ? `/service-update?serviceId=${encodeURIComponent(s.serviceId)}`
      : `/manage-client?serviceId=${encodeURIComponent(s.serviceId)}`;
    openTab({
      id: `service:${s.serviceId}`,
      title: s.serviceId,
      subtitle: s.clientName,
      path,
      iconName: "FileText",
    });
    navigate(path);
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Service calendar
        </h2>
        <span className="text-xs text-muted-foreground">
          {services.length} active {services.length === 1 ? "ticket" : "tickets"}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[70%_30%] gap-4 glass-panel rounded-2xl p-4">
        <div className="w-full min-w-0">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => d && setSelected(startOfDay(d))}
            modifiers={{ due: dueDates }}
            modifiersClassNames={{
              due: "relative after:content-[''] after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:h-1.5 after:w-1.5 after:rounded-full after:bg-primary",
            }}
            classNames={{
              months: "flex flex-col space-y-4 w-full",
              month: "space-y-4 w-full",
              caption: "flex justify-center pt-1 relative items-center h-9",
              caption_label: "text-lg font-semibold",
              nav_button: cn(buttonVariants({ variant: "outline" }), "h-8 w-8 bg-transparent p-0 opacity-60 hover:opacity-100 rounded-full"),
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse",
              head_row: "flex w-full",
              row: "flex w-full mt-2",
              head_cell: "text-muted-foreground rounded-md h-9 flex-1 font-normal text-sm flex items-center justify-center",
              cell: "h-10 lg:h-11 flex-1 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
              day: cn(buttonVariants({ variant: "ghost" }), "h-10 lg:h-11 w-full p-0 text-sm font-normal aria-selected:opacity-100 rounded-xl"),
            }}
            className="pointer-events-auto w-full rounded-xl border bg-card p-4"
          />
        </div>
        <div className="min-w-0 flex flex-col h-full">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">
              {format(selected, "EEEE, MMMM d")}
            </h3>
            <span className="text-xs text-muted-foreground">
              {dueOnSelected.length} due
            </span>
          </div>
          {dueOnSelected.length === 0 ? (
            <div className="flex-1 min-h-[220px] rounded-xl border border-dashed p-6 flex items-center justify-center text-center text-sm text-muted-foreground">
              No services due on this day.
            </div>
          ) : (
            <ul className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {dueOnSelected.map((s) => (
                <li key={s.serviceId}>
                  <button
                    onClick={() => handleOpen(s)}
                    className="w-full text-left rounded-xl border bg-card hover:bg-muted/40 transition-colors p-3 flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">{s.serviceId}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {s.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {s.clientName}
                        {s.deviceBrand || s.deviceModel
                          ? ` · ${[s.deviceBrand, s.deviceModel].filter(Boolean).join(" ")}`
                          : s.deviceType
                          ? ` · ${s.deviceType}`
                          : ""}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-primary shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};

export default DueDateCalendar;
