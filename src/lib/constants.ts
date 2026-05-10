// Shared constants across the application

export const DEVICE_TYPES = [
  "Mobile (iPhone)",
  "Laptop (Mac)",
  "iPad",
  "Apple Watch",
  "Mobile (Android)",
  "Tablet (Android)",
  "Laptop (Windows)",
  "Computer (iMac)",
  "Desktop Computer (Windows)",
  "Computer (Mac Mini)",
  "Drone",
  "Speakers",
  "AirPods",
  "Go Pro",
  "Gaming Consoles",
  "Gaming Controllers",
  "Headphones",
  "Hard Drive and Data Recovery",
  "Others",
] as const;

export type DeviceType = typeof DEVICE_TYPES[number];

export const DEPARTMENTS = [
  "Laptop (Daily Repairs)",
  "Laptop (Screens)",
  "Laptop (Logic Board)",
  "Mobile (Daily Repairs)",
  "Mobile (Logic Board)",
  "Others"
] as const;

export type Department = typeof DEPARTMENTS[number];

// Device types by department mapping
export const DEVICE_TYPES_BY_DEPARTMENT: Record<string, string[]> = {
  "Laptop (Daily Repairs)": [
    "Laptop (Mac)",
    "Laptop (Windows)",
    "Computer (iMac)",
    "Desktop Computer (Windows)",
    "Computer (Mac Mini)",
    "Others"
  ],
  "Laptop (Screens)": [
    "Laptop (Mac)",
    "Others"
  ],
  "Laptop (Logic Board)": [
    "Laptop (Mac)",
    "Laptop (Windows)",
    "Computer (iMac)",
    "Computer (Mac Mini)",
    "Drone",
    "Speakers",
    "Gaming Consoles",
    "Gaming Controllers",
    "Headphones",
    "Others"
  ],
  "Mobile (Daily Repairs)": [
    "Mobile (iPhone)",
    "iPad",
    "Apple Watch",
    "Mobile (Android)",
    "Tablet (Android)",
    "Others"
  ],
  "Mobile (Logic Board)": [
    "Mobile (iPhone)",
    "iPad",
    "Apple Watch",
    "Mobile (Android)",
    "Tablet (Android)",
    "AirPods",
    "Go Pro",
    "Others"
  ],
  "Others": DEVICE_TYPES as unknown as string[]
};

export const PRIORITY_OPTIONS = [
  "Rush (with 10% Rush Fee)",
  "Loyalty",
  "Normal"
] as const;

export type Priority = typeof PRIORITY_OPTIONS[number];

export const STATUS_OPTIONS = [
  "Pending Diagnosis",
  "Confirmed Diagnosis",
  "Waiting to Proceed",
  "Proceed Repair",
  "Ongoing Service",
  "Done Repair - Under Observation",
  "Done Repair - For Release",
  "Done Repair - Advise Client",
  "Completed",
  "Backjob",
  "RTO",
  "On Hold",
  "Cancelled"
] as const;

export type Status = typeof STATUS_OPTIONS[number];

export const TIME_FRAME_OPTIONS = [
  "Same-Day",
  "Next Business Day",
  "1-2 Days",
  "3-5 Days",
  "1-2 Weeks",
  "2-4 Weeks"
] as const;

export type TimeFrame = typeof TIME_FRAME_OPTIONS[number];

// User Roles
export const USER_ROLES = {
  ADMIN: "admin",
  TECHNICIAN: "technician",
  MANAGEMENT: "management",
} as const;

// Inventory Status
export const INVENTORY_STATUS = [
  "In Stock",
  "Low Stock",
  "Out of Stock",
  "On Order"
] as const;

// Transaction Types
export const TRANSACTION_TYPES = [
  "Add",
  "Remove",
  "Adjust",
  "Order",
  "Receive"
] as const;

// Form Validation Messages
export const VALIDATION_MESSAGES = {
  REQUIRED: (field: string) => `${field} is required`,
  MIN_LENGTH: (field: string, length: number) => 
    `${field} must be at least ${length} characters`,
  MAX_LENGTH: (field: string, length: number) => 
    `${field} must not exceed ${length} characters`,
  INVALID_FORMAT: (field: string) => `Invalid ${field} format`,
  INVALID_EMAIL: "Invalid email address",
  INVALID_PHONE: "Invalid phone number",
  INVALID_SERVICE_ID: "Service ID must match format AC + 11 digits",
  POSITIVE_NUMBER: (field: string) => `${field} must be a positive number`,
} as const;

// API Response Messages
export const API_MESSAGES = {
  SUCCESS: {
    CREATE: (item: string) => `${item} created successfully`,
    UPDATE: (item: string) => `${item} updated successfully`,
    DELETE: (item: string) => `${item} deleted successfully`,
    FETCH: (item: string) => `${item} loaded successfully`,
  },
  ERROR: {
    CREATE: (item: string) => `Failed to create ${item}`,
    UPDATE: (item: string) => `Failed to update ${item}`,
    DELETE: (item: string) => `Failed to delete ${item}`,
    FETCH: (item: string) => `Failed to load ${item}`,
    NETWORK: "Network error. Please check your connection and try again",
    SERVER: "Server error. Please try again later",
    UNAUTHORIZED: "You don't have permission to perform this action",
    VALIDATION: "Please check your input and try again",
  },
} as const;

// Debounce Delays (in milliseconds)
export const DEBOUNCE_DELAYS = {
  SEARCH: 300,
  INPUT: 500,
  AUTOSAVE: 2000,
} as const;

// Pagination
export const PAGINATION = {
  ITEMS_PER_PAGE: 15,
  MAX_PAGE_BUTTONS: 5,
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  OPENAI_KEY: 'actech_openai_key',
  SERVICE_TRACKER_FILTERS: 'actech_service_tracker_filters',
  INVENTORY_FILTERS: 'actech_inventory_filters',
  TRANSACTION_FILTERS: 'actech_transaction_filters',
  USER_PREFERENCES: 'actech_user_preferences',
} as const;
