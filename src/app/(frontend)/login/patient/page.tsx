import {
  PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME,
  PublicAuthRouteShell,
} from '@/app/(frontend)/_components/PublicAuthRouteShell'
import { AuthFlashStatus } from '@/app/(frontend)/_components/AuthFlashStatus'
import * as LoginForm from '@/components/organisms/Auth/LoginForm'
import { PATIENT_LOGIN_PATH } from '@/features/favorites/redirects'
import { readInquiryPreparationRegistration } from '@/features/inquiryCommunication/service'
import { readPreparationBinding } from '@/features/inquiryPreparations/context'
import { patientLoginCopy } from '@/features/uiCopy/patientLogin'
import { PatientLoginFormRoot } from '@/features/uiCopy/PatientLoginFormRoot.client'
import { localizedPatientAuthPath } from '@/i18n/patientAuthPath'
import { ENGLISH_PATIENT_LOGIN_PATH } from '@/i18n/requestLocale'
import { sanitizeInternalRedirectPath } from '@/utilities/routing/sanitizeInternalRedirectPath'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createLocalReq, getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<{ message?: string; next?: string; inquiry?: string }>
}) {
  const resolvedSearchParams = await searchParamsPromise
  const requestHeaders = await headers()
  const binding = readPreparationBinding(requestHeaders)
  const preparation = binding
    ? await readInquiryPreparationRegistration(
        await createLocalReq({}, await getPayload({ config })),
        binding,
        resolvedSearchParams?.inquiry,
      )
    : null
  const copy = await patientLoginCopy(preparation?.expiresAt)
  const showCheckEmailStatus = resolvedSearchParams?.message === 'patient-check-email'
  const registrationHref = localizedPatientAuthPath('/register/patient', copy.locale)
  const recoveryHref = localizedPatientAuthPath('/auth/password/reset', copy.locale)
  const inquiryQuery = resolvedSearchParams?.inquiry
    ? `?inquiry=${encodeURIComponent(resolvedSearchParams.inquiry)}`
    : ''
  const postLoginRedirectPath = sanitizeInternalRedirectPath({
    nextPath: resolvedSearchParams?.next,
    fallbackPath: preparation ? '/patient/inquiries' : '/',
    blockedPaths: [PATIENT_LOGIN_PATH, ENGLISH_PATIENT_LOGIN_PATH],
  })

  const switchQuery = new URLSearchParams()
  for (const key of ['next', 'message', 'inquiry'] as const) {
    const value = resolvedSearchParams?.[key]
    if (typeof value === 'string') switchQuery.set(key, value)
  }
  const switchSuffix = switchQuery.size ? `?${switchQuery}` : ''
  const languageSwitch = {
    locale: copy.locale,
    targets: {
      de: `${PATIENT_LOGIN_PATH}${switchSuffix}`,
      en: `${ENGLISH_PATIENT_LOGIN_PATH}${switchSuffix}`,
    },
  }

  return (
    <PublicAuthRouteShell>
      <PatientLoginFormRoot
        errors={copy.errors}
        languageSwitch={languageSwitch}
        redirectPath={postLoginRedirectPath}
        validationMessages={copy.validationMessages}
        className={`w-full max-w-md ${PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME}`}
      >
        <LoginForm.Header title={copy.title} description={copy.description} />
        <LoginForm.Status
          message={copy.inquirySaved ?? (showCheckEmailStatus ? copy.checkEmail : undefined)}
          variant={showCheckEmailStatus ? 'success' : undefined}
        />
        <AuthFlashStatus messages={{ 'password-reset-complete': copy.passwordResetComplete }} />
        <LoginForm.Form>
          <LoginForm.EmailField
            label={copy.emailLabel}
            placeholder={copy.emailPlaceholder}
            defaultValue={preparation?.email}
          />
          <LoginForm.PasswordField
            label={copy.passwordLabel}
            forgotPasswordLabel={copy.forgotPassword}
            forgotPasswordHref={preparation ? `${recoveryHref}${inquiryQuery}` : recoveryHref}
          />
          <LoginForm.SubmitButton loadingText={copy.submitting}>{copy.submit}</LoginForm.SubmitButton>
        </LoginForm.Form>
        <LoginForm.Footer>
          {preparation ? (
            <p className="text-sm text-muted-foreground">
              <Link
                href={`${registrationHref}${inquiryQuery}#patient-verification-resend`}
                className="inline-flex min-h-11 items-center text-primary underline"
              >
                {copy.requestVerificationEmail}
              </Link>
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {copy.noAccount}{' '}
            <Link href={registrationHref} className="text-primary hover:underline">
              {copy.register}
            </Link>
          </p>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="text-primary hover:underline">
              {copy.backHome}
            </Link>
          </p>
        </LoginForm.Footer>
      </PatientLoginFormRoot>
    </PublicAuthRouteShell>
  )
}
