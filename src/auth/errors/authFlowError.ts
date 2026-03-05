export const AUTH_FLOW_ERROR_CODES = {
  INVALID_EMAIL: 'AUTH_INVALID_EMAIL',
  USER_LOOKUP_FAILED: 'AUTH_USER_LOOKUP_FAILED',
  USER_CREATE_FAILED: 'AUTH_USER_CREATE_FAILED',
  USER_CREATE_CONFLICT: 'AUTH_USER_CREATE_CONFLICT',
  PATIENT_PROVISION_FAILED: 'AUTH_PATIENT_PROVISION_FAILED',
} as const

export type AuthFlowErrorCode = (typeof AUTH_FLOW_ERROR_CODES)[keyof typeof AUTH_FLOW_ERROR_CODES]

export class AuthFlowError extends Error {
  readonly code: AuthFlowErrorCode
  readonly retryable: boolean
  readonly causeError?: unknown

  constructor({
    code,
    message,
    retryable = false,
    causeError,
  }: {
    code: AuthFlowErrorCode
    message: string
    retryable?: boolean
    causeError?: unknown
  }) {
    super(message)
    this.name = 'AuthFlowError'
    this.code = code
    this.retryable = retryable
    this.causeError = causeError
  }
}

export const isAuthFlowError = (error: unknown): error is AuthFlowError => error instanceof AuthFlowError

export const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

const CONFLICT_PATTERN = /(duplicate|already exists|unique|violates unique)/i
const INVALID_EMAIL_PATTERN = /(invalid:? ?email|email is required|email.*invalid)/i

export const isConflictErrorMessage = (message: string): boolean => CONFLICT_PATTERN.test(message)

export const isInvalidEmailErrorMessage = (message: string): boolean => INVALID_EMAIL_PATTERN.test(message)
