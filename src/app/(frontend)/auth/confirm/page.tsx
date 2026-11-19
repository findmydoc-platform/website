import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ConfirmTokenHashForm } from './ConfirmTokenHashForm'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { cookies, headers } from 'next/headers'
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
import { uiCopyLocaleFromHeaders } from '@/i18n/requestLocale'

export const dynamic = 'force-dynamic'

type ConfirmPageProps = Readonly<{ searchParams: Promise<Readonly<{ type?: string | string[] }>> }>

export async function generateMetadata({ searchParams }: ConfirmPageProps): Promise<Metadata> {
  const { type } = await searchParams
  let title = 'Confirm secure email link'
  if (type === 'recovery') title = await recoveryMetadataTitle('confirmation')
  if (type === 'patient-verification') title = await patientVerificationMetadataTitle()
  return {
    ...createSiteMetadata({ title, path: '/auth/confirm' }),
    robots: { index: false, follow: false },
  }
}

export default async function ConfirmTokenHashPage({ searchParams }: ConfirmPageProps) {
  const { type } = await searchParams
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
      <PublicAuthRouteShell>
        <RecoveryConfirmationForm copy={copy} csrf={csrf} />
      </PublicAuthRouteShell>
    )
  }
  if (type === 'patient-verification') {
    const copy = await patientVerificationCopy(uiCopyLocaleFromHeaders(await headers()))
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
      <PublicAuthRouteShell>
        <PatientVerificationForm copy={copy} csrf={csrf} inquiryContinuationPending={inquiryContinuationPending} />
      </PublicAuthRouteShell>
    )
  }
  if (type !== 'invite') redirect('/auth/password/reset?reason=expired')
  return <ConfirmTokenHashForm type={type} />
}
