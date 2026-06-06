/**
 * Field-Level Access Control Functions
 *
 * These functions are specifically for PayloadCMS field-level access control.
 * They return boolean values instead of Where query objects.
 */

import type { Access, FieldAccess, PayloadRequest } from 'payload'

const clinicTrustManagerRoles = ['admin', 'support'] as const

const isPlatformUser = (user: PayloadRequest['user']): boolean => {
  return Boolean(user && user.collection === 'basicUsers' && user.userType === 'platform')
}

const hasClinicTrustManagerRole = async (req: PayloadRequest): Promise<boolean> => {
  if (!isPlatformUser(req.user)) return false
  if (!req.payload || typeof req.payload.find !== 'function') return false

  try {
    const result = await req.payload.find({
      collection: 'platformStaff',
      depth: 0,
      limit: 1,
      pagination: false,
      req,
      where: {
        and: [
          {
            user: {
              equals: req.user?.id,
            },
          },
          {
            role: {
              in: [...clinicTrustManagerRoles],
            },
          },
        ],
      },
    })

    return result.docs.length > 0
  } catch (error) {
    req.payload.logger.warn({ error }, 'Unable to resolve platform staff role for clinic trust access')
    return false
  }
}

/**
 * Only Platform Staff can create/edit this field
 */
export const platformOnlyFieldAccess: FieldAccess = ({ req }) => {
  return isPlatformUser(req.user)
}

/**
 * Only Platform Staff with clinic trust management roles can create clinic records.
 */
export const platformClinicTrustAccess: Access = async ({ req }) => {
  return hasClinicTrustManagerRole(req)
}

/**
 * Only Platform Staff with clinic trust management roles can create/edit this field.
 */
export const platformClinicTrustFieldAccess: FieldAccess = async ({ req }) => {
  return hasClinicTrustManagerRole(req)
}
