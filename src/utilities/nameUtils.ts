// Capitalize the first letter of a string
export const capitalizeFirstLetter = (string: string): string =>
  string.charAt(0).toUpperCase() + string.slice(1)

// Combine first and last name into a full name
export const generateFullName = (firstName: string, lastName: string): string => {
  const capFirstName = capitalizeFirstLetter(firstName)
  const capLastName = capitalizeFirstLetter(lastName)
  return `${capFirstName} ${capLastName}`.trim()
}
