import { format } from "date-fns";

/**
 * Formats a date string (like '2025-10-01') to display correctly,
 * ignoring the user's local timezone. This prevents dates from shifting by a day.
 * @param {string} dateString - The date string to format (e.g., "YYYY-MM-DD").
 * @param {string} formatStr - The desired output format (from date-fns).
 * @returns {string} The correctly formatted date string.
 */
export const formatTourDate = (dateString, formatStr = 'PPP') => {
  if (!dateString) return 'No date set';
  try {
    // Add time to prevent JS from assuming UTC and shifting the date
    const date = new Date(`${dateString}T00:00:00`);
    return format(date, formatStr);
  } catch (e) {
    return "Invalid Date";
  }
};