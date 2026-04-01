// User credentials - synced with Google Sheets
// Management can update passwords through Staff Management interface
import { GOOGLE_SHEETS_SCRIPT_URL } from "./googleSheets";

export interface UserCredential {
  staffId: string;
  username: string;
  password: string;
  name: string;
  role: "admin" | "technician" | "management";
  department?: string;
  status: "active" | "inactive";
  salary?: string;
}

// Cache for user credentials loaded from Google Sheets
let userCredentials: UserCredential[] = [];
let isLoaded = false;

// Load users from Google Sheets
// NOTE: Default admin credentials have been removed for security.
// Ensure at least one admin account exists in your Staff Management Google Sheet.
export const loadUsersFromSheet = async (): Promise<UserCredential[]> => {
  try {
    const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getStaffList`);
    const data = await response.json();
    
    if (data.status === "success" && data.data) {
      userCredentials = data.data.map((staff: any) => {
        const staffId = staff.staffId ?? staff["Staff ID"] ?? "";
        const username = staff.username ?? staff["Username"] ?? "";
        // Password should be validated server-side; storing client-side is a security risk
        const password = staff.password ?? staff["Password"] ?? "";
        const name = staff.name ?? staff["Name"] ?? "";
        const roleRaw = (staff.role ?? staff["Role"] ?? "").toString().trim().toLowerCase();
        const department = staff.department ?? staff["Department"] ?? undefined;
        const statusRaw = (staff.status ?? staff["Status"] ?? "").toString().trim().toLowerCase();
        const normalizedStatus: "active" | "inactive" = statusRaw.includes("inactive") ? "inactive" : "active";

        return {
          staffId,
          username,
          password,
          name,
          role: (roleRaw as "admin" | "technician" | "management") || "management",
          department,
          status: normalizedStatus,
        } as UserCredential;
      });
      isLoaded = true;
    } else {
      // If Google Sheets fails, no users available - authentication will fail
      userCredentials = [];
      isLoaded = true;
    }
    return userCredentials;
  } catch {
    // On error, no users available - authentication will fail
    userCredentials = [];
    isLoaded = true;
    return userCredentials;
  }
};

export const addUser = async (user: UserCredential) => {
  try {
    // Capitalize first letter of role for Google Sheets
    const capitalizedRole = user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase();
    
    const formData = new FormData();
    formData.append("action", "addStaff");
    formData.append("staffId", user.staffId);
    formData.append("username", user.username);
    formData.append("password", user.password);
    formData.append("name", user.name);
    formData.append("role", capitalizedRole);
    formData.append("department", user.department || "");
    formData.append("status", user.status.charAt(0).toUpperCase() + user.status.slice(1).toLowerCase());
    formData.append("salary", user.salary || "");

    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: "POST",
      body: formData,
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      // Could not parse response (likely CORS), assuming success
    }

    const isSuccess =
      (data && (data.status === "success" || data.result === "success")) ||
      (response.ok && data === null);

    if (isSuccess) {
      userCredentials.push(user);
      return true;
    }
    return false;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.toLowerCase().includes("failed to fetch")) {
      // CORS error after successful POST - assume success
      userCredentials.push(user);
      return true;
    }
    return false;
  }
};

export const updateUserPassword = async (username: string, newPassword: string) => {
  const user = userCredentials.find(u => u.username === username);
  if (user) {
    user.password = newPassword;
    return await updateUser(username, { password: newPassword });
  }
  return false;
};

export const removeUser = async (username: string) => {
  try {
    const formData = new FormData();
    formData.append("action", "removeStaff");
    formData.append("username", username);

    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: "POST",
      body: formData,
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      // Could not parse response (likely CORS), assuming success
    }

    const isSuccess =
      (data && (data.status === "success" || data.result === "success")) ||
      (response.ok && data === null);

    if (isSuccess) {
      userCredentials = userCredentials.filter(u => u.username !== username);
      return true;
    }
    return false;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.toLowerCase().includes("failed to fetch")) {
      // CORS error after successful POST - assume success
      userCredentials = userCredentials.filter(u => u.username !== username);
      return true;
    }
    return false;
  }
};

export const findUser = async (username: string, password: string): Promise<UserCredential | undefined> => {
  if (!isLoaded) {
    await loadUsersFromSheet();
  }
  return userCredentials.find(
    u => u.username === username && u.password === password && u.status === "active"
  );
};

export const getUserByUsername = (username: string): UserCredential | undefined => {
  return userCredentials.find(u => u.username === username);
};

export const getAllUsers = async (): Promise<UserCredential[]> => {
  await loadUsersFromSheet();
  return userCredentials;
};

export const updateUser = async (username: string, updates: Partial<UserCredential>) => {
  const user = userCredentials.find(u => u.username === username);
  if (!user) return false;

  const updatedUser = { ...user, ...updates };

  try {
    // Capitalize first letter of role for Google Sheets
    const capitalizedRole = updatedUser.role.charAt(0).toUpperCase() + updatedUser.role.slice(1).toLowerCase();
    
    const formData = new FormData();
    formData.append("action", "updateStaff");
    formData.append("staffId", updatedUser.staffId);
    formData.append("username", username);
    formData.append("name", updatedUser.name);
    formData.append("password", updatedUser.password);
    formData.append("role", capitalizedRole);
    formData.append("department", updatedUser.department || "");
    formData.append("status", updatedUser.status.charAt(0).toUpperCase() + updatedUser.status.slice(1).toLowerCase());
    formData.append("salary", updatedUser.salary || "");

    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: "POST",
      body: formData,
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      // Could not parse response (likely CORS), assuming success
    }

    const isSuccess =
      (data && (data.status === "success" || data.result === "success")) ||
      (response.ok && data === null);

    if (isSuccess) {
      const index = userCredentials.findIndex(u => u.username === username);
      if (index !== -1) {
        userCredentials[index] = updatedUser;
      }
      return true;
    }
    return false;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.toLowerCase().includes("failed to fetch")) {
      // CORS error after successful POST - assume success
      const index = userCredentials.findIndex(u => u.username === username);
      if (index !== -1) {
        userCredentials[index] = updatedUser;
      }
      return true;
    }
    return false;
  }
};
