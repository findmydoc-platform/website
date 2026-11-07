import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { ResetPasswordCompleteForm } from './ResetPasswordCompleteForm'
import { PublicAuthRouteShell } from '@/app/(frontend)/_components/PublicAuthRouteShell'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { resolveTransactionalEmailEnvironment } from '@/features/transactionalEmail/environment'
import { resolveRecoveryKeys } from '@/auth/actions/recoveryConfiguration'
import { readWebsiteRecoveryContext, WEBSITE_RECOVERY_COOKIE } from '@/auth/actions/websiteRecoveryContext'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  ...createSiteMetadata({ title: 'Complete password recovery', path: '/auth/password/reset/complete' }),
  robots: { index: false, follow: false },
}
export default async function CompleteResetPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ inquiry?: string }> }>) {
  const { inquiry } = await searchParams
  let csrf: string | null = null
  let resume = false
  let inquiryContinuationPending = false
  try {
    const environment = resolveTransactionalEmailEnvironment()
    const context = readWebsiteRecoveryContext(
      (await cookies()).get(WEBSITE_RECOVERY_COOKIE)?.value,
      environment,
      resolveRecoveryKeys(environment),
    )
    if (context && context.stage !== 'pending') {
      csrf = context.csrf
      resume = context.stage !== 'confirmed'
      inquiryContinuationPending =
        inquiry === 'continue' && context.flow === 'patient-recovery' && context.stage === 'signed-out'
    }
  } catch {
    /* Missing authority shares the safe invalid-link state. */
  }
  return (
    <PublicAuthRouteShell>
      <ResetPasswordCompleteForm csrf={csrf} resume={resume} inquiryContinuationPending={inquiryContinuationPending} />
    </PublicAuthRouteShell>
  )
}
