import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StaffMember {
  staffId: string;
  username: string;
  password: string; // not exposed by Supabase; kept for type compatibility
  name: string;
  role: string;
  department: string;
  status: string;
  salary: string;
  salaryType?: string;
  email?: string;
  userId?: string;
}

const fetchStaffList = async (): Promise<StaffMember[]> => {
  const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
    supabase.from("profiles").select("*").order("name", { ascending: true }),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  if (pErr) throw pErr;
  if (rErr) throw rErr;
  const roleMap = new Map<string, string>();
  (roles ?? []).forEach((r: any) => {
    const prev = roleMap.get(r.user_id);
    const rank = (x: string) => (x === "admin" ? 3 : x === "management" ? 2 : x === "technician" ? 1 : 0);
    if (!prev || rank(r.role) > rank(prev)) roleMap.set(r.user_id, r.role);
  });

  // Try to fetch emails (admin/management only); fall back silently.
  let emails: Record<string, string> = {};
  try {
    const { data } = await supabase.functions.invoke("manage-staff", { body: { action: "list" } });
    if (data && (data as any).emails) emails = (data as any).emails;
  } catch {
    // ignore - non-admin callers
  }

  return (profiles ?? []).map((p: any) => ({
    staffId: p.staff_id ?? p.id,
    username: p.username ?? "",
    password: "",
    name: p.name ?? "",
    role: roleMap.get(p.id) ?? "",
    department: p.department ?? "",
    status: p.status ?? "active",
    salary: p.salary != null ? String(p.salary) : "",
    salaryType: p.salary_type ?? "monthly",
    email: emails[p.id] ?? p.username ?? "",
    userId: p.id,
  }));
};

export const useStaff = () => {
  return useQuery({
    queryKey: ["staff"],
    queryFn: fetchStaffList,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: "always",
  });
};

export const useInvalidateStaff = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["staff"] });
};

export const useTechnicians = () => {
  const { data: staff, ...rest } = useStaff();
  const technicians =
    staff?.filter((s) => s.role?.toLowerCase() === "technician" && s.status?.toLowerCase() === "active") || [];
  return { data: technicians, ...rest };
};
