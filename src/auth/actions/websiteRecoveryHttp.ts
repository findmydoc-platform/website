import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { applyPrivateAuthHeaders } from '@/auth/utilities/tokenHashCallback'
import { InvalidWebsiteRecovery, RecoveryPasswordRejected, websiteRecoveryAuthority } from './websiteRecoveryCompletion'
import {
  WEBSITE_RECOVERY_COOKIE,
  clearWebsiteRecoveryContext,
  pendingWebsiteRecovery,
  readWebsiteRecoveryContext,
  setWebsiteRecoveryContext,
  type WebsiteRecoveryContext,
} from './websiteRecoveryContext'

export async function openWebsiteRecovery(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/auth/confirm?type=recovery', request.nextUrl.origin), {
    status: 303,
  })
  clearWebsiteRecoveryContext(response)
  const params = request.nextUrl.searchParams
  const id = params.get('authActionId') ?? ''
  const token = params.get('token_hash') ?? ''
  if (
    params.get('type') !== 'recovery' ||
    params.get('next') !== '/auth/password/reset/complete' ||
    !/^[1-9]\d*$/.test(id) ||
    !Number.isSafeInteger(Number(id)) ||
    !/^[a-f0-9]{64}$/.test(token) ||
    [...params.keys()].some((key) => !['authActionId', 'token_hash', 'type', 'next'].includes(key)) ||
    ['authActionId', 'token_hash', 'type', 'next'].some((key) => params.getAll(key).length !== 1)
  )
    return applyPrivateAuthHeaders(response)
  try {
    const authority = await websiteRecoveryAuthority()
    let subject: string = randomUUID()
    let flow: WebsiteRecoveryContext['flow'] = 'patient-recovery'
    try {
      const { action } = await authority.load(Number(id))
      subject = action.supabaseSubject!
      flow = action.actionType as WebsiteRecoveryContext['flow']
    } catch {
      /* Decoy context conceals unknown or ineligible actions. */
    }
    setWebsiteRecoveryContext(
      response,
      pendingWebsiteRecovery(Number(id), subject, flow, authority.environment, token),
      authority.keys,
    )
  } catch {
    /* All invalid or unavailable links share the same public state. */
  }
  return applyPrivateAuthHeaders(response)
}

const passwordSchema = z
  .object({ csrf: z.string(), password: z.string().min(8).max(4096), confirmPassword: z.string().max(4096) })
  .strict()
  .refine((body) => body.password === body.confirmPassword)
const resumeSchema = z
  .object({
    csrf: z.string(),
    password: z.string().max(4096).optional(),
    confirmPassword: z.string().max(4096).optional(),
  })
  .strict()

async function recoveryPost(request: NextRequest, complete: boolean) {
  if (
    request.headers.get('origin') !== request.nextUrl.origin ||
    !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')
  )
    return applyPrivateAuthHeaders(NextResponse.json({ code: 'REQUEST_REJECTED' }, { status: 403 }))
  const response = applyPrivateAuthHeaders(NextResponse.json({ code: 'INVALID_OR_EXPIRED_LINK' }, { status: 400 }))
  try {
    const authority = await websiteRecoveryAuthority()
    const context = readWebsiteRecoveryContext(
      request.cookies.get(WEBSITE_RECOVERY_COOKIE)?.value,
      authority.environment,
      authority.keys,
    )
    if (!context) {
      clearWebsiteRecoveryContext(response)
      return response
    }
    const body: unknown = await request.json().catch(() => null)
    if (
      !body ||
      typeof body !== 'object' ||
      !('csrf' in body) ||
      body.csrf !== context.csrf ||
      (!complete && Object.keys(body).length !== 1)
    )
      return applyPrivateAuthHeaders(NextResponse.json({ code: 'REQUEST_REJECTED' }, { status: 403 }))
    const parsed = complete ? (context.stage === 'confirmed' ? passwordSchema : resumeSchema).safeParse(body) : null
    if (complete && !parsed?.success)
      return applyPrivateAuthHeaders(NextResponse.json({ code: 'PASSWORD_REJECTED' }, { status: 422 }))
    const save = (grant: WebsiteRecoveryContext) => setWebsiteRecoveryContext(response, grant, authority.keys)
    const redirectTo =
      complete && parsed?.success
        ? await authority.complete(context, parsed.data.password ?? '', save)
        : await authority.confirm(context, save)
    const success = applyPrivateAuthHeaders(NextResponse.json({ redirectTo }))
    const grant = response.cookies.get(WEBSITE_RECOVERY_COOKIE)
    if (complete) clearWebsiteRecoveryContext(success)
    else if (grant) success.cookies.set(grant)
    return success
  } catch (error) {
    if (error instanceof InvalidWebsiteRecovery) {
      clearWebsiteRecoveryContext(response)
      return response
    }
    if (error instanceof RecoveryPasswordRejected)
      return applyPrivateAuthHeaders(NextResponse.json({ code: 'PASSWORD_REJECTED' }, { status: 422 }))
    const retry = applyPrivateAuthHeaders(
      NextResponse.json({ code: 'RECOVERY_TEMPORARILY_UNAVAILABLE' }, { status: 503 }),
    )
    const grant = response.cookies.get(WEBSITE_RECOVERY_COOKIE)
    if (grant) retry.cookies.set(grant)
    return retry
  }
}
export function confirmWebsiteRecovery(request: NextRequest) {
  return recoveryPost(request, false)
}
export function completeWebsiteRecovery(request: NextRequest) {
  return recoveryPost(request, true)
}
