import { RECOVERY_PASSWORD_MAX_LENGTH, RECOVERY_PASSWORD_MIN_LENGTH } from './websiteRecoveryPassword'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { applyPrivateAuthHeaders } from '@/auth/utilities/tokenHashCallback'
import { supabaseEmailTokenHashSchema } from '@/auth/utilities/supabaseEmailTokenHash'
import { AUTH_CONFIRMATION_PATH, localizedPatientAuthPath, RECOVERY_COMPLETION_PATH } from '@/i18n/patientAuthPath'
import { patientAuthLocaleSchema } from './patientAuthLocale'
import { preparationCookie } from '@/features/inquiryPreparations/context'
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
  const params = request.nextUrl.searchParams
  const locale = patientAuthLocaleSchema.safeParse(params.get('locale'))
  const confirmUrl = new URL(
    localizedPatientAuthPath(AUTH_CONFIRMATION_PATH, locale.data ?? 'de'),
    request.nextUrl.origin,
  )
  confirmUrl.searchParams.set('type', 'recovery')
  const response = NextResponse.redirect(confirmUrl, { status: 303 })
  clearWebsiteRecoveryContext(response)
  const id = params.get('authActionId') ?? ''
  const token = params.get('token_hash') ?? ''
  if (
    params.get('type') !== 'recovery' ||
    params.get('next') !== RECOVERY_COMPLETION_PATH ||
    !/^[1-9]\d*$/.test(id) ||
    !Number.isSafeInteger(Number(id)) ||
    !supabaseEmailTokenHashSchema.safeParse(token).success ||
    (params.has('locale') && (!locale.success || params.getAll('locale').length !== 1)) ||
    [...params.keys()].some((key) => !['authActionId', 'token_hash', 'type', 'next', 'locale'].includes(key)) ||
    ['authActionId', 'token_hash', 'type', 'next'].some((key) => params.getAll(key).length !== 1)
  )
    return applyPrivateAuthHeaders(response)
  try {
    const authority = await websiteRecoveryAuthority()
    let subject: string = randomUUID()
    let flow: WebsiteRecoveryContext['flow'] = 'patient-recovery'
    try {
      const { action } = await authority.load(Number(id))
      if ((action.locale ?? undefined) === locale.data) {
        subject = action.supabaseSubject!
        flow = action.actionType as WebsiteRecoveryContext['flow']
      }
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
  .object({
    csrf: z.string(),
    password: z.string().min(RECOVERY_PASSWORD_MIN_LENGTH).max(RECOVERY_PASSWORD_MAX_LENGTH),
    confirmPassword: z.string().max(RECOVERY_PASSWORD_MAX_LENGTH),
  })
  .strict()
  .refine((body) => body.password === body.confirmPassword)
const resumeSchema = z
  .object({
    csrf: z.string(),
    password: z.string().max(RECOVERY_PASSWORD_MAX_LENGTH).optional(),
    confirmPassword: z.string().max(RECOVERY_PASSWORD_MAX_LENGTH).optional(),
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
    let preparationBinding: string | null = null
    let inquiryContinuationPending = false
    if (complete) {
      try {
        preparationBinding = await authority.restorePreparation(context)
      } catch {
        // Password change and sign-out already succeeded. Keep the signed-out receipt for inquiry continuation.
        inquiryContinuationPending = true
      }
    }
    const success = applyPrivateAuthHeaders(
      NextResponse.json({ redirectTo, ...(inquiryContinuationPending ? { inquiryContinuationPending: true } : {}) }),
    )
    const grant = response.cookies.get(WEBSITE_RECOVERY_COOKIE)
    if (complete && !inquiryContinuationPending) clearWebsiteRecoveryContext(success)
    else if (grant) success.cookies.set(grant)
    else if (inquiryContinuationPending) setWebsiteRecoveryContext(success, context, authority.keys)
    if (preparationBinding) success.headers.append('Set-Cookie', preparationCookie(preparationBinding))
    return success
  } catch (error) {
    if (error instanceof InvalidWebsiteRecovery) {
      clearWebsiteRecoveryContext(response)
      return response
    }
    if (error instanceof RecoveryPasswordRejected) {
      const rejected = applyPrivateAuthHeaders(NextResponse.json({ code: 'PASSWORD_REJECTED' }, { status: 422 }))
      const grant = response.cookies.get(WEBSITE_RECOVERY_COOKIE)
      if (grant) rejected.cookies.set(grant)
      return rejected
    }
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
