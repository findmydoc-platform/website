import {
  APIError,
  createLocalReq,
  type CollectionAfterReadHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionBeforeOperationHook,
  type PayloadRequest,
} from 'payload'
import { z } from 'zod'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import type { AuthAction } from '@/payload-types'
import {
  authActionDiagnosticFields,
  authActionEnvironments,
  authActionOutcomes,
  authActionPolicies,
  authActionRetentionMs,
  authActionStates,
  authActionTransitions,
  authActionTypes,
  terminalAuthActionStates,
} from './contracts'

class AuthActionError extends APIError {
  constructor(
    public readonly code:
      'access-denied' | 'invalid-command' | 'invalid-transition' | 'transaction-unavailable' | 'not-found',
  ) {
    super(
      code,
      code === 'access-denied' ? 403 : code === 'not-found' ? 404 : code === 'transaction-unavailable' ? 503 : 409,
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
  | { kind: 'transition' | 'bind' | 'bind-subject'; id: number; data: Record<string, unknown> }
  | { kind: 'delete'; id: number }
type Scope = { transactionID: string | number; environment: Environment; now: number; write?: Write }

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
    const expectedOperation = ['bind', 'bind-subject', 'transition'].includes(scope.write.kind)
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

const storedFields = new Set<string>([
  ...authActionDiagnosticFields,
  'supabaseTokenType',
  'principal',
  'principalBoundAt',
  'supabaseSubject',
  'subjectBoundAt',
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
] as const

function validatePolicy(doc: Record<string, unknown>, scope: Scope) {
  const actionType = parsed(z.enum(authActionTypes), doc.actionType)
  const state = parsed(z.enum(authActionStates), doc.state)
  const policy = authActionPolicies[actionType]
  const createdAt = Date.parse(String(doc.createdAt))
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
    if (actionType !== 'patient-verification' || !Number.isFinite(Date.parse(String(doc.subjectBoundAt))))
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
  if (!write || write.kind === 'delete' || (operation === 'create') !== (write.kind === 'create'))
    throw new AuthActionError('access-denied')
  if (Object.keys(data).some((key) => !storedFields.has(key))) throw new AuthActionError('invalid-command')
  const doc = { ...originalDoc, ...data }
  validatePolicy(doc, scope)
  if (operation === 'create') {
    if (
      data.id != null ||
      doc.state !== 'pending' ||
      doc.terminalAt != null ||
      doc.outcomeCode != null ||
      doc.supabaseSubject != null ||
      doc.subjectBoundAt != null
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
export function bindAuthActions(req: PayloadRequest, options: { environment: Environment; now?: () => number }) {
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
  return Object.freeze({
    async create(input: CreateInput) {
      const command = parsed(createSchema, input)
      return transaction(async (internalReq, scope) => {
        await principalExists(internalReq, command.actionType, command.principal)
        const policy = authActionPolicies[command.actionType]
        const data = {
          actionType: command.actionType,
          environment,
          state: 'pending' as const,
          principal: command.principal ?? null,
          principalBoundAt: command.principal ? new Date(scope.now).toISOString() : null,
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
      })
    },
    read(id: number) {
      return transaction((internalReq) => find(internalReq, parsed(idSchema, id)))
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
          if (terminal(action.state)) {
            if (!action.terminalAt || Date.parse(action.terminalAt) > scope.now - authActionRetentionMs) continue
            scope.write = { kind: 'delete', id: action.id }
            await req.payload.delete({
              collection: 'authActions',
              id: action.id,
              req: internalReq,
              overrideAccess: true,
              depth: 0,
            })
            deleted++
          } else if (Date.parse(action.expiresAt) <= scope.now) {
            await transition(internalReq, scope, { id: action.id, to: 'expired' })
            expired++
          }
        }
        return { expired, deleted }
      })
    },
  })
}
