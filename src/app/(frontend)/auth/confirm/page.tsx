import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ConfirmTokenHashForm } from './ConfirmTokenHashForm'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { cookies } from 'next/headers'
import { resolveTransactionalEmailEnvironment } from '@/features/transactionalEmail/environment'
import { resolveVerificationKeys } from '@/auth/actions/verificationConfiguration'
import { PATIENT_VERIFICATION_COOKIE, readPatientVerificationContext } from '@/auth/actions/patientVerificationContext'
import { PatientVerificationForm } from './PatientVerificationForm'
import { PublicAuthRouteShell } from '@/app/(frontend)/_components/PublicAuthRouteShell'
import { resolveRecoveryKeys } from '@/auth/actions/recoveryConfiguration'
import { readWebsiteRecoveryContext, WEBSITE_RECOVERY_COOKIE } from '@/auth/actions/websiteRecoveryContext'
import { RecoveryConfirmationForm } from './RecoveryConfirmationForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  ...createSiteMetadata({ title: 'Confirm secure email link', path: '/auth/confirm' }),
  robots: { index: false, follow: false },
}

export default async function ConfirmTokenHashPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Readonly<{ type?: string }>> }>) {
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
    return (
      <PublicAuthRouteShell>
        <RecoveryConfirmationForm csrf={csrf} />
      </PublicAuthRouteShell>
    )
  }
  if (type === 'patient-verification') {
    let csrf: string | null = null
    try {
      const environment = resolveTransactionalEmailEnvironment()
      const keys = resolveVerificationKeys(environment)
      const context = readPatientVerificationContext(
        (await cookies()).get(PATIENT_VERIFICATION_COOKIE)?.value,
        environment,
        keys,
      )
      csrf = context?.csrf ?? null
    } catch {
      /* Unavailable configuration shares the safe invalid-link state. */
    }
    return (
      <PublicAuthRouteShell>
        <PatientVerificationForm csrf={csrf} />
      </PublicAuthRouteShell>
    )
  }
  if (type !== 'invite') redirect('/auth/password/reset?reason=expired')
  return <ConfirmTokenHashForm type={type} />
}
