import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { hasAdminUsers } from '@/auth/utilities/firstAdminCheck'
import { extractSupabaseUserData } from '@/auth/utilities/jwtValidation'
import { getUserConfig } from '@/auth/config/authConfig'
import { createUser } from '@/auth/utilities/userCreation'
import { Logo } from '@/components/molecules/Logo/Logo'
import * as LoginForm from '@/components/organisms/Auth/LoginForm'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { findUserBySupabaseId, isClinicUserApproved } from '@/auth/utilities/userLookup'
import {
  isPreviewGuardEnabled,
  PREVIEW_GUARD_LOCK_REQUEST_HEADER,
  PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY,
  resolvePreviewLogoSrc,
  sanitizePreviewGuardNextPath,
} from '@/features/previewGuard'

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
  const adminUsersExist = await hasAdminUsers()

  if (!adminUsersExist) {
    redirect('first-admin')
  }

  const authData = await extractSupabaseUserData()
  const messageKey = resolvedSearchParams?.message
  const statusFromQuery = messageKey ? loginStatusMessages[messageKey] : undefined
  const isGuardEnabled = isPreviewGuardEnabled(process.env)
  const isPreviewGuardLocked = requestHeaders.get(PREVIEW_GUARD_LOCK_REQUEST_HEADER) === '1'
  const fallbackPreviewStatus = isGuardEnabled
    ? loginStatusMessages[PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY]
    : undefined
  const postLoginRedirectPath = sanitizePreviewGuardNextPath(resolvedSearchParams?.next)
  const previewLogoSrc = resolvePreviewLogoSrc(process.env)
  const showPreviewLogo = isPreviewGuardLocked || messageKey === PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY

  console.debug({ authData }, 'Auth data on login page')

  let statusMessage: string | undefined = statusFromQuery?.text ?? fallbackPreviewStatus?.text
  let statusVariant: 'success' | 'info' | 'warning' | undefined =
    statusFromQuery?.variant ?? fallbackPreviewStatus?.variant

  if (authData) {
    // Only attempt redirect for staff types
    if (authData.userType === 'clinic' || authData.userType === 'platform') {
      const payload = await getPayload({ config: configPromise })
      let user = await findUserBySupabaseId(payload, authData)

      if (!user && (!isGuardEnabled || authData.userType === 'platform')) {
        try {
          const userConfig = getUserConfig(authData.userType)
          user = await createUser(payload, authData, userConfig, undefined)
        } catch (error: unknown) {
          // Recover from concurrent create races by re-reading after failed provisioning.
          user = await findUserBySupabaseId(payload, authData)
          if (!user) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error({ error: msg, authData }, 'Failed to provision staff user from login page')
            statusMessage = 'We could not provision your account automatically. Please contact support.'
            statusVariant = 'warning'
          }
        }
      }

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
      } else if (isGuardEnabled && authData.userType !== 'platform') {
        statusMessage = previewPlatformOnlyStatus.text
        statusVariant = previewPlatformOnlyStatus.variant
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 md:p-10">
      {showPreviewLogo ? <Logo loading="eager" priority="high" className="h-16" src={previewLogoSrc} /> : null}
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
