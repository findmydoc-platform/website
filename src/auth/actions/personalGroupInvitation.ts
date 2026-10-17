import { createHash, randomUUID } from 'node:crypto'
import { APIError, type Endpoint, type PayloadRequest } from 'payload'
import { z } from 'zod'
import { platformClinicTrustAccess } from '@/access/fieldAccess'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import { hasPersonalGroupInvitationSource } from '@/auth/utilities/personalGroupInvitationState'
import { withPersonalGroupInvitationWrite } from '@/auth/utilities/personalGroupInvitationSource'
import { createInitialClinicSupabaseAccount, setClinicSupabaseAccountAccess } from '@/auth/utilities/supabaseProvision'
import { requestInitialClinicInvitation } from './clinicInvitationRequests'

const inputSchema = z
  .object({
    groupId: z.number().int().positive(),
    email: z.string().trim().max(254).pipe(z.email()),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
  })
  .strict()

/** Reserves a personal identity before provider effects; repeats reconcile the same durable invitation origin. */
export async function invitePersonalGroupManager(
  req: PayloadRequest,
  input: { groupId: number; email: string; firstName: string; lastName: string },
): Promise<{ staffId: number; invitation: string }> {
  if ((await platformClinicTrustAccess({ req })) !== true)
    throw new APIError('Personal invitations require an authorized platform operator.', 403)
  if (req.transactionID !== undefined)
    throw new APIError('Personal invitations require a committed operator request.', 409)
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) throw new APIError('Enter one group and valid personal contact details.', 400)
  const { groupId, firstName, lastName } = parsed.data
  const email = normalizeEmail(parsed.data.email)
  await req.payload.findByID({ collection: 'clinicGroups', id: groupId, depth: 0, overrideAccess: true, req })
  const identity = `personal-group:${createHash('sha256').update(email).digest('hex')}`
  const find = () =>
    req.payload.find({
      collection: 'clinicStaff',
      where: { or: [{ provisioningIdentity: { equals: identity } }, { email: { equals: email } }] },
      limit: 2,
      depth: 0,
      overrideAccess: true,
      req,
    })
  let matches = await find()
  let staff = matches.docs[0]
  if (!staff) {
    const onboardingKey = `personal-group-invitation:${randomUUID()}`
    const source = {
      groupId: String(groupId),
      operatorId: String(req.user!.id),
      authorizedAt: new Date().toISOString(),
    }
    try {
      staff = await withPersonalGroupInvitationWrite(req, { groupId, email, onboardingKey, source }, (scopedReq) =>
        req.payload.create({
          collection: 'clinicStaff',
          depth: 0,
          overrideAccess: true,
          req: scopedReq,
          data: {
            email,
            firstName,
            lastName,
            provisioningIdentity: identity,
            onboardingKey,
            personalGroupInvitation: source,
            assignmentScope: 'group',
            group: groupId,
            clinic: null,
            status: 'pending',
          },
        }),
      )
    } catch (error) {
      // A concurrent reservation may have won; only its exact committed source is reusable.
      matches = await find()
      staff = matches.docs[0]
      if (!staff) throw error
    }
  }
  if (
    matches.docs.length > 1 ||
    !hasPersonalGroupInvitationSource(staff) ||
    staff.personalGroupInvitation?.groupId !== String(groupId) ||
    !['pending', 'approved'].includes(staff.status ?? '') ||
    normalizeEmail(staff.email) !== email
  )
    throw new APIError('This person requires the separate assignment or lifecycle workflow.', 409)
  if (staff.activationReadiness?.version || staff.accountCompletion?.source)
    return { staffId: staff.id, invitation: 'completed' }
  if (staff.status !== 'approved' || staff.authSync?.status !== 'synced') {
    let subject: string
    try {
      subject = await createInitialClinicSupabaseAccount(
        {
          email,
          onboardingKey: staff.onboardingKey!,
          userMetadata: { firstName: staff.firstName ?? undefined, lastName: staff.lastName ?? undefined },
        },
        req.payload.logger,
      )
      if (!z.uuid().safeParse(subject).success || (staff.supabaseUserId && staff.supabaseUserId !== subject))
        throw new Error('Personal identity reconciliation did not match its reserved subject.')
      await setClinicSupabaseAccountAccess({ enabled: true, supabaseUserId: subject }, req.payload.logger)
    } catch {
      throw new APIError('Identity preparation is unconfirmed. Retry the same personal invitation.', 503)
    }
    const reservedStaff = staff
    staff = await withPersonalGroupInvitationWrite(
      req,
      { groupId, email, onboardingKey: staff.onboardingKey!, source: staff.personalGroupInvitation!, original: staff },
      (scopedReq) =>
        req.payload.update({
          collection: 'clinicStaff',
          id: reservedStaff.id,
          depth: 0,
          overrideAccess: true,
          req: scopedReq,
          data: { status: 'approved', supabaseUserId: subject, authSync: { status: 'synced', errorCode: null } },
        }),
    )
  }
  return { staffId: staff.id, invitation: await requestInitialClinicInvitation(req, staff.id) }
}

export const personalGroupInvitationEndpoint: Endpoint = {
  path: '/:id/personal-invitation',
  method: 'post',
  handler: async (req) => {
    const groupId = Number(req.routeParams?.id)
    const body: unknown = typeof req.json === 'function' ? await req.json().catch(() => undefined) : undefined
    const parsed = inputSchema.omit({ groupId: true }).safeParse(body)
    if (!parsed.success || !Number.isSafeInteger(groupId) || groupId < 1)
      throw new APIError('Enter valid personal contact details for this group.', 400)
    const result = await invitePersonalGroupManager(req, { ...parsed.data, groupId })
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  },
}
