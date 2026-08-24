import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Home, FileText, Users, ClipboardList, Package, ShoppingCart, DollarSign,
  UserCog, LayoutDashboard, Wrench, Monitor, Search, Clock, Settings,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { useWorkbench } from "@/components/workbench/WorkbenchContext";
import { fetchStaffList } from "@/lib/staffList";

interface Result {
  id: string;
  label: string;
  sub?: string;
  kind: "service" | "customer" | "part" | "staff" | "page";
  path: string;
  iconName?: string;
}

const PAGES: Array<{ label: string; path: string; roles?: string[]; iconName: string }> = [
  { label: "Dashboard", path: "/menu", iconName: "Home" },
  { label: "Point of Sales", path: "/pos", roles: ["management", "admin"], iconName: "ShoppingCart" },
  { label: "Client Intake Form", path: "/service-form", iconName: "FileText" },
  { label: "Manage Client", path: "/manage-client", iconName: "Users" },
  { label: "Customer Management", path: "/customer-management", iconName: "UserCog" },
  { label: "Service Tracker", path: "/service-tracker", iconName: "ClipboardList" },
  { label: "Inventory Management", path: "/inventory-management", roles: ["management", "admin"], iconName: "Package" },
  { label: "Completed Services", path: "/completed-transactions", roles: ["management"], iconName: "DollarSign" },
  { label: "Transaction Tracker", path: "/pos", roles: ["management"], iconName: "DollarSign" },
  { label: "Salary Disbursement", path: "/salary-disbursement", roles: ["management"], iconName: "DollarSign" },
  { label: "Staff Management", path: "/staff-management", roles: ["management"], iconName: "Settings" },
  { label: "Attendance", path: "/attendance-overview", roles: ["management"], iconName: "Clock" },
  { label: "Service Update", path: "/service-update", iconName: "Wrench" },
  { label: "Tech Dashboard", path: "/tech-dashboard", roles: ["management"], iconName: "Monitor" },
  { label: "Request for Parts", path: "/request-for-parts", iconName: "ShoppingCart" },
];

const ICONS: Record<string, any> = {
  Home, FileText, Users, ClipboardList, Package, ShoppingCart, DollarSign,
  UserCog, LayoutDashboard, Wrench, Monitor, Clock, Settings,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 200);
  const [remote, setRemote] = useState<Result[]>([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const { openTab } = useWorkbench();
  const userRole = (typeof window !== "undefined" && sessionStorage.getItem("userRole")) || "";

  const pageResults: Result[] = useMemo(() => {
    const list = PAGES.filter((p) => !p.roles || p.roles.includes(userRole || "")).map((p, i) => ({
      id: `page-${i}`,
      label: p.label,
      kind: "page" as const,
      path: p.path,
      iconName: p.iconName,
    }));
    if (!debounced) return list;
    const q = debounced.toLowerCase();
    return list.filter((r) => r.label.toLowerCase().includes(q));
  }, [debounced, userRole]);

  useEffect(() => {
    if (!open || !debounced || debounced.length < 2) {
      setRemote([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    const q = debounced.trim();
    const like = `%${q}%`;
    setSearching(true);

    const runServices = async (): Promise<Result[]> => {
      try {
        const { data } = await supabase.from("services")
          .select("service_id,client_name,device_type,brand,model,status,contact_number")
          .or(`service_id.ilike.${like},client_name.ilike.${like},model.ilike.${like},brand.ilike.${like},device_type.ilike.${like},contact_number.ilike.${like}`)
          .limit(8);
        return (data || []).map((s: any) => ({
          id: `svc-${s.service_id}`,
          label: s.service_id,
          sub: `${s.client_name || ""} · ${[s.brand, s.model].filter(Boolean).join(" ") || s.device_type || ""}${s.status ? " · " + s.status : ""}`,
          kind: "service",
          path: `/manage-client?serviceId=${encodeURIComponent(s.service_id)}`,
        }));
      } catch { return []; }
    };

    const runCustomers = async (): Promise<Result[]> => {
      try {
        const { data } = await supabase.from("clients")
          .select("id,client_id,name,contact_number,email")
          .or(`name.ilike.${like},contact_number.ilike.${like},email.ilike.${like},client_id.ilike.${like}`)
          .limit(6);
        return (data || []).map((c: any) => ({
          id: `cus-${c.id}`,
          label: c.name || c.client_id,
          sub: `${c.client_id || ""}${c.contact_number ? " · " + c.contact_number : ""}`,
          kind: "customer",
          path: `/customer-management?clientId=${encodeURIComponent(c.client_id || c.id)}`,
        }));
      } catch { return []; }
    };

    const runParts = async (): Promise<Result[]> => {
      const results: Result[] = [];
      try {
        const { data } = await supabase.from("inventory_parts")
          .select("id,part_id,part_name,brand,device_model")
          .or(`part_id.ilike.${like},part_name.ilike.${like},brand.ilike.${like},device_model.ilike.${like}`)
          .limit(6);
        (data || []).forEach((p: any) => results.push({
          id: `part-${p.id}`,
          label: p.part_name || p.part_id,
          sub: `${p.part_id || ""}${p.brand ? " · " + p.brand : ""}${p.device_model ? " · " + p.device_model : ""}`,
          kind: "part",
          path: `/inventory-management?partId=${encodeURIComponent(p.part_id || "")}`,
        }));
      } catch {}
      try {
        const { data } = await supabase.from("fast_moving_parts")
          .select("id,part_id,part_name,brand,device_model")
          .or(`part_id.ilike.${like},part_name.ilike.${like},brand.ilike.${like},device_model.ilike.${like}`)
          .limit(6);
        (data || []).forEach((p: any) => results.push({
          id: `fmp-${p.id}`,
          label: p.part_name || p.part_id,
          sub: `${p.part_id || ""}${p.brand ? " · " + p.brand : ""}${p.device_model ? " · " + p.device_model : ""} · Fast-Moving`,
          kind: "part",
          path: `/inventory-management?tab=fast-moving&partId=${encodeURIComponent(p.part_id || "")}`,
        }));
      } catch {}
      return results;
    };

    const runStaff = async (): Promise<Result[]> => {
      try {
        const all = await fetchStaffList();
        const ql = q.toLowerCase();
        return all
          .filter((s) =>
            (s.name || "").toLowerCase().includes(ql) ||
            (s.staffId || "").toLowerCase().includes(ql) ||
            (s.department || "").toLowerCase().includes(ql) ||
            (s.role || "").toLowerCase().includes(ql)
          )
          .slice(0, 6)
          .map((s) => ({
            id: `staff-${s.id}`,
            label: s.name || s.staffId,
            sub: `${s.role || ""}${s.department ? " · " + s.department : ""}`,
            kind: "staff" as const,
            path: `/staff-management?staffId=${encodeURIComponent(s.staffId || s.id)}`,
          }));
      } catch { return []; }
    };

    (async () => {
      const [svcs, custs, parts, staffs] = await Promise.all([
        runServices(), runCustomers(), runParts(), runStaff(),
      ]);
      if (cancelled) return;
      setRemote([...svcs, ...custs, ...parts, ...staffs]);
      setSearching(false);
    })();

    return () => { cancelled = true; };
  }, [debounced, open]);

  const handleSelect = (r: Result) => {
    onOpenChange(false);
    setQuery("");
    if (r.kind === "service") {
      openTab({
        id: `service:${r.label}`,
        title: r.label,
        subtitle: r.sub?.split(" · ")[0],
        path: r.path,
        iconName: "FileText",
      });
      return;
    }
    if (r.kind === "page") {
      const pageDef = PAGES.find((p) => p.path === r.path);
      openTab({
        id: `page:${r.path}`,
        title: r.label,
        path: r.path,
        pinned: r.path === "/menu",
        iconName: pageDef?.iconName,
      });
      return;
    }
    navigate(r.path);
  };

  const groups: Array<{ heading: string; items: Result[] }> = [
    { heading: "Services", items: remote.filter((r) => r.kind === "service") },
    { heading: "Customers", items: remote.filter((r) => r.kind === "customer") },
    { heading: "Parts", items: remote.filter((r) => r.kind === "part") },
    { heading: "Staff", items: remote.filter((r) => r.kind === "staff") },
    { heading: "Pages", items: pageResults },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search tickets, clients, parts, staff, pages..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>
          <div className="py-6 text-center">
            <Search className="mx-auto h-6 w-6 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              {searching ? "Searching…" : <>No matches. Try a service ID like <span className="kbd">AC240726008</span></>}
            </p>
          </div>
        </CommandEmpty>
        {groups.map((g, i) => g.items.length > 0 && (
          <div key={g.heading}>
            {i > 0 && <CommandSeparator />}
            <CommandGroup heading={g.heading}>
              {g.items.map((r) => {
                const Icon = r.iconName ? ICONS[r.iconName] : null;
                return (
                  <CommandItem key={r.id} value={`${g.heading}-${r.id}-${r.label}`} onSelect={() => handleSelect(r)}>
                    {Icon ? <Icon className="mr-2 h-4 w-4 text-primary" /> : <Search className="mr-2 h-4 w-4 text-muted-foreground" />}
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{r.label}</span>
                      {r.sub && <span className="text-xs text-muted-foreground truncate">{r.sub}</span>}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export default CommandPalette;
