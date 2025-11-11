// User credentials - synced with Google Sheets
// Management can update passwords through Staff Management interface
import { GOOGLE_SHEETS_SCRIPT_URL } from "./googleSheets";

export interface UserCredential {
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

// Load users from Google Sheets
export const loadUsersFromSheet = async (): Promise<UserCredential[]> => {
  try {
    const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getStaffList`);
    const data = await response.json();
    
    if (data.status === "success" && data.data) {
      userCredentials = data.data.map((staff: any) => ({
        username: staff.username,
        password: staff.password,
        name: staff.name,
        role: staff.role.toLowerCase() as "admin" | "technician" | "management",
        department: staff.department,
        status: staff.status.toLowerCase() as "active" | "inactive"
      }));
      isLoaded = true;
    }
    return userCredentials;
  } catch (error) {
    console.error("Error loading users from sheet:", error);
    return userCredentials;
  }
};

export const addUser = async (user: UserCredential) => {
  try {
    const formData = new FormData();
    formData.append("action", "addStaff");
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
