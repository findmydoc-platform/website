import {
  PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME,
  PublicAuthRouteShell,
} from '@/app/(frontend)/_components/PublicAuthRouteShell'
import { AuthFlashStatus } from '@/app/(frontend)/_components/AuthFlashStatus'
import * as LoginForm from '@/components/organisms/Auth/LoginForm'
import { PATIENT_LOGIN_PATH } from '@/features/favorites/redirects'
import { sanitizeInternalRedirectPath } from '@/utilities/routing/sanitizeInternalRedirectPath'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createLocalReq, getPayload } from 'payload'
import config from '@payload-config'
import { readPreparationBinding } from '@/features/inquiryPreparations/context'
import { readInquiryPreparationRegistration } from '@/features/inquiryCommunication/service'

export const dynamic = 'force-dynamic'

const patientLoginMessages: Record<string, { text: string; variant?: 'success' | 'info' | 'warning' }> = {
  'patient-check-email': {
    text: 'Check your email for the verification link we sent so you can finish setting up your findmydoc account.',
    variant: 'success',
  },
}

export default async function LoginPage({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<{ message?: string; next?: string; inquiry?: string }>
}) {
  const resolvedSearchParams = await searchParamsPromise
  const binding = readPreparationBinding(await headers())
  const preparation = binding
    ? await readInquiryPreparationRegistration(
        await createLocalReq({}, await getPayload({ config })),
        binding,
        resolvedSearchParams?.inquiry,
      )
    : null
  const messageKey = resolvedSearchParams?.message
  const statusMessage = messageKey ? patientLoginMessages[messageKey] : undefined
  const postLoginRedirectPath = sanitizeInternalRedirectPath({
    nextPath: resolvedSearchParams?.next,
    fallbackPath: preparation ? '/patient/inquiries' : '/',
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
        <LoginForm.Status
          message={
            preparation
              ? `Your inquiry is saved but not sent. Sign in with your existing password to continue. It expires on ${new Date(preparation.expiresAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC.`
              : statusMessage?.text
          }
          variant={statusMessage?.variant}
        />
        <AuthFlashStatus />
        <LoginForm.Form>
          <LoginForm.EmailField placeholder="patient@example.com" defaultValue={preparation?.email} />
          <LoginForm.PasswordField
            forgotPasswordHref={
              preparation && resolvedSearchParams?.inquiry
                ? `/auth/password/reset?inquiry=${encodeURIComponent(resolvedSearchParams.inquiry)}`
                : '/auth/password/reset'
            }
          />
          <LoginForm.SubmitButton>Sign in</LoginForm.SubmitButton>
        </LoginForm.Form>
        <LoginForm.Footer>
          {preparation ? (
            <p className="text-sm text-muted-foreground">
              <Link
                href={`/register/patient${resolvedSearchParams?.inquiry ? `?inquiry=${encodeURIComponent(resolvedSearchParams.inquiry)}` : ''}#patient-verification-resend`}
                className="inline-flex min-h-11 items-center text-primary underline"
              >
                Request another verification email
              </Link>
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register/patient" className="text-primary hover:underline">
              Register here
            </Link>
          </p>
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
