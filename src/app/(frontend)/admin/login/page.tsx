import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getLocalPlatformStaffUserState } from '@/auth/utilities/firstAdminCheck'
import { extractSupabaseUserData } from '@/auth/utilities/jwtValidation'
import { AuthFlashStatus } from '@/app/(frontend)/_components/AuthFlashStatus'
import { Logo } from '@/components/molecules/Logo/Logo'
import * as LoginForm from '@/components/organisms/Auth/LoginForm'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { findUserBySupabaseId } from '@/auth/utilities/userLookup'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import { isFindmydocPlatformEmail } from '@/auth/utilities/platformStaffEmailPolicy'
import { createScopedLogger, getRequestLogContext, hashLogValue } from '@/utilities/logging/shared'
import { isNonProductionRuntime } from '@/features/runtimePolicy'
import { readHoldingViewRequestHeader } from '@/features/temporaryLandingMode'
import { sanitizeInternalRedirectPath } from '@/utilities/routing/sanitizeInternalRedirectPath'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<{ message?: string; next?: string }>
} = {}) {
  const resolvedSearchParams = await searchParamsPromise
  const requestHeaders = await headers()
  const payload = await getPayload({ config: configPromise })
  const logger = createScopedLogger(payload.logger, {
    scope: 'auth.admin_login',
    component: 'admin-login',
    ...getRequestLogContext({ headers: requestHeaders }),
  })
  const authData = await extractSupabaseUserData({ headers: requestHeaders })
  const postLoginRedirectPath = sanitizeInternalRedirectPath({
    nextPath: resolvedSearchParams?.next,
    fallbackPath: '/admin',
    blockedPaths: ['/admin/login'],
  })
  const showPreviewBadge = isNonProductionRuntime(process.env)
  const showPreviewLogo = readHoldingViewRequestHeader(requestHeaders) === 'standalone'

  let statusMessage: string | undefined
  let statusVariant: 'success' | 'info' | 'warning' | undefined

  if (authData?.userType === 'platform') {
    if (!isFindmydocPlatformEmail(authData.userEmail)) {
      logger.warn(
        {
          event: 'auth.admin_login.platform_user.invalid_email_domain',
          supabaseUserIdHash: hashLogValue(authData.supabaseUserId),
          userEmailHash: hashLogValue(normalizeEmail(authData.userEmail)),
        },
        'Platform Supabase user email is outside the allowed domain',
      )
      statusMessage = 'Your account is not available for admin access. Please contact support.'
      statusVariant = 'warning'
    } else {
      const user = await findUserBySupabaseId(payload, authData)

      if (user) {
        redirect('/admin')
      } else {
        statusMessage =
          'Your Supabase session is active, but no admin account could be found in the CMS. Please contact support.'
        statusVariant = 'warning'
      }
    }
  } else {
    const localPlatformStaffUserState = await getLocalPlatformStaffUserState(payload)
    if (localPlatformStaffUserState.status === 'no_platform_staff') {
      logger.warn(
        {
          event: 'auth.admin_login.no_platform_staff',
        },
        'No platform staff account exists',
      )
    } else if (localPlatformStaffUserState.status === 'no_login_capable_platform_staff') {
      logger.warn(
        {
          event: 'auth.admin_login.no_login_capable_platform_staff',
          hasPlatformAdmin: localPlatformStaffUserState.hasPlatformAdmin,
        },
        'No login-capable platform staff account exists',
      )
    }

    if (
      (localPlatformStaffUserState.status === 'has_platform_staff' ||
        localPlatformStaffUserState.status === 'no_login_capable_platform_staff') &&
      !localPlatformStaffUserState.hasPlatformAdmin
    ) {
      logger.warn(
        {
          event: 'auth.admin_login.no_platform_admins',
        },
        'Platform staff accounts exist, but no platform admin role exists',
      )
    } else if (localPlatformStaffUserState.status === 'check_failed') {
      logger.warn(
        {
          event: 'auth.admin_login.platform_admin_check_failed',
          reason: localPlatformStaffUserState.reason,
        },
        'Failed to determine whether platform staff accounts exist',
      )
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-start gap-5 px-6 pt-6 pb-44 md:justify-center md:gap-6 md:p-10">
      {showPreviewLogo ? (
        <Logo loading="eager" priority="high" className="h-16" showPreviewBadge={showPreviewBadge} />
      ) : null}
      <LoginForm.Root userTypes="platform" redirectPath={postLoginRedirectPath} className="w-full max-w-md">
        <LoginForm.Header title="Platform Login" description="Sign in to the platform administration area" />
        <LoginForm.Status message={statusMessage} variant={statusVariant} />
        <AuthFlashStatus />
        <LoginForm.Form>
          <LoginForm.EmailField placeholder="staff@example.com" />
          <LoginForm.PasswordField forgotPasswordHref="/auth/password/reset" />
          <LoginForm.SubmitButton>Sign in</LoginForm.SubmitButton>
        </LoginForm.Form>
      </LoginForm.Root>
    </div>
  )
}
