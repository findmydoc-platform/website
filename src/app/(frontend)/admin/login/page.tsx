import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getLocalPlatformStaffUserState } from '@/auth/utilities/firstAdminCheck'
import { extractSupabaseUserData } from '@/auth/utilities/jwtValidation'
import { Logo } from '@/components/molecules/Logo/Logo'
import * as LoginForm from '@/components/organisms/Auth/LoginForm'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { findUserBySupabaseId, isClinicUserApproved } from '@/auth/utilities/userLookup'
import { allowsPlatformEmailReconcile } from '@/features/runtimePolicy'
import { createScopedLogger, getRequestLogContext } from '@/utilities/logging/shared'
import {
  isNonProductionDeployment,
  PREVIEW_GUARD_LOCK_REQUEST_HEADER,
  PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY,
  sanitizePreviewGuardNextPath,
} from '@/features/previewGuard'
import { TEMPORARY_LANDING_MODE_REQUEST_HEADER } from '@/features/temporaryLandingMode'

export const dynamic = 'force-dynamic'

const loginStatusMessages: Record<string, { text: string; variant?: 'success' | 'info' | 'warning' }> = {
  [PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY]: {
    text: 'This is a preview deployment. Please sign in to continue.',
    variant: 'info',
  },
}

const previewPlatformOnlyStatus = {
  text: 'This preview deployment is restricted to platform staff accounts.',
  variant: 'warning' as const,
}

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
  const messageKey = resolvedSearchParams?.message
  const statusFromQuery = messageKey ? loginStatusMessages[messageKey] : undefined
  const isPreviewGuardLocked = requestHeaders.get(PREVIEW_GUARD_LOCK_REQUEST_HEADER) === '1'
  const isTemporaryLandingLocked = requestHeaders.get(TEMPORARY_LANDING_MODE_REQUEST_HEADER) === '1'
  const isGuardEnabled = isPreviewGuardLocked && !isTemporaryLandingLocked
  const fallbackPreviewStatus = isGuardEnabled
    ? loginStatusMessages[PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY]
    : undefined
  const postLoginRedirectPath = sanitizePreviewGuardNextPath(resolvedSearchParams?.next)
  const showPreviewBadge = isNonProductionDeployment(process.env)
  const showPreviewLogo = isPreviewGuardLocked || messageKey === PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY

  let statusMessage: string | undefined = statusFromQuery?.text ?? fallbackPreviewStatus?.text
  let statusVariant: 'success' | 'info' | 'warning' | undefined =
    statusFromQuery?.variant ?? fallbackPreviewStatus?.variant

  if (authData) {
    // Only attempt redirect for staff types
    if (authData.userType === 'clinic' || authData.userType === 'platform') {
      const user = await findUserBySupabaseId(payload, authData, undefined, undefined, {
        allowEmailReconcile: authData.userType === 'platform' && allowsPlatformEmailReconcile(process.env),
      })

      if (user) {
        if (authData.userType === 'clinic') {
          if (isGuardEnabled) {
            statusMessage = previewPlatformOnlyStatus.text
            statusVariant = previewPlatformOnlyStatus.variant
          } else {
            const isApproved = await isClinicUserApproved(payload, String(user.id))
            if (isApproved) {
              redirect('/admin')
            } else {
              statusMessage = 'Your account is pending approval. Please contact support.'
              statusVariant = 'warning'
            }
          }
        } else {
          // Platform users are always allowed if they exist
          redirect('/admin')
        }
      } else if (!isGuardEnabled || authData.userType === 'platform') {
        statusMessage =
          'Your Supabase session is active, but no admin account could be found in the CMS. Please contact support.'
        statusVariant = 'warning'
      } else {
        statusMessage = previewPlatformOnlyStatus.text
        statusVariant = previewPlatformOnlyStatus.variant
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
      <LoginForm.Root
        userTypes={['clinic', 'platform']}
        redirectPath={postLoginRedirectPath}
        className="w-full max-w-md"
      >
        <LoginForm.Header title="Staff Login" description="Sign in to your account to continue" />
        <LoginForm.Status message={statusMessage} variant={statusVariant} />
        <LoginForm.Form>
          <LoginForm.EmailField placeholder="staff@example.com" />
          <LoginForm.PasswordField forgotPasswordHref="/auth/password/reset" />
          <LoginForm.SubmitButton>Sign in</LoginForm.SubmitButton>
        </LoginForm.Form>
      </LoginForm.Root>
    </div>
  )
}
