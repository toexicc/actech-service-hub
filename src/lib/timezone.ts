// Timezone utilities for consistent date/time handling
// All dates should use Asia/Manila timezone for this Philippine-based app

import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { format, parseISO } from 'date-fns';

export const TIMEZONE = 'Asia/Manila';

/**
 * Get the current date/time in Manila timezone
 */
export function getManilaDate(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

/**
 * Format a date for display in Manila timezone
 * @param date - Date object or ISO string
 * @param formatStr - date-fns format string (default: "MM/dd/yyyy, hh:mm a")
 */
export function formatManilaDate(date: Date | string, formatStr: string = "MM/dd/yyyy, hh:mm a"): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatInTimeZone(dateObj, TIMEZONE, formatStr);
  } catch {
    return typeof date === 'string' ? date : format(date, formatStr);
  }
}

/**
 * Format current date/time for logging purposes
 * Returns format: "MM/dd/yyyy, hh:mm:ss AM/PM"
 */
export function getManilaTimestamp(): string {
  return formatInTimeZone(new Date(), TIMEZONE, "MM/dd/yyyy, hh:mm:ss a");
}

/**
 * Format a date for sheet storage
 * Returns format: "MM/dd/yyyy"
 */
export function formatForSheet(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "MM/dd/yyyy");
}

/**
 * Format a date for ISO-like storage with Manila timezone info
 * Returns format: "yyyy-MM-dd'T'HH:mm:ss+08:00"
 */
export function formatManilaISO(date: Date = new Date()): string {
  return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * Parse a date string and display it in Manila timezone
 * Handles various formats: ISO strings, MM/dd/yyyy, MM-dd-yyyy, MM-dd-yyyy HH:mm, etc.
 */
export function displayDate(dateStr: string, formatStr: string = "MMM dd, yyyy"): string {
  try {
    if (!dateStr) return '';
    
    // Handle ISO strings
    if (dateStr.includes('T')) {
      return formatInTimeZone(parseISO(dateStr), TIMEZONE, formatStr);
    }
    
    // Handle MM/dd/yyyy or MM-dd-yyyy format (with optional time)
    if (dateStr.includes('/') || dateStr.includes('-')) {
      // Split off time portion if present (format: "MM-dd-yyyy, HH:mm" or "MM/dd/yyyy HH:mm")
      const [datePart, timePart] = dateStr.split(/[, ]+/);
      const parts = datePart.split(/[-/]/);
      
      if (parts.length === 3) {
        const [month, day, year] = parts;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        // If there's a time part, parse it
        if (timePart) {
          const timeMatch = timePart.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?/i);
          if (timeMatch) {
            let hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const seconds = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
            const ampm = timeMatch[4];
            
            if (ampm) {
              if (ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12;
              if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
            }
            
            date.setHours(hours, minutes, seconds);
          }
        }
        
        return format(date, formatStr);
      }
    }
    
    return dateStr;
  } catch {
    return dateStr;
  }
}

/**
 * Parse a date string and display it with time in Manila timezone
 */
export function displayDateTime(dateStr: string, formatStr: string = "MMM dd, yyyy hh:mm a"): string {
  try {
    if (!dateStr) return '';
    
    // Handle ISO strings
    if (dateStr.includes('T')) {
      return formatInTimeZone(parseISO(dateStr), TIMEZONE, formatStr);
    }
    
    return dateStr;
  } catch {
    return dateStr;
  }
}
