/**
 * Scope-based Access Control Filters
 *
 * Reusable access functions for clinic/patient-scoped resources.
 * These functions implement the permission matrix logic for resources
 * that require scope filtering based on user roles.
 */

import type { Access } from 'payload'
import { isPlatformBasicUser } from './isPlatformBasicUser'
import { isClinicBasicUser } from './isClinicBasicUser'
import { isPatient } from './isPatient'
import { getUserAssignedClinicId } from './utils/getClinicAssignment'

/**
 * Platform Staff: Full access to all records
 * Clinic Staff: Only records from their assigned clinic
 */
export const platformOrOwnClinicResource: Access = async ({ req }) => {
  // Platform Staff: Full access
  if (isPlatformBasicUser({ req })) {
    return true
  }

  // Clinic Staff: Only their assigned clinic's resources
  if (isClinicBasicUser({ req })) {
    const clinicId = await getUserAssignedClinicId(req.user, req.payload)
    if (clinicId) {
      return {
        clinic: {
          equals: clinicId,
        },
      }
    }
  }

  // No access for others
  return false
}

/**
 * Platform Staff: Full access to all records
 * Patient: Only their own records
 */
export const platformOrOwnPatientResource: Access = async ({ req }) => {
  // Platform Staff: Full access
  if (isPlatformBasicUser({ req })) {
    return true
  }

  // Patient: Only their own records
  if (isPatient({ req })) {
    return {
      patient: {
        equals: req.user?.id,
      },
    }
  }

  // No access for others
  return false
}

/**
 * Platform Staff: Full access
 * Clinic Staff: Only their own clinic profile
 */
export const platformOrOwnClinicProfile: Access = async ({ req }) => {
  // Platform Staff: Full access
  if (isPlatformBasicUser({ req })) {
    return true
  }

  // Clinic Staff: Only their assigned clinic
  if (isClinicBasicUser({ req })) {
    const clinicId = await getUserAssignedClinicId(req.user, req.payload)
    if (clinicId) {
      return {
        id: {
          equals: clinicId,
        },
      }
    }
  }

  // Others get public access for read (handled by individual collection access)
  return false
}

/**
 * Scope filter for user-owned resources (patient or clinic staff)
 */
export const ownResourceOnly: Access = ({ req }) => {
  if (!req.user) return false

  return {
    user: {
      equals: req.user.id,
    },
  }
}

/**
 * Platform Staff: Full access to all records
 * Clinic Staff: Only records for doctors from their assigned clinic
 */
export const platformOrOwnClinicDoctorResource: Access = async ({ req }) => {
  // Platform Staff: Full access
  if (isPlatformBasicUser({ req })) {
    return true
  }

  // Clinic Staff: Only doctor resources from their assigned clinic
  if (isClinicBasicUser({ req })) {
    const clinicId = await getUserAssignedClinicId(req.user, req.payload)
    if (clinicId) {
      return {
        'doctor.clinic': {
          equals: clinicId,
        },
      }
    }
  }

  // No access for others
  return false
}

/**
 * Platform Staff: Full access to all content (including drafts)
 * All other users: Only published content
 */
export const platformOnlyOrPublished: Access = ({ req: { user } }) => {
  // Platform Staff: Full access to all content including drafts
  if (user && user.collection === 'basicUsers' && user.userType === 'platform') {
    return true
  }

  // All other users (Clinic Staff, Patients, Anonymous): Only published content
  return {
    _status: {
      equals: 'published',
    },
  }
}

/**
 * Platform Staff: Full access to all clinics (including drafts/pending)
 * All other users: Only approved clinics
 */
export const platformOnlyOrApproved: Access = ({ req: { user } }) => {
  // Platform Staff: Full access to all clinics including drafts/pending
  if (user && user.collection === 'basicUsers' && user.userType === 'platform') {
    return true
  }

  // All other users (Clinic Staff, Patients, Anonymous): Only approved clinics
  return {
    status: {
      equals: 'approved',
    },
  }
}

/**
 * Platform Staff: Full access to all reviews (including pending/rejected) for moderation
 * All other users: Only approved reviews
 */
export const platformOnlyOrApprovedReviews: Access = ({ req: { user } }) => {
  // Platform Staff: Full access to all reviews for moderation
  if (user && user.collection === 'basicUsers' && user.userType === 'platform') {
    return true
  }

  // All other users (Clinic Staff, Patients, Anonymous): Only approved reviews
  return {
    status: {
      equals: 'approved',
    },
  }
}
