import { supabase } from "@/integrations/supabase/client";

export interface StaffMember {
  id: string;
  staffId: string;
  name: string;
  role: string;
  username?: string;
  department?: string;
}

export const fetchStaffList = async (): Promise<StaffMember[]> => {
  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("id, name, username, department, staff_id"),
    supabase.from("user_roles").select("user_id, role"),
  ]);

  const roleMap = new Map<string, string[]>();
  for (const r of roles ?? []) {
    const arr = roleMap.get(r.user_id) ?? [];
    arr.push(r.role);
    roleMap.set(r.user_id, arr);
  }

  return (profiles ?? []).map((p: any) => {
    const r = roleMap.get(p.id) ?? [];
    const primary = r.includes("admin")
      ? "Admin"
      : r.includes("management")
      ? "Management"
      : r.includes("technician")
      ? "Technician"
      : "";
    return {
      id: p.id,
      staffId: p.id,
      name: p.name ?? "",
      role: primary,
      username: p.username ?? "",
      department: p.department ?? "",
    };
  });
};
