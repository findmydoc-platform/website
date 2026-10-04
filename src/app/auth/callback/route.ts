import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { openWebsiteRecovery, confirmWebsiteRecovery } from '@/auth/actions/websiteRecoveryHttp'
import { createClient } from '@/auth/utilities/supaBaseServer'
import { sanitizeInternalRedirectPath } from '@/utilities/routing/sanitizeInternalRedirectPath'
import { InvalidPatientVerification, patientVerificationAuthority } from '@/auth/actions/patientVerificationCompletion'
import {
  clearPatientVerificationContext,
  PATIENT_VERIFICATION_COOKIE,
  pendingPatientContext,
  readPatientVerificationContext,
  setPatientVerificationContext,
} from '@/auth/actions/patientVerificationContext'
import {
  applyPrivateAuthHeaders,
  setPendingTokenHashCookie,
  validateTokenHashCallback,
} from '@/auth/utilities/tokenHashCallback'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  if (requestUrl.searchParams.getAll('type').includes('magiclink')) {
    const response = NextResponse.redirect(new URL('/auth/confirm?type=patient-verification', requestUrl.origin), {
      status: 303,
    })
    clearPatientVerificationContext(response)
    const id = requestUrl.searchParams.get('authActionId') ?? ''
    const token = requestUrl.searchParams.get('token_hash') ?? ''
    if (
      code ||
      requestUrl.searchParams.has('next') ||
      requestUrl.searchParams.get('type') !== 'magiclink' ||
      !/^[1-9]\d*$/.test(id) ||
      !Number.isSafeInteger(Number(id)) ||
      !/^[a-f0-9]{64}$/.test(token) ||
      [...requestUrl.searchParams.keys()].some((key) => !['authActionId', 'token_hash', 'type'].includes(key)) ||
      ['authActionId', 'token_hash', 'type'].some((key) => requestUrl.searchParams.getAll(key).length !== 1)
    )
      return applyPrivateAuthHeaders(response)
    try {
      const authority = await patientVerificationAuthority()
      let subject: string = randomUUID()
      try {
        const { action } = await authority.load(Number(id))
        subject = action.supabaseSubject!
      } catch {
        // Opaque decoy contexts keep eligible and ineligible action IDs indistinguishable in the response.
      }
      setPatientVerificationContext(
        response,
        pendingPatientContext(Number(id), subject, authority.environment, token),
        authority.keys,
      )
    } catch {
      // Every unavailable or ineligible link has the same public destination.
    }
    return applyPrivateAuthHeaders(response)
  }
  if (requestUrl.searchParams.getAll('type').includes('recovery')) return openWebsiteRecovery(request)
  const next = sanitizeInternalRedirectPath({
    nextPath: requestUrl.searchParams.get('next'),
    fallbackPath: '/auth/password/reset/complete',
  })
  const hasTokenHashParameters = requestUrl.searchParams.has('token_hash') || requestUrl.searchParams.has('type')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return applyPrivateAuthHeaders(
        NextResponse.redirect(`${requestUrl.origin}/auth/password/reset/complete?error=auth_callback_failed`),
      )
    }
  }

  if (!code && hasTokenHashParameters) {
    const callback = validateTokenHashCallback(request)
    if (!callback) {
      return applyPrivateAuthHeaders(NextResponse.redirect(`${requestUrl.origin}/auth/password/reset?reason=expired`))
    }

    const confirmationUrl = new URL('/auth/confirm', requestUrl.origin)
    confirmationUrl.searchParams.set('type', callback.type)
    const response = NextResponse.redirect(confirmationUrl, { status: 303 })
    setPendingTokenHashCookie(response, callback)
    return applyPrivateAuthHeaders(response)
  }

  // URL to redirect to after code exchange
  return applyPrivateAuthHeaders(NextResponse.redirect(`${requestUrl.origin}${next}`))
}

export async function POST(request: NextRequest) {
  if (request.nextUrl.searchParams.get('flow') === 'recovery') return confirmWebsiteRecovery(request)
  const response = applyPrivateAuthHeaders(NextResponse.json({ code: 'INVALID_OR_EXPIRED_LINK' }, { status: 400 }))
  if (
    request.headers.get('origin') !== request.nextUrl.origin ||
    !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')
  ) {
    return applyPrivateAuthHeaders(NextResponse.json({ code: 'REQUEST_REJECTED' }, { status: 403 }))
  }
  try {
    const authority = await patientVerificationAuthority()
    const context = readPatientVerificationContext(
      request.cookies.get(PATIENT_VERIFICATION_COOKIE)?.value,
      authority.environment,
      authority.keys,
    )
    if (!context) {
      clearPatientVerificationContext(response)
      return response
    }
    const body: unknown = await request.json().catch(() => null)
    if (
      !body ||
      typeof body !== 'object' ||
      Object.keys(body).length !== 1 ||
      !('csrf' in body) ||
      body.csrf !== context.csrf
    ) {
      return applyPrivateAuthHeaders(NextResponse.json({ code: 'REQUEST_REJECTED' }, { status: 403 }))
    }
    const redirectTo = await authority.confirm(context, (receipt) =>
      setPatientVerificationContext(response, receipt, authority.keys),
    )
    const success = applyPrivateAuthHeaders(NextResponse.json({ redirectTo }))
    clearPatientVerificationContext(success)
    return success
  } catch (error) {
    if (error instanceof InvalidPatientVerification) {
      clearPatientVerificationContext(response)
      return response
    }
    const retry = applyPrivateAuthHeaders(
      NextResponse.json({ code: 'VERIFICATION_TEMPORARILY_UNAVAILABLE' }, { status: 503 }),
    )
    const receipt = response.cookies.get(PATIENT_VERIFICATION_COOKIE)
    if (receipt) retry.cookies.set(receipt)
    return retry
  }
}
