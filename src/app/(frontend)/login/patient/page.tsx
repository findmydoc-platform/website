import {
  PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME,
  PublicAuthRouteShell,
} from '@/app/(frontend)/_components/PublicAuthRouteShell'
import { PreparedInquiryConfirmation } from '@/app/(frontend)/_components/PreparedInquiryConfirmation'
import { Heading } from '@/components/atoms/Heading'
import { AuthFlashStatus } from '@/app/(frontend)/_components/AuthFlashStatus'
import * as LoginForm from '@/components/organisms/Auth/LoginForm'
import { PATIENT_LOGIN_HOME_PATHS, sanitizePatientLoginNext } from '@/features/favorites/redirects'
import { readInquiryPreparationRegistration } from '@/features/inquiryCommunication/service'
import { readPreparationBinding } from '@/features/inquiryPreparations/context'
import { patientLoginCopy } from '@/features/uiCopy/patientLogin'
import { PatientLoginFormRoot } from '@/features/uiCopy/PatientLoginFormRoot.client'
import { SAVED_CLINICS_PATHS } from '@/i18n/savedClinicsPath'
import { LISTING_COMPARISON_PATHS } from '@/i18n/listingComparisonPath'
import { PATIENT_LOGIN_PATH, localizedPatientAuthPath } from '@/i18n/patientAuthPath'
import { ENGLISH_PATIENT_LOGIN_PATH } from '@/i18n/requestLocale'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createLocalReq, getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'

const LOCALIZED_PATIENT_RETURN_PATHS = [PATIENT_LOGIN_HOME_PATHS, LISTING_COMPARISON_PATHS, SAVED_CLINICS_PATHS]

function localizeReturnPath(path: string, locale: UiCopyLocale): string {
  const pathname = path.split(/[?#]/, 1)[0]!
  const normalizedPath = pathname.replace(/\/$/, '') || '/'
  const localizedPaths = LOCALIZED_PATIENT_RETURN_PATHS.find(
    ({ de, en }) => normalizedPath === de || normalizedPath === en,
  )

  return localizedPaths ? localizedPaths[locale] + path.slice(pathname.length) : path
}

export default async function LoginPage({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<{ message?: string; next?: string | string[]; inquiry?: string }>
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
  const afterRegistration = resolvedSearchParams?.message === 'patient-check-email'
  const copy = await patientLoginCopy(preparation?.expiresAt, afterRegistration)
  const showCheckEmailStatus = afterRegistration && !copy.inquirySaved
  const registrationHref = localizedPatientAuthPath('/register/patient', copy.locale)
  const recoveryHref = localizedPatientAuthPath('/auth/password/reset', copy.locale)
  const inquiryQuery = resolvedSearchParams?.inquiry
    ? `?inquiry=${encodeURIComponent(resolvedSearchParams.inquiry)}`
    : ''
  const resendHref = `${registrationHref}${inquiryQuery}#patient-verification-resend`
  const requestedNext = resolvedSearchParams?.next
  const validatedNext = sanitizePatientLoginNext(typeof requestedNext === 'string' ? requestedNext : null)
  const homeHref = PATIENT_LOGIN_HOME_PATHS[copy.locale]
  const postLoginRedirectPath = localizeReturnPath(
    validatedNext ?? (preparation ? '/patient/inquiries' : homeHref),
    copy.locale,
  )

  const switchQuery = new URLSearchParams()
  if (validatedNext) switchQuery.set('next', validatedNext)
  for (const key of ['message', 'inquiry'] as const) {
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
        {copy.inquiryConfirmation ? (
          <PreparedInquiryConfirmation
            {...copy.inquiryConfirmation}
            resendHref={resendHref}
            resendLabel={copy.requestVerificationEmail}
          />
        ) : showCheckEmailStatus ? (
          <Heading as="h1" size="h4" align="center" className="mb-4">
            {copy.registrationConfirmation.title}
          </Heading>
        ) : (
          <LoginForm.Header title={copy.title} description={copy.description} />
        )}
        <LoginForm.Status
          message={
            copy.inquiryConfirmation
              ? undefined
              : (copy.inquirySaved ?? (showCheckEmailStatus ? copy.registrationConfirmation.message : undefined))
          }
          variant={showCheckEmailStatus ? 'success' : undefined}
        />
        <AuthFlashStatus messages={{ 'password-reset-complete': copy.passwordResetComplete }} />
        <LoginForm.Form
          className={
            copy.inquiryConfirmation
              ? 'mt-4 border-t border-site-divider pt-4'
              : showCheckEmailStatus
                ? 'border-t border-site-divider pt-4'
                : undefined
          }
        >
          <LoginForm.EmailField
            label={copy.emailLabel}
            placeholder={copy.emailPlaceholder}
            defaultValue={preparation?.email}
          />
          <LoginForm.PasswordField
            className="[&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:underline [&_a]:underline-offset-4"
            label={copy.passwordLabel}
            forgotPasswordLabel={copy.forgotPassword}
            forgotPasswordHref={preparation ? `${recoveryHref}${inquiryQuery}` : recoveryHref}
          />
          <LoginForm.SubmitButton
            loadingText={copy.submitting}
            variant={showCheckEmailStatus || copy.inquiryConfirmation ? 'outline' : 'default'}
          >
            {copy.submit}
          </LoginForm.SubmitButton>
        </LoginForm.Form>
        <LoginForm.Footer>
          {preparation && !copy.inquiryConfirmation ? (
            <p className="text-sm text-muted-foreground">
              <Link href={resendHref} className="inline-flex min-h-11 items-center text-primary underline">
                {copy.requestVerificationEmail}
              </Link>
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {copy.noAccount}{' '}
            <Link
              href={registrationHref}
              className="inline-flex min-h-11 items-center align-middle text-primary underline underline-offset-4 sm:inline"
            >
              {copy.register}
            </Link>
          </p>
          <p className="text-sm text-muted-foreground">
            <Link
              href={homeHref}
              className="inline-flex min-h-11 items-center align-middle text-primary underline underline-offset-4 sm:inline"
            >
              {copy.backHome}
            </Link>
          </p>
        </LoginForm.Footer>
      </PatientLoginFormRoot>
    </PublicAuthRouteShell>
  )
}
