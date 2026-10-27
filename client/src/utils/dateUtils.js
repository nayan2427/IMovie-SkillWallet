/**
 * Date formatting utilities for cinema scheduling and calendar queries.
 * Ensures consistent YYYY-MM-DD representation using local calendar components,
 * preventing UTC rollover bugs across timezones.
 */

/**
 * Formats a Date object or timestamp as 'YYYY-MM-DD' using local calendar components.
 * 
 * @param {Date|string|number} [date=new Date()] - Date to format
 * @returns {string} Formatted local date string 'YYYY-MM-DD'
 */
export const formatLocalDate = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Returns a human-readable local date string from a 'YYYY-MM-DD' calendar string
 * without UTC shift.
 * 
 * @param {string} dateStr - 'YYYY-MM-DD' date string
 * @param {Intl.DateTimeFormatOptions} [options] - Intl format options
 * @returns {string} Formatted human-readable date
 */
export const formatDisplayDate = (dateStr, options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) => {
  if (!dateStr) return '';
  // Appending 'T00:00:00' ensures Date parses in local midnight rather than UTC midnight
  const localMidnight = new Date(`${dateStr}T00:00:00`);
  if (isNaN(localMidnight.getTime())) return dateStr;
  return localMidnight.toLocaleDateString('en-US', options);
};
