const LOCAL_EXTRA_CHARACTERS = new Set([
  '!',
  '#',
  '$',
  '%',
  '&',
  "'",
  '*',
  '+',
  '-',
  '/',
  '=',
  '?',
  '^',
  '_',
  '`',
  '{',
  '|',
  '}',
  '~',
  '.',
])
const WHITESPACE_CHARACTERS = new Set([' ', '\n', '\r', '\t', '\f', '\v'])

const isDigit = (char: string): boolean => char >= '0' && char <= '9'
const isLowercaseLetter = (char: string): boolean => char >= 'a' && char <= 'z'
const isUppercaseLetter = (char: string): boolean => char >= 'A' && char <= 'Z'
const isLetter = (char: string): boolean => isLowercaseLetter(char) || isUppercaseLetter(char)
const isAlphaNumeric = (char: string): boolean => isLetter(char) || isDigit(char)

const containsWhitespace = (value: string): boolean => {
  for (const char of value) {
    if (WHITESPACE_CHARACTERS.has(char)) {
      return true
    }
  }

  return false
}

const isValidLocalPart = (localPart: string): boolean => {
  if (localPart.length === 0 || localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return false
  }

  for (const char of localPart) {
    if (!isAlphaNumeric(char) && !LOCAL_EXTRA_CHARACTERS.has(char)) {
      return false
    }
  }

  return true
}

const isValidDomainPart = (domainPart: string): boolean => {
  if (domainPart.length === 0 || domainPart.startsWith('.') || domainPart.endsWith('.') || domainPart.includes('..')) {
    return false
  }

  const labels = domainPart.split('.')
  if (labels.length < 2) {
    return false
  }

  for (const label of labels) {
    if (label.length === 0 || label.startsWith('-') || label.endsWith('-')) {
      return false
    }

    for (const char of label) {
      if (!isAlphaNumeric(char) && char !== '-') {
        return false
      }
    }
  }

  return true
}

export const normalizeEmail = (email: string | null | undefined): string => {
  if (typeof email !== 'string') {
    return ''
  }

  return email.trim().toLowerCase()
}

export const isValidEmail = (email: string): boolean => {
  if (email.length === 0 || containsWhitespace(email)) {
    return false
  }

  const atIndex = email.indexOf('@')
  if (atIndex <= 0 || email.indexOf('@', atIndex + 1) !== -1) {
    return false
  }

  const localPart = email.slice(0, atIndex)
  const domainPart = email.slice(atIndex + 1)

  return isValidLocalPart(localPart) && isValidDomainPart(domainPart)
}
