import type { Access } from 'payload'

import { doctorSourceAccess } from '@/features/doctorProfiles/authorization'

export const doctorMediaReadAccess: Access = async ({ req, isReadingStaticFile }) => {
  const scopedAccess = await doctorSourceAccess()({ req })
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
