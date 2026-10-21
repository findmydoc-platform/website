import { hasPersonalGroupInvitationSource } from './personalGroupInvitationState'
import { APIError, createLocalReq, type CollectionBeforeChangeHook, type PayloadRequest } from 'payload'
import type { ClinicStaff } from '@/payload-types'
import { platformClinicTrustAccess } from '@/access/fieldAccess'
import { clinicAssignmentRelationId } from './clinicStaffAssignment'
import { normalizeEmail } from './emailNormalization'

type InvitationBinding = {
  groupId: number
  email: string
  onboardingKey: string
  source: NonNullable<ClinicStaff['personalGroupInvitation']>
  original?: ClinicStaff
}
const invitations = new WeakMap<object, InvitationBinding>()
function origin(value: ClinicStaff['personalGroupInvitation']): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value ?? {})
        .filter(([, item]) => item != null)
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  )
}

/** Only the short-lived operator command can create or synchronize an unactivated group principal. */
export function isPersonalGroupInvitationWrite(req: PayloadRequest, candidate: ClinicStaff): boolean {
  const capability = req.context.personalGroupInvitationCapability
  const binding = capability && typeof capability === 'object' ? invitations.get(capability) : undefined
  if (!binding) return false
  return Boolean(
    (!binding.original || candidate.id === binding.original.id) &&
    candidate.onboardingKey === binding.onboardingKey &&
    normalizeEmail(candidate.email) === binding.email &&
    clinicAssignmentRelationId(candidate.group) === binding.groupId &&
    candidate.clinic == null &&
    candidate.assignmentScope === 'group' &&
    origin(candidate.personalGroupInvitation) === origin(binding.source),
  )
}

export const guardPersonalGroupInvitationSource: CollectionBeforeChangeHook<ClinicStaff> = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  const candidate = { ...originalDoc, ...data } as ClinicStaff
  const source = candidate.personalGroupInvitation
  const hasSource = source && Object.values(source).some((value) => value != null)
  const changed = origin(source) !== origin(originalDoc?.personalGroupInvitation)
  const reservedKey = candidate.onboardingKey?.startsWith('personal-group-invitation:')
  if ((operation === 'create' && (hasSource || reservedKey)) || (hasSource && changed)) {
    if (!isPersonalGroupInvitationWrite(req, candidate) || (await platformClinicTrustAccess({ req })) !== true)
      throw new APIError('Personal invitation origin is managed by the trusted operator command.', 403)
  }
  if (operation !== 'create' && originalDoc?.personalGroupInvitation?.authorizedAt && changed)
    throw new APIError('Personal invitation origin cannot be replaced.', 403)
  const capability = req.context.personalGroupInvitationCapability
  const binding = capability && typeof capability === 'object' ? invitations.get(capability) : undefined
  if (
    binding?.original &&
    (!isPersonalGroupInvitationWrite(req, candidate) ||
      originalDoc?.status !== binding.original.status ||
      (originalDoc?.supabaseUserId ?? null) !== (binding.original.supabaseUserId ?? null) ||
      !originalDoc ||
      !hasPersonalGroupInvitationSource(originalDoc) ||
      (await platformClinicTrustAccess({ req })) !== true)
  )
    throw new APIError('Personal invitation binding changed during provisioning.', 409)
  return data
}

/** Provider effects occur outside this capability and outside native database transactions. */
export async function withPersonalGroupInvitationWrite<T>(
  req: PayloadRequest,
  binding: InvitationBinding,
  write: (scopedReq: PayloadRequest) => Promise<T>,
): Promise<T> {
  if ((await platformClinicTrustAccess({ req })) !== true)
    throw new APIError('Personal invitations require an authorized platform operator.', 403)
  const capability = {}
  invitations.set(capability, binding)
  try {
    const context: Record<string, unknown> = {
      ...req.context,
      personalGroupInvitationCapability: capability,
      skipClinicStaffAuthSync: true,
    }
    delete context.seedReset
    delete context.skipHooks
    const scopedReq = await createLocalReq({ user: req.user ?? undefined, context }, req.payload)
    return await write(scopedReq)
  } finally {
    invitations.delete(capability)
  }
}
