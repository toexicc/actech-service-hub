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
  { label: "Completed Transactions", path: "/completed-transactions", roles: ["management"], iconName: "DollarSign" },
  { label: "Transaction Tracker", path: "/transaction-tracker", roles: ["management"], iconName: "DollarSign" },
  { label: "Salary Disbursement", path: "/salary-disbursement", roles: ["management"], iconName: "DollarSign" },
  { label: "Staff Management", path: "/staff-management", roles: ["management"], iconName: "Settings" },
  { label: "Attendance Overview", path: "/attendance-overview", roles: ["management"], iconName: "Clock" },
  { label: "Admin Dashboard", path: "/admin-dashboard", roles: ["management"], iconName: "LayoutDashboard" },
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
      return;
    }
    let cancelled = false;
    const q = debounced.trim();
    (async () => {
      const like = `%${q}%`;
      const [services, customers, parts, staff] = await Promise.all([
        supabase.from("services")
          .select("service_id,client_name,device_type,device_brand,device_model,status")
          .or(`service_id.ilike.${like},client_name.ilike.${like},device_model.ilike.${like},device_brand.ilike.${like}`)
          .limit(6),
        supabase.from("clients")
          .select("id,client_id,name,phone,email")
          .or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like},client_id.ilike.${like}`)
          .limit(6),
        supabase.from("parts_inventory" as any)
          .select("id,part_id,part_name,brand,model")
          .or(`part_id.ilike.${like},part_name.ilike.${like},brand.ilike.${like},model.ilike.${like}`)
          .limit(6),
        supabase.from("staff")
          .select("id,staff_id,full_name,role,department")
          .or(`full_name.ilike.${like},staff_id.ilike.${like},department.ilike.${like}`)
          .limit(6),
      ]);
      if (cancelled) return;
      const results: Result[] = [];
      (services.data || []).forEach((s: any) => results.push({
        id: `svc-${s.service_id}`,
        label: s.service_id,
        sub: `${s.client_name || ""} · ${[s.device_brand, s.device_model].filter(Boolean).join(" ") || s.device_type || ""}${s.status ? " · " + s.status : ""}`,
        kind: "service",
        path: `/manage-client?serviceId=${encodeURIComponent(s.service_id)}`,
      }));
      (customers.data || []).forEach((c: any) => results.push({
        id: `cus-${c.id}`,
        label: c.name || c.client_id,
        sub: `${c.client_id || ""}${c.phone ? " · " + c.phone : ""}`,
        kind: "customer",
        path: `/customer-management?clientId=${encodeURIComponent(c.client_id || c.id)}`,
      }));
      (parts.data || []).forEach((p: any) => results.push({
        id: `part-${p.id}`,
        label: p.part_name || p.part_id,
        sub: `${p.part_id || ""}${p.brand ? " · " + p.brand : ""}${p.model ? " · " + p.model : ""}`,
        kind: "part",
        path: `/inventory-management?partId=${encodeURIComponent(p.part_id || "")}`,
      }));
      (staff.data || []).forEach((s: any) => results.push({
        id: `staff-${s.id}`,
        label: s.full_name || s.staff_id,
        sub: `${s.role || ""}${s.department ? " · " + s.department : ""}`,
        kind: "staff",
        path: `/staff-management?staffId=${encodeURIComponent(s.staff_id || s.id)}`,
      }));
      setRemote(results);
    })().catch(() => setRemote([]));
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
            <p className="text-sm text-muted-foreground">No matches. Try a service ID like <span className="kbd">MAA-1192</span></p>
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
