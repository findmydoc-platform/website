const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/(_gh_sess=)[^;\s]+/g, '$1[redacted]'],
  [/(user_session=)[^;\s]+/g, '$1[redacted]'],
  [/(__Host-user_session_same_site=)[^;\s]+/g, '$1[redacted]'],
  [/(logged_in=)[^;\s]+/g, '$1[redacted]'],
  [/(authenticity_token["'=:\s]+)[A-Za-z0-9_=-]+/gi, '$1[redacted]'],
  [/(X-Amz-Signature["'=:\s]+)[A-Fa-f0-9]+/g, '$1[redacted]'],
  [/(policy["'=:\s]+)[A-Za-z0-9+/=]+/g, '$1[redacted]'],
  [/(jwt=)[A-Za-z0-9._-]+/g, '$1[redacted]'],
]

export const redactSecrets = (value: unknown): string => {
  let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)

  for (const [pattern, replacement] of SECRET_PATTERNS) {
    text = text.replace(pattern, replacement)
  }

  return text
}

export const info = (message: string): void => {
  console.log(message)
}

export const warn = (message: string): void => {
  console.warn(message)
}

export const fail = (error: unknown): never => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(redactSecrets(message))
  process.exit(1)
}
