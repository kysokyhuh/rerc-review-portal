"use strict";
/**
 * CSV utility functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.csvEscape = csvEscape;
exports.formatDateISO = formatDateISO;
/**
 * Escapes a value for CSV output, handling dates, nulls, and special characters
 */
function csvEscape(value) {
    if (value === null || value === undefined) {
        return "";
    }
    let str;
    if (value instanceof Date) {
        str = value.toISOString().slice(0, 10);
    }
    else {
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
function formatDateISO(value) {
    if (!value)
        return null;
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime()))
        return null;
    return date.toISOString().slice(0, 10);
}
