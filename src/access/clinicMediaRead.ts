import type { Access } from 'payload'

import { platformOrOwnClinicResource } from './scopeFilters'

export const clinicMediaReadAccess: Access = async ({ req, isReadingStaticFile }) => {
  const scopedAccess = await platformOrOwnClinicResource({ req })
  if (!isReadingStaticFile) {
    return scopedAccess
  }

  if (scopedAccess) {
    return scopedAccess
  }

  const isAnonymous = !req.user
  const isPatientUser = req.user?.collection === 'patients'
  if (isAnonymous || isPatientUser) {
    return {
      'clinic.status': {
        equals: 'approved',
      },
    }
  }

  return false
}
