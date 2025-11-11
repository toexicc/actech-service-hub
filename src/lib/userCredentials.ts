// User credentials - stored in codebase
// Management can update passwords through Staff Management interface

export interface UserCredential {
  username: string;
  password: string;
  name: string;
  role: "admin" | "technician" | "management";
  department?: string;
  status: "active" | "inactive";
}

// Default credentials
export let userCredentials: UserCredential[] = [
  {
    username: "admin1",
    password: "ACT3CH2025~*Admin+",
    name: "Admin User",
    role: "admin",
    status: "active"
  },
  {
    username: "tech1",
    password: "ACT3CH2025~*Technician#",
    name: "Technician User",
    role: "technician",
    status: "active"
  },
  {
    username: "mgmt1",
    password: "ACT3CH2025~*Management!",
    name: "Management User",
    role: "management",
    status: "active"
  }
];

export const addUser = (user: UserCredential) => {
  userCredentials.push(user);
};

export const updateUserPassword = (username: string, newPassword: string) => {
  const user = userCredentials.find(u => u.username === username);
  if (user) {
    user.password = newPassword;
  }
};

export const removeUser = (username: string) => {
  userCredentials = userCredentials.filter(u => u.username !== username);
};

export const findUser = (username: string, password: string): UserCredential | undefined => {
  return userCredentials.find(
    u => u.username === username && u.password === password && u.status === "active"
  );
};

export const getUserByUsername = (username: string): UserCredential | undefined => {
  return userCredentials.find(u => u.username === username);
};

export const getAllUsers = (): UserCredential[] => {
  return userCredentials;
};

export const updateUser = (username: string, updates: Partial<UserCredential>) => {
  const index = userCredentials.findIndex(u => u.username === username);
  if (index !== -1) {
    userCredentials[index] = { ...userCredentials[index], ...updates };
  }
};
