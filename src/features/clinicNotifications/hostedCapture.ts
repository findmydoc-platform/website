import { createHash, randomUUID } from 'node:crypto'
import {
  APIError,
  createLocalReq,
  type CollectionAfterOperationHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeOperationHook,
  type PayloadRequest,
} from 'payload'
import { z } from 'zod'
import { platformClinicTrustAccess } from '@/access/fieldAccess'
import { resolveServerRuntimeEnvironment } from '@/features/runtimePolicy'
import { requireNotificationTransaction } from '@/collections/clinicNotifications/common'
import { CLINIC_NOTIFICATIONS_CONTRACT_VERSION } from './contracts'
import { prepareClinicNotificationCapture } from './capture'
import { hasTestCaptureAuthority } from './testCaptureAuthority'

type Control = { id: string | number; active?: boolean | null; activatedAt?: string | null }

export const hostedCaptureActivationSchema = z.strictObject({
  action: z.literal('activate'),
  environment: z.enum(['preview', 'production']),
  runtimeRevision: z.string().regex(/^[a-f0-9]{40}$/),
  expectedState: z.string().regex(/^[a-f0-9]{64}$/),
})
type Activation = z.infer<typeof hostedCaptureActivationSchema>
type Authority = { input: Activation; transactionID?: string | number; activatedAt?: string }
const authorities = new WeakMap<PayloadRequest, Authority>()

async function requireHostedOwner(req: PayloadRequest, authority: Authority): Promise<void> {
  const transactionID = await req.transactionID
  requireNotificationTransaction(req, transactionID)
  if (transactionID !== authority.transactionID) throw new APIError('Capture owner changed.', 409)
}

/** No native mutation was submitted; callers need not infer rollback from cleanup. */
export class CapturePreparationRejected extends APIError {
  constructor(status: number) {
    super('Capture preparation rejected.', status)
  }
}

export async function requireCaptureOperator(req: PayloadRequest): Promise<void> {
  if (req.user?.collection !== 'platformStaff' || (await platformClinicTrustAccess({ req })) !== true)
    throw new APIError('Capture access denied.', 403)
}

function hostedRuntime() {
  const environment = resolveServerRuntimeEnvironment()
  const runtimeRevision = process.env.VERCEL_GIT_COMMIT_SHA
  if (
    (environment !== 'preview' && environment !== 'production') ||
    process.env.DEPLOYMENT_ENV !== environment ||
    process.env.VERCEL_ENV !== environment ||
    !runtimeRevision ||
    !/^[a-f0-9]{40}$/.test(runtimeRevision)
  )
    throw new APIError('Capture environment unavailable.', 409)
  return { environment, runtimeRevision, contractVersion: CLINIC_NOTIFICATIONS_CONTRACT_VERSION }
}

async function readControl(req: PayloadRequest): Promise<Control | undefined> {
  const result = await req.payload.find({
    collection: 'clinicNotificationControls',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    req,
    where: { key: { equals: 'notification-center' } },
  })
  return result.docs[0]
}

function captureStatus(control: Control | undefined) {
  const runtime = hostedRuntime()
  const state = { active: control?.active === true, activatedAt: control?.activatedAt ?? null }
  if (!state.active && state.activatedAt !== null) throw new APIError('Capture state unavailable.', 503)
  if (state.active && (!state.activatedAt || !Number.isFinite(Date.parse(state.activatedAt))))
    throw new APIError('Capture state unavailable.', 503)
  const expectedState = createHash('sha256')
    .update(JSON.stringify({ ...runtime, ...state, id: control?.id ?? null }))
    .digest('hex')
  return { ...runtime, ...state, expectedState }
}

/** Preparation and readback never create control records. */
export async function readHostedCaptureStatus(req: PayloadRequest) {
  await requireCaptureOperator(req)
  hostedRuntime()
  return captureStatus(await readControl(req))
}

function assertExpected(input: Activation, control: Control | undefined) {
  const status = captureStatus(control)
  if (
    input.environment !== status.environment ||
    input.runtimeRevision !== status.runtimeRevision ||
    input.expectedState !== status.expectedState
  )
    throw new APIError('Capture preparation changed. Read current status.', 409)
  return status
}

/** Payload starts and commits the outer operation. No adapter ownership or replay is introduced. */
export async function activateHostedCapture(req: PayloadRequest, input: Activation) {
  let control: Control | undefined
  let status: ReturnType<typeof captureStatus>
  try {
    await requireCaptureOperator(req)
    if ((await req.transactionID) != null) throw new APIError('Capture requires its native outer owner.', 409)
    control = await readControl(req)
    status = assertExpected(input, control)
  } catch (error) {
    throw new CapturePreparationRejected(error instanceof APIError ? error.status : 503)
  }
  if (status.active) return { ...status, outcome: 'already_active' as const }
  const owned = await createLocalReq(
    { user: req.user ?? undefined, context: { clinicNotificationCommand: true } },
    req.payload,
  )
  authorities.set(owned, { input })
  try {
    const args = {
      collection: 'clinicNotificationControls' as const,
      depth: 0,
      overrideAccess: true,
      req: owned,
      data: { key: 'notification-center', active: true, nonce: randomUUID() },
    }
    const result = control ? await req.payload.update({ ...args, id: control.id }) : await req.payload.create(args)
    return { ...captureStatus(result), outcome: 'activated' as const }
  } finally {
    authorities.delete(owned)
  }
}

export const prepareHostedCaptureOperation: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation === 'read' || operation === 'count') return args
  const authority = authorities.get(req)
  if (!authority) return args
  if ((operation !== 'update' && operation !== 'create') || args.disableTransaction)
    throw new APIError('Capture requires its native outer owner.', 409)
  const transactionID = await req.transactionID
  requireNotificationTransaction(req, transactionID)
  if (authority.transactionID !== undefined && authority.transactionID !== transactionID)
    throw new APIError('Capture owner changed.', 409)
  authority.transactionID = transactionID
  // Existing controls use exactly the source command's key before native predecessor retrieval.
  // Missing controls serialize at their unique-key native insert; a concurrent creator may conflict.
  if (operation === 'update') await prepareClinicNotificationCapture(req)
  requireNotificationTransaction(req, transactionID)
  await requireCaptureOperator(req)
  assertExpected(authority.input, await readControl(req))
  await requireHostedOwner(req, authority)
  return args
}

export const guardCaptureActivationBoundary: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  if (data.key !== 'notification-center' && originalDoc?.key !== 'notification-center') return data
  if (originalDoc?.key === 'notification-center' && data.key && data.key !== 'notification-center')
    throw new APIError('Capture identity is immutable.', 403)
  const authority = authorities.get(req)
  if (authority) {
    await requireHostedOwner(req, authority)
    await requireCaptureOperator(req)
    await requireHostedOwner(req, authority)
    assertExpected(authority.input, originalDoc?.id ? (originalDoc as Control) : undefined)
    authority.activatedAt = new Date().toISOString()
    return { ...data, active: true, activatedAt: authority.activatedAt }
  }
  const changesBoundary =
    (Object.hasOwn(data, 'active') && data.active !== (originalDoc?.active ?? false)) ||
    (Object.hasOwn(data, 'activatedAt') && (data.activatedAt ?? null) !== (originalDoc?.activatedAt ?? null))
  if (changesBoundary && !hasTestCaptureAuthority(req))
    throw new APIError('Capture activation requires its private command.', 403)
  return data
}

export const finishHostedCaptureOperation: CollectionAfterOperationHook = async ({ req, result, operation }) => {
  if (operation !== 'create' && operation !== 'updateByID') return result
  const authority = authorities.get(req)
  if (!authority) return result
  await requireHostedOwner(req, authority)
  await requireCaptureOperator(req)
  const runtime = hostedRuntime()
  if (
    runtime.environment !== authority.input.environment ||
    runtime.runtimeRevision !== authority.input.runtimeRevision
  )
    throw new APIError('Capture runtime changed.', 409)
  const control = await readControl(req)
  if (control?.active !== true || control.activatedAt !== authority.activatedAt)
    throw new APIError('Capture final state unavailable.', 503)
  await requireHostedOwner(req, authority)
  return result
}
