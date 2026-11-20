import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { ConfirmTokenHashForm } from './ConfirmTokenHashForm'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { cookies } from 'next/headers'
import { resolveTransactionalEmailEnvironment } from '@/features/transactionalEmail/environment'
import { resolveVerificationKeys } from '@/auth/actions/verificationConfiguration'
import { PATIENT_VERIFICATION_COOKIE, readPatientVerificationContext } from '@/auth/actions/patientVerificationContext'
import { patientVerificationAuthority } from '@/auth/actions/patientVerificationCompletion'
import { PatientVerificationForm } from './PatientVerificationForm'
import { PublicAuthRouteShell } from '@/app/(frontend)/_components/PublicAuthRouteShell'
import { resolveRecoveryKeys } from '@/auth/actions/recoveryConfiguration'
import { readWebsiteRecoveryContext, WEBSITE_RECOVERY_COOKIE } from '@/auth/actions/websiteRecoveryContext'
import { RecoveryConfirmationForm } from './RecoveryConfirmationForm'
import { recoveryConfirmationCopy, recoveryMetadataTitle } from '@/features/uiCopy/passwordRecovery'
import { patientVerificationCopy, patientVerificationMetadataTitle } from '@/features/uiCopy/patientVerification'
import {
  AUTH_CONFIRMATION_PATH,
  isLocalizedAuthConfirmationType,
  localizedPatientAuthPath,
  type LocalizedAuthConfirmationType,
} from '@/i18n/patientAuthPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'

export type ConfirmPageProps = Readonly<{ searchParams: Promise<Readonly<{ type?: string | string[] }>> }>

async function confirmationType({ searchParams }: ConfirmPageProps, locale: UiCopyLocale) {
  const { type } = await searchParams
  if (locale === 'en' && !isLocalizedAuthConfirmationType(type)) notFound()
  return type
}

export async function confirmMetadata(props: ConfirmPageProps, locale: UiCopyLocale): Promise<Metadata> {
  const type = await confirmationType(props, locale)
  let title = 'Confirm secure email link'
  if (type === 'recovery') title = await recoveryMetadataTitle('confirmation')
  if (type === 'patient-verification') title = await patientVerificationMetadataTitle()
  return {
    ...createSiteMetadata({ title, path: AUTH_CONFIRMATION_PATH }),
    robots: { index: false, follow: false },
  }
}

async function LocalizedConfirmation({
  children,
  locale,
  type,
}: Readonly<{ children: ReactNode; locale: UiCopyLocale; type: LocalizedAuthConfirmationType }>) {
  const translate = await getTranslations('auth.languageSwitch')
  const alternateLocale = locale === 'de' ? 'en' : 'de'
  const alternatePath = localizedPatientAuthPath(AUTH_CONFIRMATION_PATH, alternateLocale)

  return (
    <PublicAuthRouteShell>
      <div className="w-full max-w-md">
        <nav aria-label={translate('label')} className="mb-2 flex justify-end">
          <Link
            className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            href={`${alternatePath}?type=${type}`}
            hrefLang={alternateLocale}
            lang={alternateLocale}
            prefetch={false}
          >
            {translate('alternate')}
          </Link>
        </nav>
        {children}
      </div>
    </PublicAuthRouteShell>
  )
}

export async function ConfirmAuthLinkPage({ locale, ...props }: ConfirmPageProps & { locale: UiCopyLocale }) {
  const type = await confirmationType(props, locale)
  if (type === 'recovery') {
    let csrf: string | null = null
    try {
      const environment = resolveTransactionalEmailEnvironment()
      const context = readWebsiteRecoveryContext(
        (await cookies()).get(WEBSITE_RECOVERY_COOKIE)?.value,
        environment,
        resolveRecoveryKeys(environment),
      )
      if (context?.stage === 'pending' || context?.stage === 'confirmed') csrf = context.csrf
    } catch {
      /* Missing authority shares the safe invalid-link state. */
    }
    const copy = await recoveryConfirmationCopy()
    return (
      <LocalizedConfirmation locale={locale} type={type}>
        <RecoveryConfirmationForm copy={copy} csrf={csrf} locale={locale} />
      </LocalizedConfirmation>
    )
  }
  if (type === 'patient-verification') {
    const copy = await patientVerificationCopy(locale)
    let csrf: string | null = null
    let inquiryContinuationPending = false
    try {
      const environment = resolveTransactionalEmailEnvironment()
      const keys = resolveVerificationKeys(environment)
      const context = readPatientVerificationContext(
        (await cookies()).get(PATIENT_VERIFICATION_COOKIE)?.value,
        environment,
        keys,
      )
      csrf = context?.csrf ?? null
      if (context?.stage === 'confirmed') {
        const authority = await patientVerificationAuthority()
        inquiryContinuationPending = (await authority.load(context.actionId, context)).action.state === 'completed'
      }
    } catch {
      /* Unavailable configuration shares the safe invalid-link state. */
    }
    return (
      <LocalizedConfirmation locale={locale} type={type}>
        <PatientVerificationForm copy={copy} csrf={csrf} inquiryContinuationPending={inquiryContinuationPending} />
      </LocalizedConfirmation>
    )
  }
  if (type !== 'invite') redirect('/auth/password/reset?reason=expired')
  return <ConfirmTokenHashForm type={type} />
}
