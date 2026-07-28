// Cloud-backed user credential helpers. Replaces the old Google Sheets flow.
// Auth itself is handled by Supabase Auth (see useAuth hook + Login page).
// These helpers exist so Staff Management can keep its CRUD UX unchanged.

import { supabase } from "@/integrations/supabase/client";

export interface UserCredential {
  staffId: string;
  username: string;
  password: string;
  name: string;
  role: "admin" | "technician" | "management";
  department?: string;
  status: "active" | "inactive";
  salary?: string;
  salaryType?: "fixed" | "service-based" | "monthly";
  userId?: string;
}

let _lastStaffError: string | null = null;
export const getLastStaffError = () => _lastStaffError;

const invokeManageStaff = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("manage-staff", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

const captureErr = (e: unknown) => {
  _lastStaffError = e instanceof Error ? e.message : String(e);
};

const toNumberSalary = (s: string | undefined) => {
  if (!s) return 0;
  const n = Number(String(s).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export const addUser = async (user: UserCredential & { email?: string }) => {
  try {
    const email = (user as any).email || `${user.username}@actech.local`;
    await invokeManageStaff({
      action: "create",
      email,
      password: user.password,
      name: user.name,
      username: user.username,
      role: user.role,
      department: user.department,
      staff_id: user.staffId,
      salary: toNumberSalary(user.salary),
      salary_type: user.salaryType ?? "monthly",
      status: user.status,
    });
    return true;
  } catch (e) {
    captureErr(e);
    return false;
  }
};

export const updateUser = async (
  usernameOrUserId: string,
  updates: Partial<UserCredential> & { user_id?: string },
) => {
  try {
    let userId = updates.userId || updates.user_id;
    if (!userId && /^[0-9a-f-]{36}$/i.test(usernameOrUserId)) {
      userId = usernameOrUserId;
    }
    if (!userId) {
      const { data } = await supabase.from("profiles").select("id").eq("username", usernameOrUserId).maybeSingle();
      userId = data?.id;
    }
    if (!userId) throw new Error("User not found");
    await invokeManageStaff({
      action: "update",
      user_id: userId,
      name: updates.name,
      username: updates.username,
      role: updates.role,
      department: updates.department,
      staff_id: updates.staffId,
      salary: updates.salary !== undefined ? toNumberSalary(updates.salary) : undefined,
      salary_type: updates.salaryType,
      status: updates.status,
      password: updates.password || undefined,
    });
    return true;
  } catch (e) {
    return false;
  }
};

export const updateUserPassword = async (username: string, newPassword: string) => {
  return updateUser(username, { password: newPassword });
};

export const removeUser = async (usernameOrUserId: string) => {
  try {
    let userId = usernameOrUserId;
    if (!/^[0-9a-f-]{36}$/i.test(usernameOrUserId)) {
      const { data } = await supabase.from("profiles").select("id").eq("username", usernameOrUserId).maybeSingle();
      if (!data?.id) return false;
      userId = data.id;
    }
    await invokeManageStaff({ action: "delete", user_id: userId });
    return true;
  } catch {
    return false;
  }
};

// Legacy helpers kept as no-ops for compatibility.
export const loadUsersFromSheet = async (): Promise<UserCredential[]> => [];
export const findUser = async (): Promise<UserCredential | undefined> => undefined;
export const getUserByUsername = (): UserCredential | undefined => undefined;
export const getAllUsers = async (): Promise<UserCredential[]> => [];
