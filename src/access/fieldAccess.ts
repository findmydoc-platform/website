/**
 * Field-Level Access Control Functions
 *
 * These functions are specifically for PayloadCMS field-level access control.
 * They return boolean values instead of Where query objects.
 */

import type { FieldAccess } from 'payload'

/**
 * Only Platform Staff can create/edit this field
 */
export const platformOnlyFieldAccess: FieldAccess = ({ req }) => {
  return Boolean(req.user && req.user.collection === 'basicUsers' && req.user.userType === 'platform')
}
