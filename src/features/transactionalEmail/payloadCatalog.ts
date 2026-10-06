import { createLocalReq, type PayloadRequest } from 'payload'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'
import { bindAuthActions } from '@/auth/actions/lifecycle'
import { resolveVerificationKeys } from '@/auth/actions/verificationConfiguration'
import { createPasswordRecoveryCatalogEntry } from './passwordRecovery'
import { recoveryAdmin } from './recoveryAdmin'
import { readRecoveryPrincipal } from '@/auth/actions/recoveryPrincipal'
import { resolveRecoveryKeys } from '@/auth/actions/recoveryConfiguration'
import { createCommandCatalog } from './catalog'
import { findClinicApplication } from './clinicApplicationSource'
import { resolveTransactionalEmailEnvironment } from './environment'
import { createClinicInvitationCatalogEntry } from './clinicInvitation'
import { createPatientVerificationCatalogEntry } from './patientVerification'
import { findClinicInvitationPrincipal } from '@/auth/actions/clinicInvitationPrincipal'
import { createConversationMessageCatalogEntry } from './conversationMessage'
import { createModerationReportReceivedCatalogEntry } from './moderationReportReceived'
import { createModerationReportDecidedCatalogEntry } from './moderationReportDecided'
import { createModerationAppealReceivedCatalogEntry } from './moderationAppealReceived'

export function bindPayloadCommandCatalog(req: PayloadRequest, options: { recoverySignal?: AbortSignal } = {}) {
  const environment = resolveTransactionalEmailEnvironment()
  return Object.freeze({
    ...createCommandCatalog({ findClinicApplication: (id) => findClinicApplication(req, id) }),
    'conversation.external-message-received': createConversationMessageCatalogEntry(req, environment),
    'moderation.report-received': createModerationReportReceivedCatalogEntry(req),
    'moderation.report-decided': createModerationReportDecidedCatalogEntry(req),
    'moderation.appeal-received': createModerationAppealReceivedCatalogEntry(req),
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
    'auth.password-recovery': createPasswordRecoveryCatalogEntry({
      environment,
      signal: options.recoverySignal,
      recoveryKeys: () => resolveRecoveryKeys(environment),
      actions: {
        async read(id) {
          const sourceReq = await createLocalReq({}, req.payload)
          return bindAuthActions(sourceReq, { environment }).read(id)
        },
      },
      findPrincipal: async (collection, id) => {
        const sourceReq = await createLocalReq({}, req.payload)
        return readRecoveryPrincipal(sourceReq, collection, id)
      },
      admin: (principal) => recoveryAdmin(environment, principal, options.recoverySignal),
    }),
    'auth.invitation': createClinicInvitationCatalogEntry({
      environment,
      actions: {
        async read(id) {
          const sourceReq = await createLocalReq({}, req.payload)
          return bindAuthActions(sourceReq, { environment }).read(id)
        },
      },
      findPrincipal: async (clinicStaffId) => {
        const sourceReq = await createLocalReq({}, req.payload)
        return findClinicInvitationPrincipal(sourceReq, clinicStaffId)
      },
      admin: async () => (await createAdminClient()).auth.admin,
    }),
  })
}
