import { APIError, createLocalReq, type CollectionBeforeChangeHook, type PayloadRequest } from 'payload'
import type { ClinicStaff } from '@/payload-types'
import { createClient } from './supaBaseServer'
import { normalizeEmail } from './emailNormalization'
import { bindAuthActions } from '@/auth/actions/lifecycle'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { isClinicParticipationApproved } from './clinicParticipation'

type Completion = NonNullable<ClinicStaff['accountCompletion']>
type ProtectedWrite = { id: number; field: 'accountCompletion' | 'legacyAccess'; value: unknown }
const brokerKey = Symbol.for('findmydoc.clinic-account-evidence.v1')
const existingBroker: unknown = Reflect.get(globalThis, brokerKey)
const writes = (existingBroker ?? new WeakMap<object, ProtectedWrite>()) as WeakMap<object, ProtectedWrite>
if (!existingBroker)
  Object.defineProperty(globalThis, brokerKey, { value: writes, writable: false, configurable: false })

function canonical(value: unknown): string {
  if (!value || typeof value !== 'object') return JSON.stringify(value)
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item != null)
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  )
}

function isEmptyEvidenceGroup(field: ProtectedWrite['field'], value: unknown): boolean {
  if (value == null) return true
  if (typeof value !== 'object' || Array.isArray(value)) return false
  return Object.entries(value).every(
    ([key, item]) => item == null || (field === 'legacyAccess' && key === 'initialParticipant' && item === false),
  )
}

export const guardClinicAccountEvidence: CollectionBeforeChangeHook<ClinicStaff> = ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  for (const field of ['accountCompletion', 'legacyAccess'] as const) {
    if (!(field in data)) continue
    const empty = isEmptyEvidenceGroup(field, data[field])
    // Payload passes an empty originalDoc on ordinary create and may materialize empty/default groups.
    // A duplicate is also a create: it must never inherit another principal's evidence.
    if (operation === 'create') {
      if (empty) continue
      throw new APIError('Clinic account evidence is managed by the trusted Auth boundary.', 403)
    }
    if (
      (empty && isEmptyEvidenceGroup(field, originalDoc?.[field])) ||
      canonical(data[field]) === canonical(originalDoc?.[field])
    )
      continue
    if (
      originalDoc?.[field] &&
      (field === 'accountCompletion' ? originalDoc.accountCompletion?.source : originalDoc.legacyAccess?.eligibleAt)
    ) {
      throw new APIError('Clinic account evidence cannot be replaced.', 403)
    }
    const capability = req.context?.clinicAccountEvidenceCapability
    const write = capability && typeof capability === 'object' ? writes.get(capability) : undefined
    if (
      !write ||
      write.id !== originalDoc?.id ||
      write.field !== field ||
      canonical(write.value) !== canonical(data[field])
    ) {
      throw new APIError('Clinic account evidence is managed by the trusted Auth boundary.', 403)
    }
  }
  return data
}

async function writeEvidence(req: PayloadRequest, id: number, field: ProtectedWrite['field'], value: unknown) {
  const capability = Object.freeze({})
  writes.set(capability, { id, field, value })
  try {
    return await req.payload.update({
      collection: 'clinicStaff',
      id,
      data: { [field]: value },
      depth: 0,
      overrideAccess: true,
      context: { ...req.context, clinicAccountEvidenceCapability: capability, skipClinicStaffAuthSync: true },
      req,
    })
  } finally {
    writes.delete(capability)
  }
}

export function hasClinicAccountCompletion(staff: ClinicStaff): boolean {
  const proof = staff.accountCompletion
  const clinicId = typeof staff.clinic === 'object' ? staff.clinic?.id : staff.clinic
  return Boolean(
    staff.supabaseUserId?.trim() &&
    proof?.source &&
    proof.subject === staff.supabaseUserId &&
    proof.clinicId === String(clinicId) &&
    proof.evidenceAt &&
    Number.isFinite(Date.parse(proof.evidenceAt)) &&
    proof.observedAt &&
    Number.isFinite(Date.parse(proof.observedAt)),
  )
}

async function verifiedPasswordEvent(staff: ClinicStaff, token: string): Promise<string | null> {
  const client = await createClient()
  const [{ data: userData, error: userError }, { data, error }] = await Promise.all([
    client.auth.getUser(token),
    client.auth.getClaims(token),
  ])
  if (userError || error) throw new APIError('Account verification is temporarily unavailable.', 503)
  if (
    !userData.user ||
    userData.user.id !== staff.supabaseUserId ||
    userData.user.app_metadata?.user_type !== 'clinic' ||
    normalizeEmail(userData.user.email) !== normalizeEmail(staff.email) ||
    data?.claims.sub !== staff.supabaseUserId
  )
    return null
  const now = Math.floor(Date.now() / 1000)
  const event = data.claims.amr?.find(
    (event) =>
      typeof event === 'object' &&
      event.method === 'password' &&
      Number.isSafeInteger(event.timestamp) &&
      event.timestamp > 0 &&
      now - event.timestamp >= -30 &&
      now - event.timestamp <= 300,
  )
  const timestamp = typeof event === 'object' ? event.timestamp : undefined
  return timestamp ? new Date(timestamp * 1000).toISOString() : null
}

const auditManifestSchema = z
  .object({
    version: z.literal(1),
    environment: z.enum(['local', 'test', 'ci', 'preview', 'production']),
    authVersion: z.string().min(1).max(100),
    clinicStaffId: z.number().int().positive(),
    clinicId: z.number().int().positive(),
    subject: z.string().uuid(),
    actorSubject: z.string().uuid(),
    eventId: z.string().uuid(),
    event: z.literal('user_updated_password'),
    context: z.literal('authenticated-user'),
    identityCreatedAt: z.iso.datetime(),
    eventAt: z.iso.datetime(),
    reviewedAt: z.iso.datetime(),
  })
  .strict()

/** Offline operator import only. The signature attests review against the installed provider's semantics and environment. */
export async function importLegacyClinicPasswordEvidence(
  req: PayloadRequest,
  envelope: { manifest: string; signature: string },
  options: {
    environment: z.infer<typeof auditManifestSchema>['environment']
    authVersion: string
    verificationKey: Buffer
  },
) {
  if (
    options.verificationKey.length < 32 ||
    envelope.manifest.length > 4096 ||
    !/^[a-f0-9]{64}$/.test(envelope.signature)
  ) {
    throw new APIError('Invalid audit evidence.', 403)
  }
  const expected = createHmac('sha256', options.verificationKey).update(envelope.manifest).digest()
  if (!timingSafeEqual(expected, Buffer.from(envelope.signature, 'hex')))
    throw new APIError('Invalid audit evidence.', 403)
  let raw: unknown
  try {
    raw = JSON.parse(envelope.manifest)
  } catch {
    throw new APIError('Invalid audit evidence.', 400)
  }
  const parsed = auditManifestSchema.safeParse(raw)
  if (!parsed.success) throw new APIError('Invalid audit evidence.', 400)
  const proof = parsed.data
  if (
    proof.environment !== options.environment ||
    proof.authVersion !== options.authVersion ||
    proof.actorSubject !== proof.subject ||
    Date.parse(proof.identityCreatedAt) > Date.parse(proof.eventAt) ||
    Date.parse(proof.eventAt) > Date.parse(proof.reviewedAt) ||
    Date.parse(proof.reviewedAt) > Date.now()
  ) {
    throw new APIError('Invalid audit evidence.', 403)
  }
  const staff = await req.payload.findByID({
    collection: 'clinicStaff',
    id: proof.clinicStaffId,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const clinicId = typeof staff.clinic === 'object' ? staff.clinic?.id : staff.clinic
  // The signed review binds an existing principal and tenant, never an email or editable provider metadata.
  if (
    !staff.legacyAccess?.eligibleAt ||
    staff.legacyAccess.subject !== proof.subject ||
    staff.legacyAccess.clinicId !== String(proof.clinicId) ||
    Date.parse(proof.eventAt) > Date.parse(staff.legacyAccess.eligibleAt) ||
    staff.status !== 'approved' ||
    staff.authSync?.status !== 'synced' ||
    staff.supabaseUserId !== proof.subject ||
    clinicId !== proof.clinicId ||
    Date.parse(staff.createdAt) > Date.parse(proof.reviewedAt)
  )
    throw new APIError('Invalid audit evidence.', 403)
  const clinic = await req.payload.findByID({
    collection: 'clinics',
    id: proof.clinicId,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (clinic.status !== 'approved' || !isClinicParticipationApproved(clinic))
    throw new APIError('Invalid audit evidence.', 403)
  if (hasClinicAccountCompletion(staff)) return staff
  return writeEvidence(req, staff.id, 'accountCompletion', {
    source: 'legacy-audit',
    subject: proof.subject,
    clinicId: String(proof.clinicId),
    evidenceAt: proof.eventAt,
    observedAt: new Date().toISOString(),
  } satisfies Completion)
}

/** Password usability is observed now; this never asserts a historical initial completion time. */
export async function establishLegacyClinicPasswordEvidence(
  req: PayloadRequest,
  staff: ClinicStaff,
  token: string,
): Promise<boolean> {
  const legacy = staff.legacyAccess
  const clinicId = typeof staff.clinic === 'object' ? staff.clinic?.id : staff.clinic
  if (
    !legacy?.eligibleAt ||
    !legacy.initialParticipant ||
    legacy.subject !== staff.supabaseUserId ||
    legacy.clinicId !== String(clinicId) ||
    staff.status !== 'approved' ||
    staff.authSync?.status !== 'synced'
  )
    return false
  const clinic = await req.payload.findByID({
    collection: 'clinics',
    id: clinicId!,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (!isClinicParticipationApproved(clinic)) return false
  const evidenceAt = await verifiedPasswordEvent(staff, token)
  if (!evidenceAt || Date.parse(evidenceAt) < Date.parse(legacy.eligibleAt)) return false
  await writeEvidence(req, staff.id, 'accountCompletion', {
    source: 'legacy-password-login',
    subject: staff.supabaseUserId,
    clinicId: String(clinicId),
    evidenceAt,
    observedAt: new Date().toISOString(),
  } satisfies Completion)
  return true
}

/** Internal Auth integration. A completed identity-bound invitation and verified password authentication are both required. */
export async function recordClinicInitialPasswordCompletion(
  req: PayloadRequest,
  input: { authActionId: number; token: string },
  environment: Parameters<typeof bindAuthActions>[1]['environment'],
) {
  if (
    Object.keys(input).some((key) => !['authActionId', 'token'].includes(key)) ||
    !Number.isSafeInteger(input.authActionId)
  ) {
    throw new APIError('Invalid completion command.', 400)
  }
  const actionReq = await createLocalReq({}, req.payload)
  const action = await bindAuthActions(actionReq, { environment }).read(input.authActionId)
  if (
    !action ||
    action.actionType !== 'clinic-invitation' ||
    action.state !== 'completed' ||
    action.principal?.relationTo !== 'clinicStaff' ||
    !action.supabaseSubject
  )
    throw new APIError('Account completion is unavailable.', 403)
  const id = typeof action.principal.value === 'object' ? action.principal.value.id : action.principal.value
  const staff = await req.payload.findByID({ collection: 'clinicStaff', id, depth: 0, overrideAccess: true, req })
  if (
    staff.status !== 'approved' ||
    staff.authSync?.status !== 'synced' ||
    staff.supabaseUserId !== action.supabaseSubject ||
    !staff.clinic
  ) {
    throw new APIError('Account completion is unavailable.', 403)
  }
  const clinicId = typeof staff.clinic === 'object' ? staff.clinic.id : staff.clinic
  const clinic = await req.payload.findByID({
    collection: 'clinics',
    id: clinicId,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (!isClinicParticipationApproved(clinic)) throw new APIError('Account completion is unavailable.', 403)
  const evidenceAt = await verifiedPasswordEvent(staff, input.token)
  if (!evidenceAt || Date.parse(evidenceAt) < Date.parse(action.createdAt))
    throw new APIError('Password verification is required.', 403)
  if (hasClinicAccountCompletion(staff)) return staff
  return writeEvidence(req, staff.id, 'accountCompletion', {
    source: 'initial-password',
    subject: action.supabaseSubject,
    clinicId: String(clinicId),
    evidenceAt,
    observedAt: new Date().toISOString(),
    authActionId: String(action.id),
  } satisfies Completion)
}

/** Migration-only snapshot. No completion proof is created and newly approved rows are never enrolled later. */
export async function snapshotLegacyClinicAccess(req: PayloadRequest) {
  let afterId = 0
  for (;;) {
    const result = await req.payload.find({
      collection: 'clinicStaff',
      depth: 0,
      limit: 100,
      sort: 'id',
      overrideAccess: true,
      req,
      where: {
        and: [
          { id: { greater_than: afterId } },
          { status: { equals: 'approved' } },
          { 'authSync.status': { equals: 'synced' } },
          { supabaseUserId: { exists: true } },
          { 'legacyAccess.eligibleAt': { exists: false } },
        ],
      },
    })
    for (const staff of result.docs) {
      const clinicId = typeof staff.clinic === 'object' ? staff.clinic?.id : staff.clinic
      if (!clinicId) continue
      const applications = await req.payload.find({
        collection: 'clinicApplications',
        depth: 0,
        limit: 2,
        overrideAccess: true,
        req,
        where: {
          and: [
            { status: { equals: 'approved' } },
            { provisioningStatus: { equals: 'completed' } },
            { 'linkedRecords.clinicStaff': { equals: staff.id } },
            { 'linkedRecords.clinic': { equals: clinicId } },
          ],
        },
      })
      const application = applications.docs[0]
      const clinic = await req.payload.findByID({
        collection: 'clinics',
        id: clinicId,
        depth: 0,
        overrideAccess: true,
        req,
      })
      if (clinic.deletedAt || clinic.status !== 'approved') continue
      const initialParticipant =
        applications.docs.length === 1 &&
        staff.onboardingKey === `clinic-application:${application?.id}` &&
        clinic.onboardingKey === staff.onboardingKey
      await writeEvidence(req, staff.id, 'legacyAccess', {
        eligibleAt: new Date().toISOString(),
        subject: staff.supabaseUserId,
        clinicId: String(clinicId),
        initialParticipant,
      })
    }
    if (!result.hasNextPage) break
    afterId = result.docs.at(-1)!.id
  }
}
