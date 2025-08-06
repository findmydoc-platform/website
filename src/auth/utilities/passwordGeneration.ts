import { randomBytes } from 'crypto'

/**
 * Generates a secure random password for temporary user accounts.
 * Used when creating Supabase users from admin panel.
 *
 * @param length - Password length (default: 16)
 * @returns Secure random password
 */
export function generateSecurePassword(length: number = 16): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const randomBytesArray = randomBytes(length)

  let password = ''
  for (let i = 0; i < length; i++) {
    const charIndex = randomBytesArray[i]! % charset.length
    password += charset[charIndex]!
  }

  return password
}
