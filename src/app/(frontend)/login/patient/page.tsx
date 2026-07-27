import {
  PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME,
  PublicAuthRouteShell,
} from '@/app/(frontend)/_components/PublicAuthRouteShell'
import { AuthFlashStatus } from '@/app/(frontend)/_components/AuthFlashStatus'
import * as LoginForm from '@/components/organisms/Auth/LoginForm'
import { PATIENT_LOGIN_PATH } from '@/features/favorites/redirects'
import { PREVIEW_GUARD_ACTIVE_REQUEST_HEADER } from '@/features/previewGuard'
import { sanitizeInternalRedirectPath } from '@/utilities/routing/sanitizeInternalRedirectPath'
import Link from 'next/link'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

const patientLoginMessages: Record<string, { text: string; variant?: 'success' | 'info' | 'warning' }> = {
  'patient-check-email': {
    text: 'Check your email for the verification link we sent so you can finish setting up your findmydoc account.',
    variant: 'success',
  },
}

const previewGuardPatientAccountStatus = {
  text: 'While Preview Guard is active, patient accounts are created by findmydoc staff.',
  variant: 'info' as const,
}

export default async function LoginPage({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<{ message?: string; next?: string }>
}) {
  const resolvedSearchParams = await searchParamsPromise
  const requestHeaders = await headers()
  const messageKey = resolvedSearchParams?.message
  const isPreviewGuardActive = requestHeaders.get(PREVIEW_GUARD_ACTIVE_REQUEST_HEADER) === '1'
  const statusMessage =
    (messageKey ? patientLoginMessages[messageKey] : undefined) ??
    (isPreviewGuardActive ? previewGuardPatientAccountStatus : undefined)
  const postLoginRedirectPath = sanitizeInternalRedirectPath({
    nextPath: resolvedSearchParams?.next,
    fallbackPath: isPreviewGuardActive ? '/patient/favorites' : '/',
    blockedPaths: [PATIENT_LOGIN_PATH],
  })

  return (
    <PublicAuthRouteShell>
      <LoginForm.Root
        userTypes="patient"
        redirectPath={postLoginRedirectPath}
        className={`w-full max-w-md ${PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME}`}
      >
        <LoginForm.Header
          title="Patient Login"
          description="Sign in to your patient account to access your medical information"
        />
        <LoginForm.Status message={statusMessage?.text} variant={statusMessage?.variant} />
        <AuthFlashStatus />
        <LoginForm.Form>
          <LoginForm.EmailField placeholder="patient@example.com" />
          <LoginForm.PasswordField forgotPasswordHref="/auth/password/reset" />
          <LoginForm.SubmitButton>Sign in</LoginForm.SubmitButton>
        </LoginForm.Form>
        <LoginForm.Footer>
          {!isPreviewGuardActive ? (
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/register/patient" className="text-primary hover:underline">
                Register here
              </Link>
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="text-primary hover:underline">
              ← Back to home
            </Link>
          </p>
        </LoginForm.Footer>
      </LoginForm.Root>
    </PublicAuthRouteShell>
  )
}
