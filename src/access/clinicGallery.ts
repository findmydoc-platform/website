import type { Access } from 'payload'

import { isPlatformBasicUser } from './isPlatformBasicUser'
import { isClinicBasicUser } from './isClinicBasicUser'
import { getUserAssignedClinicId } from './utils/getClinicAssignment'

/**
 * Shared access helpers for clinic gallery collections (media + entries).
 */

/**
 * Read access: platform users see everything, clinic staff are scoped to their clinic,
 * everyone else only sees published documents.
 */
export const clinicGalleryReadAccess: Access = async ({ req }) => {
  if (isPlatformBasicUser({ req })) {
    return true
  }

  if (isClinicBasicUser({ req })) {
    const clinicId = await getUserAssignedClinicId(req.user, req.payload)
    if (clinicId) {
      return {
        clinic: {
          equals: clinicId,
        },
      } as any
    }
    return false
  }

  return {
    status: {
      equals: 'published',
    },
  } as any
}

/**
 * Mutation access: platform users get full control; clinic staff are scoped to their clinic.
 */
export const clinicGalleryScopedMutationAccess: Access = async ({ req }) => {
  if (isPlatformBasicUser({ req })) {
    return true
  }

  if (isClinicBasicUser({ req })) {
    const clinicId = await getUserAssignedClinicId(req.user, req.payload)
    if (clinicId) {
      return {
        clinic: {
          equals: clinicId,
        },
      } as any
    }
  }

  return false
}
