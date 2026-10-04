import { z } from 'zod'
import type { PayloadRequest } from 'payload'
import type { User } from '@supabase/supabase-js'
import { bindAuthActions } from '../lifecycle'
import { dashboardRecoveryContext } from '../recoveryContext'
import { requestPasswordRecovery } from '../passwordRecoveryRequests'
import { resolveRecoveryKeys } from '../recoveryConfiguration'
import { dashboardActionFlows } from '../contracts'
import {
  authenticateAuthActionRequest,
  readActionReference,
  authActionRequestBodyLimit,
  type AuthActionProtocolKeys,
  type AuthActionRequestEnvelope,
} from './credentials'
import { bindProtocolReplay, type ProtocolOutcome } from './replay'
import { bindProtocolPasswordCompletion } from './passwordCompletion'
import { updateProtocolPassword, verifyProtocolUser } from './provider'

const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
export function authActionProtocolResponse(outcome: ProtocolOutcome): Response {
  if (outcome === 'unavailable')
    return Response.json(
      { version: 1, ok: false, code: 'AUTH_ACTION_TEMPORARILY_UNAVAILABLE' },
      { status: 503, headers },
    )
  if (outcome === 'invalid')
    return Response.json({ version: 1, ok: false, code: 'INVALID_OR_EXPIRED_ACTION' }, { status: 400, headers })
  return Response.json({ version: 1, ok: true, outcome }, { status: outcome === 'accepted' ? 202 : 200, headers })
}
const recoverySchema = z.object({ email: z.string().max(254), clientIP: z.string().max(64) }).strict()
const actionSchema = z.object({ actionRef: z.string().max(1024), flow: z.enum(dashboardActionFlows) }).strict()
const subjectSchema = actionSchema.extend({ accessToken: z.string().min(1).max(8192) }).strict()
const completeSchema = subjectSchema.extend({ password: z.string().min(1).max(1024) }).strict()

async function boundedBody(request: Request): Promise<string> {
  if (!request.body) throw new Error()
  const reader = request.body.getReader()
  let size = 0
  const chunks: Uint8Array[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error()), 10_000)
  })
  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), deadline])
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > authActionRequestBodyLimit) {
        throw new Error()
      }
      chunks.push(chunk.value)
    }
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks))
  } catch {
    // A cloned request uses a tee: waiting for cancellation could wait forever for its unread sibling.
    void reader.cancel().catch(() => {})
    throw new Error()
  } finally {
    clearTimeout(timer)
    reader.releaseLock()
  }
}

async function envelope(request: Request, operation: string): Promise<AuthActionRequestEnvelope> {
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') throw new Error()
  return {
    method: request.method,
    operation,
    body: await boundedBody(request),
    timestamp: request.headers.get('x-auth-action-timestamp') ?? '',
    requestId: request.headers.get('x-auth-action-request-id') ?? '',
    keyVersion: request.headers.get('x-auth-action-key-version') ?? '',
    signature: request.headers.get('x-auth-action-signature') ?? '',
  }
}

/** The route verifies the bounded envelope before initializing Payload or performing any database work. */
export async function authenticateProtocolHttpRequest(
  request: Request,
  operation: string,
  keys: AuthActionProtocolKeys,
  now = Date.now(),
) {
  try {
    return authenticateAuthActionRequest(await envelope(request, operation), keys, now) !== null
  } catch {
    return false
  }
}

function eligibleUser(user: User | null, now: number): user is User {
  return Boolean(
    user &&
    z.uuid().safeParse(user.id).success &&
    user.email &&
    user.app_metadata?.user_type === 'clinic' &&
    (!user.banned_until || Date.parse(user.banned_until) <= now),
  )
}

export function bindAuthActionProtocol(
  req: PayloadRequest,
  options: {
    keys: AuthActionProtocolKeys
    now?: () => number
    verifyUser?: typeof verifyProtocolUser
    updatePassword?: typeof updateProtocolPassword
    recoveryKeys?: ReturnType<typeof resolveRecoveryKeys>
  },
) {
  const { keys } = options
  const now = options.now ?? Date.now
  const verifyUser = options.verifyUser ?? verifyProtocolUser
  const updatePassword = options.updatePassword ?? updateProtocolPassword
  const replay = bindProtocolReplay(req, keys, now)
  const passwordCompletion = bindProtocolPasswordCompletion(req, keys.environment)
  function actions(flow: string) {
    return bindAuthActions(req, {
      environment: keys.environment,
      now,
      recoveryKeys:
        flow === 'clinic-recovery' ? (options.recoveryKeys ?? resolveRecoveryKeys(keys.environment)) : undefined,
    })
  }
  return async (request: Request, operation: string): Promise<Response> => {
    let input: AuthActionRequestEnvelope
    let body: unknown
    let owned: { finish(outcome: ProtocolOutcome): Promise<void> } | undefined
    try {
      input = await envelope(request, operation)
      body = JSON.parse(input.body)
    } catch {
      return authActionProtocolResponse('invalid')
    }
    const authenticated = authenticateAuthActionRequest(input, keys, now())
    if (!authenticated) return authActionProtocolResponse('invalid')
    try {
      // No cleanup, read, provider call or original-IP handling precedes service authentication.
      await replay.sweep()
      const claim = await replay.claim(input, authenticated.expiresAt)
      if (claim.kind === 'owned') owned = claim
      if (operation === 'requestRecovery') {
        const parsed = recoverySchema.safeParse(body)
        const context = parsed.success
          ? dashboardRecoveryContext(input, {
              environment: keys.environment,
              keys: keys.service,
              now,
              protocolVersion: 1,
            })
          : null
        if (!parsed.success || !context) return authActionProtocolResponse('invalid')
        if (claim.kind === 'replay') return authActionProtocolResponse(claim.outcome)
        // Existing admission, catalog acceptance and non-enumeration remain the recovery owner's responsibility.
        try {
          await requestPasswordRecovery(req, { email: parsed.data.email, context, actionType: 'clinic-recovery' })
        } catch {
          /* Neutral recovery outcome. */
        }
        await claim.finish('accepted')
        return authActionProtocolResponse('accepted')
      }
      const parsed = (
        operation === 'validateAction' ? actionSchema : operation === 'confirmAction' ? subjectSchema : completeSchema
      ).safeParse(body)
      if (!parsed.success) return authActionProtocolResponse('invalid')
      const reference = readActionReference(parsed.data.actionRef, keys)
      if (!reference || reference.flow !== parsed.data.flow) return authActionProtocolResponse('invalid')
      const actionService = actions(reference.flow)
      if (operation === 'validateAction') {
        if (claim.kind === 'replay' && claim.outcome !== 'valid') return authActionProtocolResponse(claim.outcome)
        await actionService.inspectDashboardAction({ id: reference.actionId, flow: reference.flow })
        if (claim.kind === 'owned') await claim.finish('valid')
        return authActionProtocolResponse('valid')
      }
      if (!('accessToken' in parsed.data) || typeof parsed.data.accessToken !== 'string')
        return authActionProtocolResponse('invalid')
      const accessToken = parsed.data.accessToken
      const user = await verifyUser(accessToken)
      if (!eligibleUser(user, now())) return authActionProtocolResponse('invalid')
      const source = await actionService.read(reference.actionId)
      if (
        !source ||
        source.actionType !== reference.flow ||
        source.environment !== keys.environment ||
        source.supabaseSubject !== user.id ||
        Date.parse(source.expiresAt) <= now()
      )
        return authActionProtocolResponse('invalid')
      if (claim.kind === 'replay' && claim.outcome !== 'unavailable') {
        if (claim.outcome === 'confirmed' && source.state === 'confirmed') {
          await actionService.inspectDashboardAction({
            id: source.id,
            flow: reference.flow,
            subject: user.id,
            email: user.email!,
            state: 'confirmed',
          })
        } else if (
          claim.outcome === 'completed' &&
          source.state === 'completed' &&
          (await passwordCompletion.succeeded(source, user.id))
        ) {
          await actionService.inspectDashboardAction({
            id: source.id,
            flow: reference.flow,
            subject: user.id,
            email: user.email!,
            state: 'completed',
          })
          await passwordCompletion.releaseCompleted(source, user.id)
        } else if (claim.outcome !== 'invalid') return authActionProtocolResponse('invalid')
        return authActionProtocolResponse(claim.outcome)
      }
      if (operation === 'confirmAction') {
        if (claim.kind === 'replay') {
          if (source.state !== 'confirmed') return authActionProtocolResponse('unavailable')
          await actionService.inspectDashboardAction({
            id: source.id,
            flow: reference.flow,
            subject: user.id,
            email: user.email!,
            state: 'confirmed',
          })
          return authActionProtocolResponse('confirmed')
        }
        await actionService.inspectDashboardAction({
          id: source.id,
          flow: reference.flow,
          subject: user.id,
          email: user.email!,
          to: 'confirmed',
        })
        await claim.finish('confirmed')
        return authActionProtocolResponse('confirmed')
      }
      if (!('password' in parsed.data) || typeof parsed.data.password !== 'string')
        return authActionProtocolResponse('invalid')
      const password = parsed.data.password
      if (claim.kind === 'replay') {
        // A matching durable success may resume lifecycle work; an uncertain password call cannot resume execution.
        if (!(await passwordCompletion.succeeded(source, user.id))) return authActionProtocolResponse('unavailable')
        if (source.state === 'completed')
          await actionService.inspectDashboardAction({
            id: source.id,
            flow: reference.flow,
            subject: user.id,
            email: user.email!,
            state: 'completed',
          })
      } else {
        await actionService.inspectDashboardAction({
          id: source.id,
          flow: reference.flow,
          subject: user.id,
          email: user.email!,
          state: 'confirmed',
        })
        const outcome = await passwordCompletion.execute({
          action: source,
          subject: user.id,
          requestId: input.requestId,
          verifyCurrentAuthority: async () => {
            if (now() >= authenticated.expiresAt) throw new Error()
            const current = await verifyUser(accessToken)
            if (!eligibleUser(current, now()) || current.id !== user.id) throw new Error()
            await actionService.inspectDashboardAction({
              id: source.id,
              flow: reference.flow,
              subject: current.id,
              email: current.email!,
              state: 'confirmed',
            })
          },
          updatePassword: () => updatePassword(accessToken, password),
        })
        if (outcome !== 'updated') {
          const result = outcome === 'rejected' ? 'invalid' : 'unavailable'
          await claim.finish(result)
          return authActionProtocolResponse(result)
        }
      }
      const completed =
        source.state === 'completed' && claim.kind === 'replay'
          ? source
          : await actionService.inspectDashboardAction({
              id: source.id,
              flow: reference.flow,
              subject: user.id,
              email: user.email!,
              to: 'completed',
            })
      await passwordCompletion.releaseCompleted(completed, user.id)
      if (claim.kind === 'owned') await claim.finish('completed')
      return authActionProtocolResponse('completed')
    } catch (error) {
      // Auth lifecycle codes are closed and safe; storage/provider diagnostics never cross this boundary.
      const code = error && typeof error === 'object' ? Reflect.get(error, 'code') : undefined
      const outcome = ['not-found', 'invalid-command', 'invalid-transition', 'access-denied'].includes(String(code))
        ? 'invalid'
        : 'unavailable'
      if (outcome === 'invalid' && owned) await owned.finish('invalid').catch(() => {})
      return authActionProtocolResponse(outcome)
    }
  }
}
