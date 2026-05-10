import { supabase } from "@/integrations/supabase/client";

export interface ActivityLog {
  logId?: string;
  serviceId: string;
  username: string;
  role: string;
  timestamp: string;
  activity: string;
}

const sendLog = async (log: Omit<ActivityLog, "logId" | "timestamp">) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("activity_logs").insert({
      action: log.activity,
      actor_id: user?.id ?? null,
      actor_name: log.username,
      entity_type: "service",
      entity_id: log.serviceId,
    });
    return true;
  } catch {
    return false;
  }
};

export const logActivity = sendLog;

export const logActivityAsync = (log: Omit<ActivityLog, "logId" | "timestamp">) => {
  setTimeout(() => { sendLog(log); }, 0);
};

export const logSystemActivity = (activity: string) => {
  const username = sessionStorage.getItem("username") || "System";
  const role = sessionStorage.getItem("userRole") || "system";
  logActivityAsync({ serviceId: "SYSTEM", username, role, activity });
};

export const logAuthActivity = (username: string, activity: string, role: string = "unknown") => {
  logActivityAsync({ serviceId: "AUTH", username, role, activity });
};

export const logStaffActivity = (activity: string, targetStaffName?: string) => {
  const username = sessionStorage.getItem("username") || "System";
  const role = sessionStorage.getItem("userRole") || "system";
  logActivityAsync({
    serviceId: "STAFF",
    username,
    role,
    activity: targetStaffName ? `${activity}: ${targetStaffName}` : activity,
  });
};

export const logInventoryActivity = (partId: string, activity: string) => {
  const username = sessionStorage.getItem("username") || "System";
  const role = sessionStorage.getItem("userRole") || "system";
  logActivityAsync({ serviceId: `INV-${partId}`, username, role, activity });
};

export const logInquiryActivity = (inquiryId: string, activity: string) => {
  const username = sessionStorage.getItem("username") || "System";
  const role = sessionStorage.getItem("userRole") || "system";
  logActivityAsync({ serviceId: `INQ-${inquiryId}`, username, role, activity });
};

export const getServiceLogs = async (serviceId: string, limit: number = 10): Promise<ActivityLog[]> => {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("entity_id", serviceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    logId: r.id,
    serviceId: r.entity_id ?? "",
    username: r.actor_name ?? "",
    role: "",
    timestamp: r.created_at,
    activity: r.action,
  }));
};
