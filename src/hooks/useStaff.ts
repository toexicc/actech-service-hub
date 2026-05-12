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
  // Try to read full profiles (works for admin/management). Non-admins only get
  // their own row from the profiles table due to RLS, so we fall back to the
  // safe `get_staff_directory` RPC which excludes salary fields.
  const [profilesResp, { data: roles, error: rErr }] = await Promise.all([
    supabase.from("profiles").select("*").order("name", { ascending: true }),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  if (profilesResp.error) throw profilesResp.error;
  if (rErr) throw rErr;
  let profiles: any[] = profilesResp.data ?? [];
  // If we got fewer than 2 rows, the caller likely is not admin/management; use directory.
  if (profiles.length < 2) {
    const { data: dir } = await supabase.rpc("get_staff_directory");
    if (dir && Array.isArray(dir)) {
      const ownRow = profiles[0];
      profiles = dir.map((d: any) => {
        if (ownRow && d.id === ownRow.id) return ownRow;
        return { ...d, salary: null, salary_type: null };
      });
    }
  }
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
    name: p.name || p.username || p.staff_id || "Unknown",
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
