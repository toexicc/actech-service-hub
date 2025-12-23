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

// Queue for activity logs to prevent blocking UI
const logQueue: Array<Omit<ActivityLog, "logId" | "timestamp">> = [];
let isProcessingQueue = false;

const processQueue = async () => {
  if (isProcessingQueue || logQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  while (logQueue.length > 0) {
    const log = logQueue.shift();
    if (log) {
      await sendLogToServer(log);
    }
  }
  
  isProcessingQueue = false;
};

const sendLogToServer = async (log: Omit<ActivityLog, "logId" | "timestamp">) => {
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

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
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await response.json();
    return data.status === "success";
  } catch {
    // Silently fail - don't block user operations for logging
    return false;
  }
};

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

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
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await response.json();
    return data.status === "success";
  } catch {
    // Silently fail - don't block user operations for logging
    return false;
  }
};

// Non-blocking log function that queues logs for background processing
export const logActivityAsync = (log: Omit<ActivityLog, "logId" | "timestamp">) => {
  logQueue.push(log);
  // Process queue in background
  setTimeout(processQueue, 0);
};

// Helper function to log system activities (login, logout, page access)
export const logSystemActivity = (activity: string) => {
  const username = sessionStorage.getItem("username") || "System";
  const role = sessionStorage.getItem("userRole") || "system";
  
  logActivityAsync({
    serviceId: "SYSTEM",
    username,
    role,
    activity,
  });
};

// Helper function to log user authentication events
export const logAuthActivity = (username: string, activity: string, role: string = "unknown") => {
  logActivityAsync({
    serviceId: "AUTH",
    username,
    role,
    activity,
  });
};

// Helper function to log staff management activities
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

// Helper function to log inventory activities
export const logInventoryActivity = (partId: string, activity: string) => {
  const username = sessionStorage.getItem("username") || "System";
  const role = sessionStorage.getItem("userRole") || "system";
  
  logActivityAsync({
    serviceId: `INV-${partId}`,
    username,
    role,
    activity,
  });
};

// Helper function to log client inquiry activities
export const logInquiryActivity = (inquiryId: string, activity: string) => {
  const username = sessionStorage.getItem("username") || "System";
  const role = sessionStorage.getItem("userRole") || "system";
  
  logActivityAsync({
    serviceId: `INQ-${inquiryId}`,
    username,
    role,
    activity,
  });
};

export const getServiceLogs = async (serviceId: string, limit: number = 10): Promise<ActivityLog[]> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `${GOOGLE_SHEETS_SCRIPT_URL}?action=getServiceLogs&serviceId=${encodeURIComponent(serviceId)}&limit=${limit}`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeoutId);
    const data = await response.json();
    
    if (data.status === "success") {
      return data.logs || [];
    }
    return [];
  } catch {
    return [];
  }
};
