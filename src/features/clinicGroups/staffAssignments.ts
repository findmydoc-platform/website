import { hasPersonalGroupInvitationSource } from '@/auth/utilities/personalGroupInvitationState'
import { isPersonalGroupInvitationWrite } from '@/auth/utilities/personalGroupInvitationSource'
import { createLocalReq, APIError, type CollectionBeforeChangeHook, type PayloadRequest } from 'payload'
import type { ClinicStaff } from '@/payload-types'
import { platformClinicTrustAccess } from '@/access/fieldAccess'
import {
  clinicAssignmentRelationId,
  readClinicStaffAssignment,
  type ClinicStaffAssignment,
} from '@/auth/utilities/clinicStaffAssignment'
import { hasClinicActivationReadiness } from '@/auth/utilities/clinicAccountCompletionState'
import { isTrustedClinicAccountEvidenceWrite } from '@/auth/utilities/clinicAccountCompletion'
import {
  clinicGroupAuthorizationKey,
  guardClinicAuthorizationKeys,
  guardNotificationAuthorizationSession,
} from '@/features/clinicNotifications/authorizationBarrier'

const resetRevocations = new WeakMap<object, { id: number; clinicId: number }>()

function isResetRevocation(
  req: PayloadRequest,
  id: number,
  data: Record<string, unknown>,
  current: ClinicStaff | undefined,
): boolean {
  const capability = req.context.clinicResetAssignmentCapability
  const expected = capability && typeof capability === 'object' ? resetRevocations.get(capability) : undefined
  if (!expected) return false
  if (
    expected.id !== Number(id) ||
    !current ||
    clinicAssignmentRelationId(current.clinic) !== expected.clinicId ||
    current.group != null ||
    Object.keys(data).length !== 3 ||
    data.assignmentScope !== 'unassigned' ||
    data.clinic !== null ||
    data.group !== null
  )
    throw new APIError('The clinic assignment changed after reset preflight.', 409)
  return true
}

const fields = ['assignmentScope', 'clinic', 'group'] as const

/** Ordinary Admin saves must submit the complete replacement, not independently edit access relationships. */
export async function guardClinicStaffAssignmentInput({
  req,
  args,
  operation,
}: {
  req: PayloadRequest
  args: unknown
  operation: string
}): Promise<void> {
  if (operation !== 'update') return
  const input = args as { id?: number; data?: Record<string, unknown> }
  if (!input.data || !fields.some((field) => Object.hasOwn(input.data!, field))) return
  if (input.id && isTrustedClinicAccountEvidenceWrite(req, input.id)) return
  const current = input.id
    ? await req.payload.findByID({ collection: 'clinicStaff', id: input.id, depth: 0, overrideAccess: true, req })
    : undefined
  if (current && isPersonalGroupInvitationWrite(req, { ...current, ...input.data } as ClinicStaff)) return
  if (input.id && isResetRevocation(req, input.id, input.data, current)) return
  // An onboarding clinic reference without explicit scope grants no access before trusted activation.
  if (
    current &&
    !hasClinicActivationReadiness(current) &&
    current.assignmentScope == null &&
    (input.data.assignmentScope == null || input.data.assignmentScope === 'local') &&
    input.data.group == null
  )
    return
  if ((await platformClinicTrustAccess({ req })) !== true)
    throw new APIError('Assignment changes require an authorized platform operator.', 403)
  if (!fields.every((field) => Object.hasOwn(input.data!, field)))
    throw new APIError('Replace scope, clinic and group together.', 400)
}

export const validateClinicStaffAssignment: CollectionBeforeChangeHook<ClinicStaff> = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!fields.some((field) => Object.hasOwn(data, field))) return data
  const candidate = { ...originalDoc, ...data } as ClinicStaff
  const assignment = readClinicStaffAssignment(candidate)
  if (!assignment) {
    if (!hasClinicActivationReadiness(candidate) && candidate.assignmentScope == null && candidate.group == null)
      return data
    throw new APIError('Choose exactly one clinic, one group, or an unassigned scope.', 400)
  }
  const retainedPersonalInvitation =
    originalDoc &&
    hasPersonalGroupInvitationSource(originalDoc) &&
    hasPersonalGroupInvitationSource(candidate) &&
    clinicAssignmentRelationId(originalDoc.group) === clinicAssignmentRelationId(candidate.group)
  if (
    assignment.scope === 'group' &&
    !hasClinicActivationReadiness(candidate) &&
    !isPersonalGroupInvitationWrite(req, candidate) &&
    !retainedPersonalInvitation
  )
    throw new APIError('Complete identity activation before assigning group access.', 403)
  const previousGroup = clinicAssignmentRelationId(originalDoc?.group)
  const nextGroup = assignment.scope === 'group' ? assignment.groupId : null
  const groups = [...new Set([previousGroup, nextGroup].filter((id): id is number => id !== null))]
  if (groups.length) {
    await guardClinicAuthorizationKeys(req, groups.map(clinicGroupAuthorizationKey))
    if (nextGroup)
      await req.payload.findByID({ collection: 'clinicGroups', id: nextGroup, depth: 0, overrideAccess: true, req })
  }
  await guardNotificationAuthorizationSession({ req })
  return data
}

/** Existing identities keep their lifecycle and immutable activation evidence when their assignment changes. */
export async function replaceClinicStaffAssignment(
  req: PayloadRequest,
  id: number,
  assignment: ClinicStaffAssignment,
): Promise<ClinicStaff> {
  const keys = Object.keys(assignment)
  const expected =
    assignment.scope === 'local'
      ? ['scope', 'clinicId']
      : assignment.scope === 'group'
        ? ['scope', 'groupId']
        : ['scope']
  if (
    !['local', 'group', 'unassigned'].includes(assignment.scope) ||
    keys.some((key) => !expected.includes(key)) ||
    keys.length !== expected.length
  )
    throw new APIError('Invalid assignment command.', 400)
  const clinic = assignment.scope === 'local' ? clinicAssignmentRelationId(assignment.clinicId) : null
  const group = assignment.scope === 'group' ? clinicAssignmentRelationId(assignment.groupId) : null
  if ((assignment.scope === 'local' && !clinic) || (assignment.scope === 'group' && !group))
    throw new APIError('Invalid assignment target.', 400)
  return req.payload.update({
    collection: 'clinicStaff',
    id,
    data: { assignmentScope: assignment.scope, clinic, group },
    depth: 0,
    overrideAccess: false,
    req,
  })
}

/** Internal reset revokes only the exact clinic reference selected by reset preflight, never a grant. */
export async function revokeResetClinicAssignment(
  req: PayloadRequest,
  id: number,
  expectedClinicId: number,
): Promise<ClinicStaff> {
  if (!clinicAssignmentRelationId(id) || !clinicAssignmentRelationId(expectedClinicId))
    throw new APIError('Invalid reset assignment.', 400)
  const capability = {}
  resetRevocations.set(capability, { id, clinicId: expectedClinicId })
  const context: Record<string, unknown> = {
    ...req.context,
    clinicResetAssignmentCapability: capability,
    skipClinicStaffAuthSync: true,
  }
  delete context.seedReset
  delete context.skipHooks
  const scopedReq = await createLocalReq(
    { user: req.user ?? undefined, context, req: { transactionID: req.transactionID } },
    req.payload,
  )
  try {
    return await req.payload.update({
      collection: 'clinicStaff',
      id,
      data: { assignmentScope: 'unassigned', clinic: null, group: null },
      req: scopedReq,
      depth: 0,
      overrideAccess: true,
    })
  } finally {
    resetRevocations.delete(capability)
  }
}
