import type { Access, Where } from 'payload'

import { isPlatformStaff } from './isPlatformStaff'
import { isClinicStaff } from './isClinicStaff'
import { getUserAssignedClinicId } from './utils/getClinicAssignment'

/**
 * Shared access helpers for clinic gallery collections (media + entries).
 */

/**
 * The before-and-after gallery is intentionally disabled pending a new product decision and legal review.
 * Keep the schema and stored data intact, but do not expose the feature through regular application access.
 */
export const disabledClinicGalleryAccess = (_args?: unknown): false => false

/**
 * Read access: platform users see everything, clinic staff are scoped to their clinic,
 * everyone else only sees published documents.
 */
export const clinicGalleryReadAccess: Access = async ({ req }) => {
  if (isPlatformStaff({ req })) {
    return true
  }

  if (isClinicStaff({ req })) {
    const clinicId = await getUserAssignedClinicId(req.user, req.payload)
    if (clinicId) {
      const clinicFilter: Where = {
        clinic: {
          equals: clinicId,
        },
      }
      return clinicFilter
    }
    return false
  }

  const publishedFilter: Where = {
    status: {
      equals: 'published',
    },
  }
  return publishedFilter
}

/**
 * Mutation access: platform users get full control; clinic staff are scoped to their clinic.
 */
export const clinicGalleryScopedMutationAccess: Access = async ({ req }) => {
  if (isPlatformStaff({ req })) {
    return true
  }

  if (isClinicStaff({ req })) {
    const clinicId = await getUserAssignedClinicId(req.user, req.payload)
    if (clinicId) {
      const clinicFilter: Where = {
        clinic: {
          equals: clinicId,
        },
      }
      return clinicFilter
    }
  }

  return false
}
