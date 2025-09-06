/**
 * Formats a timestamp string into MM/DD/YYYY format.
 * If no timestamp is provided, uses the current date.
 * 
 * @param timestamp - ISO 8601 timestamp string to format
 * @returns Formatted date string in MM/DD/YYYY format
 * 
 * @example
 * formatDateTime('2023-12-25T10:30:00.000Z') // Returns "12/25/2023"
 * formatDateTime('') // Returns current date in MM/DD/YYYY format
 */
export const formatDateTime = (timestamp: string): string => {
  const now = new Date()
  let date = now
  if (timestamp) date = new Date(timestamp)
  const months = date.getMonth()
  const days = date.getDate()
  // const hours = date.getHours();
  // const minutes = date.getMinutes();
  // const seconds = date.getSeconds();

  const MM = months + 1 < 10 ? `0${months + 1}` : months + 1
  const DD = days < 10 ? `0${days}` : days
  const YYYY = date.getFullYear()
  // const AMPM = hours < 12 ? 'AM' : 'PM';
  // const HH = hours > 12 ? hours - 12 : hours;
  // const MinMin = (minutes < 10) ? `0${minutes}` : minutes;
  // const SS = (seconds < 10) ? `0${seconds}` : seconds;

  return `${MM}/${DD}/${YYYY}`
}
