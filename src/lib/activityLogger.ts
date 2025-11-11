// Activity Logger - logs all service updates to Google Sheets
import { GOOGLE_SHEETS_SCRIPT_URL } from "./googleSheets";

export interface ActivityLog {
  logId?: string;
  serviceId: string;
  username: string;
  role: string;
  timestamp: string;
  activity: string;
}

export const logActivity = async (log: Omit<ActivityLog, "logId" | "timestamp">) => {
  try {
    const timestamp = new Date().toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });

    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        action: "logActivity",
        serviceId: log.serviceId,
        username: log.username,
        role: log.role,
        timestamp: timestamp,
        activity: log.activity,
      }),
    });

    const data = await response.json();
    return data.status === "success";
  } catch (error) {
    console.error("Error logging activity:", error);
    return false;
  }
};

export const getServiceLogs = async (serviceId: string, limit: number = 10): Promise<ActivityLog[]> => {
  try {
    const response = await fetch(
      `${GOOGLE_SHEETS_SCRIPT_URL}?action=getServiceLogs&serviceId=${encodeURIComponent(serviceId)}&limit=${limit}`
    );
    const data = await response.json();
    
    if (data.status === "success") {
      return data.logs || [];
    }
    return [];
  } catch (error) {
    console.error("Error fetching service logs:", error);
    return [];
  }
};
