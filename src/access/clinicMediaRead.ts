import { readClinicPrincipalAccess } from '@/auth/utilities/clinicPrincipalAccess'
import type { Access } from 'payload'

import { platformOrOwnClinicResource } from './scopeFilters'

export const clinicMediaReadAccess: Access = async ({ req, isReadingStaticFile }) => {
  const current =
    req.user?.collection === 'clinicStaff' ? await readClinicPrincipalAccess(req.payload, req.user.id, req) : null
  const scopedAccess =
    req.user?.collection === 'clinicStaff'
      ? current?.clinics.length
        ? current.clinics.length === 1
          ? { clinic: { equals: current.clinics[0]!.id } }
          : { clinic: { in: current.clinics.map((clinic) => clinic.id) } }
        : false
      : await platformOrOwnClinicResource({ req })
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
      and: [
        {
          status: {
            equals: 'published',
          },
        },
        {
          'clinic.status': {
            equals: 'approved',
          },
        },
      ],
    }
  }

  return false
}
