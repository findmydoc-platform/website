/**
 * Formats a timestamp (interpreted in UTC) into MM/DD/YYYY.
 * Falls back to the current date (also UTC) when the provided value is falsy.
 * Intentionally uses UTC getters to ensure deterministic output independent of
 * the server or test runner timezone (the tests assert on UTC dates such as
 * 12/31/2023 for 2023-12-31T23:59:59.999Z even when the local TZ would roll over).
 *
 * Invalid dates return the string "NaN/NaN/NaN" which the tests rely on.
 *
 * @param timestamp - ISO 8601 timestamp string (or any falsy value) to format
 * @returns Formatted date string (MM/DD/YYYY)
 *
 * @example
 * formatDateTime('2023-12-25T10:30:00.000Z') // "12/25/2023"
 * formatDateTime('')                         // current UTC date
 */
export const formatDateTime = (timestamp?: unknown): string => {
  const useNow = !timestamp
  const date = useNow ? new Date() : new Date(timestamp as string)

  const MM = String(date.getUTCMonth() + 1).padStart(2, '0')
  const DD = String(date.getUTCDate()).padStart(2, '0')
  const YYYY = date.getUTCFullYear()

  return `${MM}/${DD}/${YYYY}`
}
