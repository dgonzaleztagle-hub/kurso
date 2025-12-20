/**
 * Utility functions for consistent date handling across the application
 * Prevents timezone conversion issues when working with date-only values
 */

/**
 * Formats a Date object to YYYY-MM-DD string in local timezone
 * Use this when sending dates to the database
 */
export const formatDateForDB = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parses a date string (YYYY-MM-DD) to a Date object in local timezone
 * Use this when reading dates from the database
 */
export const parseDateFromDB = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Formats a date string from DB to display format (dd/MM/yyyy)
 */
export const formatDateForDisplay = (dateStr: string): string => {
  try {
    const date = parseDateFromDB(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateStr;
  }
};

/**
 * Gets today's date as YYYY-MM-DD string in local timezone
 */
export const getTodayForDB = (): string => {
  return formatDateForDB(new Date());
};
