export type UserType = 'patient' | 'clinic' | 'platform'

export interface LoginRequest {
  email: string
  password: string
  allowedUserTypes: UserType[]
}

export interface LoginResponse {
  success: true
  redirectUrl: string
  user: {
    id: string
    email: string
    userType: UserType
  }
}

export interface LoginError {
  error: string
  message?: string
  details?: Array<{
    field: string
    message: string
  }>
}

export interface LoginFormProps {
  userTypes: UserType[] | UserType // Support both single and multiple user types
  title: string
  redirectAfterLogin?: string
}

export interface LoginState {
  isLoading: boolean
  error: string | null
  fieldErrors: Record<string, string>
}
