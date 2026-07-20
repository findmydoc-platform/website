import type { Payload, PayloadRequest } from 'payload'
import { readClinicAccessState } from '@/auth/utilities/clinicAccessState'

// Normalize a clinic identifier into a numeric id if possible.
// Accepts raw numbers, numeric strings, or prefixed values like "clinic-123".
export const normalizeClinicId = (value: unknown): number | null => {
  if (value === null || value === undefined) return null

  const str = String(value).trim()
  if (!str.length) return null

  const withoutPrefix = str.startsWith('clinic-') ? str.slice('clinic-'.length) : str
  const asNumber = Number(withoutPrefix)

  return Number.isFinite(asNumber) ? asNumber : null
}

/**
 * Get the clinic ID that a clinic user is assigned to via their ClinicStaff profile
 * @param user - The authenticated user from req.user
 * @param payload - Payload instance from req.payload
 * @returns Promise<number | null> - The clinic ID or null if not found/applicable
 */
export async function getUserAssignedClinicId(user: PayloadRequest['user'], payload: Payload): Promise<number | null> {
  if (!user || user.collection !== 'clinicStaff') {
    return null
  }

  try {
    const accessState = await readClinicAccessState(payload, user.id)
    if (!accessState) {
      payload.logger.warn(`No access-ready clinic staff principal found for user ${user.id}`)
      return null
    }

    return normalizeClinicId(accessState.clinic.id)
  } catch (error) {
    payload.logger.error(error, 'Error getting clinic assignment')
    return null
  }
}
