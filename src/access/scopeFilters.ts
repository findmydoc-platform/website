/**
 * Scope-based Access Control Filters
 *
 * Reusable access functions for clinic/patient-scoped resources.
 * These functions implement the permission matrix logic for resources
 * that require scope filtering based on user roles.
 */

import type { Access, Where } from 'payload'
import { isPlatformStaff } from './isPlatformStaff'
import { isClinicStaff } from './isClinicStaff'
import { isPatient } from './isPatient'
import { getUserAssignedClinicId } from './utils/getClinicAssignment'
import {
  buildPublicReviewResponseParentConditions,
  buildPublicReviewWhere,
} from '@/collections/reviews/publicProjection'

/**
 * Platform Staff: Full access to all records
 * Clinic Staff: Only records from their assigned clinic
 */
export const platformOrOwnClinicResource: Access = async ({ req }) => {
  // Platform Staff: Full access
  if (isPlatformStaff({ req })) {
    return true
  }

  // Clinic Staff: Only their assigned clinic's resources
  if (isClinicStaff({ req })) {
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
 * Platform Staff: All resources
 * Clinic Staff: Active resources plus inactive resources from their clinic
 * Patients and anonymous users: Active resources only
 */
export const platformOrOwnClinicResourceOrActive: Access = async ({ req }) => {
  if (isPlatformStaff({ req })) {
    return true
  }

  const activeResources = {
    active: {
      equals: true,
    },
  }

  if (isClinicStaff({ req })) {
    const clinicId = await getUserAssignedClinicId(req.user, req.payload)
    if (clinicId) {
      return {
        or: [
          activeResources,
          {
            clinic: {
              equals: clinicId,
            },
          },
        ],
      }
    }
  }

  return activeResources
}

/**
 * Mutation access for create operations where field-level ownership
 * is enforced in beforeChange hooks.
 */
export const platformOrAssignedClinicMutation: Access = async ({ req }) => {
  if (isPlatformStaff({ req })) {
    return true
  }

  if (isClinicStaff({ req })) {
    const clinicId = await getUserAssignedClinicId(req.user, req.payload)
    return clinicId !== null
  }

  return false
}

/**
 * Platform Staff: Full access to all records
 * Patient: Only their own records
 */
export const platformOrOwnPatientResource: Access = async ({ req }) => {
  // Platform Staff: Full access
  if (isPlatformStaff({ req })) {
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
  if (isPlatformStaff({ req })) {
    return true
  }

  // Clinic Staff: Only their assigned clinic
  if (isClinicStaff({ req })) {
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
  if (isPlatformStaff({ req })) {
    return true
  }

  // Clinic Staff: Only doctor resources from their assigned clinic
  if (isClinicStaff({ req })) {
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
  if (user && user.collection === 'platformStaff') {
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
  if (user && user.collection === 'platformStaff') {
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
 * All other users: Only active public review projections
 */
export const platformOnlyOrApprovedReviews: Access = ({ req: { user } }) => {
  // Platform Staff: Full access to all reviews for moderation
  if (user && user.collection === 'platformStaff') {
    return true
  }

  // All other users (Clinic Staff, Patients, Anonymous): Only active public projections
  return buildPublicReviewWhere()
}

/**
 * Platform Staff: All reviews for moderation
 * Clinic Staff: Approved reviews for their assigned clinic
 * Patients and anonymous users: Active public review projections
 */
export const platformOrApprovedReviewsByClinic: Access = async ({ req }) => {
  if (isPlatformStaff({ req })) {
    return true
  }

  if (isClinicStaff({ req })) {
    const clinicId = await getUserAssignedClinicId(req.user, req.payload)
    if (!clinicId) return false

    return {
      and: [
        {
          status: {
            equals: 'approved',
          },
        },
        {
          clinic: {
            equals: clinicId,
          },
        },
      ],
    }
  }

  return buildPublicReviewWhere()
}

/**
 * Platform Staff: All response records
 * Clinic Staff: Response records for their assigned clinic, including moderation history
 * Patients and anonymous users: Only the currently approved, non-blocked response projection
 */
export const platformClinicOrPublicReviewResponse: Access = async ({ req }): Promise<boolean | Where> => {
  if (isPlatformStaff({ req })) {
    return true
  }

  if (isClinicStaff({ req })) {
    const clinicId = await getUserAssignedClinicId(req.user, req.payload)
    if (!clinicId) return false

    return {
      clinic: {
        equals: clinicId,
      },
    } satisfies Where
  }

  return {
    and: [
      ...buildPublicReviewResponseParentConditions(),
      {
        'publishedResponse.body': {
          exists: true,
        },
      },
      {
        'publishedResponse.isBlocked': {
          not_equals: true,
        },
      },
    ],
  } satisfies Where
}

/**
 * Payload version documents wrap collection fields in `version`.
 */
export const platformOrOwnClinicReviewWorkflowVersions: Access = async ({ req }) => {
  if (isPlatformStaff({ req })) {
    return true
  }

  if (isClinicStaff({ req })) {
    const clinicId = await getUserAssignedClinicId(req.user, req.payload)
    if (!clinicId) return false

    return {
      'version.clinic': {
        equals: clinicId,
      },
    }
  }

  return false
}
