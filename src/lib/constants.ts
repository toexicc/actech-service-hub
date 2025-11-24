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

export const STATUS_OPTIONS = [
  "Pending Diagnosis",
  "Confirmed Diagnosis",
  "Pending - Approval",
  "Complete - Approval",
  "Ongoing Service",
  "Service Check (Completed)",
  "Pending Pickup (Completed)",
  "Completed",
  "Backjob",
  "RTO",
  "On Hold",
  "Cancelled"
] as const;

export type Status = typeof STATUS_OPTIONS[number];

// OpenAI API Configuration
export const DEFAULT_OPENAI_API_KEY = "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";
