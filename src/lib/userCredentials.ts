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
}

// Cache for user credentials loaded from Google Sheets
let userCredentials: UserCredential[] = [];
let isLoaded = false;

// Default fallback admin account
const DEFAULT_ADMIN: UserCredential = {
  staffId: "ACTECH-ADMIN-001",
  username: "Admin-ACTECH",
  password: "ACT3CH2025~*Management!",
  name: "Default Admin",
  role: "management",
  status: "active"
};

// Load users from Google Sheets
export const loadUsersFromSheet = async (): Promise<UserCredential[]> => {
  try {
    const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getStaffList`);
    const data = await response.json();
    
    if (data.status === "success" && data.data) {
      userCredentials = data.data.map((staff: any) => {
        const staffId = staff.staffId ?? staff["Staff ID"] ?? "";
        const username = staff.username ?? staff["Username"] ?? "";
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
      
      // Add default admin if not already in the list
      const hasDefaultAdmin = userCredentials.some(u => u.username === DEFAULT_ADMIN.username);
      if (!hasDefaultAdmin) {
        userCredentials.unshift(DEFAULT_ADMIN);
      }
    } else {
      // If Google Sheets fails, use default admin only
      userCredentials = [DEFAULT_ADMIN];
      isLoaded = true;
    }
    return userCredentials;
  } catch (error) {
    console.error("Error loading users from sheet:", error);
    // On error, ensure default admin is available
    userCredentials = [DEFAULT_ADMIN];
    isLoaded = true;
    return userCredentials;
  }
};

export const addUser = async (user: UserCredential) => {
  try {
    const formData = new FormData();
    formData.append("action", "addStaff");
    formData.append("staffId", user.staffId);
    formData.append("username", user.username);
    formData.append("password", user.password);
    formData.append("name", user.name);
    formData.append("role", user.role);
    formData.append("department", user.department || "");
    formData.append("status", user.status);

    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (data.status === "success") {
      userCredentials.push(user);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error adding user:", error);
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

    const data = await response.json();
    if (data.status === "success") {
      userCredentials = userCredentials.filter(u => u.username !== username);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error removing user:", error);
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
  try {
    const user = userCredentials.find(u => u.username === username);
    if (!user) return false;

    const updatedUser = { ...user, ...updates };
    
    const formData = new FormData();
    formData.append("action", "updateStaff");
    formData.append("staffId", updatedUser.staffId);
    formData.append("username", username);
    formData.append("name", updatedUser.name);
    formData.append("password", updatedUser.password);
    formData.append("role", updatedUser.role);
    formData.append("department", updatedUser.department || "");
    formData.append("status", updatedUser.status);

    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (data.status === "success") {
      const index = userCredentials.findIndex(u => u.username === username);
      if (index !== -1) {
        userCredentials[index] = updatedUser;
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error updating user:", error);
    return false;
  }
};
