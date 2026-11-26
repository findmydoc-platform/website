import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { ResetPasswordCompleteForm } from './ResetPasswordCompleteForm'
import { RecoveryCompletionShell } from './RecoveryCompletionShell.client'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { resolveTransactionalEmailEnvironment } from '@/features/transactionalEmail/environment'
import { resolveRecoveryKeys } from '@/auth/actions/recoveryConfiguration'
import { readWebsiteRecoveryContext, WEBSITE_RECOVERY_COOKIE } from '@/auth/actions/websiteRecoveryContext'
import { recoveryCompletionCopy, recoveryMetadataTitle } from '@/features/uiCopy/passwordRecovery'
import { localizedPatientAuthPath, RECOVERY_COMPLETION_PATH } from '@/i18n/patientAuthPath'
import { uiCopyLocaleFromHeaders } from '@/i18n/requestLocale'

export const dynamic = 'force-dynamic'
export async function generateMetadata(): Promise<Metadata> {
  const locale = uiCopyLocaleFromHeaders(await headers())
  return {
    ...createSiteMetadata({
      title: await recoveryMetadataTitle('completion'),
      path: localizedPatientAuthPath(RECOVERY_COMPLETION_PATH, locale),
    }),
    robots: { index: false, follow: false },
  }
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
  const [copy, requestHeaders] = await Promise.all([recoveryCompletionCopy(), headers()])
  const locale = uiCopyLocaleFromHeaders(requestHeaders)
  return (
    <RecoveryCompletionShell locale={locale}>
      <ResetPasswordCompleteForm
        copy={copy}
        csrf={csrf}
        locale={locale}
        resume={resume}
        inquiryContinuationPending={inquiryContinuationPending}
      />
    </RecoveryCompletionShell>
  )
}
