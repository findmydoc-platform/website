// Capitalize the first letter of a string
export const capitalizeFirstLetter = (string: string | null | undefined): string => {
  if (!string || typeof string !== 'string') return ''
  return string.charAt(0).toUpperCase() + string.slice(1)
}

// Combine first and last name into a full name
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
