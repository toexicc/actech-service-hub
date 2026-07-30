// Timezone utilities for consistent date/time handling
// All dates should use Asia/Manila timezone for this Philippine-based app

import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { format, parse, parseISO, isValid } from 'date-fns';

export const TIMEZONE = 'Asia/Manila';

/**
 * Parse many date shapes coming from Sheets / Apps Script into a real Date.
 *
 * Supported examples:
 * - 2026-01-04T14:34:00.000Z
 * - 01-04-2026, 14:34
 * - 01/04/2026, 14:34
 * - 01/04/2026 2:34 PM
 */
export function parseManilaDate(input: string): Date | null {
  if (!input) return null;

  const value = String(input).trim();

  // ISO-like values
  if (value.includes('T')) {
    try {
      // Some Apps Script values represent local time but end with "Z".
      // If we treat as UTC it shifts; removing "Z" keeps the wall-clock time.
      const normalized = value.endsWith('Z') ? value.replace(/Z$/, '') : value;
      const iso = parseISO(normalized);
      return isValid(iso) ? toZonedTime(iso, TIMEZONE) : null;
    } catch {
      return null;
    }
  }

  // Common sheet string formats
  const formats = [
    'MM-dd-yyyy, HH:mm',
    'dd-MM-yyyy, HH:mm',
    'MM/dd/yyyy, HH:mm',
    'MM/dd/yyyy HH:mm',
    'MM/dd/yyyy h:mm a',
    'MM/dd/yyyy, h:mm a',
    'MM-dd-yyyy',
    'MM/dd/yyyy',
  ];

  // Heuristic for ambiguous "01-04-2026": if first part > 12, it's day-month.
  const m = value.match(/^(\d{2})-(\d{2})-(\d{4})(?:,\s*(\d{2}):(\d{2}))?$/);
  const preferDayFirst = !!(m && Number(m[1]) > 12);

  for (const fmt of formats) {
    if (preferDayFirst && fmt.startsWith('MM-')) continue;
    const parsed = parse(value, fmt, new Date());
    if (isValid(parsed)) return toZonedTime(parsed, TIMEZONE);
  }

  // Final fallback: let JS try (can be browser-dependent)
  const d = new Date(value);
  return isValid(d) ? toZonedTime(d, TIMEZONE) : null;
}


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
    
    // Handle ISO calendar dates (yyyy-MM-dd) stored by the database
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return format(new Date(parseInt(y), parseInt(m) - 1, parseInt(d)), formatStr);
    }

    // Handle MM/dd/yyyy or MM-dd-yyyy format (with optional time)
    if (dateStr.includes('/') || dateStr.includes('-')) {
      // Split off time portion if present (format: "MM-dd-yyyy, HH:mm" or "MM/dd/yyyy HH:mm")
      const [datePart, timePart] = dateStr.split(/[, ]+/);
      const parts = datePart.split(/[-/]/);
      
      if (parts.length === 3) {
        // yyyy-MM-dd with a trailing time component
        const isYearFirst = parts[0].length === 4;
        const [month, day, year] = isYearFirst
          ? [parts[1], parts[2], parts[0]]
          : [parts[0], parts[1], parts[2]];

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
