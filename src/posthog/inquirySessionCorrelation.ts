const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u

/**
 * The value is transport-only. Callers must never persist, log, or return it.
 */
export const readClinicInquirySessionId = (value: unknown): string | undefined =>
  typeof value === 'string' && SESSION_ID_PATTERN.test(value) ? value : undefined
