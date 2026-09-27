import type { PayloadRequest } from 'payload'
import { selectTransactionalEmailCommandAcceptance } from '@/features/transactionalEmail/payloadIntegration'
import { getCurrentIsoTimestampString } from '@/utilities/timestamps'

const PRIVACY_NOTICE_URL = '/privacy-policy'
const REGISTRATION_COMMAND = 'clinic.registration-received' as const

export type ClinicRegistrationInput = {
  clinicName: string
  clinicWebsite: string
  contactFirstName: string
  contactLastName: string
  contactEmail: string
  contactRole: 'Medical Director' | 'Clinic Management' | 'International Office'
  medicalSpecialtyIds: number[]
  sourceMeta: {
    ip: string
    userAgent: string
  }
}

export class ClinicRegistrationSubmissionError extends Error {
  readonly code = 'clinic-registration-unavailable'

  constructor(cause: unknown) {
    super('clinic-registration-unavailable', { cause })
    this.name = 'ClinicRegistrationSubmissionError'
  }
}

async function createClinicApplication(req: PayloadRequest, input: ClinicRegistrationInput) {
  return req.payload.create({
    collection: 'clinicApplications',
    req,
    data: {
      clinicName: input.clinicName,
      clinicWebsite: input.clinicWebsite,
      contactFirstName: input.contactFirstName,
      contactLastName: input.contactLastName,
      contactEmail: input.contactEmail,
      contactRole: input.contactRole,
      medicalSpecialties: input.medicalSpecialtyIds,
      status: 'submitted',
      sourceMeta: input.sourceMeta,
      privacyNotice: {
        acknowledgedAt: getCurrentIsoTimestampString(),
        url: PRIVACY_NOTICE_URL,
      },
    },
    overrideAccess: true,
  })
}

export async function submitClinicRegistration(
  req: PayloadRequest,
  input: ClinicRegistrationInput,
): Promise<{ applicationId: number | string }> {
  try {
    const acceptance = selectTransactionalEmailCommandAcceptance(REGISTRATION_COMMAND)
    if (acceptance.kind === 'inactive') {
      const application = await createClinicApplication(req, input)
      return { applicationId: application.id }
    }

    return await acceptance.run(req, async (transactionReq, commands) => {
      const application = await createClinicApplication(transactionReq, input)
      await commands.accept({ type: REGISTRATION_COMMAND, registrationId: application.id })
      return { applicationId: application.id }
    })
  } catch (error) {
    if (error instanceof ClinicRegistrationSubmissionError) throw error
    throw new ClinicRegistrationSubmissionError(error)
  }
}
