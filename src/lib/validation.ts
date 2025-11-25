import { z } from "zod";

// Common validation schemas
export const phoneSchema = z.string()
  .min(1, "Phone number is required")
  .regex(/^[\d\s\-\+\(\)]+$/, "Invalid phone number format")
  .min(7, "Phone number must be at least 7 digits")
  .max(20, "Phone number must not exceed 20 characters");

export const emailSchema = z.string()
  .email("Invalid email address")
  .max(255, "Email must not exceed 255 characters")
  .or(z.string().length(0)); // Allow empty string

export const nameSchema = z.string()
  .min(1, "Name is required")
  .max(100, "Name must not exceed 100 characters")
  .regex(/^[a-zA-Z\s\-\.\']+$/, "Name can only contain letters, spaces, hyphens, and periods");

export const textFieldSchema = (fieldName: string, minLength: number = 1, maxLength: number = 500) => 
  z.string()
    .min(minLength, `${fieldName} is required`)
    .max(maxLength, `${fieldName} must not exceed ${maxLength} characters`)
    .trim();

export const numberFieldSchema = (fieldName: string, min: number = 0, max: number = 9999999) =>
  z.number()
    .min(min, `${fieldName} must be at least ${min}`)
    .max(max, `${fieldName} must not exceed ${max}`);

export const priceSchema = z.number()
  .min(0, "Price must be a positive number")
  .max(10000000, "Price is too large")
  .refine((val) => {
    const decimalPlaces = (val.toString().split('.')[1] || '').length;
    return decimalPlaces <= 2;
  }, "Price can have at most 2 decimal places");

// Sanitization functions
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 1000); // Limit length
};

export const sanitizeNumber = (input: string): number => {
  const num = parseFloat(input.replace(/[^\d.-]/g, ''));
  return isNaN(num) ? 0 : num;
};

export const sanitizePhone = (input: string): string => {
  return input.replace(/[^\d\s\-\+\(\)]/g, '').slice(0, 20);
};

// Validation helper functions
export const isValidDate = (date: any): boolean => {
  return date instanceof Date && !isNaN(date.getTime());
};

export const isValidServiceId = (id: string): boolean => {
  return /^AC\d{11}$/.test(id);
};

export const validateFileSize = (file: File, maxSizeMB: number = 5): boolean => {
  return file.size <= maxSizeMB * 1024 * 1024;
};

export const validateFileType = (file: File, allowedTypes: string[]): boolean => {
  return allowedTypes.includes(file.type);
};
