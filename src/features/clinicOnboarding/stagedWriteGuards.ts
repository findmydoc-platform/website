import { isDeepStrictEqual } from 'node:util'
import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type PayloadRequest,
} from 'payload'
import type { ClinicApplication, ClinicStaff } from '@/payload-types'
import { clinicApplicationProvisioningInputFields } from '@/collections/clinicApplications/provisioningLifecycle'

type WriteTargets = { applicationId?: number; clinicId?: number; staffId?: number }
const permittedWrites = new WeakMap<PayloadRequest, WriteTargets>()

export async function withMcpOnboardingWrite<Result>(
  req: PayloadRequest,
  targets: WriteTargets,
  write: () => Promise<Result>,
): Promise<Result> {
  if (permittedWrites.has(req)) throw new Error('An onboarding write is already in progress.')
  permittedWrites.set(req, targets)
  try {
    return await write()
  } finally {
    permittedWrites.delete(req)
  }
}

export function isTrustedMcpOnboardingClinicWrite(req: PayloadRequest, clinicId: number): boolean {
  return permittedWrites.get(req)?.clinicId === clinicId
}

function changed<T extends { id: number }>(data: Partial<T>, original: T, fields: readonly (keyof T)[]) {
  return fields.some((field) => Object.hasOwn(data, field) && !isDeepStrictEqual(data[field], original[field]))
}

const onboardingSourceFields = ['mcpOnboardingRequestKey', 'mcpOnboardingStaffMode'] as const
const stagedApplicationFields = [
  ...clinicApplicationProvisioningInputFields,
  'medicalSpecialties',
  'status',
  'reviewNotes',
  'linkedRecords',
  'provisioningStatus',
  'provisioningErrorCode',
] as const

export const guardMcpOnboardingApplication: CollectionBeforeChangeHook<ClinicApplication> = ({
  data,
  originalDoc,
  req,
}) => {
  if (!originalDoc) {
    if (onboardingSourceFields.some((field) => data[field] != null)) {
      throw new APIError('Onboarding source fields are server-managed.', 403)
    }
    return data
  }

  const trusted = permittedWrites.get(req)?.applicationId === originalDoc.id
  if (originalDoc.mcpOnboardingRequestKey && changed(data, originalDoc, onboardingSourceFields)) {
    throw new APIError('The onboarding source cannot be changed.', 409)
  }
  if (!trusted && changed(data, originalDoc, onboardingSourceFields)) {
    throw new APIError('Onboarding source fields are server-managed.', 403)
  }
  if (originalDoc.mcpOnboardingRequestKey && !trusted && changed(data, originalDoc, stagedApplicationFields)) {
    throw new APIError('Use the clinic onboarding workflow to change this application.', 409)
  }
  return data
}

export const guardMcpOnboardingApplicationDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const application = await req.payload.findByID({
    collection: 'clinicApplications',
    id,
    depth: 0,
    select: { mcpOnboardingRequestKey: true },
    overrideAccess: true,
    req,
  })
  if (application.mcpOnboardingRequestKey) throw new APIError('A staged onboarding application cannot be deleted.', 409)
}

const openStaffFields = [
  'email',
  'firstName',
  'lastName',
  'clinic',
  'group',
  'assignmentScope',
  'status',
  'supabaseUserId',
  'authSync',
] as const

export const guardMcpOnboardingStaff: CollectionBeforeChangeHook<ClinicStaff> = async ({ data, originalDoc, req }) => {
  if (originalDoc?.status !== 'pending' || permittedWrites.get(req)?.staffId === originalDoc.id) return data
  const applicationId = /^clinic-application:(\d+)$/u.exec(originalDoc.onboardingKey ?? '')?.[1]
  if (!applicationId || !changed(data, originalDoc, openStaffFields)) return data

  const application = await req.payload.findByID({
    collection: 'clinicApplications',
    id: applicationId,
    depth: 0,
    select: { mcpOnboardingStaffMode: true, linkedRecords: true, status: true },
    overrideAccess: true,
    disableErrors: true,
    req,
  })
  if (
    application?.mcpOnboardingStaffMode === 'new_account' &&
    application.status !== 'approved' &&
    application.linkedRecords?.clinicStaff === originalDoc.id
  ) {
    throw new APIError('Use the clinic onboarding workflow to change this pending staff account.', 409)
  }
  return data
}
