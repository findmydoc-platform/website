import { APIError, type CollectionBeforeChangeHook, type PayloadRequest } from 'payload'
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
  if (assignment.scope === 'group' && !hasClinicActivationReadiness(candidate))
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
