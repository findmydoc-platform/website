import type { PayloadRequest } from 'payload'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import { selectTransactionalEmailCommandAcceptance } from '@/features/transactionalEmail/payloadIntegration'
import { getCurrentIsoTimestampString } from '@/utilities/timestamps'
import { runClinicRegistrationTransaction } from './transactions'

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

type ClinicRegistrationSubmission = {
  applicationId: number | string
  created: boolean
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

function normalizeClinicRegistrationInput(input: ClinicRegistrationInput): ClinicRegistrationInput {
  return {
    ...input,
    clinicName: input.clinicName.trim(),
    contactEmail: normalizeEmail(input.contactEmail),
  }
}

async function findExistingClinicApplication(req: PayloadRequest, input: ClinicRegistrationInput) {
  const result = await req.payload.find({
    collection: 'clinicApplications',
    req,
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: {
      and: [
        { clinicName: { equals: input.clinicName } },
        { contactEmail: { equals: input.contactEmail } },
        { status: { in: ['submitted', 'approved'] } },
      ],
    },
  })
  return result.docs[0] ?? null
}

async function submitInTransaction(
  req: PayloadRequest,
  input: ClinicRegistrationInput,
  accept?: (command: { type: typeof REGISTRATION_COMMAND; registrationId: number }) => Promise<unknown>,
): Promise<ClinicRegistrationSubmission> {
  const existing = await findExistingClinicApplication(req, input)
  if (existing) return { applicationId: existing.id, created: false }

  const application = await createClinicApplication(req, input)
  if (accept) await accept({ type: REGISTRATION_COMMAND, registrationId: application.id })
  return { applicationId: application.id, created: true }
}

export async function submitClinicRegistration(
  req: PayloadRequest,
  input: ClinicRegistrationInput,
): Promise<ClinicRegistrationSubmission> {
  try {
    const normalizedInput = normalizeClinicRegistrationInput(input)
    const acceptance = selectTransactionalEmailCommandAcceptance(REGISTRATION_COMMAND)
    if (acceptance.kind === 'inactive') {
      return await runClinicRegistrationTransaction(req, (transactionReq) =>
        submitInTransaction(transactionReq, normalizedInput),
      )
    }

    return await acceptance.run(req, (transactionReq, commands) =>
      submitInTransaction(transactionReq, normalizedInput, commands.accept),
    )
  } catch (error) {
    if (error instanceof ClinicRegistrationSubmissionError) throw error
    throw new ClinicRegistrationSubmissionError(error)
  }
}
