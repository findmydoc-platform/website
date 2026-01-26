/**
 * Capitalize the first letter of a string.
 * Returns empty string if input is null, undefined, or not a string.
 *
 * @param string - The string to capitalize
 * @returns Capitalized string or empty string if invalid input
 *
 * @example
 * capitalizeFirstLetter('hello') // Returns "Hello"
 * capitalizeFirstLetter('') // Returns ""
 * capitalizeFirstLetter(null) // Returns ""
 */
export const capitalizeFirstLetter = (string: string | null | undefined): string => {
  if (!string || typeof string !== 'string') return ''
  return string.charAt(0).toUpperCase() + string.slice(1)
}

/**
 * Combine title, first name, and last name into a full name.
 * Capitalizes each component and handles null/undefined values gracefully.
 *
 * @param title - Optional title (e.g., "Dr.", "Mr.")
 * @param firstName - First name
 * @param lastName - Last name
 * @returns Combined full name with proper capitalization, trimmed of extra spaces
 *
 * @example
 * generateFullName('dr', 'john', 'doe') // Returns "Dr John Doe"
 * generateFullName(null, 'jane', 'smith') // Returns "Jane Smith"
 * generateFullName('', '', '') // Returns ""
 */
export const generateFullName = (
  title: string | null | undefined,
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string => {
  const trimmedTitle = title ? capitalizeFirstLetter(title) : ''
  const capFirstName = capitalizeFirstLetter(firstName)
  const capLastName = capitalizeFirstLetter(lastName)
  return `${trimmedTitle} ${capFirstName} ${capLastName}`.trim()
}
