import { LoginRequest, LoginResponse, LoginError } from '@/components/Auth/types/loginTypes'

/**
 * Handles login requests to the server-side API endpoint
 * @param loginData - The login credentials and allowed user types
 * @returns Promise resolving to either success response or error
 */
export async function handleLogin(loginData: LoginRequest): Promise<LoginResponse | LoginError> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData),
    })

    const data = await response.json()

    if (!response.ok) {
      return data as LoginError
    }

    return data as LoginResponse
  } catch (error) {
    console.error('Login request failed:', error)
    return {
      error: 'Network error',
      message: 'Failed to connect to the server. Please try again.',
    }
  }
}
