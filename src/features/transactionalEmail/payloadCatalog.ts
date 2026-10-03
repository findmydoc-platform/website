import { createLocalReq, type PayloadRequest } from 'payload'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'
import { bindAuthActions } from '@/auth/actions/lifecycle'
import { resolveVerificationKeys } from '@/auth/actions/verificationConfiguration'
import { createCommandCatalog } from './catalog'
import { findClinicApplication } from './clinicApplicationSource'
import { resolveTransactionalEmailEnvironment } from './environment'
import { createPatientVerificationCatalogEntry } from './patientVerification'

export function bindPayloadCommandCatalog(req: PayloadRequest) {
  const environment = resolveTransactionalEmailEnvironment()
  return Object.freeze({
    ...createCommandCatalog({ findClinicApplication: (id) => findClinicApplication(req, id) }),
    'auth.email-verification': createPatientVerificationCatalogEntry({
      environment,
      verificationKeys: () => resolveVerificationKeys(environment),
      actions: {
        async read(id) {
          const sourceReq = await createLocalReq({}, req.payload)
          return bindAuthActions(sourceReq, { environment }).read(id)
        },
      },
      admin: async () => (await createAdminClient()).auth.admin,
    }),
  })
}
