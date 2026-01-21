/**
 * CSV utility functions
 */

/**
 * Escapes a value for CSV output, handling dates, nulls, and special characters
 */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let str: string;
  if (value instanceof Date) {
    str = value.toISOString().slice(0, 10);
  } else {
    str = String(value);
  }

  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Formats a date value to ISO date string (YYYY-MM-DD) or null
 */
export function formatDateISO(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}
