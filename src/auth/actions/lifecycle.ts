import {
  APIError,
  createLocalReq,
  type CollectionAfterReadHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionBeforeOperationHook,
  type PayloadRequest,
  type Where,
} from 'payload'
import { z } from 'zod'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import { inspectRecoveryContext, type RecoveryContext, type RecoveryKey } from './recoveryContext'
import { recoveryCorrelations, recoveryWindowMs, recoveryCooldownMs, recoveryHourlyLimit } from './recoveryCorrelation'
import { findRecoveryPrincipal, recoveryActionTypes } from './recoveryPrincipal'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { findClinicInvitationPrincipal } from './clinicInvitationPrincipal'
import { readRecoveryPrincipal } from './recoveryPrincipal'
import type { DashboardActionFlow } from './contracts'
import type { AuthAction, ClinicStaff } from '@/payload-types'
import {
  authActionDiagnosticFields,
  authActionEnvironments,
  authActionOutcomes,
  authActionPolicies,
  authActionRetentionMs,
  authActionStates,
  authActionTransitions,
  authActionTypes,
  dashboardActionFlows,
  terminalAuthActionStates,
} from './contracts'
import {
  verificationCorrelations,
  verificationCorrelationWindowMs,
  verificationCooldownMs,
  verificationDailyLimit,
  type VerificationCorrelationKey,
} from './verificationCorrelation'

class AuthActionError extends APIError {
  constructor(
    public readonly code:
      | 'access-denied'
      | 'invalid-command'
      | 'invalid-transition'
      | 'transaction-unavailable'
      | 'not-found'
      | 'correlation-unavailable'
      | 'rate-limited',
  ) {
    super(
      code,
      code === 'access-denied'
        ? 403
        : code === 'not-found'
          ? 404
          : ['transaction-unavailable', 'correlation-unavailable'].includes(code)
            ? 503
            : code === 'rate-limited'
              ? 429
              : 409,
    )
  }
}

const idSchema = z.number().int().positive()
const principalSchema = z
  .object({ relationTo: z.enum(['patients', 'clinicStaff', 'platformStaff']), value: idSchema })
  .strict()
const createSchema = z.object({ actionType: z.enum(authActionTypes), principal: principalSchema.optional() }).strict()
const bindSchema = z.object({ id: idSchema, principal: principalSchema }).strict()
const subjectSchema = z.string().uuid()
const bindSubjectSchema = z.object({ id: idSchema, supabaseSubject: subjectSchema }).strict()
const transitionSchema = z
  .object({
    id: idSchema,
    to: z.enum(authActionStates).exclude(['pending']),
    outcomeCode: z.enum(authActionOutcomes).optional(),
  })
  .strict()
type CreateInput = z.infer<typeof createSchema>
type Principal = z.infer<typeof principalSchema>
type TransitionInput = z.infer<typeof transitionSchema>
type Environment = (typeof authActionEnvironments)[number]
type Write =
  | { kind: 'create'; data: Record<string, unknown> }
  | { kind: 'transition' | 'bind' | 'bind-subject' | 'clear-correlation'; id: number; data: Record<string, unknown> }
  | { kind: 'delete'; id: number }
  | { kind: 'recovery-create'; data: Record<string, unknown> }
  | { kind: 'recovery-delete'; id: number }
  | { kind: 'clinic-invitation-mark'; id: number; data: Record<string, unknown> }
type Scope = { transactionID: string | number; environment: Environment; now: number; write?: Write; recovery?: true }

// Server bundles can load this module more than once. Identity remains process-local and cannot be supplied as JSON.
type Broker = {
  open(scope: Scope): object
  inspect(identity: object): Scope | undefined
  close(identity: object): void
}
const brokerKey = Symbol.for('findmydoc.auth-actions.capability.v1')
function resolveBroker(): Broker {
  const existing: unknown = Reflect.get(globalThis, brokerKey)
  if (existing) return existing as Broker
  const scopes = new WeakMap<object, Scope>()
  const broker: Broker = Object.freeze({
    open(scope: Scope) {
      const identity = Object.freeze({})
      scopes.set(identity, scope)
      return identity
    },
    inspect(identity: object) {
      return scopes.get(identity)
    },
    close(identity: object) {
      scopes.delete(identity)
    },
  })
  Object.defineProperty(globalThis, brokerKey, { value: broker, writable: false, configurable: false })
  return broker
}
const broker = resolveBroker()

async function systemScope(req: PayloadRequest): Promise<Scope | undefined> {
  const identity: unknown = req.context?.authActionCapability
  if (!identity || typeof identity !== 'object') return undefined
  const scope = broker.inspect(identity)
  if (!scope || !(req.transactionID instanceof Promise) || (await req.transactionID) !== scope.transactionID)
    return undefined
  return scope
}
async function requireScope(req: PayloadRequest) {
  const scope = await systemScope(req)
  if (!scope) throw new AuthActionError('access-denied')
  return scope
}
function parsed<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input)
  if (!result.success) throw new AuthActionError('invalid-command')
  return result.data
}
function terminal(state: AuthAction['state']) {
  return (terminalAuthActionStates as readonly string[]).includes(state)
}
function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

export const guardAuthActionOperation: CollectionBeforeOperationHook = async ({ operation, req, args }) => {
  const scope = await systemScope(req)
  if (operation === 'read' || operation === 'count') {
    if (scope || (await isPlatformStaff({ req }))) return
  } else if (scope?.write) {
    if (
      scope.write.kind === 'recovery-create' ||
      scope.write.kind === 'recovery-delete' ||
      scope.write.kind === 'clinic-invitation-mark'
    )
      throw new AuthActionError('access-denied')
    const expectedOperation = ['bind', 'bind-subject', 'transition', 'clear-correlation'].includes(scope.write.kind)
      ? 'update'
      : scope.write.kind
    if (operation === expectedOperation) {
      const input = args as unknown as Record<string, unknown>
      if (scope.write.kind !== 'create' && input.id !== scope.write.id) throw new AuthActionError('access-denied')
      if ('data' in scope.write && !sameValue(input.data, scope.write.data)) throw new AuthActionError('access-denied')
      return
    }
  }
  throw new AuthActionError('access-denied')
}

export const readAuthActionDiagnostics: CollectionAfterReadHook = async ({ doc, req }) => {
  const scope = await systemScope(req)
  if (scope) {
    if (doc.environment !== scope.environment) throw new AuthActionError('access-denied')
    return doc
  }
  if (!(await isPlatformStaff({ req }))) throw new AuthActionError('access-denied')
  return Object.fromEntries(
    authActionDiagnosticFields.filter((field) => Object.hasOwn(doc, field)).map((field) => [field, doc[field]]),
  )
}

export const guardClinicInvitationAuthorization: CollectionBeforeChangeHook<ClinicStaff> = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (!Object.hasOwn(data, 'invitationAuthorizedAt')) return data
  if (operation === 'create') {
    if (data.invitationAuthorizedAt == null) return data
    throw new AuthActionError('access-denied')
  }
  if (sameValue(data.invitationAuthorizedAt, originalDoc?.invitationAuthorizedAt)) return data
  const scope = await requireScope(req)
  if (
    originalDoc?.invitationAuthorizedAt ||
    scope.write?.kind !== 'clinic-invitation-mark' ||
    scope.write.id !== originalDoc?.id ||
    !sameValue(scope.write.data.invitationAuthorizedAt, data.invitationAuthorizedAt) ||
    Date.parse(data.invitationAuthorizedAt ?? '') !== scope.now
  )
    throw new AuthActionError('access-denied')
  return data
}

export const guardRecoveryEventOperation: CollectionBeforeOperationHook = async ({ operation, req, args }) => {
  const scope = await requireScope(req)
  if (!scope.recovery) throw new AuthActionError('access-denied')
  if (operation === 'read' || operation === 'count') return
  const input = args as unknown as Record<string, unknown>
  if (operation === 'create' && scope.write?.kind === 'recovery-create' && sameValue(input.data, scope.write.data))
    return
  if (operation === 'delete' && scope.write?.kind === 'recovery-delete' && input.id === scope.write.id) return
  throw new AuthActionError('access-denied')
}

export const guardRecoveryEventWrite: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  const scope = await requireScope(req)
  if (
    !scope.recovery ||
    operation !== 'create' ||
    scope.write?.kind !== 'recovery-create' ||
    !sameValue(data, scope.write.data) ||
    Object.keys(data).some(
      (key) => !['environment', 'dimension', 'keyVersion', 'digest', 'observedAt'].includes(key),
    ) ||
    data.environment !== scope.environment ||
    !['target', 'ip'].includes(data.dimension) ||
    !z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,64}$/)
      .safeParse(data.keyVersion).success ||
    !z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .safeParse(data.digest).success ||
    Date.parse(data.observedAt) !== scope.now
  )
    throw new AuthActionError('access-denied')
  return data
}

export const readRecoveryEvent: CollectionAfterReadHook = async ({ doc, req }) => {
  const scope = await requireScope(req)
  if (!scope.recovery || doc.environment !== scope.environment) throw new AuthActionError('access-denied')
  return doc
}

export const guardRecoveryEventDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const scope = await requireScope(req)
  if (!scope.recovery || scope.write?.kind !== 'recovery-delete' || scope.write.id !== id)
    throw new AuthActionError('access-denied')
  const doc = await req.payload.findByID({
    collection: 'recoveryRequestEvents',
    id,
    req,
    depth: 0,
    overrideAccess: true,
  })
  if (doc.environment !== scope.environment || Date.parse(doc.observedAt) > scope.now - recoveryWindowMs)
    throw new AuthActionError('invalid-transition')
}

const storedFields = new Set<string>([
  ...authActionDiagnosticFields,
  'supabaseTokenType',
  'principal',
  'principalBoundAt',
  'supabaseSubject',
  'subjectBoundAt',
  'correlationDigest',
  'correlationKeyVersion',
  'callbackDestination',
  'completionRoute',
  'finalDestination',
])
const immutableFields = [
  'id',
  'actionType',
  'environment',
  'supabaseTokenType',
  'callbackDestination',
  'completionRoute',
  'finalDestination',
  'expiresAt',
  'createdAt',
  'correlationDigest',
  'correlationKeyVersion',
] as const

function validatePolicy(doc: Record<string, unknown>, scope: Scope) {
  const actionType = parsed(z.enum(authActionTypes), doc.actionType)
  const state = parsed(z.enum(authActionStates), doc.state)
  const policy = authActionPolicies[actionType]
  const createdAt = Date.parse(String(doc.createdAt))
  if (doc.correlationDigest != null || doc.correlationKeyVersion != null) {
    if (
      (actionType !== 'patient-verification' && !recoveryActionTypes.includes(actionType as never)) ||
      !z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .safeParse(doc.correlationDigest).success ||
      !z
        .string()
        .regex(/^[a-zA-Z0-9_-]{1,64}$/)
        .safeParse(doc.correlationKeyVersion).success
    )
      throw new AuthActionError('invalid-command')
  }
  if (
    doc.environment !== scope.environment ||
    doc.callbackDestination !== policy.callbackDestination ||
    doc.supabaseTokenType !== policy.supabaseTokenType ||
    doc.completionRoute !== policy.completionRoute ||
    doc.finalDestination !== policy.finalDestination ||
    !Number.isFinite(createdAt) ||
    Date.parse(String(doc.expiresAt)) !== createdAt + policy.lifetime
  )
    throw new AuthActionError('invalid-command')
  if (doc.principal != null) {
    if (parsed(principalSchema, doc.principal).relationTo !== policy.principalCollection)
      throw new AuthActionError('invalid-command')
    if (!doc.principalBoundAt) throw new AuthActionError('invalid-command')
  } else if (
    state === 'completed' ||
    (['active', 'confirmed'].includes(state) &&
      (actionType !== 'patient-verification' || !doc.supabaseSubject || doc.principalBoundAt != null))
  ) {
    throw new AuthActionError('invalid-transition')
  }
  if (doc.supabaseSubject != null) {
    parsed(subjectSchema, doc.supabaseSubject)
    if (
      !['patient-verification', 'clinic-invitation', ...recoveryActionTypes].includes(actionType) ||
      !Number.isFinite(Date.parse(String(doc.subjectBoundAt)))
    )
      throw new AuthActionError('invalid-command')
  } else if (doc.subjectBoundAt != null) throw new AuthActionError('invalid-command')
  if (doc.principalBoundAt != null && !Number.isFinite(Date.parse(String(doc.principalBoundAt))))
    throw new AuthActionError('invalid-command')
  if (
    terminal(state) !== (doc.terminalAt != null) ||
    (doc.terminalAt != null && !Number.isFinite(Date.parse(String(doc.terminalAt))))
  )
    throw new AuthActionError('invalid-command')
  if (
    (state === 'superseded' && doc.outcomeCode !== 'superseded') ||
    (state === 'revoked' &&
      doc.outcomeCode != null &&
      !['ineligible', 'source-unavailable', 'recipient-changed'].includes(String(doc.outcomeCode))) ||
    (!['revoked', 'superseded'].includes(state) && doc.outcomeCode != null)
  )
    throw new AuthActionError('invalid-command')
}

export const guardAuthActionWrite: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const scope = await requireScope(req)
  const write = scope.write
  if (
    !write ||
    write.kind === 'delete' ||
    write.kind === 'recovery-create' ||
    write.kind === 'recovery-delete' ||
    (operation === 'create') !== (write.kind === 'create')
  )
    throw new AuthActionError('access-denied')
  if (Object.keys(data).some((key) => !storedFields.has(key))) throw new AuthActionError('invalid-command')
  const doc = { ...originalDoc, ...data }
  if (write.kind === 'clear-correlation') {
    if (
      operation !== 'update' ||
      !originalDoc ||
      originalDoc.id !== write.id ||
      originalDoc.environment !== scope.environment ||
      (originalDoc.actionType !== 'patient-verification' &&
        !recoveryActionTypes.includes(originalDoc.actionType as never)) ||
      originalDoc.correlationDigest == null ||
      !Number.isFinite(Date.parse(originalDoc.createdAt)) ||
      Date.parse(originalDoc.createdAt) >
        scope.now -
          (originalDoc.actionType === 'patient-verification' ? verificationCorrelationWindowMs : recoveryWindowMs) ||
      doc.correlationDigest !== null ||
      doc.correlationKeyVersion !== null ||
      Object.keys(data).some(
        (field) =>
          !['correlationDigest', 'correlationKeyVersion', 'updatedAt'].includes(field) &&
          !sameValue(data[field], originalDoc[field as keyof typeof originalDoc]),
      )
    )
      throw new AuthActionError('invalid-transition')
    return data
  }
  validatePolicy(doc, scope)
  if (operation === 'create') {
    if (
      data.id != null ||
      doc.state !== 'pending' ||
      doc.terminalAt != null ||
      doc.outcomeCode != null ||
      (['clinic-invitation', ...recoveryActionTypes].includes(doc.actionType)
        ? doc.supabaseSubject == null
          ? doc.subjectBoundAt != null
          : Date.parse(doc.subjectBoundAt) !== scope.now
        : doc.supabaseSubject != null || doc.subjectBoundAt != null)
    )
      throw new AuthActionError('invalid-command')
    if (
      (doc.actionType !== 'patient-verification' && doc.principal == null) ||
      (doc.principal == null ? doc.principalBoundAt != null : Date.parse(doc.principalBoundAt) !== scope.now)
    )
      throw new AuthActionError('invalid-command')
  } else {
    if (!originalDoc || originalDoc.id !== ('id' in write ? write.id : undefined) || terminal(originalDoc.state))
      throw new AuthActionError('invalid-transition')
    for (const field of immutableFields)
      if (!sameValue(doc[field], originalDoc[field])) throw new AuthActionError('invalid-command')
    if (write.kind === 'bind-subject') {
      if (
        originalDoc.actionType !== 'patient-verification' ||
        originalDoc.state !== 'pending' ||
        originalDoc.supabaseSubject != null ||
        originalDoc.subjectBoundAt != null ||
        originalDoc.principal != null ||
        originalDoc.principalBoundAt != null ||
        !sameValue(doc.principal, originalDoc.principal) ||
        !sameValue(doc.principalBoundAt, originalDoc.principalBoundAt) ||
        doc.state !== originalDoc.state ||
        doc.supabaseSubject == null ||
        Date.parse(doc.subjectBoundAt) !== scope.now ||
        Date.parse(doc.expiresAt) <= scope.now
      )
        throw new AuthActionError('invalid-transition')
    } else if (write.kind === 'bind') {
      if (
        (originalDoc.supabaseSubject ? originalDoc.state !== 'confirmed' : originalDoc.state !== 'pending') ||
        originalDoc.principal != null ||
        originalDoc.principalBoundAt != null ||
        doc.state !== originalDoc.state ||
        doc.terminalAt != null ||
        doc.outcomeCode != null ||
        !sameValue(doc.supabaseSubject, originalDoc.supabaseSubject) ||
        !sameValue(doc.subjectBoundAt, originalDoc.subjectBoundAt) ||
        Date.parse(doc.principalBoundAt) !== scope.now
      )
        throw new AuthActionError('invalid-transition')
    } else if (
      !sameValue(doc.principal, originalDoc.principal) ||
      !sameValue(doc.principalBoundAt, originalDoc.principalBoundAt) ||
      !sameValue(doc.supabaseSubject, originalDoc.supabaseSubject) ||
      !sameValue(doc.subjectBoundAt, originalDoc.subjectBoundAt) ||
      !authActionTransitions[originalDoc.state as AuthAction['state']].includes(doc.state) ||
      (doc.state === 'expired'
        ? Date.parse(doc.expiresAt) > scope.now
        : Date.parse(doc.expiresAt) <= scope.now && ['active', 'confirmed', 'completed'].includes(doc.state)) ||
      (terminal(doc.state) && Date.parse(doc.terminalAt) !== scope.now)
    ) {
      throw new AuthActionError('invalid-transition')
    }
  }
  return data
}

export const guardAuthActionDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const scope = await requireScope(req)
  if (scope.write?.kind !== 'delete' || scope.write.id !== id) throw new AuthActionError('access-denied')
  const doc = await req.payload.findByID({ collection: 'authActions', id, req, depth: 0, overrideAccess: true })
  if (!terminal(doc.state) || !doc.terminalAt || Date.parse(doc.terminalAt) > scope.now - authActionRetentionMs)
    throw new AuthActionError('invalid-transition')
}

function retryable(error: unknown) {
  const visited = new Set<unknown>()
  let current = error
  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current)
    const detail = current as { code?: unknown; cause?: unknown }
    if (detail.code === '40001' || detail.code === '40P01') return true
    current = detail.cause
  }
  return false
}

/** Internal system commands. No request capability or retry callback escapes this module. */
export function bindAuthActions(
  req: PayloadRequest,
  options: {
    environment: Environment
    now?: () => number
    verificationKeys?: readonly VerificationCorrelationKey[]
    recoveryKeys?: readonly RecoveryKey[]
  },
) {
  const environment = parsed(z.enum(authActionEnvironments), options.environment)
  const clock = options.now ?? Date.now
  async function transaction<Result>(
    work: (internalReq: PayloadRequest, scope: Scope) => Promise<Result>,
  ): Promise<Result> {
    if (typeof req.transactionID !== 'undefined') throw new AuthActionError('transaction-unavailable')
    for (let attempt = 1; attempt <= 3; attempt++) {
      let transactionID: string | number | null = null
      let identity: object | undefined
      try {
        const now = clock()
        if (!Number.isFinite(now)) throw new AuthActionError('invalid-command')
        transactionID = await req.payload.db.beginTransaction({
          isolationLevel: 'serializable',
          accessMode: 'read write',
        })
        if (transactionID === null) throw new AuthActionError('transaction-unavailable')
        const scope: Scope = { transactionID, environment, now }
        identity = broker.open(scope)
        // Promise IDs keep Payload's native error cleanup from swallowing owner rollback failures.
        const internalReq = await createLocalReq(
          { context: { authActionCapability: identity }, req: { transactionID: Promise.resolve(transactionID) } },
          req.payload,
        )
        const result = await work(internalReq, scope)
        await requireScope(internalReq)
        broker.close(identity)
        await req.payload.db.commitTransaction(transactionID)
        return result
      } catch (error) {
        if (identity) broker.close(identity)
        if (transactionID !== null) {
          try {
            await req.payload.db.rollbackTransaction(transactionID)
          } catch (rollbackError) {
            throw new AggregateError([error, rollbackError], 'Auth action transaction cleanup failed.')
          }
        }
        if (retryable(error) && attempt < 3) continue
        throw error
      } finally {
        if (identity) broker.close(identity)
      }
    }
    throw new AuthActionError('transaction-unavailable')
  }
  const find = async (internalReq: PayloadRequest, id: number) =>
    req.payload.findByID({
      collection: 'authActions',
      id,
      req: internalReq,
      overrideAccess: true,
      depth: 0,
      disableErrors: true,
    })
  async function requireAction(internalReq: PayloadRequest, id: number) {
    const action = await find(internalReq, id)
    if (!action) throw new AuthActionError('not-found')
    return action
  }
  async function principalExists(
    internalReq: PayloadRequest,
    actionType: CreateInput['actionType'],
    principal: Principal | undefined,
  ) {
    if (!principal) {
      if (actionType !== 'patient-verification') throw new AuthActionError('invalid-command')
      return
    }
    if (principal.relationTo !== authActionPolicies[actionType].principalCollection)
      throw new AuthActionError('invalid-command')
    const principalDoc = await req.payload.findByID({
      collection: principal.relationTo,
      id: principal.value,
      req: internalReq,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
    })
    if (!principalDoc) throw new AuthActionError('invalid-command')
    return principalDoc
  }
  async function transition(internalReq: PayloadRequest, scope: Scope, input: TransitionInput) {
    const action = await requireAction(internalReq, input.id)
    const outcomeCode = input.to === 'superseded' ? 'superseded' : (input.outcomeCode ?? null)
    if (
      (input.to === 'superseded' && input.outcomeCode && input.outcomeCode !== 'superseded') ||
      (input.to !== 'revoked' && input.to !== 'superseded' && input.outcomeCode)
    )
      throw new AuthActionError('invalid-command')
    if (action.state === input.to) {
      if (!sameValue(action.outcomeCode, outcomeCode)) throw new AuthActionError('invalid-transition')
      return action
    }
    if (terminal(action.state)) throw new AuthActionError('invalid-transition')
    if (['active', 'confirmed', 'completed'].includes(input.to)) {
      if (!action.principal) {
        if (
          input.to === 'completed' ||
          action.actionType !== 'patient-verification' ||
          !action.supabaseSubject ||
          action.principalBoundAt
        )
          throw new AuthActionError('invalid-transition')
      } else {
        const principal = await principalExists(
          internalReq,
          action.actionType,
          parsed(principalSchema, action.principal),
        )
        if (action.supabaseSubject && principal?.supabaseUserId !== action.supabaseSubject)
          throw new AuthActionError('invalid-transition')
        if (action.actionType === 'clinic-invitation') {
          const eligible = await findClinicInvitationPrincipal(
            internalReq,
            parsed(principalSchema, action.principal).value,
          )
          if (!eligible || !action.supabaseSubject || eligible.supabaseUserId !== action.supabaseSubject)
            throw new AuthActionError('invalid-transition')
        }
      }
    }
    const data = {
      state: input.to,
      terminalAt: terminal(input.to) ? new Date(scope.now).toISOString() : null,
      outcomeCode,
    }
    scope.write = { kind: 'transition', id: input.id, data }
    return req.payload.update({
      collection: 'authActions',
      id: input.id,
      req: internalReq,
      overrideAccess: true,
      depth: 0,
      data,
    })
  }
  async function createPending(
    internalReq: PayloadRequest,
    scope: Scope,
    command: CreateInput,
    correlation?: { correlationDigest: string; correlationKeyVersion: string },
    boundSubject?: string,
  ) {
    await principalExists(internalReq, command.actionType, command.principal)
    const policy = authActionPolicies[command.actionType]
    const data = {
      actionType: command.actionType,
      environment,
      state: 'pending' as const,
      principal: command.principal ?? null,
      principalBoundAt: command.principal ? new Date(scope.now).toISOString() : null,
      supabaseSubject: boundSubject ?? null,
      subjectBoundAt: boundSubject ? new Date(scope.now).toISOString() : null,
      correlationDigest: correlation?.correlationDigest ?? null,
      correlationKeyVersion: correlation?.correlationKeyVersion ?? null,
      supabaseTokenType: policy.supabaseTokenType,
      callbackDestination: policy.callbackDestination,
      completionRoute: policy.completionRoute,
      finalDestination: policy.finalDestination,
      createdAt: new Date(scope.now).toISOString(),
      expiresAt: new Date(scope.now + policy.lifetime).toISOString(),
      terminalAt: null,
      outcomeCode: null,
    }
    scope.write = { kind: 'create', data }
    return req.payload.create({ collection: 'authActions', req: internalReq, overrideAccess: true, depth: 0, data })
  }
  return Object.freeze({
    async create(input: CreateInput) {
      const command = parsed(createSchema, input)
      return transaction((internalReq, scope) => createPending(internalReq, scope, command))
    },
    async reserveClinicInvitation(input: { clinicStaffId: number; resendOf?: number }): Promise<AuthAction | null> {
      const command = parsed(z.object({ clinicStaffId: idSchema, resendOf: idSchema.optional() }).strict(), input)
      return transaction(async (internalReq, scope) => {
        const staff = await findClinicInvitationPrincipal(internalReq, command.clinicStaffId)
        if (!staff) return null
        const matches = await req.payload.find({
          collection: 'authActions',
          req: internalReq,
          overrideAccess: true,
          depth: 0,
          pagination: false,
          limit: 4,
          sort: '-createdAt',
          where: {
            and: [
              { environment: { equals: environment } },
              { actionType: { equals: 'clinic-invitation' } },
              { 'principal.relationTo': { equals: 'clinicStaff' } },
              { 'principal.value': { equals: staff.id } },
              {
                or: [
                  { createdAt: { greater_than: new Date(scope.now - 86400000).toISOString() } },
                  { state: { not_in: [...terminalAuthActionStates] } },
                ],
              },
            ],
          },
        })
        const live = matches.docs.filter(
          (action) => !terminal(action.state) && Date.parse(action.expiresAt) > scope.now,
        )
        if (live.length > 1) throw new AuthActionError('invalid-transition')
        const current = live[0]
        if (current && current.supabaseSubject !== staff.supabaseUserId) throw new AuthActionError('invalid-transition')
        if (
          command.resendOf != null &&
          (!current || current.id !== command.resendOf || !['pending', 'active'].includes(current.state))
        )
          throw new AuthActionError('invalid-transition')
        if (current && command.resendOf == null) return current
        const recent = matches.docs.filter((action) => Date.parse(action.createdAt) > scope.now - 86400000)
        if (recent.length >= 3 || recent.some((action) => Date.parse(action.createdAt) > scope.now - 900000))
          throw new AuthActionError('rate-limited')
        for (const action of matches.docs) {
          if (!terminal(action.state) && Date.parse(action.expiresAt) <= scope.now)
            await transition(internalReq, scope, { id: action.id, to: 'expired' })
        }
        if (staff.invitationAuthorizedAt && !current) return null
        if (current) await transition(internalReq, scope, { id: current.id, to: 'superseded' })
        const action = await createPending(
          internalReq,
          scope,
          { actionType: 'clinic-invitation', principal: { relationTo: 'clinicStaff', value: staff.id } },
          undefined,
          staff.supabaseUserId!,
        )
        if (!staff.invitationAuthorizedAt) {
          const data = { invitationAuthorizedAt: new Date(scope.now).toISOString() }
          scope.write = { kind: 'clinic-invitation-mark', id: staff.id, data }
          await req.payload.update({
            collection: 'clinicStaff',
            id: staff.id,
            req: internalReq,
            overrideAccess: true,
            depth: 0,
            context: { ...internalReq.context, skipClinicStaffAuthSync: true },
            data,
          })
        }
        return action
      })
    },
    liveClinicInvitations(input: { afterId?: number; limit?: number } = {}): Promise<AuthAction[]> {
      const command = parsed(
        z
          .object({
            afterId: z.number().int().nonnegative().optional(),
            limit: z.number().int().min(1).max(25).optional(),
          })
          .strict(),
        input,
      )
      return transaction(async (internalReq, scope) => {
        const result = await req.payload.find({
          collection: 'authActions',
          req: internalReq,
          overrideAccess: true,
          depth: 0,
          pagination: false,
          limit: command.limit ?? 25,
          sort: 'id',
          where: {
            and: [
              { id: { greater_than: command.afterId ?? 0 } },
              { environment: { equals: environment } },
              { actionType: { equals: 'clinic-invitation' } },
              { state: { in: ['pending', 'active'] } },
              { expiresAt: { greater_than: new Date(scope.now).toISOString() } },
            ],
          },
        })
        return result.docs
      })
    },
    liveRecoveries(input: { beforeId?: number; limit?: number } = {}): Promise<AuthAction[]> {
      const command = parsed(
        z
          .object({
            beforeId: z.number().int().positive().optional(),
            limit: z.number().int().min(1).max(25).optional(),
          })
          .strict(),
        input,
      )
      return transaction(async (internalReq, scope) => {
        const result = await req.payload.find({
          collection: 'authActions',
          req: internalReq,
          overrideAccess: true,
          depth: 0,
          pagination: false,
          limit: command.limit ?? 25,
          sort: '-id',
          where: {
            and: [
              ...(command.beforeId ? [{ id: { less_than: command.beforeId } }] : []),
              { environment: { equals: environment } },
              { actionType: { in: [...recoveryActionTypes] } },
              { state: { in: ['pending', 'active'] } },
              { expiresAt: { greater_than: new Date(scope.now).toISOString() } },
            ],
          },
        })
        return result.docs
      })
    },
    async reserveRecovery(input: {
      email: string
      context: RecoveryContext | null
      actionType?: 'clinic-recovery'
    }): Promise<AuthAction | null> {
      const email = normalizeEmail(input.email)
      if (!isValidEmail(email) || email.length > 254) throw new AuthActionError('invalid-command')
      return transaction(async (internalReq, scope) => {
        const ip = inspectRecoveryContext(input.context, environment, email, scope.now)
        if (!ip) return null
        let dimensions: ReturnType<typeof recoveryCorrelations>
        try {
          dimensions = recoveryCorrelations(email, ip, environment, options.recoveryKeys ?? [])
        } catch {
          throw new AuthActionError('correlation-unavailable')
        }
        scope.recovery = true
        const window = { observedAt: { greater_than: new Date(scope.now - recoveryWindowMs).toISOString() } }
        const unknownVersion = await req.payload.find({
          collection: 'recoveryRequestEvents',
          req: internalReq,
          overrideAccess: true,
          depth: 0,
          pagination: false,
          limit: 1,
          where: {
            and: [
              { environment: { equals: environment } },
              window,
              { keyVersion: { not_in: dimensions[0]!.correlations.map((key) => key.keyVersion) } },
            ],
          },
        })
        if (unknownVersion.docs.length) throw new AuthActionError('correlation-unavailable')
        for (const { dimension, correlations } of dimensions) {
          const recent = await req.payload.find({
            collection: 'recoveryRequestEvents',
            req: internalReq,
            overrideAccess: true,
            depth: 0,
            pagination: false,
            limit: recoveryHourlyLimit,
            sort: '-observedAt',
            where: {
              and: [
                { environment: { equals: environment } },
                { dimension: { equals: dimension } },
                window,
                {
                  or: correlations.map<Where>(({ keyVersion, digest }) => ({
                    keyVersion: { equals: keyVersion },
                    digest: { equals: digest },
                  })),
                },
              ],
            },
          })
          if (
            recent.docs.length >= recoveryHourlyLimit ||
            recent.docs.some((event) => Date.parse(event.observedAt) > scope.now - recoveryCooldownMs)
          )
            return null
        }
        for (const { dimension, correlations } of dimensions) {
          const data = { environment, dimension, ...correlations[0]!, observedAt: new Date(scope.now).toISOString() }
          scope.write = { kind: 'recovery-create', data }
          await req.payload.create({
            collection: 'recoveryRequestEvents',
            req: internalReq,
            overrideAccess: true,
            depth: 0,
            data,
          })
        }
        const principal = await findRecoveryPrincipal(internalReq, email)
        if (!principal || (input.actionType && principal.actionType !== input.actionType)) return null
        const prior = await req.payload.find({
          collection: 'authActions',
          req: internalReq,
          overrideAccess: true,
          depth: 0,
          pagination: false,
          limit: 6,
          where: {
            and: [
              { environment: { equals: environment } },
              { actionType: { equals: principal.actionType } },
              { 'principal.relationTo': { equals: principal.collection } },
              { 'principal.value': { equals: principal.document.id } },
              { state: { in: ['pending', 'active'] } },
              { expiresAt: { greater_than: new Date(scope.now).toISOString() } },
            ],
          },
        })
        if (prior.docs.length > recoveryHourlyLimit) throw new AuthActionError('invalid-transition')
        for (const action of prior.docs) await transition(internalReq, scope, { id: action.id, to: 'superseded' })
        const correlation = dimensions[0]!.correlations[0]!
        return createPending(
          internalReq,
          scope,
          {
            actionType: principal.actionType,
            principal: { relationTo: principal.collection, value: principal.document.id },
          },
          { correlationDigest: correlation.digest, correlationKeyVersion: correlation.keyVersion },
          principal.document.supabaseUserId!,
        )
      })
    },
    sweepRecovery() {
      return transaction(async (internalReq, scope) => {
        scope.recovery = true
        const due = await req.payload.find({
          collection: 'recoveryRequestEvents',
          req: internalReq,
          overrideAccess: true,
          depth: 0,
          pagination: false,
          limit: 100,
          sort: 'id',
          where: {
            and: [
              { environment: { equals: environment } },
              { observedAt: { less_than_equal: new Date(scope.now - recoveryWindowMs).toISOString() } },
            ],
          },
        })
        for (const event of due.docs) {
          scope.write = { kind: 'recovery-delete', id: event.id }
          await req.payload.delete({
            collection: 'recoveryRequestEvents',
            id: event.id,
            req: internalReq,
            overrideAccess: true,
            depth: 0,
          })
        }
        return { deleted: due.docs.length }
      })
    },
    async reservePatientVerification(input: { email: string; resendOf?: number }) {
      const command = parsed(z.object({ email: z.string(), resendOf: idSchema.optional() }).strict(), input)
      let correlations: ReturnType<typeof verificationCorrelations>
      try {
        correlations = verificationCorrelations(command.email, environment, options.verificationKeys ?? [])
      } catch {
        throw new AuthActionError('invalid-command')
      }
      return transaction(async (internalReq, scope) => {
        const missingVersion = await req.payload.find({
          collection: 'authActions',
          req: internalReq,
          overrideAccess: true,
          depth: 0,
          pagination: false,
          limit: 1,
          where: {
            and: [
              { environment: { equals: environment } },
              { actionType: { equals: 'patient-verification' } },
              { correlationDigest: { exists: true } },
              {
                correlationKeyVersion: {
                  not_in: correlations.map(({ correlationKeyVersion }) => correlationKeyVersion),
                },
              },
            ],
          },
        })
        if (missingVersion.docs.length) throw new AuthActionError('correlation-unavailable')
        const matches = await req.payload.find({
          collection: 'authActions',
          req: internalReq,
          overrideAccess: true,
          depth: 0,
          pagination: false,
          limit: 6,
          sort: '-createdAt',
          where: {
            and: [
              { environment: { equals: environment } },
              { actionType: { equals: 'patient-verification' } },
              {
                or: [
                  { createdAt: { greater_than: new Date(scope.now - verificationCorrelationWindowMs).toISOString() } },
                  { state: { not_in: [...terminalAuthActionStates] } },
                ],
              },
              {
                or: correlations.map<Where>(({ correlationDigest, correlationKeyVersion }) => ({
                  correlationDigest: { equals: correlationDigest },
                  correlationKeyVersion: { equals: correlationKeyVersion },
                })),
              },
            ],
          },
        })
        const live = matches.docs.filter(
          (action) => !terminal(action.state) && Date.parse(action.expiresAt) > scope.now,
        )
        if (live.length > 1) throw new AuthActionError('invalid-transition')
        const current = live[0]
        if (
          command.resendOf != null &&
          (!current || current.id !== command.resendOf || !['pending', 'active'].includes(current.state))
        )
          throw new AuthActionError('invalid-transition')
        if (current && command.resendOf == null) return current
        const recent = matches.docs.filter(
          (action) => Date.parse(action.createdAt) > scope.now - verificationCorrelationWindowMs,
        )
        if (
          recent.length >= verificationDailyLimit ||
          recent.some((action) => Date.parse(action.createdAt) > scope.now - verificationCooldownMs)
        )
          throw new AuthActionError('rate-limited')
        for (const action of matches.docs) {
          if (!terminal(action.state) && Date.parse(action.expiresAt) <= scope.now)
            await transition(internalReq, scope, { id: action.id, to: 'expired' })
        }
        if (current) await transition(internalReq, scope, { id: current.id, to: 'superseded' })
        return createPending(internalReq, scope, { actionType: 'patient-verification' }, correlations[0])
      })
    },
    read(id: number) {
      return transaction((internalReq) => find(internalReq, parsed(idSchema, id)))
    },
    /** Dashboard commands keep the reference and verified subject checks inside the owned lifecycle transaction. */
    inspectDashboardAction(input: {
      id: number
      flow: DashboardActionFlow
      subject?: string
      email?: string
      to?: 'confirmed' | 'completed'
      state?: 'confirmed' | 'completed'
    }) {
      const command = parsed(
        z
          .object({
            id: idSchema,
            flow: z.enum(['clinic-invitation', 'clinic-recovery']),
            subject: subjectSchema.optional(),
            email: z.string().max(254).optional(),
            to: z.enum(['confirmed', 'completed']).optional(),
            state: z.enum(['confirmed', 'completed']).optional(),
          })
          .strict(),
        input,
      )
      return transaction(async (internalReq, scope) => {
        const action = await requireAction(internalReq, command.id)
        validatePolicy(action as unknown as Record<string, unknown>, scope)
        const expectedState = command.state ?? (command.to === 'completed' ? 'confirmed' : 'active')
        const confirmingRetry = command.to === 'confirmed' && action.state === 'confirmed'
        if (
          action.actionType !== command.flow ||
          (action.state !== expectedState && !confirmingRetry) ||
          Date.parse(action.createdAt) > scope.now ||
          Date.parse(action.expiresAt) <= scope.now ||
          !action.supabaseSubject ||
          !action.principal ||
          action.principal.relationTo !== 'clinicStaff' ||
          ((command.to || command.state) && (!command.subject || !command.email)) ||
          (command.subject && action.supabaseSubject !== command.subject)
        )
          throw new AuthActionError('invalid-transition')
        const principalId =
          typeof action.principal.value === 'number' ? action.principal.value : action.principal.value.id
        const principal =
          command.flow === 'clinic-invitation'
            ? await findClinicInvitationPrincipal(internalReq, principalId)
            : (await readRecoveryPrincipal(internalReq, 'clinicStaff', principalId))?.document
        if (
          !principal ||
          principal.supabaseUserId !== action.supabaseSubject ||
          (command.email && normalizeEmail(principal.email) !== normalizeEmail(command.email))
        )
          throw new AuthActionError('invalid-transition')
        if (command.flow === 'clinic-recovery') {
          const correlations = recoveryCorrelations(
            principal.email ?? '',
            '192.0.2.1',
            environment,
            options.recoveryKeys ?? [],
          )[0]!.correlations
          if (
            !correlations.some(
              (key) => key.keyVersion === action.correlationKeyVersion && key.digest === action.correlationDigest,
            )
          )
            throw new AuthActionError('invalid-transition')
        }
        if (command.to === 'completed') {
          // The protocol still holds the subject's password claim. Commit revocation with completion before
          // releasing that claim, so an earlier invitation or recovery cannot become the next password writer.
          const competing = await req.payload.find({
            collection: 'authActions',
            req: internalReq,
            overrideAccess: true,
            depth: 0,
            pagination: false,
            limit: 101,
            where: {
              environment: { equals: environment },
              actionType: { in: [...dashboardActionFlows] },
              supabaseSubject: { equals: action.supabaseSubject },
              state: { in: ['pending', 'active', 'confirmed'] },
              id: { not_equals: action.id },
            },
          })
          if (competing.docs.length > 100) throw new AuthActionError('invalid-transition')
          for (const candidate of competing.docs)
            await transition(internalReq, scope, { id: candidate.id, to: 'revoked' })
        }
        return command.to && !confirmingRetry
          ? transition(internalReq, scope, { id: action.id, to: command.to })
          : action
      })
    },
    async bindSubject(input: z.infer<typeof bindSubjectSchema>) {
      const command = parsed(bindSubjectSchema, input)
      return transaction(async (internalReq, scope) => {
        const action = await requireAction(internalReq, command.id)
        if (action.supabaseSubject === command.supabaseSubject) return action
        if (
          action.actionType !== 'patient-verification' ||
          action.state !== 'pending' ||
          action.supabaseSubject ||
          action.subjectBoundAt ||
          action.principal ||
          action.principalBoundAt ||
          Date.parse(action.expiresAt) <= scope.now
        )
          throw new AuthActionError('invalid-transition')
        const data = { supabaseSubject: command.supabaseSubject, subjectBoundAt: new Date(scope.now).toISOString() }
        scope.write = { kind: 'bind-subject', id: command.id, data }
        return req.payload.update({
          collection: 'authActions',
          id: command.id,
          req: internalReq,
          overrideAccess: true,
          depth: 0,
          data,
        })
      })
    },
    async bindPrincipal(input: z.infer<typeof bindSchema>) {
      const command = parsed(bindSchema, input)
      return transaction(async (internalReq, scope) => {
        const action = await requireAction(internalReq, command.id)
        if (sameValue(action.principal, command.principal)) return action
        if (
          (action.supabaseSubject ? action.state !== 'confirmed' : action.state !== 'pending') ||
          action.principal ||
          action.principalBoundAt ||
          Date.parse(action.expiresAt) <= scope.now
        )
          throw new AuthActionError('invalid-transition')
        const principal = await principalExists(internalReq, action.actionType, command.principal)
        if (action.supabaseSubject && principal?.supabaseUserId !== action.supabaseSubject)
          throw new AuthActionError('invalid-transition')
        const data = { principal: command.principal, principalBoundAt: new Date(scope.now).toISOString() }
        scope.write = { kind: 'bind', id: command.id, data }
        return req.payload.update({
          collection: 'authActions',
          id: command.id,
          req: internalReq,
          overrideAccess: true,
          depth: 0,
          data,
        })
      })
    },
    async transition(input: TransitionInput) {
      const command = parsed(transitionSchema, input)
      return transaction((internalReq, scope) => transition(internalReq, scope, command))
    },
    async fenceWebsiteRecovery(
      id: number,
      confirm = false,
      replaceableConfirmation: (action: AuthAction) => boolean = () => false,
    ) {
      const actionId = parsed(idSchema, id)
      const claimConfirmation = parsed(z.boolean(), confirm)
      return transaction(async (internalReq, scope) => {
        const action = await requireAction(internalReq, actionId)
        if (
          !['patient-recovery', 'platform-recovery'].includes(action.actionType) ||
          !['active', 'confirmed'].includes(action.state) ||
          !action.principal ||
          !action.supabaseSubject ||
          Date.parse(action.expiresAt) <= scope.now ||
          (claimConfirmation && action.state !== 'active')
        )
          throw new AuthActionError('invalid-transition')
        const principal = parsed(principalSchema, action.principal)
        const prior = await req.payload.find({
          collection: 'authActions',
          req: internalReq,
          overrideAccess: true,
          depth: 0,
          pagination: false,
          limit: 6,
          where: {
            and: [
              { environment: { equals: environment } },
              { actionType: { equals: action.actionType } },
              { 'principal.relationTo': { equals: principal.relationTo } },
              { 'principal.value': { equals: principal.value } },
              {
                or: [
                  { state: { equals: 'confirmed' } },
                  {
                    and: [
                      { state: { in: ['pending', 'active'] } },
                      { expiresAt: { greater_than: new Date(scope.now).toISOString() } },
                    ],
                  },
                ],
              },
            ],
          },
        })
        if (prior.docs.length >= 6 || prior.docs.some((candidate) => candidate.id > actionId))
          throw new AuthActionError('invalid-transition')
        // An unresolved provider writer must remain fenced even after expiry. The callback only examines a
        // previously fetched identity in memory; provider effects never enter this retried transaction.
        if (
          prior.docs.some(
            (candidate) =>
              candidate.id !== actionId && candidate.state === 'confirmed' && !replaceableConfirmation(candidate),
          )
        )
          throw new AuthActionError('invalid-transition')
        for (const candidate of prior.docs) {
          if (candidate.id !== actionId) await transition(internalReq, scope, { id: candidate.id, to: 'revoked' })
        }
        if (claimConfirmation) await transition(internalReq, scope, { id: actionId, to: 'confirmed' })
      })
    },
    sweep() {
      return transaction(async (internalReq, scope) => {
        const due = await req.payload.find({
          collection: 'authActions',
          req: internalReq,
          overrideAccess: true,
          depth: 0,
          pagination: false,
          limit: 100,
          sort: 'id',
          where: {
            and: [
              { environment: { equals: environment } },
              {
                or: [
                  {
                    and: [
                      { state: { in: [...terminalAuthActionStates] } },
                      { terminalAt: { less_than_equal: new Date(scope.now - authActionRetentionMs).toISOString() } },
                    ],
                  },
                  {
                    and: [
                      { state: { not_in: [...terminalAuthActionStates] } },
                      { expiresAt: { less_than_equal: new Date(scope.now).toISOString() } },
                      {
                        or: [
                          { state: { not_in: ['confirmed'] } },
                          { actionType: { not_in: ['patient-recovery', 'platform-recovery'] } },
                        ],
                      },
                    ],
                  },
                  {
                    and: [
                      { actionType: { equals: 'patient-verification' } },
                      { correlationDigest: { exists: true } },
                      {
                        createdAt: {
                          less_than_equal: new Date(scope.now - verificationCorrelationWindowMs).toISOString(),
                        },
                      },
                    ],
                  },
                  {
                    and: [
                      { actionType: { in: [...recoveryActionTypes] } },
                      { correlationDigest: { exists: true } },
                      { createdAt: { less_than_equal: new Date(scope.now - recoveryWindowMs).toISOString() } },
                    ],
                  },
                ],
              },
            ],
          },
        })
        let expired = 0
        let deleted = 0
        for (const action of due.docs) {
          if (
            terminal(action.state) &&
            action.terminalAt &&
            Date.parse(action.terminalAt) <= scope.now - authActionRetentionMs
          ) {
            scope.write = { kind: 'delete', id: action.id }
            await req.payload.delete({
              collection: 'authActions',
              id: action.id,
              req: internalReq,
              overrideAccess: true,
              depth: 0,
            })
            deleted++
            continue
          } else if (
            !terminal(action.state) &&
            Date.parse(action.expiresAt) <= scope.now &&
            !(action.state === 'confirmed' && ['patient-recovery', 'platform-recovery'].includes(action.actionType))
          ) {
            await transition(internalReq, scope, { id: action.id, to: 'expired' })
            expired++
          }
          if (
            action.correlationDigest &&
            Date.parse(action.createdAt) <=
              scope.now -
                (action.actionType === 'patient-verification' ? verificationCorrelationWindowMs : recoveryWindowMs)
          ) {
            const data = { correlationDigest: null, correlationKeyVersion: null }
            scope.write = { kind: 'clear-correlation', id: action.id, data }
            await req.payload.update({
              collection: 'authActions',
              id: action.id,
              req: internalReq,
              overrideAccess: true,
              depth: 0,
              data,
            })
          }
        }
        return { expired, deleted }
      })
    },
  })
}
